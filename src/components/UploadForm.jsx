import { useState } from 'react'
import { createItem } from '../lib/api'
import { fileToMedia, videoLimitMB } from '../lib/media'
import { useToast } from './Toast'

export default function UploadForm({ kind, categories = [], defaultCategory = '', onDone }) {
  const [category, setCategory] = useState(defaultCategory)
  const [title, setTitle] = useState('')
  const [files, setFiles] = useState([])
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const toast = useToast()
  const isVideo = kind === 'video'

  const submit = async (e) => {
    e.preventDefault()
    if (!category.trim()) return toast('Escribe el nombre del lugar', 'error')
    if (!files.length && !link.trim()) return toast(isVideo ? 'Elige un video o pega un enlace' : 'Elige al menos una foto', 'error')
    setBusy(true)
    const created = []
    try {
      if (link.trim()) created.push(await createItem(kind, { category: category.trim(), title: title.trim(), src: link.trim() }))
      for (let i = 0; i < files.length; i++) {
        setProgress(`${i + 1} / ${files.length}`)
        try {
          const m = await fileToMedia(files[i])
          created.push(await createItem(kind, { category: category.trim(), title: title.trim(), src: m.src }))
        } catch (err) {
          toast(err.message, 'error')
        }
      }
      if (created.length) toast(`${created.length} ${isVideo ? 'video(s)' : 'foto(s)'} guardado(s) en "${category.trim()}" 💕`)
      onDone(created)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <form onSubmit={submit} className="upload-form">
      <label className="field">
        Lugar (categoría)
        <input list="cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ej: Playa de Máncora" autoFocus={!defaultCategory} />
        <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      </label>
      <label className="field">
        Descripción (opcional)
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nuestro primer atardecer juntos" />
      </label>
      <label className="drop">
        <input type="file" multiple accept={isVideo ? 'video/*' : 'image/*'} hidden onChange={(e) => setFiles([...e.target.files])} />
        <span className="drop-icon">{isVideo ? '🎬' : '📷'}</span>
        {files.length ? `${files.length} archivo(s) seleccionado(s)` : `Toca para elegir ${isVideo ? 'videos' : 'fotos'}`}
      </label>
      {isVideo && (
        <>
          <label className="field">
            …o pega un enlace (YouTube, Google Drive, Vimeo, mp4)
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://youtu.be/…" />
          </label>
          <p className="hint">Archivos de video: hasta {videoLimitMB()} MB. Para videos más grandes usa un enlace.</p>
        </>
      )}
      <button className="btn wide" disabled={busy}>{busy ? `Guardando… ${progress}` : 'Guardar'}</button>
    </form>
  )
}
