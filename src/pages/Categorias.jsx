import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listItems } from '../lib/api'
import { videoEmbed } from '../lib/media'
import Modal from '../components/Modal'
import UploadForm from '../components/UploadForm'
import { useToast } from '../components/Toast'

export function groupByCategory(items) {
  const map = new Map()
  for (const it of items) {
    const key = it.category || 'Sin lugar'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(it)
  }
  return [...map.entries()].map(([name, list]) => ({ name, list }))
}

function Cover({ item, kind }) {
  if (!item) return <div className="cover-empty">{kind === 'video' ? '🎬' : '📷'}</div>
  if (kind === 'photo') return <img src={item.src} alt="" loading="lazy" />
  const v = videoEmbed(item.src)
  const yt = v?.src.match(/youtube\.com\/embed\/([\w-]+)/)
  if (yt) return <img src={`https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`} alt="" loading="lazy" />
  if (v?.kind === 'file') return <video src={v.src + '#t=0.5'} muted preload="metadata" />
  return <div className="cover-empty">🎬</div>
}

export default function Categorias({ kind }) {
  const [items, setItems] = useState(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const toast = useToast()
  const isVideo = kind === 'video'
  const base = isVideo ? '/videos' : '/fotos'

  useEffect(() => {
    setItems(null)
    listItems(kind).then(setItems).catch((e) => { toast(e.message, 'error'); setItems([]) })
  }, [kind, toast])

  const groups = useMemo(() => groupByCategory(items || []), [items])
  const filtered = groups.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <section>
      <div className="section-head">
        <h2 className="script">{isVideo ? 'Nuestros videos' : 'Nuestras fotos'}</h2>
        <p>{isVideo ? 'Momentos en movimiento, ordenados por lugar.' : 'Cada lugar guarda un pedacito de nuestra historia.'}</p>
      </div>
      <div className="toolbar">
        <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar lugar…" />
        <button className="btn" onClick={() => setOpen(true)}>+ {isVideo ? 'Subir videos' : 'Subir fotos'}</button>
      </div>

      {items === null && <div className="loader">♥</div>}
      {items && groups.length === 0 && (
        <button className="empty-card" onClick={() => setOpen(true)}>
          <span>{isVideo ? '🎬' : '📷'}</span>
          Crea tu primer lugar y sube {isVideo ? 'videos' : 'fotos'}
        </button>
      )}

      <div className="cat-grid">
        {filtered.map((g, i) => (
          <Link key={g.name} to={`${base}/${encodeURIComponent(g.name)}`} className="cat-card" style={{ animationDelay: `${i * 0.07}s` }}>
            <div className="cat-cover">
              <Cover item={g.list[0]} kind={kind} />
              {isVideo && <span className="play">▶</span>}
            </div>
            <div className="cat-info">
              <h3>📍 {g.name}</h3>
              <span>{g.list.length} {isVideo ? 'video' : 'foto'}{g.list.length === 1 ? '' : 's'}</span>
            </div>
          </Link>
        ))}
      </div>

      {open && (
        <Modal title={isVideo ? 'Subir videos' : 'Subir fotos'} onClose={() => setOpen(false)}>
          <UploadForm
            kind={kind}
            categories={groups.map((g) => g.name)}
            onDone={(created) => { setItems((cur) => [...created, ...(cur || [])]); setOpen(false) }}
          />
        </Modal>
      )}
    </section>
  )
}
