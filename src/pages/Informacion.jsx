import { useEffect, useState } from 'react'
import Particles from '../components/Particles'
import TulipBouquet from '../components/TulipBouquet'
import Modal from '../components/Modal'
import { createItem, listItems, updateItem } from '../lib/api'
import { useToast } from '../components/Toast'

/* ✏️ Texto por defecto: cámbialo desde el botón "Editar mensaje" de la página
   (se guarda en la Mock API) o directamente aquí. */
export const DEFAULT_INFO = {
  title: 'Para el amor de mi vida',
  message: `Mi amor, no sé exactamente en qué momento empezaste a ser mi lugar favorito, pero sé que desde que llegaste todo tiene más color. Cada risa tuya, cada mirada y cada abrazo se han vuelto mis recuerdos más bonitos.

Gracias por elegirme cada día, por tu paciencia, por tus palabras y por hacerme sentir en casa aunque estemos lejos. Contigo aprendí que el amor no es solo un sentimiento: es cuidarnos, crecer juntos y celebrar hasta los momentos más pequeños.

Esta página es para guardar todo lo que hemos vivido y todo lo que nos falta por vivir. Prometo seguir llenándola de fotos, viajes, risas y aventuras a tu lado.

Te regalo estos tulipanes, que nunca se marchitan, como lo que siento por ti.`,
  signature: 'Con todo mi amor, siempre tuyo ♥',
}

export default function Informacion() {
  const [info, setInfo] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(DEFAULT_INFO)
  const [replay, setReplay] = useState(0)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    listItems('info')
      .then((list) => setInfo(list[0] || DEFAULT_INFO))
      .catch(() => setInfo(DEFAULT_INFO))
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const saved = info?.id ? await updateItem({ ...info, ...draft }) : await createItem('info', draft)
      setInfo(saved)
      setEditing(false)
      setReplay((n) => n + 1)
      toast('Mensaje guardado 💌')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const data = info || DEFAULT_INFO
  const paragraphs = data.message.split(/\n\s*\n/).filter(Boolean)

  return (
    <section className="info">
      <Particles />
      <div className="info-content">
        <h2 className="info-title script">{data.title}</h2>
        <div className="bouquet-wrap" key={`b${replay}`}>
          <div className="bouquet-glow" />
          <TulipBouquet />
        </div>
        <div className="info-actions">
          <button className="btn ghost" onClick={() => setReplay((n) => n + 1)}>🌷 Volver a dibujar</button>
          <button className="btn" onClick={() => { setDraft({ ...DEFAULT_INFO, ...data }); setEditing(true) }}>✎ Editar mensaje</button>
        </div>
        <article className="letter" key={`l${replay}`}>
          {paragraphs.map((p, i) => (
            <p key={i} style={{ animationDelay: `${6.8 + i * 0.7}s` }}>{p}</p>
          ))}
          <p className="signature script" style={{ animationDelay: `${6.8 + paragraphs.length * 0.7}s` }}>{data.signature}</p>
        </article>
      </div>

      {editing && (
        <Modal title="Editar mensaje para ella" onClose={() => setEditing(false)}>
          <form onSubmit={save}>
            <label className="field">
              Título
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label className="field">
              Mensaje (deja una línea en blanco para separar párrafos)
              <textarea rows={12} value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} />
            </label>
            <label className="field">
              Firma
              <input value={draft.signature} onChange={(e) => setDraft({ ...draft, signature: e.target.value })} />
            </label>
            <button className="btn wide" disabled={saving}>{saving ? 'Guardando…' : 'Guardar mensaje'}</button>
          </form>
        </Modal>
      )}
    </section>
  )
}
