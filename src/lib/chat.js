/*
 * Identidad y estado de lectura del chat (sin UI).
 * Lo usan pages/Chat.jsx, App.jsx (aviso de mensajes nuevos) y los comentarios de Recuerdos.
 *
 *   recuerdos.author          -> nombre con el que firma esta persona (chat y comentarios)
 *   recuerdos.chatSeen        -> marca de tiempo de la última vez que se abrió el chat
 *   recuerdos.chatSeenTopics  -> { [tema]: marca de tiempo } leído por pestaña
 */

const AUTHOR_KEY = 'recuerdos.author'
const SEEN_KEY = 'recuerdos.chatSeen'
const TOPIC_SEEN_KEY = 'recuerdos.chatSeenTopics'

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
