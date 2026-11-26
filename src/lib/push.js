import { createItem, deleteItem, getConfig, listByKind, mutateItem } from './api'
import { myName } from './chat'

/*
 * Notificaciones push del chat (llegan aunque la página esté cerrada).
 *
 *  - Cada dispositivo que las activa guarda su suscripción en la Mock API como
 *      pushSub -> { author, endpoint, keys: { p256dh, auth }, date }
 *  - Al enviar un mensaje se llama a la función de Netlify `notify` solo con el id
 *    del mensaje; la función lo lee de la Mock API y avisa a las suscripciones de
 *    la otra persona (author distinto). Ver netlify/functions/notify.mjs.
 *  - Requiere modo remoto (Mock API) y la variable VITE_VAPID_PUBLIC_KEY.
 */

const PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim()
const NOTIFY_URL = '/.netlify/functions/notify'

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/*
 * La función de Netlify solo lee la Mock API de sus variables de entorno: si en Ajustes
 * se configuró otra URL o recurso, los avisos no llegarían, así que no se ofrecen.
 */
function usesDefaultApi() {
  const { url, resource, mode } = getConfig()
  const envUrl = (import.meta.env.VITE_MOCKAPI_URL || '').trim().replace(/\/+$/, '')
  const envRes = (import.meta.env.VITE_MOCKAPI_RESOURCE || 'recuerdos').trim()
  return mode === 'remote' && !!envUrl && url === envUrl && resource === envRes
}

/* ¿Se puede ofrecer el botón en este navegador y con esta configuración? */
export const pushAvailable = () => pushSupported() && !!PUBLIC_KEY && usesDefaultApi()

function keyToBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const register = () => navigator.serviceWorker.register('/sw.js')

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

/* Registros pushSub de este dispositivo (puede haber duplicados si se activó dos veces a la vez) */
async function recordsOf(endpoint) {
  const list = await listByKind('pushSub')
  return list.filter((s) => s.endpoint === endpoint)
}

/* ¿La suscripción se creó con la clave VAPID actual? (si la clave cambió, hay que renovarla) */
function sameKey(sub) {
  const key = sub.options?.applicationServerKey
  if (!key) return true
  const a = new Uint8Array(key)
  const b = keyToBytes(PUBLIC_KEY)
  return a.length === b.length && a.every((x, i) => x === b[i])
}

/* Suscripción válida de este dispositivo (renueva la que tenga una clave vieja) */
async function subscribe(reg) {
  let sub = await reg.pushManager.getSubscription()
  if (sub && !sameKey(sub)) {
    await sub.unsubscribe().catch(() => {})
    sub = null
  }
  return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(PUBLIC_KEY) })
}

/* Crea o actualiza el registro pushSub de esta suscripción (y borra duplicados) */
async function saveSubscription(sub, author) {
  const { endpoint, keys } = sub.toJSON()
  const [first, ...extra] = await recordsOf(endpoint)
  if (first) {
    if (first.author !== author || first.keys?.p256dh !== keys.p256dh || first.keys?.auth !== keys.auth)
      await mutateItem(first.id, (x) => ({ ...x, author, keys, date: Date.now() }))
  } else {
    await createItem('pushSub', { author, endpoint, keys })
  }
  await Promise.allSettled(extra.map((s) => deleteItem(s.id)))
}

/*
 * 'on' | 'off' | 'denied' | 'unavailable'
 * Con permiso concedido también sincroniza: si el navegador renovó la suscripción o su
 * registro se borró en la Mock API (p. ej. tras un 410), se vuelve a guardar. Así "on"
 * significa que de verdad le llegarán los avisos.
 */
export async function pushStatus() {
  if (!pushAvailable()) return 'unavailable'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  try {
    // Se vuelve a registrar: así el service worker se actualiza solo
    const reg = await register()
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return 'off'
    const author = myName()
    if (!author) return 'off'
    await saveSubscription(sameKey(sub) ? sub : await subscribe(reg), author)
    return 'on'
  } catch {
    return 'off'
  }
}

/* Pide permiso, suscribe este dispositivo y lo guarda a nombre de `author` */
export async function enablePush(author) {
  if (!pushAvailable()) throw new Error('Las notificaciones no están disponibles en este navegador.')
  if (!author) throw new Error('Primero escribe tu nombre en el chat.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') {
    throw new Error(perm === 'denied'
      ? 'Bloqueaste las notificaciones. Actívalas en los ajustes del sitio (candado junto a la dirección) y vuelve a intentarlo.'
      : 'No se concedió el permiso para notificaciones.')
  }
  await register()
  const reg = await navigator.serviceWorker.ready
  const sub = await subscribe(reg)
  try {
    await saveSubscription(sub, author)
  } catch (e) {
    // Sin registro en la Mock API no llegarían avisos: se deshace para no mostrar "activado"
    await sub.unsubscribe().catch(() => {})
    throw e
  }
}

/* Da de baja este dispositivo */
export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  const { endpoint } = sub.toJSON()
  await sub.unsubscribe().catch(() => {})
  const recs = await recordsOf(endpoint)
  await Promise.allSettled(recs.map((s) => deleteItem(s.id)))
}

/* Si cambia el nombre en el chat, la suscripción pasa a ese nombre (sin pedir permiso) */
export async function renamePush(author) {
  if (!author || !pushAvailable() || Notification.permission !== 'granted') return
  const sub = await currentSubscription()
  if (!sub) return
  const recs = await recordsOf(sub.toJSON().endpoint)
  await Promise.allSettled(recs.map((s) => mutateItem(s.id, (x) => ({ ...x, author }))))
}

/* Avisa a la otra persona de un mensaje ya guardado. Nunca lanza: el aviso es opcional. */
export function notifyPartner(messageId) {
  if (!messageId || getConfig().mode !== 'remote') return
  fetch(NOTIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: messageId }),
    keepalive: true,
  }).catch(() => { /* sin función (npm run dev) o sin red: el mensaje igual quedó guardado */ })
}
