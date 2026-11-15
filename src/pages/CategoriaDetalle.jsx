import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteItem, listItems, updateItem } from '../lib/api'
import { formatDate } from '../lib/media'
import Modal from '../components/Modal'
import UploadForm from '../components/UploadForm'
import Lightbox from '../components/Lightbox'
import VideoPlayer from '../components/VideoPlayer'
import { useToast } from '../components/Toast'

export default function CategoriaDetalle({ kind }) {
  const { categoria } = useParams()
  const name = decodeURIComponent(categoria)
  const [items, setItems] = useState(null)
  const [all, setAll] = useState([])
  const [open, setOpen] = useState(false)
  const [lb, setLb] = useState(null)
  const toast = useToast()
  const navigate = useNavigate()
  const isVideo = kind === 'video'
  const base = isVideo ? '/videos' : '/fotos'

  useEffect(() => {
    listItems(kind)
      .then((list) => { setAll(list); setItems(list.filter((i) => (i.category || 'Sin lugar') === name)) })
      .catch((e) => { toast(e.message, 'error'); setItems([]) })
  }, [kind, name, toast])

  const remove = async (item) => {
    if (!window.confirm(`¿Eliminar este ${isVideo ? 'video' : 'foto'}?`)) return
    try {
      await deleteItem(item.id)
      const next = items.filter((i) => i.id !== item.id)
      setItems(next)
      if (!next.length) navigate(base)
    } catch (e) { toast(e.message, 'error') }
  }

  const rename = async () => {
    const nuevo = window.prompt('Nuevo nombre del lugar', name)?.trim()
    if (!nuevo || nuevo === name) return
    try {
      for (const it of items) await updateItem({ ...it, category: nuevo })
      toast('Lugar renombrado')
      navigate(`${base}/${encodeURIComponent(nuevo)}`, { replace: true })
    } catch (e) { toast(e.message, 'error') }
  }

  const categories = [...new Set(all.map((i) => i.category))]

  return (
    <section>
      <Link to={base} className="back">← Todos los lugares</Link>
      <div className="section-head">
        <h2 className="script">📍 {name}</h2>
        <p>{items ? `${items.length} ${isVideo ? 'video' : 'foto'}${items.length === 1 ? '' : 's'}` : ''}</p>
      </div>
      <div className="toolbar">
        <button className="btn ghost" onClick={rename}>✎ Renombrar lugar</button>
        <button className="btn" onClick={() => setOpen(true)}>+ Agregar {isVideo ? 'videos' : 'fotos'}</button>
      </div>

      {items === null && <div className="loader">♥</div>}

      {isVideo ? (
        <div className="video-grid">
          {items?.map((v, i) => (
            <div key={v.id} className="card video-card" style={{ animationDelay: `${i * 0.06}s` }}>
              <VideoPlayer src={v.src} />
              <div className="video-meta">
                <div>
                  {v.title && <b>{v.title}</b>}
                  <small>{formatDate(v.date)}</small>
                </div>
                <button className="icon-btn danger" onClick={() => remove(v)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="masonry">
          {items?.map((p, i) => (
            <figure key={p.id} className="photo" style={{ animationDelay: `${i * 0.05}s` }} onClick={() => setLb(i)}>
              <img src={p.src} alt={p.title || ''} loading="lazy" />
              <figcaption>
                <span>{p.title}</span>
                <button className="icon-btn danger" onClick={(e) => { e.stopPropagation(); remove(p) }}>🗑</button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {lb !== null && items && (
        <Lightbox items={items.map((p) => ({ type: 'image', src: p.src, title: p.title }))} index={lb} onIndex={setLb} onClose={() => setLb(null)} />
      )}

      {open && (
        <Modal title={`Agregar a ${name}`} onClose={() => setOpen(false)}>
          <UploadForm
            kind={kind}
            categories={categories}
            defaultCategory={name}
            onDone={(created) => {
              setItems((cur) => [...created.filter((c) => c.category === name), ...(cur || [])])
              setOpen(false)
            }}
          />
        </Modal>
      )}
    </section>
  )
}
