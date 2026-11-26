/*
 * Geocodificación de lugares para el Mapa de recuerdos (sin React).
 * Usa Nominatim (OpenStreetMap): máximo 1 petición por segundo, en secuencia
 * (política de uso de Nominatim). Los resultados se cachean en localStorage
 * (recuerdos.geocache) y, además, se guardan como lat/lng en la categoría.
 */

const CACHE_KEY = 'recuerdos.geocache'
const MISS_TTL = 7 * 86400000 // un "no encontrado" se vuelve a intentar a la semana
export const GEO_GAP_MS = 1100

export const PERU_CENTER = [-9.19, -75.0152]
export const PERU_ZOOM = 5

const norm = (name) => (name || '').trim().toLowerCase()

const isNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))
export const hasCoords = (o) => isNum(o?.lat) && isNum(o?.lng)

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {} } catch { return {} }
}
function writeCache(c) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch { /* sin storage */ }
}

/* { lat, lng } | { miss: true } | null (sin dato o caducado) */
export function cachedGeo(name) {
  const hit = readCache()[norm(name)]
  if (!hit) return null
  if (hit.miss) return Date.now() - (hit.at || 0) < MISS_TTL ? { miss: true } : null
  return hasCoords(hit) ? { lat: Number(hit.lat), lng: Number(hit.lng) } : null
}

export function cacheGeo(name, value) {
  const c = readCache()
  c[norm(name)] = value ? { lat: value.lat, lng: value.lng } : { miss: true, at: Date.now() }
  writeCache(c)
}

/* Quita años y signos sueltos ("Cusco 2025 ✨" -> "Cusco") para buscar mejor */
export function geoQuery(name) {
  const q = (name || '')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s,.'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return q || (name || '').trim()
}

/* Una consulta a Nominatim. Devuelve { lat, lng } o null. Lanza si falla la red. */
async function search(query, signal, countrycodes) {
  const cc = countrycodes ? `&countrycodes=${countrycodes}` : ''
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=es${cc}&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Nominatim respondió ${res.status}`)
  const [hit] = await res.json()
  if (!hit) return null
  const lat = Number(hit.lat)
  const lng = Number(hit.lon)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

/*
 * Busca un lugar por nombre. Devuelve { lat, lng } o null. Lanza si falla la red.
 * Primero lo busca en Perú (así "Miraflores" o "Lima" no caen en otro país); si no hay
 * resultado, reintenta sin restricción de país, respetando la pausa de 1 petición por segundo.
 */
export async function geocode(name, signal) {
  const q = geoQuery(name)
  const hit = await search(q, signal, 'pe')
  if (hit) return hit
  await wait(GEO_GAP_MS, signal)
  return search(q, signal)
}

/* Espera ms milisegundos (se corta con la señal) */
export const wait = (ms, signal) => new Promise((resolve, reject) => {
  const abort = new DOMException('Cancelado', 'AbortError')
  if (signal?.aborted) { reject(abort); return }
  const onAbort = () => { clearTimeout(t); reject(abort) }
  const t = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve() }, ms)
  signal?.addEventListener('abort', onAbort, { once: true })
})
