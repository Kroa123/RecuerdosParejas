import { sendNotification, setVapidDetails } from 'web-push'

/*
 * POST /.netlify/functions/notify   body: { id }
 *
 * Envía una notificación push a la otra persona cuando se escribe en el chat.
 * Solo recibe el id del mensaje: lo lee de la Mock API, comprueba que sea un mensaje
 * reciente y no avisado, y usa SU texto y autor (no acepta texto suelto). Cada mensaje
 * avisa una sola vez (campo `notified`). No es una protección completa: quien conozca la
 * URL pública de la Mock API podría crear mensajes; evitarlo requeriría autenticación.
 *
 * Variables de entorno (Netlify → Site settings → Environment variables):
 *   VITE_MOCKAPI_URL, VITE_MOCKAPI_RESOURCE   (las mismas que usa la página)
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY       (par de claves VAPID)
 *   VAPID_SUBJECT (opcional)                  mailto: o https:; por defecto la URL del sitio
 */

const MAX_AGE_MS = 15 * 60 * 1000 // solo mensajes recientes (margen para relojes desfasados)

const reply = (status, body) => Response.json(body, { status })
const sameName = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()

async function getJson(url) {
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Mock API respondió ${res.status}`)
  return res.json()
}

function preview(msg) {
  const text = (msg.text || '').trim()
  if (text) return text.length > 140 ? `${text.slice(0, 137)}…` : text
  return msg.image ? '📷 Te envió una foto' : 'Te escribió en el chat'
}

export default async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'Método no permitido' })

  const base = (process.env.VITE_MOCKAPI_URL || '').trim().replace(/\/+$/, '')
  const resource = (process.env.VITE_MOCKAPI_RESOURCE || 'recuerdos').trim()
  const publicKey = (process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '').trim()
  const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim()
  if (!base || !publicKey || !privateKey) return reply(500, { error: 'Faltan variables de entorno de push' })

  let id
  try {
    ({ id } = await req.json())
  } catch {
    return reply(400, { error: 'Cuerpo inválido' })
  }
  if (!/^[\w-]{1,40}$/.test(String(id || ''))) return reply(400, { error: 'id inválido' })

  try {
    const msg = await getJson(`${base}/${resource}/${encodeURIComponent(id)}`)
    if (!msg || msg.kind !== 'message') return reply(404, { error: 'Mensaje no encontrado' })
    if (Math.abs(Date.now() - Number(msg.date || 0)) > MAX_AGE_MS) return reply(409, { error: 'Mensaje antiguo' })
    if (msg.notified) return reply(409, { error: 'Mensaje ya avisado' })

    // Se marca ANTES de enviar: una segunda llamada con el mismo id ya no vuelve a avisar
    const msgUrl = `${base}/${resource}/${encodeURIComponent(id)}`
    const marked = await fetch(msgUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...msg, notified: true }),
    })
    if (!marked.ok) throw new Error(`Mock API respondió ${marked.status}`)

    // MockAPI responde 404 cuando el filtro no encuentra nada
    const subs = (await getJson(`${base}/${resource}?kind=pushSub`)) || []
    const author = (msg.author || '').trim()
    const targets = (Array.isArray(subs) ? subs : [])
      .filter((s) => s.kind === 'pushSub' && s.endpoint && s.keys?.p256dh && s.keys?.auth)
      .filter((s) => !sameName(s.author, author))
    if (!targets.length) return reply(200, { sent: 0, removed: 0 })

    setVapidDetails(process.env.VAPID_SUBJECT || process.env.URL || 'mailto:avisos@example.com', publicKey, privateKey)
    const topic = (msg.topic || '').trim()
    const payload = JSON.stringify({
      title: author ? `💌 ${author}` : '💌 Nuevo mensaje',
      body: topic && topic !== 'General' ? `[${topic}] ${preview(msg)}` : preview(msg),
      url: '/chat',
      tag: `chat-${msg.id}`,
    })

    let sent = 0
    let removed = 0
    await Promise.allSettled(targets.map(async (s) => {
      try {
        await sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 60 * 60 * 24, urgency: 'high' })
        sent++
      } catch (e) {
        // 404/410: la suscripción ya no existe (se desinstaló o se revocó el permiso) → se borra
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await fetch(`${base}/${resource}/${encodeURIComponent(s.id)}`, { method: 'DELETE' }).catch(() => {})
          removed++
        }
      }
    }))
    return reply(200, { sent, removed })
  } catch (e) {
    return reply(502, { error: e.message || 'Error al enviar' })
  }
}
