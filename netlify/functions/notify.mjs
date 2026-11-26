import { configureVapid, getJson, listSubs, pushEnv, sendToSubs } from '../lib/send-push.mjs'

/*
 * POST /.netlify/functions/notify   body: { id }
 *
 * Envía una notificación push a la otra persona cuando se escribe en el chat.
 * Solo recibe el id del mensaje: lo lee de la Mock API, comprueba que sea un mensaje
 * reciente y no avisado, y usa SU texto y autor (no acepta texto suelto). Cada mensaje
 * avisa una sola vez (campo `notified`). Los "Pensando en ti" (type 'nudge') usan un texto propio.
 * No es una protección completa: quien conozca la
 * URL pública de la Mock API podría crear mensajes; evitarlo requeriría autenticación.
 *
 * Variables de entorno: ver netlify/lib/send-push.mjs.
 */

const MAX_AGE_MS = 15 * 60 * 1000 // solo mensajes recientes (margen para relojes desfasados)

const reply = (status, body) => Response.json(body, { status })
const sameName = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()

function preview(msg) {
  const text = (msg.text || '').trim()
  if (text) return text.length > 140 ? `${text.slice(0, 137)}…` : text
  return msg.image ? '📷 Te envió una foto' : 'Te escribió en el chat'
}

export default async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'Método no permitido' })

  const env = pushEnv()
  const { base, resource } = env
  if (!base || !env.publicKey || !env.privateKey) return reply(500, { error: 'Faltan variables de entorno de push' })

  let id
  try {
    ({ id } = await req.json())
  } catch {
    return reply(400, { error: 'Cuerpo inválido' })
  }
  if (!/^[\w-]{1,40}$/.test(String(id || ''))) return reply(400, { error: 'id inválido' })

  try {
    const msgUrl = `${base}/${resource}/${encodeURIComponent(id)}`
    const msg = await getJson(msgUrl)
    if (!msg || msg.kind !== 'message') return reply(404, { error: 'Mensaje no encontrado' })
    if (Math.abs(Date.now() - Number(msg.date || 0)) > MAX_AGE_MS) return reply(409, { error: 'Mensaje antiguo' })
    if (msg.notified) return reply(409, { error: 'Mensaje ya avisado' })

    // Se marca ANTES de enviar: una segunda llamada con el mismo id ya no vuelve a avisar.
    // (Entre la lectura y el PUT pasan milisegundos; un corazón puesto justo ahí podría perderse.)
    const marked = await fetch(msgUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...msg, notified: true }),
    })
    if (!marked.ok) throw new Error(`Mock API respondió ${marked.status}`)

    const author = (msg.author || '').trim()
    const targets = (await listSubs(env)).filter((s) => !sameName(s.author, author))
    if (!targets.length) return reply(200, { sent: 0, removed: 0 })

    configureVapid(env)
    const topic = (msg.topic || '').trim()
    // "Pensando en ti" (type 'nudge'): título propio y cuerpo corto
    const nudge = msg.type === 'nudge'
    const payload = {
      title: nudge ? `💗 ${author || 'Tu amor'} está pensando en ti` : author ? `💌 ${author}` : '💌 Nuevo mensaje',
      body: nudge ? 'Toca para responderle 💌' : topic && topic !== 'General' ? `[${topic}] ${preview(msg)}` : preview(msg),
      url: '/chat',
      tag: `chat-${msg.id}`,
    }
    return reply(200, await sendToSubs(targets, payload, env))
  } catch (e) {
    return reply(502, { error: e.message || 'Error al enviar' })
  }
}
