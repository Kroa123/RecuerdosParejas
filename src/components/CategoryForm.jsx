import { useState } from 'react'
import { saveCategory } from '../lib/categories'
import { useToast } from './Toast'

/* Formulario para crear / editar una categoría (lugar) */
export default function CategoryForm({ scope, group, existing, label = 'lugar', onDone }) {
  const [name, setName] = useState(group?.name || '')
  const [description, setDescription] = useState(group?.description || '')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const saved = await saveCategory({
        scope,
        group,
        name,
        description,
        existing: existing.filter((n) => n !== group?.name),
      })
      toast(group ? 'Cambios guardados' : `Se creó "${saved.name}"`)
      onDone(saved)
    } catch (err) {
      toast(err.message, 'error')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="field">
        <span>Nombre del {label}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Playa de Máncora" autoFocus maxLength={60} />
      </label>
      <label className="field">
        <span>Descripción <em>opcional</em></span>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué pasó aquí, cuándo fuimos…" maxLength={240} />
      </label>
      {group && group.list.length > 0 && name.trim() && name.trim() !== group.name && (
        <p className="hint">Se moverán {group.list.length} elemento(s) al nuevo nombre.</p>
      )}
      <button className="btn wide" disabled={busy || !name.trim()}>
        {busy ? 'Guardando…' : group ? 'Guardar cambios' : `Crear ${label}`}
      </button>
    </form>
  )
}
