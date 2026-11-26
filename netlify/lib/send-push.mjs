import { sendNotification, setVapidDetails } from 'web-push'

/*
 * Ayudas compartidas para las funciones de Netlify que envían notificaciones push.
 * Las usan notify.mjs (mensajes del chat) y daily.mjs (cápsulas y pregunta del día).
 *
 * Variables de entorno:
 *   VITE_MOCKAPI_URL, VITE_MOCKAPI_RESOURCE   (las mismas que usa la página)
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY       (par de claves VAPID)
 *   VAPID_SUBJECT (opcional)                  mailto: o https:; por defecto la URL del sitio
 */

/* Configuración de la Mock API y de VAPID leída del entorno */
export function pushEnv() {
  return {
    base: (process.env.VITE_MOCKAPI_URL || '').trim().replace(/\/+$/, ''),
    resource: (process.env.VITE_MOCKAPI_RESOURCE || 'recuerdos').trim(),
    publicKey: (process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '').trim(),
    privateKey: (process.env.VAPID_PRIVATE_KEY || '').trim(),
    subject: process.env.VAPID_SUBJECT || process.env.URL || 'mailto:avisos@example.com',
  }
}

/* GET JSON de la Mock API; 404 -> null (MockAPI responde 404 cuando un filtro no encuentra nada) */
export async function getJson(url) {
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Mock API respondió ${res.status}`)
  return res.json()
}

/* Lista de un kind (siempre un array) */
export async function listKind({ base, resource }, kind) {
  const list = await getJson(`${base}/${resource}?kind=${encodeURIComponent(kind)}`)
  return (Array.isArray(list) ? list : []).filter((i) => i.kind === kind)
}

/* Suscripciones válidas guardadas en la Mock API */
export async function listSubs(cfg) {
  return (await listKind(cfg, 'pushSub')).filter((s) => s.endpoint && s.keys?.p256dh && s.keys?.auth)
}

let vapidReady = false
export function configureVapid({ subject, publicKey, privateKey }) {
  if (vapidReady) return
  setVapidDetails(subject, publicKey, privateKey)
  vapidReady = true
}

/*
 * Envía `payload` (objeto o cadena) a cada suscripción.
 * Las que responden 404/410 ya no existen (app desinstalada o permiso revocado) y se borran.
 * Devuelve { sent, removed }.
 */
export async function sendToSubs(subs, payload, { base, resource, options = {} }) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
  let sent = 0
  let removed = 0
  await Promise.allSettled((subs || []).map(async (s) => {
    try {
      await sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: 60 * 60 * 24, urgency: 'high', ...options })
      sent++
    } catch (e) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        if (s.id) await fetch(`${base}/${resource}/${encodeURIComponent(s.id)}`, { method: 'DELETE' }).catch(() => {})
        removed++
      }
    }
  }))
  return { sent, removed }
}
