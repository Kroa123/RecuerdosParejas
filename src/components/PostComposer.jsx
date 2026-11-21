import { useEffect, useState } from 'react'
import { createItem } from '../lib/api'
import { fromDateInput, videoLimitMB } from '../lib/media'
import { useToast } from './Toast'
import MediaEditor from './MediaEditor'
import Icon from './Icon'

/* ---------- crear ---------- */
export default function PostComposer({ categories, defaultCategory, onCreated }) {
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [category, setCategory] = useState(defaultCategory || '')
  const [media, setMedia] = useState([])
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const toast = useToast()

  useEffect(() => { setCategory(defaultCategory || '') }, [defaultCategory])

  const publish = async (e) => {
    e.preventDefault()
    if (!text.trim() && !media.length) return toast('Escribe algo o agrega una foto/video', 'error')
    setBusy(true)
    try {
      const item = await createItem('post', {
        title: title.trim(),
        text: text.trim(),
        category: category.trim(),
        media,
        moment: fromDateInput(when),
        comments: [],
        likes: 0,
      })
      onCreated(item)
      setText(''); setTitle(''); setWhen(''); setMedia([]); setOpen(false)
      toast('Recuerdo publicado')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={`card composer ${open ? 'open' : ''}`} onSubmit={publish} onFocus={() => setOpen(true)}>
      <input className="composer-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del recuerdo" />
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="¿Qué momento quieres guardar hoy?" rows={open ? 4 : 2} />
      {open && (
        <>
          <div className="composer-row">
            <label className="mini-field">
              <Icon name="folder" size={15} />
              <input list="post-cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Categoría" />
              <datalist id="post-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="mini-field">
              <Icon name="calendar" size={15} />
              <input type="date" value={when} onChange={(e) => setWhen(e.target.value)} />
            </label>
          </div>
          <MediaEditor media={media} setMedia={setMedia} busy={busy} setBusy={setBusy} />
          <div className="composer-foot">
            <span className="hint">Video como archivo: máx. {videoLimitMB()} MB. Más grande → pega un enlace.</span>
            <button type="button" className="btn subtle" onClick={() => setOpen(false)}>Cerrar</button>
            <button className="btn" disabled={busy}>{busy ? 'Guardando…' : 'Publicar'}</button>
          </div>
        </>
      )}
    </form>
  )
}
