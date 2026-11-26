import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getConfig } from '../lib/api'
import { compressImage } from '../lib/media'
import { cachedCouple, loadCouple } from '../lib/couple'
import { authorOf, dayKey, dayLabel, GENERAL, initial, myName, readTopicSeen, saveMyName, topicOf, typingLabel, writeTopicSeen } from '../lib/chat'
import { useChatMessages } from '../hooks/useChatMessages'
import { useTyping } from '../hooks/useTyping'
import { disablePush, enablePush, pushAvailable, pushStatus, renamePush } from '../lib/push'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import Lightbox from '../components/Lightbox'
import ChatBubble from '../components/ChatBubble'
import ChatInput from '../components/ChatInput'
import NudgeButton from '../components/NudgeButton'
import Icon from '../components/Icon'

/*
 * Un solo chat para los dos, separado en pestañas por tema.
 *   message:   { topic, author, text, image?, hearts: [nombres], reactions?: { emoji: [nombres] }, type?: 'nudge', date }
 *   chatTopic: { name, date }
 *   typing:    { author, at }  (solo modo remoto; ver hooks/useTyping.js)
 * "General" siempre existe. Los mensajes antiguos sin tema van a General.
 * Identidad y "leídos" en src/lib/chat.js; sondeo y acciones en src/hooks/useChatMessages.js.
 */

const QUICK = ['Te amo', 'Te extraño mucho', 'Buenos días, mi amor', 'Buenas noches, sueña conmigo', 'Eres mi persona favorita', '¿Hablamos un rato?']
const SUGGESTED = ['Planes juntos', 'Nuestras canciones', 'Buenas noches', 'Lugares por conocer']

export default function Chat() {
  const [couple, setCouple] = useState(cachedCouple())
  const [me, setMe] = useState(myName())
  const [editingName, setEditingName] = useState(!myName())
  const [nameDraft, setNameDraft] = useState(myName())
  const [tab, setTab] = useState(GENERAL)
  const [seen, setSeen] = useState(readTopicSeen())
  const [newTopic, setNewTopic] = useState(null) // null = cerrado, '' = escribiendo
  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
  const [sending, setSending] = useState(false)
  const [lb, setLb] = useState(null)
  const [push, setPush] = useState(null) // null = comprobando | 'on' | 'off' | 'denied' | 'unavailable'
  const [pushBusy, setPushBusy] = useState(false)
  const listRef = useRef(null)
  const stick = useRef(true)
  const toast = useToast()
  const confirm = useConfirm()
  const remote = getConfig().mode === 'remote'
  const { msgs, topics, typing, send: sendMessage, toggleHeart, toggleReaction, remove: removeMessage, addTopic: createTopic, removeTopic: moveTopicToGeneral } = useChatMessages(me)
  useTyping(me, text, remote)

  useEffect(() => {
    let alive = true
    loadCouple().then((c) => { if (alive) setCouple(c) }).catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    pushStatus().then((s) => { if (alive) setPush(s) })
    return () => { alive = false }
  }, [])

  const tabNames = useMemo(() => {
    const names = [GENERAL, ...topics.map((t) => t.name)]
    for (const m of msgs || []) if (!names.includes(topicOf(m))) names.push(topicOf(m))
    return names
  }, [topics, msgs])

  const unreadBy = useMemo(() => {
    const out = {}
    for (const m of msgs || []) {
      const t = topicOf(m)
      if (t !== tab && authorOf(m, couple) !== me && (m.date || 0) > (seen[t] || 0)) out[t] = (out[t] || 0) + 1
    }
    return out
  }, [msgs, seen, tab, me, couple])

  const visible = useMemo(() => (msgs || []).filter((m) => topicOf(m) === tab), [msgs, tab])

  // Al estar en una pestaña se marca como leída; solo cuando cambia la pestaña o llega
  // un mensaje nuevo a ella (no en cada sondeo)
  const loaded = msgs !== null
  const visibleCount = visible.length
  const lastVisibleId = visible.length ? visible[visible.length - 1].id : ''
  useEffect(() => {
    if (!loaded) return
    const next = { ...readTopicSeen(), [tab]: Date.now() }
    writeTopicSeen(next)
    setSeen(next)
  }, [loaded, tab, visibleCount, lastVisibleId])

  const grouped = useMemo(() => {
    const out = []
    let last = ''
    for (const m of visible) {
      const k = dayKey(m.date)
      if (k !== last) { out.push({ day: m.date, id: `d-${k}` }); last = k }
      out.push(m)
    }
    return out
  }, [visible])

  useLayoutEffect(() => {
    const el = listRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [grouped])
  useEffect(() => { stick.current = true }, [tab])
  const onScroll = () => {
    const el = listRef.current
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const saveName = (e) => {
    e?.preventDefault()
    const n = nameDraft.trim()
    if (!n) return toast('Escribe tu nombre para firmar tus mensajes', 'error')
    saveMyName(n); setMe(n); setEditingName(false)
    if (push === 'on') renamePush(n).catch(() => toast('No se pudo actualizar tu nombre en los avisos', 'error'))
  }

  const togglePush = async () => {
    if (pushBusy) return
    if (!me) { setEditingName(true); return toast('Primero escribe tu nombre', 'error') }
    setPushBusy(true)
    try {
      if (push === 'on') {
        await disablePush()
        setPush('off')
        toast('Notificaciones desactivadas en este dispositivo')
      } else {
        await enablePush(me)
        setPush('on')
        toast('Listo: te avisaremos cuando te escriban, aunque la página esté cerrada')
      }
    } catch (e) {
      toast(e.message, 'error')
      setPush(await pushStatus())
    } finally {
      setPushBusy(false)
    }
  }

  const send = async (e, quick) => {
    e?.preventDefault()
    if (!me) { setEditingName(true); return toast('Primero escribe tu nombre', 'error') }
    const body = (quick ?? text).trim()
    if (!body && !image) return
    const draft = { topic: tab, author: me, text: body, image: quick ? null : image, hearts: [], date: Date.now() }
    stick.current = true
    if (!quick) { setText(''); setImage(null) }
    setSending(true)
    const ok = await sendMessage(draft)
    if (!ok && !quick) { setText(body); setImage(draft.image) }
    setSending(false)
  }

  // Callbacks estables: ChatBubble va en memo y así escribir o el indicador "escribiendo…" no re-renderizan cada burbuja
  const heart = useCallback((m) => toggleHeart(m, me), [toggleHeart, me])
  const react = useCallback((m, emoji) => toggleReaction(m, emoji, me), [toggleReaction, me])

  // "Pensando en ti": mismo flujo de envío (optimista + aviso push)
  const sendNudge = (draft) => { stick.current = true; return sendMessage(draft) }
  const askName = () => { setEditingName(true); toast('Primero escribe tu nombre', 'error') }

  const remove = useCallback(async (m) => {
    const ok = await confirm({
      title: '¿Borrar este mensaje?',
      message: 'Se borrará para los dos y no se puede deshacer.',
      confirmText: 'Borrar',
      danger: true,
    })
    if (ok) removeMessage(m)
  }, [confirm, removeMessage])

  const addTopic = async (name) => {
    const n = (name || '').trim()
    if (!n) return setNewTopic(null)
    if (tabNames.some((t) => t.toLowerCase() === n.toLowerCase())) { setTab(tabNames.find((t) => t.toLowerCase() === n.toLowerCase())); return setNewTopic(null) }
    const saved = await createTopic(n)
    if (saved) {
      setTab(n)
      setNewTopic(null)
    }
  }

  const removeTopic = async (name) => {
    const count = (msgs || []).filter((m) => topicOf(m) === name).length
    const ok = await confirm({
      title: `¿Eliminar el tema "${name}"?`,
      message: count ? `Sus ${count} mensaje(s) se moverán a General.` : 'No tiene mensajes.',
      confirmText: 'Eliminar tema',
      danger: true,
    })
    if (!ok) return
    if (await moveTopicToGeneral(name)) setTab(GENERAL)
  }

  const pickImage = async (file) => {
    if (!file) return
    try { setImage(await compressImage(file)) } catch (e) { toast(e.message, 'error') }
  }

  const isCustom = topics.some((t) => t.name === tab)

  return (
    <section className="chat-page">
      <div className="chat glass">
        <header className="chat-head">
          <span className="chat-logo"><Icon name="message" size={20} /></span>
          <div className="chat-title">
            <b>Nuestro chat</b>
            <small>{remote ? `${couple.names.M} y ${couple.names.D} · se actualiza solo` : 'Modo local: configura la Mock API para escribirse desde dos celulares'}</small>
          </div>
          {editingName ? (
            <form className="name-form" onSubmit={saveName}>
              <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="Tu nombre" autoFocus aria-label="Tu nombre" />
              <button className="btn sm">Listo</button>
            </form>
          ) : (
            <button className="who-chip" onClick={() => { setNameDraft(me); setEditingName(true) }} title="Cambiar tu nombre">
              <span className="avatar xs">{initial(me)}</span> {me} <Icon name="pencil" size={12} />
            </button>
          )}
          {pushAvailable() && push && push !== 'unavailable' && (
            <button
              className={`who-chip push-chip ${push === 'on' ? 'on' : ''}`}
              onClick={togglePush}
              disabled={pushBusy}
              aria-pressed={push === 'on'}
              aria-label={push === 'on' ? 'Desactivar notificaciones' : 'Activar notificaciones'}
              title={push === 'denied' ? 'Notificaciones bloqueadas en este navegador' : push === 'on' ? 'Desactivar notificaciones' : 'Recibir notificaciones aunque la página esté cerrada'}
            >
              <Icon name={push === 'on' ? 'bell' : 'bellOff'} size={15} />
              <span className="push-label">{push === 'on' ? 'Avisos' : 'Activar avisos'}</span>
            </button>
          )}
        </header>

        <nav className="topic-tabs" aria-label="Temas">
          {tabNames.map((t) => (
            <button key={t} className={`topic-tab ${t === tab ? 'on' : ''}`} onClick={() => setTab(t)}>
              {t}
              {unreadBy[t] > 0 && <span className="badge">{unreadBy[t]}</span>}
            </button>
          ))}
          {newTopic === null ? (
            <button className="topic-tab add" onClick={() => setNewTopic('')}><Icon name="plus" size={14} /> Nuevo tema</button>
          ) : (
            <form className="topic-new" onSubmit={(e) => { e.preventDefault(); addTopic(newTopic) }}>
              <input value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="Nombre del tema" autoFocus onBlur={() => !newTopic.trim() && setNewTopic(null)} />
              <button className="btn sm">Crear</button>
            </form>
          )}
        </nav>
        {newTopic !== null && (
          <div className="topic-suggest">
            <span className="muted small">Ideas:</span>
            {SUGGESTED.filter((s) => !tabNames.includes(s)).map((s) => (
              <button key={s} className="chip" onMouseDown={(e) => e.preventDefault()} onClick={() => addTopic(s)}>{s}</button>
            ))}
          </div>
        )}

        <div className="chat-list" ref={listRef} onScroll={onScroll}>
          {msgs === null && <div className="chat-empty">Cargando mensajes…</div>}
          {msgs && visible.length === 0 && (
            <div className="chat-empty">
              <span className="chat-empty-heart"><Icon name="heart" size={44} fill /></span>
              <b>{tab === GENERAL ? 'Escríbanse el primer mensaje' : `Todavía no hay nada en "${tab}"`}</b>
              <span>Lo que escriban aquí se queda guardado para siempre.</span>
              {isCustom && <button className="btn subtle sm" onClick={() => removeTopic(tab)}><Icon name="trash" size={14} /> Eliminar este tema</button>}
            </div>
          )}
          {grouped.map((m) =>
            m.day ? (
              <div key={m.id} className="day-sep"><span>{dayLabel(m.day)}</span></div>
            ) : (
              <ChatBubble key={m.id} m={m} me={me} author={authorOf(m, couple)} mine={!!me && authorOf(m, couple) === me} onHeart={heart} onReact={react} onDelete={remove} onOpen={setLb} />
            ),
          )}
        </div>

        <div className="quick">
          <NudgeButton me={me} topic={tab} onSend={sendNudge} onNoName={askName} />
          {QUICK.map((q) => <button key={q} className="chip" disabled={sending} onClick={() => send(null, q)}>{q}</button>)}
          {isCustom && visible.length > 0 && <button className="chip danger-chip" onClick={() => removeTopic(tab)}><Icon name="trash" size={12} /> Eliminar tema</button>}
        </div>

        <div className="typing-indicator" aria-live="polite">
          {remote && typing.length > 0 && (
            <>
              <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
              <span>{typingLabel(typing)}</span>
            </>
          )}
        </div>

        <ChatInput text={text} setText={setText} image={image} setImage={setImage} onSend={send} onPickImage={pickImage} tab={tab} />
      </div>
      {lb && <Lightbox items={[{ type: 'image', src: lb }]} index={0} onIndex={() => {}} onClose={() => setLb(null)} />}
    </section>
  )
}
