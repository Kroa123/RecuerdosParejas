import { useEffect, useState } from 'react'
import { createItem, deleteItem, listItems, updateItem } from '../lib/api'
import { fileToMedia, formatDate, videoLimitMB } from '../lib/media'
import { useToast } from '../components/Toast'
import VideoPlayer from '../components/VideoPlayer'
import Lightbox from '../components/Lightbox'

const AUTHOR_KEY = 'recuerdos.author'
const getAuthor = () => { try { return localStorage.getItem(AUTHOR_KEY) || '' } catch { return '' } }
const saveAuthor = (a) => { try { localStorage.setItem(AUTHOR_KEY, a) } catch { /* nada */ } }

function Composer({ onCreated }) {
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [media, setMedia] = useState([])
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const addFiles = async (files) => {
    setBusy(true)
    for (const f of files) {
      try {
        const m = await fileToMedia(f)
        setMedia((cur) => [...cur, m])
      } catch (e) {
        toast(e.message, 'error')
      }
    }
    setBusy(false)
  }

  const addLink = () => {
    if (!link.trim()) return
    setMedia((cur) => [...cur, { type: 'video', src: link.trim() }])
    setLink('')
  }

  const publish = async (e) => {
    e.preventDefault()
    if (!text.trim() && !media.length) return toast('Escribe algo o agrega una foto/video', 'error')
    setBusy(true)
    try {
      const item = await createItem('post', {
        title: title.trim(),
        text: text.trim(),
        media,
        moment: when ? new Date(when + 'T12:00:00').getTime() : null,
        comments: [],
        likes: 0,
      })
      onCreated(item)
      setText(''); setTitle(''); setWhen(''); setMedia([])
      toast('Recuerdo publicado 💕')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card composer" onSubmit={publish}>
      <div className="composer-head">
        <span className="avatar">♥</span>
        <input className="composer-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del recuerdo (opcional)" />
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="¿Qué momento quieres recordar hoy?" rows={3} />
      {media.length > 0 && (
        <div className="preview-grid">
          {media.map((m, i) => (
            <div key={i} className="preview">
              {m.type === 'image' ? <img src={m.src} alt="" /> : m.src.startsWith('data:') ? <video src={m.src} muted /> : <div className="link-chip">🎬 enlace</div>}
              <button type="button" onClick={() => setMedia(media.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div className="composer-tools">
        <label className="tool">
          📷 Fotos / videos
          <input type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = '' }} />
        </label>
        <label className="tool">
          📅 <input type="date" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        <div className="tool link-tool">
          🔗
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Enlace de YouTube / Drive" />
          <button type="button" className="mini" onClick={addLink}>Agregar</button>
        </div>
        <button className="btn" disabled={busy}>{busy ? 'Guardando…' : 'Publicar'}</button>
      </div>
      <p className="hint">Videos como archivo: hasta {videoLimitMB()} MB. Para videos más grandes pega un enlace.</p>
    </form>
  )
}

function MediaGallery({ media, onOpen }) {
  if (!media?.length) return null
  const cls = media.length === 1 ? 'one' : media.length === 2 ? 'two' : 'many'
  return (
    <div className={`post-media ${cls}`}>
      {media.slice(0, 4).map((m, i) => (
        <div key={i} className="post-media-item" onClick={() => m.type === 'image' && onOpen(media.slice(0, i).filter((x) => x.type === 'image').length)}>
          {m.type === 'image' ? <img src={m.src} alt="" loading="lazy" /> : <VideoPlayer src={m.src} />}
          {i === 3 && media.length > 4 && <div className="more" onClick={(e) => { e.stopPropagation(); onOpen(0) }}>+{media.length - 4}</div>}
        </div>
      ))}
    </div>
  )
}

function Post({ post, onChange, onDelete }) {
  const [comment, setComment] = useState('')
  const [author, setAuthor] = useState(getAuthor())
  const [liked, setLiked] = useState(false)
  const [lb, setLb] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const toast = useToast()

  const save = async (next) => {
    onChange(next)
    try { await updateItem(next) } catch (e) { toast(e.message, 'error'); onChange(post) }
  }

  const like = () => {
    setLiked(true)
    setTimeout(() => setLiked(false), 700)
    save({ ...post, likes: (post.likes || 0) + 1 })
  }

  const addComment = (e) => {
    e.preventDefault()
    if (!comment.trim()) return
    saveAuthor(author)
    save({
      ...post,
      comments: [...(post.comments || []), { id: Date.now(), author: author.trim() || 'Anónimo', text: comment.trim(), date: Date.now() }],
    })
    setComment('')
  }

  const removeComment = (id) => save({ ...post, comments: post.comments.filter((c) => c.id !== id) })

  const comments = post.comments || []
  const visible = showAll ? comments : comments.slice(-3)

  return (
    <article className="card post">
      <header className="post-head">
        <span className="avatar">♥</span>
        <div>
          <b>{post.title || 'Nuestro recuerdo'}</b>
          <small>{formatDate(post.moment || post.date)}</small>
        </div>
        <button className="icon-btn danger" title="Eliminar" onClick={() => confirmDelete(post, onDelete)}>🗑</button>
      </header>
      {post.text && <p className="post-text">{post.text}</p>}
      <MediaGallery media={post.media} onOpen={setLb} />
      <div className="post-actions">
        <button className={`like ${liked ? 'pop' : ''}`} onClick={like}>
          <span>♥</span> {post.likes || 0}
        </button>
        <span className="muted">💬 {comments.length} comentario{comments.length === 1 ? '' : 's'}</span>
      </div>
      <div className="comments">
        {comments.length > 3 && !showAll && (
          <button className="link" onClick={() => setShowAll(true)}>Ver los {comments.length} comentarios</button>
        )}
        {visible.map((c) => (
          <div key={c.id} className="comment">
            <b>{c.author}</b> {c.text}
            <button className="x" onClick={() => removeComment(c.id)} title="Borrar">✕</button>
          </div>
        ))}
        <form className="comment-form" onSubmit={addComment}>
          <input className="author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Tu nombre" />
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Escribe un comentario bonito…" />
          <button className="mini">Enviar</button>
        </form>
      </div>
      {lb !== null && (
        <Lightbox items={post.media.filter((m) => m.type === 'image')} index={lb} onIndex={setLb} onClose={() => setLb(null)} />
      )}
    </article>
  )
}

async function confirmDelete(post, onDelete) {
  if (window.confirm('¿Eliminar este recuerdo?')) onDelete(post)
}

export default function Recuerdos() {
  const [posts, setPosts] = useState(null)
  const toast = useToast()

  useEffect(() => {
    listItems('post').then(setPosts).catch((e) => { toast(e.message, 'error'); setPosts([]) })
  }, [toast])

  const remove = async (post) => {
    try {
      await deleteItem(post.id)
      setPosts((p) => p.filter((x) => x.id !== post.id))
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <section className="feed">
      <div className="section-head">
        <h2 className="script">Nuestros recuerdos</h2>
        <p>Cada momento contigo merece quedarse guardado aquí.</p>
      </div>
      <Composer onCreated={(p) => setPosts((cur) => [p, ...(cur || [])])} />
      {posts === null && <div className="loader">♥</div>}
      {posts?.length === 0 && <p className="empty">Aún no hay recuerdos. ¡Publica el primero! 💌</p>}
      {posts?.map((p) => (
        <Post
          key={p.id}
          post={p}
          onDelete={remove}
          onChange={(next) => setPosts((cur) => cur.map((x) => (x.id === next.id ? next : x)))}
        />
      ))}
    </section>
  )
}
