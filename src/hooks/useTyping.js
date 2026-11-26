import { useEffect, useRef } from 'react'
import { createItem, deleteItem, listByKind, updateItem } from '../lib/api'
import { sameName, TYPING_THROTTLE_MS } from '../lib/chat'

/*
 * Publica "estoy escribiendo" en un registro { kind: 'typing', author, at } por autor.
 *
 *  - Mientras el texto no esté vacío, actualiza `at` como mucho cada TYPING_THROTTLE_MS.
 *  - Al vaciarse el texto (enviar o borrar) pone `at: 0` una sola vez.
 *  - El id del registro se guarda en memoria; solo se busca (listByKind) la primera vez.
 *    Como solo lo escribe su dueño, se guarda con updateItem (una petición, sin releer).
 *    Las escrituras van en cola, así dos teclas rápidas no crean dos registros.
 *  - Los errores se ignoran: el indicador es opcional y nunca debe molestar al escribir.
 *  - enabled = false (modo local) o sin nombre: no hace nada.
 */
export function useTyping(me, text, enabled) {
  const idRef = useRef(null)
  const ownerRef = useRef('') // autor al que pertenece idRef
  const chain = useRef(Promise.resolve())
  const lastSent = useRef(0)
  const active = useRef(false) // el último valor escrito fue at > 0

  // Busca (o crea) el registro de este autor; borra duplicados que hayan quedado de carreras
  const ensureId = async (author) => {
    if (idRef.current && sameName(ownerRef.current, author)) return idRef.current
    const list = await listByKind('typing')
    const mine = list.filter((t) => sameName(t.author, author))
    let id
    if (mine.length) {
      id = mine[0].id
      mine.slice(1).forEach((t) => { deleteItem(t.id).catch(() => {}) })
    } else {
      const saved = await createItem('typing', { author, at: 0 })
      id = saved.id
    }
    idRef.current = id
    ownerRef.current = author
    return id
  }

  const write = (author, at) => {
    chain.current = chain.current
      .then(async () => {
        const id = await ensureId(author)
        try {
          // Solo su dueño escribe este registro: basta un PUT directo (sin releer antes)
          await updateItem({ id, kind: 'typing', author, at })
        } catch {
          // Lo borraron: se vuelve a buscar o crear en la próxima escritura
          idRef.current = null
          if (at) await updateItem({ id: await ensureId(author), kind: 'typing', author, at })
        }
      })
      .catch(() => { /* sin red o sin API: se ignora */ })
  }

  useEffect(() => {
    if (!enabled || !me) return
    if (text.trim()) {
      const now = Date.now()
      if (now - lastSent.current < TYPING_THROTTLE_MS) return
      lastSent.current = now
      active.current = true
      write(me, now)
    } else if (active.current) {
      active.current = false
      lastSent.current = 0
      write(me, 0)
    }
    // write/ensureId solo usan refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, me, enabled])

  // Al cambiar de nombre o salir del chat con algo escrito, se apaga el indicador del nombre anterior
  useEffect(() => {
    if (!enabled || !me) return
    return () => {
      if (active.current) {
        active.current = false
        lastSent.current = 0
        write(me, 0)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, enabled])
}
