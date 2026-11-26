import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createItem, deleteItem, listByKind } from '../lib/api'
import { compressImage, formatDate } from '../lib/media'
import { myName } from '../lib/chat'
import { countdown, isOpen, markCapsuleSeen, openAtOf, seenCapsules, sortCapsules, toDateTimeInput } from '../lib/capsules'
import Modal from '../components/Modal'
import Lightbox from '../components/Lightbox'
import Icon from '../components/Icon'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'

const OPEN_ANIM_MS = 900

/* Formulario de una cápsula nueva */
function CapsuleForm({ onDone }) {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [image, setImage] = useState('')
  const [openAt, setOpenAt] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const author = myName()

  if (!author) {
    return (
      <div className="empty-state">
        <Icon name="user" size={28} />
        <h3>Primero dinos quién eres</h3>
        <p>Elige tu nombre en el chat para firmar la cápsula.</p>
        <Link className="btn" to="/chat"><Icon name="message" /> Ir al chat</Link>
      </div>
    )
  }

  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      setImage(await compressImage(file))
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    const at = openAt ? new Date(openAt).getTime() : NaN
    if (!title.trim()) return toast('Ponle un título a la cápsula', 'error')
    if (!text.trim()) return toast('Escribe un mensaje para el futuro', 'error')
    if (!Number.isFinite(at) || at <= Date.now()) return toast('La fecha de apertura debe ser futura', 'error')
    setBusy(true)
    try {
      await createItem('capsule', {
        author,
        title: title.trim(),
        text: text.trim(),
        ...(image ? { image } : {}),
        openAt: at,
      })
      toast('Cápsula guardada. Se abrirá el ' + formatDate(at))
      onDone()
    } catch (err) {
      toast(err.message, 'error')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="field">
        <span>Título</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Para nuestro aniversario" maxLength={80} autoFocus />
      </label>
      <label className="field">
        <span>Mensaje</span>
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escríbele a tu yo (o a tu amor) del futuro…" maxLength={4000} />
      </label>
      <label className="field">
        <span>Se abrirá el</span>
        <input type="datetime-local" value={openAt} min={toDateTimeInput(Date.now() + 60000)} onChange={(e) => setOpenAt(e.target.value)} required />
      </label>
      <div className="field">
        <span>Foto <em>opcional</em></span>
        {image ? (
          <div className="capsule-preview">
            <img src={image} alt="Foto de la cápsula" />
            <button type="button" className="btn ghost sm" onClick={() => setImage('')}><Icon name="trash" size={14} /> Quitar foto</button>
          </div>
        ) : (
          <label className="btn ghost">
            <Icon name="image" /> Elegir foto
            <input type="file" accept="image/*" onChange={pick} hidden />
          </label>
        )}
      </div>
      <p className="hint">Se mostrará a partir de esa fecha. Firmada por {author}.</p>
      <button className="btn wide" disabled={busy}>{busy ? 'Guardando…' : 'Sellar cápsula'}</button>
    </form>
  )
}

export default function Capsula() {
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [seen, setSeen] = useState(() => seenCapsules())
  const [opening, setOpening] = useState(() => new Set())
  const [viewer, setViewer] = useState(null) // { src, title }
  const timers = useRef([])
  const toast = useToast()
  const confirm = useConfirm()

  // Cada carga invalida la anterior
  const reqRef = useRef(0)
  const load = () => {
    const req = ++reqRef.current
    setError('')
    return listByKind('capsule')
      .then((l) => { if (req === reqRef.current) setList(l) })
      .catch((e) => { if (req === reqRef.current) { setError(e.message); setList((p) => p || []) } })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); return () => { reqRef.current++ } }, [])

  // Limpia los temporizadores de la animación al salir
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const sorted = useMemo(() => (list ? sortCapsules(list, now) : []), [list, now])
  const hasLocked = sorted.some((c) => !isOpen(c, now))

  // Cuenta regresiva viva: solo corre mientras quede alguna cápsula cerrada
  useEffect(() => {
    if (!hasLocked) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [hasLocked])

  const openCapsule = (c) => {
    const key = String(c.id)
    setOpening((s) => new Set(s).add(key))
    markCapsuleSeen(key)
    const t = setTimeout(() => {
      setSeen((s) => new Set(s).add(key))
      setOpening((s) => { const n = new Set(s); n.delete(key); return n })
    }, OPEN_ANIM_MS)
    timers.current.push(t)
  }

  const remove = async (c) => {
    const ok = await confirm({
      title: `Eliminar "${c.title || 'cápsula'}"`,
      message: isOpen(c, Date.now()) ? 'Se borrará la cápsula y su contenido. No se puede deshacer.' : 'Todavía no se ha abierto. Si la borras, nadie podrá leerla.',
      confirmText: 'Eliminar cápsula',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteItem(c.id)
      setList((l) => (l || []).filter((x) => x.id !== c.id))
      toast('Cápsula eliminada')
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <section>
      <header className="page-head">
        <h1 className="page-title">Cápsula del tiempo</h1>
        <p className="page-sub">Mensajes sellados que solo se pueden abrir en la fecha elegida.</p>
        <div className="page-actions">
          <button className="btn" onClick={() => setModal(true)}><Icon name="plus" /> Nueva cápsula</button>
        </div>
      </header>

      {error && (
        <div className="empty-state" role="alert">
          <Icon name="cloud" size={28} />
          <h3>No se pudieron cargar las cápsulas</h3>
          <p>{error}</p>
          <button className="btn ghost" onClick={load}><Icon name="refresh" /> Reintentar</button>
        </div>
      )}

      {!list && !error && (
        <div className="capsule-grid" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="capsule-card skeleton" />)}
        </div>
      )}

      {list && !error && sorted.length === 0 && (
        <div className="empty-state">
          <Icon name="gift" size={32} />
          <h3>Todavía no hay cápsulas</h3>
          <p>Escribe un mensaje para el futuro: un aniversario, un cumpleaños o un día cualquiera.</p>
          <button className="btn" onClick={() => setModal(true)}><Icon name="plus" /> Crear la primera</button>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="capsule-grid">
          {sorted.map((c) => {
            const key = String(c.id)
            const open = isOpen(c, now)
            const sealed = open && !seen.has(key) && !opening.has(key)
            const cls = ['capsule-card', 'glass', open ? 'is-open' : 'is-locked', sealed ? 'is-sealed' : '', opening.has(key) ? 'opening' : ''].join(' ')
            return (
              <article key={key} className={cls}>
                <div className="capsule-head">
                  <span className="capsule-ico"><Icon name={open && !sealed ? 'unlock' : 'lock'} size={18} /></span>
                  <div className="capsule-titles">
                    <h3>{c.title || 'Cápsula'}</h3>
                    <p className="mono muted">De {c.author || 'Anónimo'} · {open ? `se abrió el ${formatDate(c.openAt)}` : `se abre el ${formatDate(c.openAt)}`}</p>
                  </div>
                  <button className="tool-btn danger" aria-label={`Eliminar cápsula ${c.title || ''}`} title="Eliminar" onClick={() => remove(c)}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>

                {!open && (
                  <div className="capsule-countdown" aria-live="off">
                    <Icon name="clock" size={16} />
                    <span>Faltan <b>{countdown(openAtOf(c) - now)}</b></span>
                  </div>
                )}

                {sealed && (
                  <button className="btn capsule-open-btn" onClick={() => openCapsule(c)}>
                    <Icon name="sparkles" /> Abrir cápsula
                  </button>
                )}

                {open && !sealed && (
                  <div className="capsule-body">
                    <p className="capsule-text">{c.text}</p>
                    {c.image && (
                      <button className="capsule-img" onClick={() => setViewer({ src: c.image, title: c.title })} aria-label="Ver foto en grande">
                        <img src={c.image} alt={c.title || 'Foto de la cápsula'} loading="lazy" />
                      </button>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {modal && (
        <Modal title="Nueva cápsula" subtitle="Elige cuándo se podrá abrir." onClose={() => setModal(false)}>
          <CapsuleForm onDone={() => { setModal(false); load() }} />
        </Modal>
      )}

      {viewer && (
        <Lightbox items={[{ type: 'image', src: viewer.src, title: viewer.title }]} index={0} onIndex={() => {}} onClose={() => setViewer(null)} />
      )}
    </section>
  )
}
