import { useEffect, useRef, useState } from 'react'
import { mutateItem } from '../lib/api'
import { myName, saveMyName } from '../lib/chat'
import { formatDate } from '../lib/media'
import { useToast } from './Toast'
import { useConfirm } from './Confirm'
import VideoPlayer from './VideoPlayer'
import Lightbox from './Lightbox'
import Icon from './Icon'

/*
 * Key por contenido (tipo + tamaño + final del src + repetición): se mantiene aunque el
 * servidor devuelva objetos nuevos tras un like, así los videos no se reinician.
 */
function contentKeys(list) {
  const seen = new Map()
  return list.map((m) => {
    const src = typeof m.src === 'string' ? m.src : ''
    const base = `${m.type}:${src.length}:${src.slice(-32)}`
    const n = (seen.get(base) || 0) + 1
    seen.set(base, n)
    return `${base}#${n}`
  })
}

/* Galería de una publicación (máx. 4 visibles; la 4.ª muestra "+N") */
function MediaGallery({ media, onOpen }) {
  if (!media?.length) return null
  const keys = contentKeys(media)
  const cls = media.length === 1 ? 'one' : media.length === 2 ? 'two' : 'many'
  return (
    <div className={`post-media ${cls}`}>
      {media.slice(0, 4).map((m, i) => {
        const more = i === 3 && media.length > 4
        // La imagen es el control con teclado (Enter / Espacio); el clic en el recuadro se mantiene para el ratón
        const keyOpen = (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(i) }
        }
        return (
          <div key={keys[i]} className={`post-media-item ${m.type}`} onClick={() => m.type === 'image' && onOpen(i)}>
            {m.type === 'image'
              ? <img src={m.src} alt="" loading="lazy" role="button" tabIndex={more ? -1 : 0} aria-label={`Ver foto ${i + 1} de ${media.length}`} onKeyDown={keyOpen} />
              : <VideoPlayer src={m.src} />}
            {more && (
              <button className="more" aria-label={`Ver ${media.length - 4} más`} onClick={(e) => { e.stopPropagation(); onOpen(media.findIndex((x) => x.type === 'image')) }}>
                +{media.length - 4}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

/*
 * Una publicación con likes, comentarios y visor.
 * onChange(fnOObjeto): actualiza la publicación en la lista del padre; acepta una función
 * (actual) => siguiente para aplicar/revertir cambios sin pisar otros más recientes.
 */
export default function PostCard({ post, onChange, onDelete, onEdit }) {
  const [comment, setComment] = useState('')
  const [author, setAuthor] = useState(myName())
  const [liked, setLiked] = useState(false)
  const [lb, setLb] = useState(null) // índice dentro de `images`
  const [showAll, setShowAll] = useState(false)
  const likeTimer = useRef(null)
  const toast = useToast()
  const confirm = useConfirm()

  useEffect(() => () => clearTimeout(likeTimer.current), [])

  const images = (post.media || []).map((m, i) => ({ ...m, _i: i })).filter((m) => m.type === 'image')

  /*
   * Cambio optimista + guardado sobre la versión más reciente del servidor (mutateItem).
   *   apply(x)  -> aplica el cambio sobre cualquier versión del registro
   *   revert(x) -> deshace solo este cambio si falla
   * Devuelve true si se guardó.
   */
  const save = async (apply, revert) => {
    onChange((cur) => apply(cur))
    try {
      const saved = await mutateItem(post.id, apply)
      onChange(saved)
      return true
    } catch (e) {
      toast(e.message, 'error')
      onChange((cur) => revert(cur))
      return false
    }
  }

  const like = () => {
    setLiked(true)
    clearTimeout(likeTimer.current)
    likeTimer.current = setTimeout(() => setLiked(false), 600)
    save(
      (x) => ({ ...x, likes: (x.likes || 0) + 1 }),
      (x) => ({ ...x, likes: Math.max(0, (x.likes || 0) - 1) }),
    )
  }

  const addComment = (e) => {
    e.preventDefault()
    if (!comment.trim()) return
    saveMyName(author)
    const c = { id: Date.now(), author: author.trim() || 'Anónimo', text: comment.trim(), date: Date.now() }
    save(
      (x) => ({ ...x, comments: [...(x.comments || []), c] }),
      (x) => ({ ...x, comments: (x.comments || []).filter((y) => y.id !== c.id) }),
    )
    setComment('')
  }

  const removeComment = (c) => save(
    (x) => ({ ...x, comments: (x.comments || []).filter((y) => y.id !== c.id) }),
    (x) => ((x.comments || []).some((y) => y.id === c.id) ? x : { ...x, comments: [...(x.comments || []), c].sort((a, b) => (a.date || 0) - (b.date || 0)) }),
  )

  const removeMedia = async (mediaIndex) => {
    const target = post.media?.[mediaIndex]
    if (!target) return false
    const ok = await confirm({ title: 'Quitar esta foto', message: 'Se quitará de este recuerdo.', confirmText: 'Quitar', danger: true })
    if (!ok) return false
    // Se busca por contenido (no por posición): en la versión del servidor el orden pudo cambiar
    const without = (x) => {
      const list = x.media || []
      const j = list.findIndex((m) => m.src === target.src && m.type === target.type)
      return j === -1 ? x : { ...x, media: list.filter((_, k) => k !== j) }
    }
    const saved = await save(without, (x) => ((x.media || []).some((m) => m.src === target.src) ? x : { ...x, media: [...(x.media || []), target] }))
    if (saved) toast('Foto quitada')
    return saved
  }

  const comments = post.comments || []
  const visible = showAll ? comments : comments.slice(-3)

  return (
    <article className="card post">
      <header className="post-head">
        <div className="post-date">
          <b>{new Date(post.moment || post.date).getDate()}</b>
          <span>{new Date(post.moment || post.date).toLocaleDateString('es', { month: 'short' }).replace('.', '')}</span>
        </div>
        <div className="post-title">
          <b>{post.title || 'Sin título'}</b>
          <small className="mono">
            {formatDate(post.moment || post.date, true)}
            {post.category && <> · <span className="tag">{post.category}</span></>}
          </small>
        </div>
        <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => onEdit(post)}><Icon name="pencil" size={16} /></button>
        <button className="icon-btn danger" title="Eliminar" aria-label="Eliminar" onClick={() => onDelete(post)}><Icon name="trash" size={16} /></button>
      </header>
      {post.text && <p className="post-text">{post.text}</p>}
      <MediaGallery media={post.media} onOpen={(mi) => setLb(Math.max(0, images.findIndex((m) => m._i === mi)))} />
      <div className="post-actions">
        <button className={`like ${liked ? 'pop' : ''}`} onClick={like} aria-label="Me gusta">
          <Icon name="heart" size={17} fill={(post.likes || 0) > 0} /> <span className="mono">{post.likes || 0}</span>
        </button>
        <span className="muted mono small"><Icon name="message" size={15} /> {comments.length}</span>
      </div>
      <div className="comments">
        {comments.length > 3 && !showAll && (
          <button className="link" onClick={() => setShowAll(true)}>Ver los {comments.length} comentarios</button>
        )}
        {visible.map((c) => (
          <div key={c.id} className="comment">
            <b>{c.author}</b> <span>{c.text}</span>
            <button className="x" onClick={() => removeComment(c)} title="Borrar comentario" aria-label="Borrar comentario">
              <Icon name="x" size={13} />
            </button>
          </div>
        ))}
        <form className="comment-form" onSubmit={addComment}>
          <input className="author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Tu nombre" aria-label="Tu nombre" />
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Escribe un comentario…" aria-label="Comentario" />
          <button className="mini" aria-label="Enviar"><Icon name="send" size={15} /></button>
        </form>
      </div>
      {lb !== null && images[lb] && (
        <Lightbox
          items={images}
          index={lb}
          onIndex={setLb}
          onClose={() => setLb(null)}
          onDelete={async (item, idx) => {
            const ok = await removeMedia(item._i)
            if (!ok) return
            const left = images.length - 1
            setLb(left <= 0 ? null : Math.min(idx, left - 1))
          }}
        />
      )}
    </article>
  )
}
