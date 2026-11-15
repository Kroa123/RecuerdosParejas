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
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('No se pudo leer la imagen'))
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

/* Convierte enlaces de YouTube / Drive / Vimeo en algo reproducible */
export function videoEmbed(src) {
  if (!src) return null
  if (src.startsWith('data:')) return { kind: 'file', src }
  let m = src.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/)
  if (m) return { kind: 'iframe', src: `https://www.youtube.com/embed/${m[1]}` }
  m = src.match(/drive\.google\.com\/file\/d\/([\w-]+)/)
  if (m) return { kind: 'iframe', src: `https://drive.google.com/file/d/${m[1]}/preview` }
  m = src.match(/vimeo\.com\/(\d+)/)
  if (m) return { kind: 'iframe', src: `https://player.vimeo.com/video/${m[1]}` }
  return { kind: 'file', src }
}

export function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
}
