import { useCallback, useEffect, useRef, useState } from 'react'
import { createItem, deleteItem, getConfig, listByKind, mutateItem, runAll } from '../lib/api'
import { GENERAL, hasReaction, HEART_EMOJI, markChatSeen, sameName, topicOf, TYPING_TTL_MS, withReaction } from '../lib/chat'
import { notifyPartner } from '../lib/push'
import { useToast } from '../components/Toast'

/*
 * Mensajes y temas del chat con sondeo periódico y acciones optimistas.
 *
 *  - Un solo sondeo a la vez (inFlight); un refresco explícito pedido mientras tanto se repite al terminar.
 *  - Si la lista del servidor no cambió, no se toca el estado (sin renders de más).
 *  - Cada mutación local sube `version`: las respuestas de sondeos iniciados antes se
 *    descartan, para que un sondeo lento no revierta un corazón o un borrado optimista.
 *  - Los mensajes temporales (tmp-…) se descartan en cuanto llega su versión guardada.
 *  - En modo remoto el mismo sondeo lee los registros `typing` y expone `typing`: nombres de
 *    otras personas escribiendo ahora. Para no depender del reloj del otro dispositivo, se
 *    considera "escribiendo" a quien cambió su `at` (> 0) hace menos de TYPING_TTL_MS según
 *    el reloj local. Si esa consulta falla, los mensajes se cargan igual.
 *  - Los temas (chatTopic) se piden en el primer sondeo, en los refrescos explícitos y luego
 *    cada TOPICS_EVERY sondeos, para no gastar peticiones a la Mock API.
 *  - Al recibir el guardado de un corazón o una reacción, solo se reemplaza el mensaje si no hubo
 *    otra mutación local desde que empezó esa acción (si no, borraría un optimista posterior).
 */

const POLL_MS = 5000
const TOPICS_EVERY = 6 // los temas cambian poco: se piden cada 6 sondeos (y siempre en refrescos explícitos)

const byDate = (a, b) => (a.date || 0) - (b.date || 0)

/* Firma barata para saber si algo cambió (sin incluir imágenes) */
const reactSig = (m) => Object.entries(m.reactions || {}).map(([e, n]) => `${e}=${(n || []).join(',')}`).join(';')
const sigOf = (list) => list.map((m) => `${m.id}:${m.date || 0}:${topicOf(m)}:${(m.hearts || []).join(',')}:${reactSig(m)}:${(m.text || '').length}`).join('|')
const topicSig = (list) => list.map((t) => `${t.id}:${t.name}`).join('|')

/* ¿Este mensaje guardado es el mismo que un temporal? (createItem conserva la fecha del borrador) */
const sameAsTmp = (saved, tmp) => (saved.date || 0) === tmp.date && (saved.author || '') === (tmp.author || '') && (saved.text || '') === (tmp.text || '') && topicOf(saved) === topicOf(tmp)

const withHeart = (m, name, on) => withReaction(m, HEART_EMOJI, name, on)

const NO_TYPING = []

/* me: nombre propio (para excluirse del indicador "escribiendo…") */
export function useChatMessages(me = '') {
  const [msgs, setMsgs] = useState(null)
  const [topics, setTopics] = useState([])
  const [typing, setTyping] = useState(NO_TYPING)
  const meRef = useRef(me)
  const typingSeen = useRef(new Map()) // autor (minúsculas) -> { at, seenAt } según el reloj local
  const toast = useToast()
  const inFlight = useRef(false)
  const again = useRef(false)
  const version = useRef(0)
  const warned = useRef(false)
  const alive = useRef(true)
  const polls = useRef(0) // sondeos del intervalo desde la última lectura de temas

  // Identidad estable: así las acciones de abajo también lo son (ChatBubble va en memo)
  const bump = useCallback(() => { version.current++ }, [])

  useEffect(() => { meRef.current = me }, [me])

  /* Calcula quién está escribiendo a partir de los registros `typing` (null = consulta fallida o modo local) */
  const applyTyping = useCallback((recs) => {
    if (!recs) return
    const now = Date.now()
    const seen = typingSeen.current
    const latest = new Map() // si hay duplicados del mismo autor, gana el `at` más alto
    for (const r of recs) {
      const author = (r.author || '').trim()
      if (!author) continue
      const key = author.toLowerCase()
      const at = Number(r.at) || 0
      if (!latest.has(key) || at > latest.get(key).at) latest.set(key, { author, at })
    }
    const names = []
    for (const [key, { author, at }] of latest) {
      const prev = seen.get(key)
      let seenAt = prev?.seenAt || 0
      if (!prev) seenAt = at > 0 && Math.abs(now - at) < TYPING_TTL_MS ? now : 0
      else if (prev.at !== at) seenAt = at > 0 ? now : 0
      seen.set(key, { at, seenAt })
      if (at > 0 && seenAt && now - seenAt < TYPING_TTL_MS && !sameName(author, meRef.current)) names.push(author)
    }
    names.sort()
    setTyping((cur) => (cur.join('|') === names.join('|') ? cur : names.length ? names : NO_TYPING))
  }, [])

  // fromPoll: los ticks del intervalo no se encolan (ya habrá otro tick); solo los refrescos explícitos repiten
  const refresh = useCallback(async (fromPoll = false) => {
    if (inFlight.current) { if (!fromPoll) again.current = true; return }
    inFlight.current = true
    const started = version.current
    const withTopics = !fromPoll || polls.current % TOPICS_EVERY === 0
    polls.current = withTopics ? 1 : polls.current + 1
    try {
      const remote = getConfig().mode === 'remote'
      const [list, tlist, typingRecs] = await Promise.all([
        listByKind('message'),
        withTopics ? listByKind('chatTopic') : Promise.resolve(null),
        remote ? listByKind('typing').catch(() => null) : Promise.resolve(null),
      ])
      if (!alive.current) return
      warned.current = false
      markChatSeen()
      if (remote) applyTyping(typingRecs)
      else setTyping((cur) => (cur.length ? NO_TYPING : cur))
      // Hubo una mutación local mientras tanto: esta respuesta puede estar desactualizada.
      // Se descarta y el siguiente sondeo traerá el estado bueno.
      if (started !== version.current) return
      list.sort(byDate)
      if (tlist) {
        tlist.sort(byDate)
        setTopics((cur) => (topicSig(cur) === topicSig(tlist) ? cur : tlist))
      }
      setMsgs((cur) => {
        const pending = (cur || []).filter((m) => m.pending)
        const keep = pending.filter((p) => !list.some((s) => sameAsTmp(s, p)))
        if (cur && keep.length === pending.length && sigOf(cur.filter((m) => !m.pending)) === sigOf(list)) return cur
        return [...list, ...keep]
      })
    } catch (e) {
      if (!alive.current) return
      setMsgs((cur) => cur || [])
      if (!warned.current) { toast(e.message, 'error'); warned.current = true }
    } finally {
      inFlight.current = false
      if (again.current && alive.current) {
        again.current = false
        // Se repite fuera de este ciclo para no anidar promesas
        setTimeout(() => { if (alive.current) refresh() }, 0)
      }
    }
  }, [toast, applyTyping])

  useEffect(() => {
    alive.current = true
    refresh()
    const id = setInterval(() => { if (document.visibilityState === 'visible') refresh(true) }, POLL_MS)
    return () => { alive.current = false; clearInterval(id) }
  }, [refresh])

  /* Envía un mensaje. Devuelve true si se guardó. */
  const send = async (draft) => {
    const tmp = { ...draft, id: `tmp-${draft.date}-${Math.random().toString(36).slice(2, 6)}`, pending: true }
    bump()
    setMsgs((cur) => [...(cur || []), tmp])
    try {
      const saved = await createItem('message', draft)
      notifyPartner(saved?.id) // aviso push a la otra persona (no bloquea ni falla el envío)
      // Si un sondeo ya trajo el guardado, se quita el temporal en vez de duplicar
      setMsgs((cur) => {
        const list = cur || []
        return list.some((m) => m.id === saved.id) ? list.filter((m) => m.id !== tmp.id) : list.map((m) => (m.id === tmp.id ? saved : m))
      })
      return true
    } catch (err) {
      setMsgs((cur) => (cur || []).filter((m) => m.id !== tmp.id))
      toast(err.message, 'error')
      return false
    } finally {
      bump()
    }
  }

  /* Corazón del autor: optimista y mezclado sobre la versión más reciente del servidor */
  const toggleHeart = useCallback(async (m, me) => {
    if (m.pending || !me) return
    const on = !(m.hearts || []).includes(me)
    bump()
    const mark = version.current
    setMsgs((cur) => (cur || []).map((x) => (x.id === m.id ? withHeart(x, me, on) : x)))
    try {
      const saved = await mutateItem(m.id, (x) => withHeart(x, me, on))
      // Otra acción local empezó mientras tanto: no se pisa su optimista (el siguiente sondeo trae lo bueno)
      if (mark === version.current) setMsgs((cur) => (cur || []).map((x) => (x.id === saved.id ? saved : x)))
    } catch (e) {
      setMsgs((cur) => (cur || []).map((x) => (x.id === m.id ? withHeart(x, me, !on) : x)))
      toast(e.message, 'error')
    } finally {
      bump()
    }
  }, [toast, bump])

  /* Reacción con emoji (varias distintas por persona). El ❤️ usa `hearts` vía toggleHeart. */
  const toggleReaction = useCallback(async (m, emoji, me) => {
    if (emoji === HEART_EMOJI) return toggleHeart(m, me)
    if (m.pending || !me) return
    const on = !hasReaction(m, emoji, me)
    bump()
    const mark = version.current
    setMsgs((cur) => (cur || []).map((x) => (x.id === m.id ? withReaction(x, emoji, me, on) : x)))
    try {
      const saved = await mutateItem(m.id, (x) => withReaction(x, emoji, me, on))
      if (mark === version.current) setMsgs((cur) => (cur || []).map((x) => (x.id === saved.id ? saved : x)))
    } catch (e) {
      setMsgs((cur) => (cur || []).map((x) => (x.id === m.id ? withReaction(x, emoji, me, !on) : x)))
      toast(e.message, 'error')
    } finally {
      bump()
    }
  }, [toast, bump, toggleHeart])

  const remove = useCallback(async (m) => {
    bump()
    setMsgs((cur) => (cur || []).filter((x) => x.id !== m.id))
    try {
      await deleteItem(m.id)
    } catch (e) {
      toast(e.message, 'error')
      bump()
      refresh()
      return
    }
    bump()
  }, [toast, bump, refresh])

  /* Crea un tema. Devuelve el guardado o null si falló. */
  const addTopic = async (name) => {
    bump()
    try {
      const saved = await createItem('chatTopic', { name })
      setTopics((cur) => [...cur, saved])
      return saved
    } catch (e) {
      toast(e.message, 'error')
      return null
    } finally {
      bump()
    }
  }

  /*
   * Mueve los mensajes de un tema a General (máx. 4 a la vez, sin detenerse ante fallos)
   * y borra el tema solo si todos se movieron. Devuelve true si todo salió bien.
   */
  const removeTopic = async (name) => {
    const list = (msgs || []).filter((m) => !m.pending && topicOf(m) === name)
    const topic = topics.find((t) => t.name === name)
    bump()
    try {
      const results = await runAll(list, (m) => mutateItem(m.id, (x) => ({ ...x, topic: GENERAL })))
      const failed = results.filter((r) => r.status === 'rejected')
      if (failed.length) {
        toast(`No se pudieron mover ${failed.length} de ${list.length} mensaje(s). El tema no se eliminó; inténtalo de nuevo. (${failed[0].reason?.message || 'error'})`, 'error')
        return false
      }
      if (topic) await deleteItem(topic.id)
      return true
    } catch (e) {
      toast(e.message, 'error')
      return false
    } finally {
      bump()
      refresh()
    }
  }

  return { msgs, topics, typing, send, toggleHeart, toggleReaction, remove, addTopic, removeTopic, refresh }
}
