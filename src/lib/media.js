import { getConfig } from './api'

/* Reduce y comprime una imagen a JPEG base64 para que pese poco. */
export function compressImage(file) {
  const remote = getConfig().mode === 'remote'
  const max = remote ? 1100 : 1800
  const quality = remote ? 0.62 : 0.8
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(img.width * scale))
        c.height = Math.max(1, Math.round(img.height * scale))
        const ctx = c.getContext('2d')
        // JPEG no tiene transparencia: sin fondo, los PNG transparentes quedarían negros
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, c.width, c.height)
        ctx.drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/jpeg', quality))
      } catch {
        reject(new Error(`No se pudo procesar la imagen "${file.name}".`))
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      const heic = /\.(heic|heif)$/i.test(file.name || '') || /hei[cf]/i.test(file.type || '')
      reject(new Error(heic
        ? `Este navegador no puede leer "${file.name}" (formato HEIC de iPhone). Conviértela a JPG o, en el iPhone, usa Ajustes > Cámara > Formatos > "Más compatible".`
        : `Este navegador no puede leer la imagen "${file.name}". Prueba con un JPG o PNG.`))
    }
    img.src = url
  })
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

/* Límite de videos subidos como archivo (base64). Con Mock API, mejor usar enlaces. */
export const videoLimitMB = () => (getConfig().mode === 'remote' ? 2 : 60)

export async function fileToMedia(file) {
  if (file.type.startsWith('image/')) return { type: 'image', src: await compressImage(file) }
  if (file.type.startsWith('video/')) {
    const lim = videoLimitMB()
    if (file.size > lim * 1024 * 1024)
      throw new Error(`El video "${file.name}" pesa más de ${lim} MB. Súbelo a YouTube o Google Drive y pega el enlace.`)
    return { type: 'video', src: await fileToDataUrl(file) }
  }
  throw new Error(`Formato no soportado: ${file.name}`)
}

/* IDs válidos: la URL del iframe se construye SOLO con estos, nunca con la URL original */
const YT_ID = /^[\w-]{6,20}$/
const DRIVE_ID = /^[\w-]{10,}$/
const VIMEO_ID = /^\d{1,12}$/
const VIMEO_HASH = /^[0-9a-f]{6,20}$/i

function parseUrl(src) {
  try {
    return new URL(/^[a-z][a-z\d+.-]*:/i.test(src) ? src : `https://${src}`)
  } catch {
    return null
  }
}

function youtubeId(u) {
  const host = u.hostname.replace(/^(www|m|music)\./, '')
  const parts = u.pathname.split('/').filter(Boolean)
  if (host === 'youtu.be') return parts[0]
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null
  if (parts[0] === 'watch') return u.searchParams.get('v') // v en cualquier posición
  if (['shorts', 'embed', 'live', 'v'].includes(parts[0])) return parts[1]
  return null
}

function driveId(u) {
  if (u.hostname !== 'drive.google.com') return null
  const parts = u.pathname.split('/').filter(Boolean)
  const i = parts.indexOf('d')
  // drive.google.com/file/d/ID/view y también /file/u/0/d/ID/view (cuenta seleccionada)
  if (parts[0] === 'file' && i >= 1) return parts[i + 1] || null
  if (parts[0] === 'open' || parts[0] === 'uc') return u.searchParams.get('id')
  return null
}

function vimeo(u) {
  const host = u.hostname.replace(/^www\./, '')
  const parts = u.pathname.split('/').filter(Boolean)
  if (host === 'player.vimeo.com' && parts[0] === 'video') return { id: parts[1], hash: u.searchParams.get('h') }
  if (host !== 'vimeo.com') return null
  // vimeo.com/ID, vimeo.com/ID/HASH (privado), vimeo.com/channels/x/ID, vimeo.com/groups/x/videos/ID
  const i = parts.findIndex((p) => VIMEO_ID.test(p))
  if (i === -1) return null
  return { id: parts[i], hash: (i === 0 && parts[1]) || u.searchParams.get('h') }
}

/* Convierte enlaces de YouTube / Drive / Vimeo en algo reproducible */
export function videoEmbed(src) {
  if (!src) return null
  if (src.startsWith('data:')) return { kind: 'file', src }
  const u = parseUrl(src.trim())
  if (u) {
    const yt = youtubeId(u)
    if (yt && YT_ID.test(yt)) return { kind: 'iframe', src: `https://www.youtube.com/embed/${yt}` }
    const dr = driveId(u)
    if (dr && DRIVE_ID.test(dr)) return { kind: 'iframe', src: `https://drive.google.com/file/d/${dr}/preview` }
    const vm = vimeo(u)
    if (vm && VIMEO_ID.test(vm.id || '')) {
      const h = vm.hash && VIMEO_HASH.test(vm.hash) ? `?h=${vm.hash}` : ''
      return { kind: 'iframe', src: `https://player.vimeo.com/video/${vm.id}${h}` }
    }
  }
  return { kind: 'file', src }
}

export function formatDate(ts, short = false) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('es', { day: 'numeric', month: short ? 'short' : 'long', year: 'numeric' })
}

/*
 * Valor para <input type="date"> a partir de un timestamp, en la fecha LOCAL
 * (toISOString usaría UTC y de noche podía mostrar el día siguiente).
 * fromDateInput guarda el mediodía local de ese día, así el ida y vuelta da la misma fecha.
 */
const pad2 = (n) => String(n).padStart(2, '0')
export const toDateInput = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
export const fromDateInput = (v) => (v ? new Date(v + 'T12:00:00').getTime() : null)
