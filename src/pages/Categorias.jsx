import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildGroups, deleteCategory, loadScope } from '../lib/categories'
import { formatDate } from '../lib/media'
import { SCOPE_TEXT, plural } from '../lib/scopes'
import Modal from '../components/Modal'
import UploadForm from '../components/UploadForm'
import CategoryForm from '../components/CategoryForm'
import Icon from '../components/Icon'
import { VideoThumb } from '../components/VideoPlayer'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'

function Cover({ group, kind }) {
  const list = group.list
  if (!list.length)
    return (
      <div className="cover-empty">
        <Icon name={kind === 'video' ? 'film' : 'image'} size={28} />
        <span>Vacío</span>
      </div>
    )
  if (kind === 'video')
    return (
      <>
        <VideoThumb src={list[0].src} />
        <span className="play-badge"><Icon name="play" size={16} fill /></span>
      </>
    )
  if (list.length >= 3)
    return (
      <div className="mosaic">
        {list.slice(0, 3).map((p) => <img key={p.id} src={p.src} alt="" loading="lazy" />)}
      </div>
    )
  return <img src={list[0].src} alt="" loading="lazy" />
}

export function SkeletonGrid({ n = 6 }) {
  return (
    <div className="cat-grid">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="cat-card skeleton"><div className="cat-cover" /><div className="cat-body"><i /><i /></div></div>
      ))}
    </div>
  )
}

export default function Categorias({ kind }) {
  const t = SCOPE_TEXT[kind]
  const [data, setData] = useState(null)
  const [modal, setModal] = useState(null) // 'upload' | 'new' | {edit: group}
  const [q, setQ] = useState('')
  const toast = useToast()
  const confirm = useConfirm()

  // Cada carga invalida la anterior: una respuesta lenta de /fotos no pisa /videos
  const reqRef = useRef(0)
  const load = () => {
    const req = ++reqRef.current
    const alive = () => req === reqRef.current
    return loadScope(kind)
      .then((d) => { if (alive()) setData(d) })
      .catch((e) => { if (alive()) { toast(e.message, 'error'); setData({ items: [], cats: [] }) } })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setData(null); load(); return () => { reqRef.current++ } }, [kind])

  const groups = useMemo(() => (data ? buildGroups(data.items, data.cats) : []), [data])
  const filtered = groups.filter((g) => g.name.toLowerCase().includes(q.trim().toLowerCase()))
  const names = groups.map((g) => g.name)
  const total = data?.items.length || 0

  const remove = async (g) => {
    const ok = await confirm({
      title: `Eliminar "${g.name}"`,
      message: g.list.length
        ? `Se eliminarán también ${plural(g.list.length, t.unit)} de este lugar. No se puede deshacer.`
        : 'Este lugar está vacío.',
      confirmText: 'Eliminar lugar',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteCategory(g)
      toast(`"${g.name}" eliminado`)
      load()
    } catch (e) {
      toast(e.message, 'error')
      load() // puede que una parte sí se haya eliminado
    }
  }

  const stop = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn() }

  return (
    <section>
      <header className="page-head">
        <h1 className="page-title">{t.heading}</h1>
        <p className="page-sub">{t.sub}</p>
        <div className="page-actions">
          <button className="btn ghost" onClick={() => setModal('new')}><Icon name="folderPlus" /> Nuevo lugar</button>
          <button className="btn" onClick={() => setModal('upload')}><Icon name="upload" /> Subir {t.unit[1]}</button>
        </div>
      </header>

      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar lugar…" />
          {q && <button type="button" className="icon-btn" onClick={() => setQ('')} aria-label="Limpiar"><Icon name="x" size={14} /></button>}
        </label>
        {data && <span className="mono muted">{plural(groups.length, ['lugar', 'lugares'])} · {plural(total, t.unit)}</span>}
      </div>

      {!data && <SkeletonGrid />}

      {data && groups.length === 0 && (
        <div className="empty-state">
          <Icon name={t.icon} size={32} />
          <h3>Todavía no hay lugares</h3>
          <p>Crea un lugar (por ejemplo “Cusco 2025”) y empieza a subir {t.unit[1]}.</p>
          <div className="row gap center">
            <button className="btn ghost" onClick={() => setModal('new')}><Icon name="folderPlus" /> Nuevo lugar</button>
            <button className="btn" onClick={() => setModal('upload')}><Icon name="upload" /> Subir {t.unit[1]}</button>
          </div>
        </div>
      )}

      {data && groups.length > 0 && filtered.length === 0 && <p className="empty">Ningún lugar coincide con “{q}”.</p>}

      {data && filtered.length > 0 && (
        <div className="cat-grid">
          {filtered.map((g, i) => (
            // El enlace y las herramientas son hermanos (no hay botones dentro de un <a>)
            <div key={g.name} className="cat-card" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
              <Link to={`${t.base}/${encodeURIComponent(g.name)}`} className="cat-link">
                <div className="cat-cover">
                  <Cover group={g} kind={kind} />
                </div>
                <div className="cat-body">
                  <h3><Icon name="pin" size={15} /> {g.name}</h3>
                  {g.description && <p>{g.description}</p>}
                  <div className="cat-meta mono">
                    <span>{plural(g.list.length, t.unit)}</span>
                    {g.list[0] && <span>{formatDate(g.list[0].date, true)}</span>}
                  </div>
                </div>
              </Link>
              <div className="cat-tools">
                <button className="tool-btn" title="Editar lugar" aria-label={`Editar lugar ${g.name}`} onClick={stop(() => setModal({ edit: g }))}><Icon name="pencil" size={15} /></button>
                <button className="tool-btn danger" title="Eliminar lugar" aria-label={`Eliminar lugar ${g.name}`} onClick={stop(() => remove(g))}><Icon name="trash" size={15} /></button>
              </div>
            </div>
          ))}
          {!q && (
            <button className="cat-new" onClick={() => setModal('new')}>
              <Icon name="plus" size={22} />
              <span>Nuevo lugar</span>
            </button>
          )}
        </div>
      )}

      {modal === 'upload' && (
        <Modal title={`Subir ${t.unit[1]}`} subtitle="Elige el lugar donde se guardarán." onClose={() => setModal(null)}>
          <UploadForm kind={kind} categories={names} onDone={() => { setModal(null); load() }} />
        </Modal>
      )}
      {(modal === 'new' || modal?.edit) && (
        <Modal title={modal.edit ? 'Editar lugar' : 'Nuevo lugar'} onClose={() => setModal(null)}>
          <CategoryForm scope={kind} group={modal.edit} existing={names} onDone={() => { setModal(null); load() }} />
        </Modal>
      )}
    </section>
  )
}
