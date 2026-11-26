/*
 * Capa de datos.
 *  - Si hay una URL de Mock API (variable VITE_MOCKAPI_URL o configurada desde el
 *    engranaje ⚙ de la página), se usa esa API REST (MockAPI.io o json-server).
 *  - Si no, todo se guarda en este navegador (IndexedDB), para que funcione al instante.
 *  - Si en Ajustes se guarda la URL vacía, se fuerza el modo local aunque exista
 *    VITE_MOCKAPI_URL ("Usar valor por defecto" vuelve a lo que diga la variable).
 *
 * Todo vive en UN solo recurso (por defecto "recuerdos") con un campo `kind`:
 *   post  -> publicación de la vista Recuerdos  { text, media:[{type,src}], comments:[], likes, date }
 *   photo -> foto de una categoría (lugar)      { category, title, src, date }
 *   video -> video de una categoría (lugar)     { category, title, src, date }
 *   info  -> texto de la vista Información      { title, message, signature }
 *   category -> categoría / lugar               { scope: 'photo' | 'video' | 'post', name, description, lat?, lng?, date }
 *   message -> mensaje del chat                  { topic, author, text, image?, hearts?: [], reactions?: { emoji: [nombres] },
 *                                                  type?: 'nudge' ("Pensando en ti"), notified?, date } (antiguos: from 'M' | 'D')
 *   typing  -> "escribiendo…" (uno por autor)    { author, at } (at = ms o 0; ver hooks/useTyping.js)
 *   capsule -> cápsula del tiempo                { author, title, text, image?, openAt, date, notified? }
 *   answer  -> respuesta a la pregunta del día    { key: 'YYYY-MM-DD' (día en Lima), author, text, date, edited? }
 *   dailyLog -> avisos diarios ya enviados       { key: 'YYYY-MM-DD', date } (lo crea netlify/functions/daily.mjs)
 *   chatTopic -> tema del chat                   { name, date }
 *   couple  -> datos de la pareja                { names: { M, D }, since }
 *   pushSub -> suscripción a notificaciones      { author, endpoint, keys: { p256dh, auth }, date } (ver lib/push.js)
 * Así basta con crear un único recurso en MockAPI (el plan gratis limita recursos).
 *
 * API pública:
 *   listItems(kind?)          -> todos (o de un tipo), ordenados por fecha descendente
 *   listByKind(kind)          -> solo un tipo (filtrado en la API), sin ordenar
 *   createItem(kind, data)    -> crea (añade kind y date)
 *   updateItem(item)          -> reemplaza el registro completo (PUT)
 *   deleteItem(id)
 *   mutateItem(id, mutator)   -> lee la versión MÁS RECIENTE del registro, aplica
 *                                `next = mutator(copia)` (debe devolver el objeto completo),
 *                                lo guarda y devuelve lo guardado. Si no existe, lanza Error.
 *                                Úsalo para cambios concurrentes (likes, comentarios, corazones).
 *                                Las mutaciones del mismo id se ejecutan en cola.
 *   runAll(list, fn, limit=4) -> fn sobre cada elemento con concurrencia limitada (resultados allSettled)
 *   testConnection(url, resource) -> prueba una Mock API sin guardar la configuración
 *   exportAll() / importAll(items) -> respaldo (ver detalles en importAll)
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
  // Una cadena vacía guardada significa "modo local forzado" (no cae en la variable de entorno)
  const url = (safeGet(LS_URL) ?? import.meta.env.VITE_MOCKAPI_URL ?? '').trim().replace(/\/+$/, '')
  const resource = (safeGet(LS_RES) || import.meta.env.VITE_MOCKAPI_RESOURCE || 'recuerdos').trim()
  return { url, resource, mode: url ? 'remote' : 'local' }
}

export function setConfig({ url, resource }) {
  if (url === undefined) safeSet(LS_URL, null)
  else {
    // Se guarda aunque esté vacía: así vaciar la URL en Ajustes fuerza el modo local
    try { localStorage.setItem(LS_URL, url.trim()) } catch { /* sin storage */ }
  }
  safeSet(LS_RES, resource ? resource.trim() : null)
}

export function resetConfig() {
  safeSet(LS_URL, null)
  safeSet(LS_RES, null)
}

/* ---------------- Remoto (MockAPI / json-server) ---------------- */

async function http(path, opts = {}) {
  const { url, resource } = getConfig()
  let res
  try {
    res = await fetch(`${url}/${resource}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    })
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    // fetch lanza TypeError ("Failed to fetch") cuando no hay red, la URL no existe o CORS falla
    throw new Error('Sin conexión con la Mock API. Revisa tu internet o la URL en Ajustes (⚙).')
  }
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
  get: async (id) => {
    try {
      return await http(`/${encodeURIComponent(id)}`)
    } catch (e) {
      if (/Error 404/.test(e.message)) return null
      throw e
    }
  },
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
      req.onerror = () => { dbPromise = null; reject(req.error || new Error('No se pudo abrir el almacenamiento local')) }
    })
  }
  return dbPromise
}

async function tx(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    let t
    try {
      t = db.transaction(STORE, mode)
    } catch (e) {
      reject(e)
      return
    }
    const store = t.objectStore(STORE)
    const out = fn(store)
    t.oncomplete = () => resolve(out instanceof IDBRequest ? out.result : out)
    t.onerror = () => reject(t.error || new Error('Error del almacenamiento local'))
    // onabort salta, por ejemplo, cuando se llena la cuota del navegador
    t.onabort = () =>
      reject(t.error || new Error('No se pudo guardar en este navegador (¿espacio lleno?). Libera espacio o usa la Mock API.'))
  })
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

const local = {
  list: () => tx('readonly', (s) => s.getAll()),
  get: async (id) => (await tx('readonly', (s) => s.get(id))) ?? null,
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

/* Orden por fecha descendente (lo más reciente primero) */
export const byDateDesc = (a, b) => (b.date || 0) - (a.date || 0)

export async function listItems(kind) {
  const all = (await backend().list()) || []
  return all
    .filter((i) => !kind || i.kind === kind)
    .sort(byDateDesc)
}
export const createItem = (kind, data) => backend().create({ kind, date: Date.now(), ...data })
export const updateItem = (item) => backend().update(item.id, item)
export const deleteItem = (id) => backend().remove(id)

/*
 * Lee la versión más reciente del registro, aplica el cambio y lo guarda.
 * mutator recibe una COPIA del registro actual y debe devolver el objeto completo.
 * Las mutaciones del mismo id se encolan: la segunda lee lo que guardó la primera,
 * así dos likes o corazones rápidos no se pisan entre sí.
 */
const mutationQueue = new Map() // id -> promesa de la última mutación encolada

async function runMutation(id, mutator) {
  const b = backend()
  const current = await b.get(id)
  if (!current) throw new Error('Este elemento ya no existe (puede que lo hayan eliminado).')
  const copy = JSON.parse(JSON.stringify(current))
  const next = await mutator(copy)
  if (!next || typeof next !== 'object') throw new Error('No se pudo aplicar el cambio.')
  return b.update(id, { ...next, id })
}

export function mutateItem(id, mutator) {
  const key = String(id)
  const prev = mutationQueue.get(key) || Promise.resolve()
  // Un fallo anterior no bloquea la cola
  const run = prev.catch(() => {}).then(() => runMutation(id, mutator))
  mutationQueue.set(key, run)
  const cleanup = () => { if (mutationQueue.get(key) === run) mutationQueue.delete(key) }
  run.then(cleanup, cleanup)
  return run
}

/*
 * Ejecuta fn sobre cada elemento con un límite de peticiones simultáneas; no se detiene ante fallos.
 * Devuelve los resultados al estilo Promise.allSettled, en el mismo orden que list.
 */
export async function runAll(list, fn, limit = 4) {
  const results = new Array(list.length)
  let next = 0
  const worker = async () => {
    while (next < list.length) {
      const i = next++
      results[i] = await Promise.allSettled([fn(list[i])]).then(([r]) => r)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker))
  return results
}

/* Prueba una URL/recurso de Mock API sin guardarlos. Lanza Error en español si falla. */
export async function testConnection(url, resource) {
  const base = (url || '').trim().replace(/\/+$/, '')
  const res0 = (resource || '').trim()
  if (!base) throw new Error('falta la URL de la Mock API')
  if (!res0) throw new Error('falta el nombre del recurso')
  let res
  try {
    res = await fetch(`${base}/${encodeURIComponent(res0)}`)
  } catch {
    throw new Error('sin respuesta (revisa la URL o tu conexión)')
  }
  if (res.status === 404) throw new Error(`no existe el recurso "${res0}" en esa URL (error 404)`)
  if (!res.ok) throw new Error(`la API respondió con error ${res.status}`)
  try {
    await res.json()
  } catch {
    throw new Error('la respuesta no es JSON (¿es la URL correcta de la Mock API?)')
  }
  return true
}

/* Solo los elementos de un tipo (pide a la API filtrado, así el chat no descarga las fotos) */
export async function listByKind(kind) {
  let list
  if (getConfig().mode === 'remote') {
    try {
      list = await http(`?kind=${encodeURIComponent(kind)}`)
    } catch (e) {
      // MockAPI responde 404 cuando el filtro no encuentra nada
      if (/Error 404/.test(e.message)) list = []
      else throw e
    }
  } else {
    list = await local.list()
  }
  return (Array.isArray(list) ? list : []).filter((i) => i.kind === kind)
}

/* Exporta / importa todo (útil para pasar de local a la Mock API) */
/* Las suscripciones push (pushSub) son de cada dispositivo: no van en el respaldo */
const NO_BACKUP_KINDS = ['pushSub', 'typing', 'dailyLog']

export async function exportAll() {
  const all = (await backend().list()) || []
  return all.filter((i) => !NO_BACKUP_KINDS.includes(i.kind))
}

/* Tipos de los que solo debe existir un registro */
const SINGLE_KINDS = ['couple', 'info']

/*
 * Huella para detectar duplicados: mismo kind + fecha + contenido principal
 * (título, texto, nombre, categoría y el final del src).
 */
const fingerprint = (i) =>
  [
    i.kind,
    i.date || 0,
    i.title || '',
    i.text || '',
    i.name || '',
    i.category || '',
    typeof i.src === 'string' ? `${i.src.length}:${i.src.slice(-32)}` : '',
  ].join('|')

/*
 * Importa un respaldo en la fuente actual. No aborta si un elemento falla.
 * Se omiten (cuentan como "saltados"):
 *   - elementos cuyo `id` ya existe en el destino,
 *   - elementos con la misma huella (kind + fecha + contenido) que uno existente,
 *   - `couple` e `info` si el destino ya tiene uno (solo puede haber uno).
 * Devuelve { imported, skipped, failed, errors: string[] }.
 */
export async function importAll(items) {
  if (!Array.isArray(items))
    throw new Error('El archivo no es un respaldo válido: debe contener una lista de elementos.')
  const bad = items.findIndex((i) => !i || typeof i !== 'object' || Array.isArray(i) || typeof i.kind !== 'string' || !i.kind)
  if (bad !== -1)
    throw new Error(`El archivo no es un respaldo válido: el elemento ${bad + 1} no tiene el campo "kind".`)

  const b = backend()
  const existing = (await b.list()) || []
  const ids = new Set(existing.map((i) => String(i.id)))
  const prints = new Set(existing.map(fingerprint))
  const singles = new Set(existing.filter((i) => SINGLE_KINDS.includes(i.kind)).map((i) => i.kind))

  const result = { imported: 0, skipped: 0, failed: 0, errors: [] }
  for (const item of items) {
    const { id, ...rest } = item
    const fp = fingerprint(rest)
    if (NO_BACKUP_KINDS.includes(rest.kind) || (id !== undefined && ids.has(String(id))) || prints.has(fp) || singles.has(rest.kind)) {
      result.skipped++
      continue
    }
    try {
      await b.create(rest)
      result.imported++
      prints.add(fp)
      if (SINGLE_KINDS.includes(rest.kind)) singles.add(rest.kind)
    } catch (e) {
      result.failed++
      if (result.errors.length < 3) result.errors.push(e.message)
    }
  }
  return result
}
