import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteItem } from '../lib/api'
import { buildGroups, deleteCategory, loadScope } from '../lib/categories'
import { formatDate } from '../lib/media'
import { SCOPE_TEXT, plural } from '../lib/scopes'
import Modal from '../components/Modal'
import UploadForm from '../components/UploadForm'
import CategoryForm from '../components/CategoryForm'
import Lightbox from '../components/Lightbox'
import VideoPlayer from '../components/VideoPlayer'
import Icon from '../components/Icon'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'

export default function CategoriaDetalle({ kind }) {
  const { categoria } = useParams()
  // React Router ya entrega el parámetro decodificado (decodificar otra vez rompe nombres como "100% amor")
  const name = categoria || ''
  const t = SCOPE_TEXT[kind]
  const isVideo = kind === 'video'
  const [data, setData] = useState(null)
  const [modal, setModal] = useState(null) // 'upload' | 'edit'
  const [lb, setLb] = useState(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()

  // Cada carga invalida la anterior: una respuesta lenta de otro tipo no pisa el estado
  const reqRef = useRef(0)
  const load = () => {
    const req = ++reqRef.current
    const alive = () => req === reqRef.current
    return loadScope(kind)
      .then((d) => { if (alive()) setData(d) })
      .catch((e) => { if (alive()) { toast(e.message, 'error'); setData({ items: [], cats: [] }) } })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); return () => { reqRef.current++ } }, [kind, name])

  const groups = useMemo(() => (data ? buildGroups(data.items, data.cats) : []), [data])
  const group = groups.find((g) => g.name === name)
  const items = group?.list || []

  const dropLocal = (ids) => {
    setData((d) => ({ ...d, items: d.items.filter((i) => !ids.includes(i.id)) }))
    // un lugar sin entidad propia desaparece al quedar vacío: volver a la lista
    if (group && !group.entity && ids.length >= items.length) navigate(t.base)
  }

  const removeOne = async (item) => {
    const ok = await confirm({
      title: `Eliminar ${t.unit[0]}`,
      message: item.title ? `"${item.title}" se eliminará para siempre.` : 'Se eliminará para siempre.',
      confirmText: 'Eliminar',
      danger: true,
    })
    if (!ok) return false
    try {
      await deleteItem(item.id)
      dropLocal([item.id])
      toast(isVideo ? 'Video eliminado' : 'Foto eliminada')
      return true
    } catch (e) {
      toast(e.message, 'error')
      return false
    }
  }

  const removeSelected = async () => {
    const ids = [...selected]
    if (!ids.length) return
    const ok = await confirm({
      title: `Eliminar ${plural(ids.length, t.unit)}`,
      message: 'Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    const done = []
    for (const id of ids) {
      try { await deleteItem(id); done.push(id) } catch (e) { toast(e.message, 'error'); break }
    }
    dropLocal(done)
    setSelected(new Set())
    setSelecting(false)
    setBusy(false)
    if (done.length) toast(`${plural(done.length, t.unit)} eliminada(s)`)
  }

  const removeCategory = async () => {
    const ok = await confirm({
      title: `Eliminar "${name}"`,
      message: items.length ? `Se eliminarán también ${plural(items.length, t.unit)}. No se puede deshacer.` : 'Este lugar está vacío.',
      confirmText: 'Eliminar lugar',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await deleteCategory(group)
      toast(`"${name}" eliminado`)
      navigate(t.base)
    } catch (e) {
      toast(e.message, 'error')
      setBusy(false)
      load() // puede que una parte sí se haya eliminado
    }
  }

  const toggle = (id) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const onTile = (i, item) => (selecting ? toggle(item.id) : setLb(i))
  const exitSelect = () => { setSelecting(false); setSelected(new Set()) }
  const allSelected = items.length > 0 && selected.size === items.length

  return (
    <section>
      <Link to={t.base} className="back"><Icon name="arrowLeft" size={16} /> {t.title}</Link>

      <header className="page-head detail">
        <h1 className="page-title">{name}</h1>
        {group?.description && <p className="page-sub">{group.description}</p>}
        {data && group && (
          <p className="mono muted small">
            {plural(items.length, t.unit)}{items[0] ? ` · última el ${formatDate(items[0].date, true)}` : ''}
          </p>
        )}
        {group && (
          <div className="page-actions">
            <button className="btn ghost" onClick={() => setModal('edit')}><Icon name="pencil" /> Editar</button>
            <button className="btn ghost danger-text" onClick={removeCategory} disabled={busy}><Icon name="trash" /> Eliminar lugar</button>
            {items.length > 0 && !selecting && (
              <button className="btn ghost" onClick={() => setSelecting(true)}><Icon name="select" /> Seleccionar</button>
            )}
            <button className="btn" onClick={() => setModal('upload')}><Icon name="plus" /> Agregar {t.unit[1]}</button>
          </div>
        )}
      </header>

      {selecting && (
        <div className="sel-bar">
          <span className="mono">{selected.size} seleccionada(s)</span>
          <button className="btn subtle sm" onClick={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))}>
            {allSelected ? 'Quitar selección' : 'Seleccionar todo'}
          </button>
          <span className="spacer" />
          <button className="btn subtle sm" onClick={exitSelect}>Cancelar</button>
          <button className="btn danger sm" disabled={!selected.size || busy} onClick={removeSelected}>
            <Icon name="trash" size={15} /> Eliminar{selected.size ? ` (${selected.size})` : ''}
          </button>
        </div>
      )}

      {!data && <div className="gallery skeleton-gallery">{Array.from({ length: 6 }, (_, i) => <div key={i} className="tile skeleton" />)}</div>}

      {data && !group && (
        <div className="empty-state">
          <Icon name="folder" size={32} />
          <h3>Este lugar no existe</h3>
          <p>Puede que lo hayan renombrado o eliminado.</p>
          <Link to={t.base} className="btn ghost">Ver todos los lugares</Link>
        </div>
      )}

      {group && items.length === 0 && (
        <button className="empty-state as-button" onClick={() => setModal('upload')}>
          <Icon name="upload" size={32} />
          <h3>Este lugar está vacío</h3>
          <p>Haz clic para agregar las primeras {t.unit[1]}.</p>
        </button>
      )}

      {group && items.length > 0 && !isVideo && (
        <div className={`gallery ${selecting ? 'selecting' : ''}`}>
          {items.map((p, i) => (
            <figure
              key={p.id}
              className={`tile ${selected.has(p.id) ? 'is-selected' : ''}`}
              style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
              onClick={() => onTile(i, p)}
              role="button"
              tabIndex={0}
              aria-label={selecting ? `Seleccionar ${p.title || `foto ${i + 1}`}` : `Ver ${p.title || `foto ${i + 1}`}`}
              aria-pressed={selecting ? selected.has(p.id) : undefined}
              onKeyDown={(e) => {
                // solo cuando el foco está en la tarjeta (no en el botón de eliminar)
                if (e.target !== e.currentTarget) return
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTile(i, p) }
              }}
            >
              <img src={p.src} alt={p.title || ''} loading="lazy" />
              {selecting ? (
                <span className="tile-check">{selected.has(p.id) && <Icon name="check" size={14} />}</span>
              ) : (
                <button className="tile-del" title="Eliminar foto" aria-label="Eliminar foto" onClick={(e) => { e.stopPropagation(); removeOne(p) }}>
                  <Icon name="trash" size={15} />
                </button>
              )}
              {p.title && <figcaption>{p.title}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      {group && items.length > 0 && isVideo && (
        <div className="video-grid">
          {items.map((v, i) => (
            <div
              key={v.id}
              className={`card video-card ${selected.has(v.id) ? 'is-selected' : ''}`}
              style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
            >
              <div className="video-wrap">
                <VideoPlayer src={v.src} />
                {selecting && (
                  <button className="select-overlay" onClick={() => toggle(v.id)} aria-label={`Seleccionar ${v.title || 'video'}`} aria-pressed={selected.has(v.id)}>
                    <span className="tile-check">{selected.has(v.id) && <Icon name="check" size={14} />}</span>
                  </button>
                )}
              </div>
              <div className="video-meta">
                <div>
                  <b>{v.title || 'Sin descripción'}</b>
                  <small className="mono">{formatDate(v.date, true)}</small>
                </div>
                {!selecting && (
                  <button className="btn ghost sm danger-text" onClick={() => removeOne(v)}>
                    <Icon name="trash" size={15} /> Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {lb !== null && items[lb] && (
        <Lightbox
          items={items.map((p) => ({ type: 'image', src: p.src, title: p.title, id: p.id }))}
          index={lb}
          onIndex={setLb}
          onClose={() => setLb(null)}
          onDelete={async (_, idx) => {
            const ok = await removeOne(items[idx])
            if (!ok) return
            const left = items.length - 1
            if (left <= 0) setLb(null)
            else setLb(Math.min(idx, left - 1))
          }}
        />
      )}

      {modal === 'upload' && group && (
        <Modal title={`Agregar ${t.unit[1]}`} subtitle={`Se guardarán en "${name}".`} onClose={() => setModal(null)}>
          <UploadForm kind={kind} categories={groups.map((g) => g.name)} defaultCategory={name} onDone={() => { setModal(null); load() }} />
        </Modal>
      )}
      {modal === 'edit' && group && (
        <Modal title="Editar lugar" onClose={() => setModal(null)}>
          <CategoryForm
            scope={kind}
            group={group}
            existing={groups.map((g) => g.name)}
            onDone={(saved) => {
              setModal(null)
              if (saved.name !== name) navigate(`${t.base}/${encodeURIComponent(saved.name)}`, { replace: true })
              else load()
            }}
          />
        </Modal>
      )}
    </section>
  )
}
