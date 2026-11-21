import { useEffect, useMemo, useState } from 'react'
import { createItem } from '../lib/api'
import { fileToMedia, videoLimitMB } from '../lib/media'
import { useToast } from './Toast'
import Icon from './Icon'
import GooglePhotosButton from './GooglePhotosButton'

export default function UploadForm({ kind, categories = [], defaultCategory = '', onDone }) {
  const [category, setCategory] = useState(defaultCategory)
  const [title, setTitle] = useState('')
  const [files, setFiles] = useState([])
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [drag, setDrag] = useState(false)
  const toast = useToast()
  const isVideo = kind === 'video'

  const previews = useMemo(() => files.map((f) => ({ name: f.name, url: URL.createObjectURL(f), size: f.size })), [files])
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews])

  const addFiles = (list) => {
    const accepted = [...list].filter((f) => f.type.startsWith(isVideo ? 'video/' : 'image/'))
    if (accepted.length < list.length) toast('Algunos archivos se ignoraron por formato', 'error')
    setFiles((cur) => [...cur, ...accepted])
  }

  const submit = async (e) => {
    e.preventDefault()
    const cat = category.trim()
    if (!cat) return toast('Elige o escribe el lugar', 'error')
    if (!files.length && !link.trim()) return toast(isVideo ? 'Elige un video o pega un enlace' : 'Elige al menos una foto', 'error')
    setBusy(true)
    const created = []
    try {
      if (link.trim()) created.push(await createItem(kind, { category: cat, title: title.trim(), src: link.trim() }))
      for (let i = 0; i < files.length; i++) {
        setProgress(`${i + 1}/${files.length}`)
        try {
          const m = await fileToMedia(files[i])
          created.push(await createItem(kind, { category: cat, title: title.trim(), src: m.src }))
        } catch (err) {
          toast(err.message, 'error')
        }
      }
      if (created.length) toast(`${created.length} ${isVideo ? 'video(s)' : 'foto(s)'} guardado(s) en "${cat}"`)
      onDone(created)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  const mb = (b) => (b / 1024 / 1024).toFixed(1) + ' MB'

  return (
    <form onSubmit={submit} className="upload-form">
      <label className="field">
        <span>Lugar</span>
        <input list="cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Elige uno existente o escribe uno nuevo" autoFocus={!defaultCategory} />
        <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      </label>
      {categories.length > 0 && !defaultCategory && (
        <div className="chips">
          {categories.slice(0, 8).map((c) => (
            <button type="button" key={c} className={`chip ${c === category ? 'on' : ''}`} aria-pressed={c === category} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>
      )}
      <label className="field">
        <span>Descripción <em>opcional</em></span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nuestro primer atardecer juntos" />
      </label>

      <label
        className={`drop ${drag ? 'over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}
      >
        <input type="file" multiple accept={isVideo ? 'video/*' : 'image/*'} hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        <Icon name="upload" size={22} />
        <b>{isVideo ? 'Arrastra videos aquí' : 'Arrastra fotos aquí'}</b>
        <small>o haz clic para elegir{isVideo ? ` · máx. ${videoLimitMB()} MB c/u` : ''}</small>
      </label>

      <div className="import-row">
        <span className="muted small">¿Están en tu nube?</span>
        <GooglePhotosButton accept={isVideo ? 'video' : 'image'} disabled={busy} onFiles={addFiles} className="btn ghost sm" />
      </div>

      {previews.length > 0 && (
        <ul className="file-list">
          {previews.map((p, i) => (
            <li key={p.url}>
              {isVideo ? <video src={p.url} muted /> : <img src={p.url} alt="" />}
              <span className="file-name">{p.name}</span>
              <span className="mono">{mb(p.size)}</span>
              <button type="button" className="icon-btn danger" aria-label={`Quitar ${p.name}`} title="Quitar" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <Icon name="x" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {isVideo && (
        <label className="field">
          <span>…o pega un enlace <em>YouTube, Drive, Vimeo, mp4</em></span>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://youtu.be/…" />
        </label>
      )}
      <button className="btn wide" disabled={busy}>
        {busy ? `Subiendo ${progress}…` : `Guardar${files.length ? ` ${files.length} archivo(s)` : ''}`}
      </button>
    </form>
  )
}
