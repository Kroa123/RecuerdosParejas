import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { hasReaction, initial, isNudge, reactionsOf, REACTIONS, timeOf } from '../lib/chat'
import Icon from './Icon'

const LONG_PRESS_MS = 450
const MOVE_TOLERANCE = 10 // px que se puede mover el dedo sin cancelar la pulsación larga
const PICKER_SPACE = 56 // px libres que necesita el selector encima del botón; si no, se abre debajo

/* Chips de reacciones debajo de la burbuja: emoji + cantidad; el propio resaltado */
function Reactions({ m, me, onReact }) {
  const list = reactionsOf(m)
  if (!list.length) return null
  return (
    <div className="msg-reactions">
      {list.map(({ emoji, names }) => {
        const own = !!me && names.includes(me)
        const who = names.join(', ')
        return (
          <button
            key={emoji}
            type="button"
            className={`react-chip ${own ? 'on' : ''}`}
            onClick={() => onReact(m, emoji)}
            disabled={m.pending || !me}
            aria-pressed={own}
            aria-label={`${emoji} ${names.length}: ${who}. ${own ? 'Quitar tu reacción' : 'Reaccionar igual'}`}
            title={who}
          >
            <span aria-hidden="true">{emoji}</span>
            {names.length > 1 && <b>{names.length}</b>}
          </button>
        )
      })}
    </div>
  )
}

/* Selector de emojis. Se cierra con Escape, clic fuera, al tabular fuera o al elegir. */
function ReactionPicker({ id, m, me, onPick, onClose, emojis, returnFocus }) {
  const ref = useRef(null)
  const [below, setBelow] = useState(false)

  // Si no cabe encima (poco espacio respecto a la parte de arriba de .chat-list), se abre debajo
  useLayoutEffect(() => {
    const btn = returnFocus?.current
    const list = btn?.closest('.chat-list')
    if (!btn || !list) return
    if (btn.getBoundingClientRect().top - list.getBoundingClientRect().top < PICKER_SPACE) setBelow(true)
  }, [returnFocus])

  useEffect(() => {
    ref.current?.querySelector('button')?.focus()
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
      returnFocus?.current?.focus()
    }
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target) && !returnFocus?.current?.contains(e.target)) onClose() }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [onClose, returnFocus])

  // Flechas izquierda/derecha para moverse entre emojis; Inicio/Fin van al primero/último
  const onKeyDown = (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return
    const btns = [...ref.current.querySelectorAll('button')]
    const i = btns.indexOf(document.activeElement)
    let next
    if (e.key === 'Home') next = btns[0]
    else if (e.key === 'End') next = btns[btns.length - 1]
    else next = btns[(i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length]
    next?.focus()
    e.preventDefault()
  }

  // Al tabular fuera (foco a algo que no es el menú ni el botón ☺) se cierra
  const onBlur = (e) => {
    const to = e.relatedTarget
    if (!to || ref.current?.contains(to) || returnFocus?.current?.contains(to)) return
    onClose()
  }

  return (
    <div id={id} className={`react-picker ${below ? 'below' : ''}`} role="menu" aria-label="Elegir reacción" ref={ref} onKeyDown={onKeyDown} onBlur={onBlur}>
      {emojis.map((emoji) => {
        const on = hasReaction(m, emoji, me)
        return (
          <button
            key={emoji}
            type="button"
            role="menuitemcheckbox"
            aria-checked={on}
            className={`react-option ${on ? 'on' : ''}`}
            onClick={() => { onPick(m, emoji); onClose(); returnFocus?.current?.focus() }}
            aria-label={on ? `Quitar ${emoji}` : `Reaccionar con ${emoji}`}
          >
            {emoji}
          </button>
        )
      })}
    </div>
  )
}

/*
 * Un mensaje del chat (burbuja + hora + acciones + reacciones). Los "Pensando en ti" se muestran centrados.
 * Se exporta envuelto en memo: Chat.jsx le pasa callbacks estables (useCallback).
 */
function ChatBubble({ m, mine, author, me, onHeart, onReact, onDelete, onOpen }) {
  const [picking, setPicking] = useState(false)
  const menuId = useId()
  const press = useRef(null) // { timer, x, y } mientras dura una pulsación táctil
  const longFired = useRef(false)
  const reactBtn = useRef(null)
  const hearts = m.hearts || []
  const liked = hearts.includes(me)
  const nudge = isNudge(m)
  const canReact = !m.pending && !!me && !!onReact
  // Los "Pensando en ti" solo aceptan ❤️ (con el botón de corazón); no abren el selector
  const canPick = canReact && !nudge
  const react = onReact || ((x) => onHeart(x))

  useEffect(() => () => { if (press.current) clearTimeout(press.current.timer) }, [])

  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
  }

  /* Pulsación larga (solo táctil o lápiz) para abrir el selector */
  const onPointerDown = (e) => {
    longFired.current = false
    if (!canPick || e.pointerType === 'mouse') return
    cancelPress()
    press.current = {
      x: e.clientX,
      y: e.clientY,
      timer: setTimeout(() => {
        press.current = null
        longFired.current = true
        navigator.vibrate?.(15)
        setPicking(true)
      }, LONG_PRESS_MS),
    }
  }
  const onPointerMove = (e) => {
    const p = press.current
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_TOLERANCE) cancelPress()
  }
  // Tras una pulsación larga, el clic al soltar no debe abrir la foto
  const onClickCapture = (e) => {
    if (!longFired.current) return
    longFired.current = false
    e.preventDefault()
    e.stopPropagation()
  }
  const onContextMenu = (e) => { if (press.current || longFired.current) e.preventDefault() }

  // Identidad estable: así el selector no reinstala sus listeners en cada render
  const closePicker = useCallback(() => setPicking(false), [])

  const meta = (
    <div className="msg-meta">
      <span>{nudge ? '' : `${mine ? 'Tú' : author} · `}{m.pending ? 'enviando…' : timeOf(m.date)}</span>
      <button type="button" className={`msg-act ${liked ? 'on' : ''}`} onClick={() => onHeart(m)} disabled={m.pending} aria-label="Corazón" aria-pressed={liked}><Icon name="heart" size={12} fill={liked} /></button>
      {canPick && (
        <span className="react-wrap">
          <button
            type="button"
            ref={reactBtn}
            className={`msg-act react-btn ${picking ? 'on' : ''}`}
            onClick={() => setPicking((v) => !v)}
            aria-label="Reaccionar con un emoji"
            aria-haspopup="menu"
            aria-expanded={picking}
            aria-controls={picking ? menuId : undefined}
            title="Reaccionar"
          >
            <span aria-hidden="true">☺</span>
          </button>
          {picking && <ReactionPicker id={menuId} m={m} me={me} emojis={REACTIONS} onPick={react} onClose={closePicker} returnFocus={reactBtn} />}
        </span>
      )}
      {mine && !m.pending && <button type="button" className="msg-act" onClick={() => onDelete(m)} aria-label="Borrar mensaje"><Icon name="trash" size={12} /></button>}
    </div>
  )

  if (nudge) {
    return (
      <div className={`msg-nudge ${mine ? 'mine' : 'theirs'} ${m.pending ? 'pending' : ''}`}>
        <div className="nudge-pill" onDoubleClick={() => onHeart(m)} title="Doble clic para darle un corazón">
          <span className="nudge-heart" aria-hidden="true">💗</span>
          <span>{mine ? 'Enviaste un «Pensando en ti»' : `${author} está pensando en ti`}</span>
        </div>
        <Reactions m={m} me={me} onReact={react} />
        {meta}
      </div>
    )
  }

  return (
    <div className={`msg ${mine ? 'mine' : 'theirs'} ${m.pending ? 'pending' : ''} ${picking ? 'picking' : ''}`}>
      {!mine && <span className="avatar sm">{initial(author)}</span>}
      <div className="msg-col">
        <div
          className="bubble"
          onDoubleClick={() => onHeart(m)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={cancelPress}
          onPointerCancel={cancelPress}
          onPointerLeave={cancelPress}
          onClickCapture={onClickCapture}
          onContextMenu={onContextMenu}
          title={canPick ? 'Doble clic para darle un corazón · mantén presionado para reaccionar' : 'Doble clic para darle un corazón'}
        >
          {m.image && <img src={m.image} alt="" onClick={() => onOpen(m.image)} />}
          {m.text && <p>{m.text}</p>}
        </div>
        <Reactions m={m} me={me} onReact={react} />
        {meta}
      </div>
    </div>
  )
}

export default memo(ChatBubble)
