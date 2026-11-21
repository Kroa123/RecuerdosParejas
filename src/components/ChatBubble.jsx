import { initial, timeOf } from '../lib/chat'
import Icon from './Icon'

/* Un mensaje del chat (burbuja + hora + acciones) */
export default function ChatBubble({ m, mine, author, me, onHeart, onDelete, onOpen }) {
  const hearts = m.hearts || []
  const liked = hearts.includes(me)
  return (
    <div className={`msg ${mine ? 'mine' : 'theirs'} ${m.pending ? 'pending' : ''}`}>
      {!mine && <span className="avatar sm">{initial(author)}</span>}
      <div className="msg-col">
        <div className="bubble" onDoubleClick={() => onHeart(m)} title="Doble clic para darle un corazón">
          {m.image && <img src={m.image} alt="" onClick={() => onOpen(m.image)} />}
          {m.text && <p>{m.text}</p>}
          {hearts.length > 0 && <span className="msg-heart"><Icon name="heart" size={11} fill />{hearts.length > 1 ? hearts.length : ''}</span>}
        </div>
        <div className="msg-meta">
          <span>{mine ? 'Tú' : author} · {m.pending ? 'enviando…' : timeOf(m.date)}</span>
          <button className={`msg-act ${liked ? 'on' : ''}`} onClick={() => onHeart(m)} aria-label="Corazón" aria-pressed={liked}><Icon name="heart" size={12} fill={liked} /></button>
          {mine && !m.pending && <button className="msg-act" onClick={() => onDelete(m)} aria-label="Borrar mensaje"><Icon name="trash" size={12} /></button>}
        </div>
      </div>
    </div>
  )
}
