import { useCallback, useEffect, useRef, useState } from 'react'
import { createItem, deleteItem, listByKind, mutateItem, runAll } from '../lib/api'
import { GENERAL, markChatSeen, topicOf } from '../lib/chat'
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
 */

const POLL_MS = 5000

const byDate = (a, b) => (a.date || 0) - (b.date || 0)

/* Firma barata para saber si algo cambió (sin incluir imágenes) */
const sigOf = (list) => list.map((m) => `${m.id}:${m.date || 0}:${topicOf(m)}:${(m.hearts || []).join(',')}:${(m.text || '').length}`).join('|')
const topicSig = (list) => list.map((t) => `${t.id}:${t.name}`).join('|')

/* ¿Este mensaje guardado es el mismo que un temporal? (createItem conserva la fecha del borrador) */
const sameAsTmp = (saved, tmp) => (saved.date || 0) === tmp.date && (saved.author || '') === (tmp.author || '') && (saved.text || '') === (tmp.text || '') && topicOf(saved) === topicOf(tmp)

const withHeart = (m, name, on) => {
  const hearts = m.hearts || []
  if (on) return hearts.includes(name) ? m : { ...m, hearts: [...hearts, name] }
  return hearts.includes(name) ? { ...m, hearts: hearts.filter((h) => h !== name) } : m
}

export function useChatMessages() {
  const [msgs, setMsgs] = useState(null)
  const [topics, setTopics] = useState([])
  const toast = useToast()
  const inFlight = useRef(false)
  const again = useRef(false)
  const version = useRef(0)
  const warned = useRef(false)
  const alive = useRef(true)

  const bump = () => { version.current++ }

  // fromPoll: los ticks del intervalo no se encolan (ya habrá otro tick); solo los refrescos explícitos repiten
  const refresh = useCallback(async (fromPoll = false) => {
    if (inFlight.current) { if (!fromPoll) again.current = true; return }
    inFlight.current = true
    const started = version.current
    try {
      const [list, tlist] = await Promise.all([listByKind('message'), listByKind('chatTopic')])
      if (!alive.current) return
      warned.current = false
      markChatSeen()
      // Hubo una mutación local mientras tanto: esta respuesta puede estar desactualizada.
      // Se descarta y el siguiente sondeo traerá el estado bueno.
      if (started !== version.current) return
      list.sort(byDate)
      tlist.sort(byDate)
      setTopics((cur) => (topicSig(cur) === topicSig(tlist) ? cur : tlist))
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
  }, [toast])

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
  const toggleHeart = async (m, me) => {
    if (m.pending || !me) return
    const on = !(m.hearts || []).includes(me)
    bump()
    setMsgs((cur) => (cur || []).map((x) => (x.id === m.id ? withHeart(x, me, on) : x)))
    try {
      const saved = await mutateItem(m.id, (x) => withHeart(x, me, on))
      setMsgs((cur) => (cur || []).map((x) => (x.id === saved.id ? saved : x)))
    } catch (e) {
      setMsgs((cur) => (cur || []).map((x) => (x.id === m.id ? withHeart(x, me, !on) : x)))
      toast(e.message, 'error')
    } finally {
      bump()
    }
  }

  const remove = async (m) => {
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
  }

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

  return { msgs, topics, send, toggleHeart, remove, addTopic, removeTopic, refresh }
}
