/*
 * Importar desde Google Fotos con la "Google Photos Picker API".
 * La persona inicia sesión con Google, elige fotos/videos en la ventana de
 * Google Fotos y aquí los descargamos para guardarlos como cualquier otra foto.
 *
 * Requiere VITE_GOOGLE_CLIENT_ID (ver README: "Conectar Google Fotos").
 */

const SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'
const API = 'https://photospicker.googleapis.com/v1'

export const googleClientId = () => (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()

let gisPromise
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => { gisPromise = null; reject(new Error('No se pudo cargar el inicio de sesión de Google. Revisa tu conexión.')) }
      document.head.appendChild(s)
    })
  }
  return gisPromise
}

let cachedToken = null // { value, exp }

export async function getToken() {
  if (cachedToken && cachedToken.exp > Date.now() + 60000) return cachedToken.value
  await loadGis()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId(),
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error === 'access_denied' ? 'No diste permiso a Google Fotos.' : `Google: ${resp.error}`))
        cachedToken = { value: resp.access_token, exp: Date.now() + (resp.expires_in || 3600) * 1000 }
        resolve(resp.access_token)
      },
      error_callback: (err) => reject(new Error(err?.type === 'popup_closed' ? 'Cerraste la ventana de Google.' : 'No se pudo iniciar sesión con Google.')),
    })
    client.requestAccessToken()
  })
}

async function call(token, path, opts = {}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } })
  if (!res.ok) {
    let msg = `Google Fotos respondió ${res.status}`
    try { msg = (await res.json()).error?.message || msg } catch { /* nada */ }
    throw new Error(msg)
  }
  return res.status === 204 ? null : res.json()
}

const seconds = (s, def) => (s ? parseFloat(String(s)) * 1000 : def)

export async function createSession(token) {
  return call(token, '/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
}

/* Espera a que la persona termine de elegir en Google Fotos */
export async function waitForSelection(token, session, { signal } = {}) {
  const interval = Math.max(2000, seconds(session.pollingConfig?.pollInterval, 3000))
  const deadline = Date.now() + seconds(session.pollingConfig?.timeoutIn, 20 * 60000)
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('cancelado')
    const s = await call(token, `/sessions/${session.id}`)
    if (s.mediaItemsSet) return s
    await new Promise((r) => setTimeout(r, interval))
  }
  throw new Error('Se acabó el tiempo para elegir. Inténtalo de nuevo.')
}

export async function listPicked(token, sessionId) {
  const out = []
  let pageToken = ''
  do {
    const q = new URLSearchParams({ sessionId, pageSize: '100' })
    if (pageToken) q.set('pageToken', pageToken)
    const page = await call(token, `/mediaItems?${q}`)
    out.push(...(page.mediaItems || []))
    pageToken = page.nextPageToken || ''
  } while (pageToken)
  return out
}

/*
 * Error identificable para videos que superan el límite (no se descargan enteros).
 *   try { await downloadItem(token, item, { maxBytes }) } catch (e) { if (isTooBig(e)) ... }
 * e.code === 'TOO_BIG', e.size = bytes informados/leídos, e.maxBytes = límite.
 */
export class TooBigError extends Error {
  constructor(name, size, maxBytes) {
    super(`"${name}" supera ${Math.round(maxBytes / 1048576)} MB y no se agregó.`)
    this.name = 'TooBigError'
    this.code = 'TOO_BIG'
    this.size = size
    this.maxBytes = maxBytes
  }
}
export const isTooBig = (e) => e?.code === 'TOO_BIG'

/* Lee el cuerpo cortando en cuanto pasa de maxBytes (por si el servidor no envía Content-Length) */
async function readLimited(res, maxBytes, name) {
  if (!res.body?.getReader) {
    const blob = await res.blob()
    if (blob.size > maxBytes) throw new TooBigError(name, blob.size, maxBytes)
    return blob
  }
  const reader = res.body.getReader()
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      try { await reader.cancel() } catch { /* nada */ }
      throw new TooBigError(name, total, maxBytes)
    }
    chunks.push(value)
  }
  return new Blob(chunks, { type: res.headers.get('Content-Type') || '' })
}

/*
 * Descarga un elemento elegido como File (para reutilizar la compresión de siempre).
 * Opciones:
 *   maxBytes -> límite SOLO para videos: si Content-Length lo supera se corta antes de leer
 *               el cuerpo; si no hay Content-Length se corta al pasarlo mientras se descarga.
 *               Lanza TooBigError (ver isTooBig). Sin maxBytes se comporta como siempre.
 *   signal   -> AbortSignal para cancelar la descarga.
 */
export async function downloadItem(token, item, { maxBytes, signal } = {}) {
  const f = item.mediaFile || {}
  const isVideo = item.type === 'VIDEO' || (f.mimeType || '').startsWith('video/')
  const name = f.filename || (isVideo ? 'video.mp4' : 'foto.jpg')
  const url = `${f.baseUrl}${isVideo ? '=dv' : '=w2048-h2048'}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal })
  if (!res.ok) throw new Error(`No se pudo descargar "${f.filename || 'archivo'}" (${res.status})`)
  const limit = isVideo && maxBytes > 0 ? maxBytes : 0
  let blob
  if (limit) {
    const len = Number(res.headers.get('Content-Length') || 0)
    if (len > limit) {
      try { await res.body?.cancel() } catch { /* nada */ }
      throw new TooBigError(name, len, limit)
    }
    blob = await readLimited(res, limit, name)
  } else {
    blob = await res.blob()
  }
  const type = f.mimeType || blob.type || (isVideo ? 'video/mp4' : 'image/jpeg')
  return new File([blob], name, { type })
}

export async function deleteSession(token, id) {
  try { await call(token, `/sessions/${id}`, { method: 'DELETE' }) } catch { /* no importa */ }
}
