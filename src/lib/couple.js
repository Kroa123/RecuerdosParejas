/*
 * Datos de la pareja: nombres (M y D) y fecha en que empezaron.
 * Se guardan en la Mock API como { kind: 'couple', names: { M, D }, since }
 * (El nombre con el que firma cada persona vive en src/lib/chat.js: clave recuerdos.author.)
 */
import { createItem, listByKind, updateItem } from './api'

export const DEFAULT_COUPLE = { names: { M: 'Maryori', D: 'D' }, since: null }
const CACHE_KEY = 'recuerdos.couple'

export function cachedCouple() {
  try { return { ...DEFAULT_COUPLE, ...JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') } } catch { return DEFAULT_COUPLE }
}

export async function loadCouple() {
  const [c] = await listByKind('couple')
  const out = c ? { ...DEFAULT_COUPLE, ...c, names: { ...DEFAULT_COUPLE.names, ...(c.names || {}) } } : cachedCouple()
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(out)) } catch { /* nada */ }
  return out
}

export async function saveCouple(couple) {
  const data = { names: couple.names, since: couple.since || null }
  const saved = couple.id ? await updateItem({ ...couple, ...data }) : await createItem('couple', data)
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(saved)) } catch { /* nada */ }
  return saved
}

export function daysTogether(since) {
  if (!since) return null
  return Math.max(0, Math.floor((Date.now() - since) / 86400000))
}
