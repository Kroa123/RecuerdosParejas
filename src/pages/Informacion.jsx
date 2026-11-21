import { useEffect, useRef, useState } from 'react'
import Particles from '../components/Particles'
import TulipBouquet from '../components/TulipBouquet'
import Modal from '../components/Modal'
import Icon from '../components/Icon'
import { byDateDesc, createItem, listByKind, updateItem } from '../lib/api'
import { useToast } from '../components/Toast'
import SignatureLine from '../components/SignatureLine'
import { cachedCouple } from '../lib/couple'

/* Texto por defecto: se puede cambiar desde "Editar mensaje" (se guarda en la API) o aquí. */
export const DEFAULT_INFO = {
  title: 'Para el amor de mi vida',
  message: `Hola mi monita, se que esta pagina es un poco random y sobre todo esta vista, pero quiero que leas estos mensajes como una carta de amor hacia la mujer mas hermosa de este universo, osea usted mi vida, la amo con toda mi alma
  y todo mi corazon, usted es mi motivacion dia tras dia, mi motivo para siempre querer salir adelante, por la cual me esfuerzo, mejoro, dia tras dia levantandome con la bendicion de Dios de un dia mas de vida al lado de una mujer tan
  hermosa, bella, preciosa, perfecta, eres el amor de mi vida y lo serás siempre, quiero que sepas que pase lo que pase no hay dia que no piense en nosotros, y como solemos decir, POR SIEMPRE Y PARA SIEMPRE, Te amo maryori huamanchumo 
  y te quiero amar para toda la vida <3 `,
  signature: 'Te amo mi monita <3',
}

const CACHE_KEY = 'recuerdos.infoCache'
const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) } catch { return null } }
const writeCache = (v) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)) } catch { /* sin storage */ } }

/* El ramo solo empieza a dibujarse cuando entra en pantalla, y no bloquea la carta */
function LazyBouquet({ replay }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return setVisible(true)
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } }, { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div className="bouquet-wrap" ref={ref}>
      <div className="bouquet-glow" />
      {visible && <TulipBouquet key={replay} />}
    </div>
  )
}

export default function Informacion() {
  // Se muestra al instante: primero la copia guardada / texto por defecto, luego se actualiza con la API
  const [info, setInfo] = useState(() => readCache() || DEFAULT_INFO)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(DEFAULT_INFO)
  const [replay, setReplay] = useState(0)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let alive = true
    listByKind('info')
      .then((list) => {
        const latest = list.sort(byDateDesc)[0] // el más reciente, como antes
        if (alive && latest) { setInfo(latest); writeCache(latest) }
      })
      .catch(() => { /* se queda con lo que ya se muestra */ })
    return () => { alive = false }
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const saved = info?.id ? await updateItem({ ...info, ...draft }) : await createItem('info', draft)
      setInfo(saved)
      writeCache(saved)
      setEditing(false)
      toast('Mensaje guardado')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Los saltos de línea con sangría vienen de pegar el texto; se leen como un espacio
  const paragraphs = (info.message || '').split(/\n\s*\n/).map((p) => p.replace(/[ \t]*\n[ \t]+/g, ' ').trim()).filter(Boolean)

  return (
    <section className="info">
      <Particles />
      <div className="info-grid">
        <article className="letter">
          <h1 className="letter-title">{info.title}</h1>
          <div className="letter-body">
            {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <SignatureLine text={info.signature} name={cachedCouple().names.D} />
          <div className="info-actions">
            <button className="btn ghost sm" onClick={() => { setDraft({ ...DEFAULT_INFO, ...info }); setEditing(true) }}>
              <Icon name="pencil" size={15} /> Editar mensaje
            </button>
            <button className="btn subtle sm" onClick={() => setReplay((n) => n + 1)}>
              <Icon name="refresh" size={15} /> Dibujar el ramo otra vez
            </button>
          </div>
        </article>

        <aside className="bouquet-side">
          <LazyBouquet replay={replay} />
        </aside>
      </div>

      {editing && (
        <Modal title="Editar mensaje" wide onClose={() => setEditing(false)}>
          <form onSubmit={save}>
            <label className="field">
              <span>Título</span>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label className="field">
              <span>Mensaje <em>deja una línea en blanco para separar párrafos</em></span>
              <textarea rows={12} value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} />
            </label>
            <label className="field">
              <span>Firma</span>
              <input value={draft.signature} onChange={(e) => setDraft({ ...draft, signature: e.target.value })} />
            </label>
            <button className="btn wide" disabled={saving}>{saving ? 'Guardando…' : 'Guardar mensaje'}</button>
          </form>
        </Modal>
      )}
    </section>
  )
}
