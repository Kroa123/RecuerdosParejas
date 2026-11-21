import { useState } from 'react'
import { mutateItem } from '../lib/api'
import { NO_CATEGORY } from '../lib/categories'
import { fromDateInput, toDateInput } from '../lib/media'
import { useToast } from './Toast'
import MediaEditor from './MediaEditor'

/* ---------- editar ---------- */
export default function PostEditForm({ post, categories, onSaved }) {
  const [title, setTitle] = useState(post.title || '')
  const [text, setText] = useState(post.text || '')
  const [category, setCategory] = useState(post.category || '')
  const [when, setWhen] = useState(toDateInput(post.moment || post.date))
  const [media, setMedia] = useState(post.media || [])
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const changes = { title: title.trim(), text: text.trim(), category: category.trim(), media, moment: fromDateInput(when) }
      // Se mezcla sobre la versión más reciente: no pisa likes ni comentarios nuevos de la otra persona
      const saved = await mutateItem(post.id, (cur) => ({ ...cur, ...changes }))
      onSaved(saved)
      toast('Recuerdo actualizado')
    } catch (err) {
      toast(err.message, 'error')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="edit-post">
      <label className="field"><span>Título</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="field"><span>Texto</span><textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} /></label>
      <div className="grid-2">
        <label className="field">
          <span>Categoría</span>
          <input list="edit-cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={NO_CATEGORY} />
          <datalist id="edit-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="field"><span>Fecha</span><input type="date" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
      </div>
      <div className="field">
        <span>Fotos y videos <em>{media.length} · toca el ícono rojo para quitar</em></span>
        <MediaEditor media={media} setMedia={setMedia} busy={busy} setBusy={setBusy} />
      </div>
      <button className="btn wide" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
    </form>
  )
}
