/*
 * Identidad y estado de lectura del chat (sin UI).
 * Lo usan pages/Chat.jsx, App.jsx (aviso de mensajes nuevos) y los comentarios de Recuerdos.
 *
 *   recuerdos.author          -> nombre con el que firma esta persona (chat y comentarios)
 *   recuerdos.chatSeen        -> marca de tiempo de la última vez que se abrió el chat
 *   recuerdos.chatSeenTopics  -> { [tema]: marca de tiempo } leído por pestaña
 *   recuerdos.nudgeAt         -> marca de tiempo del último "Pensando en ti" enviado desde este dispositivo
 *
 * También: "Pensando en ti" (message con type 'nudge'), reacciones con emojis y el indicador "escribiendo…".
 */

const AUTHOR_KEY = 'recuerdos.author'
const SEEN_KEY = 'recuerdos.chatSeen'
const TOPIC_SEEN_KEY = 'recuerdos.chatSeenTopics'
const NUDGE_KEY = 'recuerdos.nudgeAt'

export const GENERAL = 'General'

export const myName = () => { try { return localStorage.getItem(AUTHOR_KEY) || '' } catch { return '' } }
export const saveMyName = (n) => { try { localStorage.setItem(AUTHOR_KEY, n) } catch { /* sin storage */ } }

export const markChatSeen = () => { try { localStorage.setItem(SEEN_KEY, String(Date.now())) } catch { /* sin storage */ } }
export const chatSeenAt = () => { try { return Number(localStorage.getItem(SEEN_KEY) || 0) } catch { return 0 } }

export const readTopicSeen = () => { try { return JSON.parse(localStorage.getItem(TOPIC_SEEN_KEY) || '{}') || {} } catch { return {} } }
export const writeTopicSeen = (m) => { try { localStorage.setItem(TOPIC_SEEN_KEY, JSON.stringify(m)) } catch { /* sin storage */ } }

/* Los mensajes antiguos sin tema van a General */
export const topicOf = (m) => (m.topic || '').trim() || GENERAL

/* Mensajes nuevos traen `author`; los antiguos solo `from` ('M' | 'D'), que se traduce con los nombres de la pareja */
export const authorOf = (m, couple) => m.author || couple?.names?.[m.from] || m.from || 'Anónimo'

/* Formato de fechas del chat */
export const dayKey = (ts) => new Date(ts).toDateString()
export function dayLabel(ts) {
  const d = new Date(ts)
  const today = new Date()
  const y = new Date(); y.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Hoy'
  if (d.toDateString() === y.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
}
export const timeOf = (ts) => new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
export const initial = (name) => (name || '?').trim().charAt(0).toUpperCase()

/* Compara nombres sin importar mayúsculas ni espacios */
export const sameName = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()

/* ---------- "Pensando en ti" ---------- */
export const NUDGE_TEXT = '💗 Pensando en ti'
export const NUDGE_COOLDOWN_MS = 30 * 1000
export const isNudge = (m) => m?.type === 'nudge'

/* Milisegundos que faltan para poder enviar otro desde este dispositivo (0 = ya se puede) */
export const nudgeWait = () => {
  try {
    const last = Number(localStorage.getItem(NUDGE_KEY) || 0)
    return Math.max(0, last + NUDGE_COOLDOWN_MS - Date.now())
  } catch { return 0 }
}
export const markNudge = (ts = Date.now()) => { try { localStorage.setItem(NUDGE_KEY, String(ts)) } catch { /* sin storage */ } }
export const clearNudge = () => { try { localStorage.removeItem(NUDGE_KEY) } catch { /* sin storage */ } }

/* ---------- Reacciones ---------- */
/* El ❤️ usa el array `hearts` (compatibilidad con mensajes antiguos); el resto va en `reactions` */
export const HEART_EMOJI = '❤️'
export const REACTIONS = [HEART_EMOJI, '😂', '😮', '😢', '😍', '👍']

/* Lista [{ emoji, names }] con las reacciones que tienen al menos un nombre, en el orden de REACTIONS */
export function reactionsOf(m) {
  const out = []
  const extra = m?.reactions && typeof m.reactions === 'object' ? m.reactions : {}
  for (const emoji of REACTIONS) {
    const names = emoji === HEART_EMOJI ? m?.hearts || [] : Array.isArray(extra[emoji]) ? extra[emoji] : []
    if (names.length) out.push({ emoji, names })
  }
  return out
}

const asList = (v) => (Array.isArray(v) ? v : [])

export const hasReaction = (m, emoji, name) =>
  asList(emoji === HEART_EMOJI ? m?.hearts : m?.reactions?.[emoji]).includes(name)

/* Pone o quita la reacción de `name` (función pura: devuelve un mensaje nuevo o el mismo si no cambia) */
export function withReaction(m, emoji, name, on) {
  if (emoji === HEART_EMOJI) {
    const hearts = m.hearts || []
    if (on) return hearts.includes(name) ? m : { ...m, hearts: [...hearts, name] }
    return hearts.includes(name) ? { ...m, hearts: hearts.filter((h) => h !== name) } : m
  }
  const all = m.reactions && typeof m.reactions === 'object' ? m.reactions : {}
  const names = Array.isArray(all[emoji]) ? all[emoji] : []
  if (on === names.includes(name)) return m
  const next = on ? [...names, name] : names.filter((n) => n !== name)
  const reactions = { ...all }
  if (next.length) reactions[emoji] = next
  else delete reactions[emoji]
  return { ...m, reactions }
}

/* ---------- "Escribiendo…" ---------- */
export const TYPING_TTL_MS = 7000 // se muestra si el registro cambió hace menos de esto
export const TYPING_THROTTLE_MS = 3000 // como mucho una escritura cada 3 s

export function typingLabel(names) {
  if (!names.length) return ''
  if (names.length === 1) return `${names[0]} está escribiendo…`
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]} están escribiendo…`
}
