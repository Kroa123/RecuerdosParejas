import { useState } from 'react'
import { fileToMedia } from '../lib/media'
import { useToast } from './Toast'
import { VideoThumb } from './VideoPlayer'
import GooglePhotosButton from './GooglePhotosButton'
import Icon from './Icon'

/*
 * Key estable para listas de medios sin tocar los datos guardados:
 * se asocia un id local a cada objeto (WeakMap), así quitar uno no reutiliza keys.
 */
const keys = new WeakMap()
let seq = 0
function mediaKey(m) {
  if (!m || typeof m !== 'object') return `m-${String(m)}`
  if (!keys.has(m)) keys.set(m, `m${++seq}`)
  return keys.get(m)
}

/* Edición de medios (compartido por crear y editar recuerdos) */
export default function MediaEditor({ media, setMedia, busy, setBusy }) {
  const [link, setLink] = useState('')
  const toast = useToast()

  const addFiles = async (files) => {
    setBusy(true)
    for (const f of files) {
      try {
        const m = await fileToMedia(f)
        setMedia((cur) => [...cur, m])
      } catch (e) { toast(e.message, 'error') }
    }
    setBusy(false)
  }

  const addLink = () => {
    if (!link.trim()) return
    setMedia((cur) => [...cur, { type: 'video', src: link.trim() }])
    setLink('')
  }

  return (
    <>
      {media.length > 0 && (
        <div className="preview-grid">
          {media.map((m) => (
            <div key={mediaKey(m)} className="preview">
              {m.type === 'image' ? <img src={m.src} alt="" /> : <VideoThumb src={m.src} />}
              {m.type === 'video' && <span className="preview-tag"><Icon name="play" size={10} fill /></span>}
              <button type="button" className="preview-del" title="Quitar" aria-label="Quitar" onClick={() => setMedia((cur) => cur.filter((x) => x !== m))}>
                <Icon name="trash" size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="composer-tools">
        <label className="tool">
          <Icon name="image" size={16} /> Fotos / videos
          <input type="file" accept="image/*,video/*" multiple hidden disabled={busy} onChange={(e) => { addFiles([...e.target.files]); e.target.value = '' }} />
        </label>
        <GooglePhotosButton accept="all" disabled={busy} onFiles={addFiles} />
        <div className="tool link-tool">
          <Icon name="link" size={16} />
          <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }} placeholder="Enlace YouTube / Drive" />
          {link && <button type="button" className="mini" onClick={addLink}>Añadir</button>}
        </div>
      </div>
    </>
  )
}
