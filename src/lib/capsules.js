/*
 * Cápsulas del tiempo (sin React).
 *   { kind: 'capsule', author, title, text, image?, openAt, date, notified? }
 * Una cápsula está bloqueada hasta `openAt`; la función programada netlify/functions/daily.mjs
 * avisa por push cuando se abre (y marca `notified`).
 */

const SEEN_KEY = 'recuerdos.capsulesSeen'

/* openAt como número seguro (un dato raro no debe mostrar NaN) */
export const openAtOf = (c) => (Number.isFinite(Number(c?.openAt)) ? Number(c.openAt) : 0)

export const isOpen = (c, now = Date.now()) => openAtOf(c) <= now

/* Próximas a abrir primero (la más cercana arriba); después las abiertas, de la más reciente a la más antigua */
export function sortCapsules(list, now = Date.now()) {
  const locked = list.filter((c) => !isOpen(c, now)).sort((a, b) => openAtOf(a) - openAtOf(b))
  const opened = list.filter((c) => isOpen(c, now)).sort((a, b) => openAtOf(b) - openAtOf(a))
  return [...locked, ...opened]
}

/* Cuenta regresiva legible: "3 d 4 h 12 min" o, si falta menos de un día, "4 h 12 min 05 s" */
export function countdown(ms) {
  const s = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d} d ${h} h ${m} min`
  if (h > 0) return `${h} h ${m} min ${String(sec).padStart(2, '0')} s`
  return `${m} min ${String(sec).padStart(2, '0')} s`
}

/* Valor para <input type="datetime-local"> en hora local */
const pad2 = (n) => String(n).padStart(2, '0')
export function toDateTimeInput(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/* Cápsulas ya vistas abiertas en este dispositivo (para animar la apertura solo la primera vez) */
export function seenCapsules() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')) } catch { return new Set() }
}
export function markCapsuleSeen(id) {
  try {
    const s = seenCapsules()
    s.add(String(id))
    localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-300)))
  } catch { /* sin storage */ }
}
