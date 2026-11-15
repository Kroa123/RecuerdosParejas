/*
 * Capa de datos.
 *  - Si hay una URL de Mock API (variable VITE_MOCKAPI_URL o configurada desde el
 *    engranaje ⚙ de la página), se usa esa API REST (MockAPI.io o json-server).
 *  - Si no, todo se guarda en este navegador (IndexedDB), para que funcione al instante.
 *
 * Todo vive en UN solo recurso (por defecto "recuerdos") con un campo `kind`:
 *   post  -> publicación de la vista Recuerdos  { text, media:[{type,src}], comments:[], likes, date }
 *   photo -> foto de una categoría (lugar)      { category, title, src, date }
 *   video -> video de una categoría (lugar)     { category, title, src, date }
 *   info  -> texto de la vista Información      { title, message, signature }
 * Así basta con crear un único recurso en MockAPI (el plan gratis limita recursos).
 */

const LS_URL = 'recuerdos.apiUrl'
const LS_RES = 'recuerdos.apiResource'

function safeGet(k) {
  try { return localStorage.getItem(k) } catch { return null }
}
function safeSet(k, v) {
  try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k) } catch { /* sin storage */ }
}

export function getConfig() {
  const url = (safeGet(LS_URL) ?? import.meta.env.VITE_MOCKAPI_URL ?? '').trim().replace(/\/+$/, '')
  const resource = (safeGet(LS_RES) || import.meta.env.VITE_MOCKAPI_RESOURCE || 'recuerdos').trim()
  return { url, resource, mode: url ? 'remote' : 'local' }
}

export function setConfig({ url, resource }) {
  safeSet(LS_URL, url === undefined ? null : url.trim())
  safeSet(LS_RES, resource ? resource.trim() : null)
}

export function resetConfig() {
  safeSet(LS_URL, null)
  safeSet(LS_RES, null)
}

/* ---------------- Remoto (MockAPI / json-server) ---------------- */

async function http(path, opts = {}) {
  const { url, resource } = getConfig()
  const res = await fetch(`${url}/${resource}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) {
    let hint = ''
    if (res.status === 413 || res.status === 400 || res.status === 500)
      hint = ' (posiblemente el archivo es demasiado grande para la Mock API; usa un enlace o una imagen más liviana)'
    if (res.status === 404 && path === '') hint = ` (¿creaste el recurso "${resource}" en MockAPI?)`
    throw new Error(`Error ${res.status} de la API${hint}`)
  }
  return res.status === 204 ? null : res.json()
}

const remote = {
  list: () => http(''),
  create: (data) => http('', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => http(`/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => http(`/${id}`, { method: 'DELETE' }),
}

/* ---------------- Local (IndexedDB) ---------------- */

const DB_NAME = 'recuerdos-amor'
const STORE = 'items'
let dbPromise

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

async function tx(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const store = t.objectStore(STORE)
    const out = fn(store)
    t.oncomplete = () => resolve(out?.result ?? out)
    t.onerror = () => reject(t.error)
  })
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

const local = {
  list: () => tx('readonly', (s) => s.getAll()),
  create: async (data) => {
    const item = { ...data, id: uid() }
    await tx('readwrite', (s) => s.put(item))
    return item
  },
  update: async (id, data) => {
    const item = { ...data, id }
    await tx('readwrite', (s) => s.put(item))
    return item
  },
  remove: (id) => tx('readwrite', (s) => s.delete(id)),
}

const backend = () => (getConfig().mode === 'remote' ? remote : local)

/* ---------------- API pública ---------------- */

export async function listItems(kind) {
  const all = (await backend().list()) || []
  return all
    .filter((i) => !kind || i.kind === kind)
    .sort((a, b) => (b.date || 0) - (a.date || 0))
}
export const createItem = (kind, data) => backend().create({ kind, date: Date.now(), ...data })
export const updateItem = (item) => backend().update(item.id, item)
export const deleteItem = (id) => backend().remove(id)

/* Exporta / importa todo (útil para pasar de local a la Mock API) */
export async function exportAll() {
  return backend().list()
}
export async function importAll(items) {
  for (const { id: _id, ...rest } of items) await backend().create(rest)
}
