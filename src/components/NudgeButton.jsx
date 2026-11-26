import { useState } from 'react'
import { getConfig } from '../lib/api'
import { clearNudge, GENERAL, markNudge, myName, NUDGE_TEXT, nudgeWait } from '../lib/chat'
import { useToast } from './Toast'
import Icon from './Icon'

/*
 * Botón "Pensando en ti": envía un message { type: 'nudge' } a la otra persona.
 *   onSend(draft)  -> debe guardar el mensaje (y avisar por push); devuelve true si se guardó
 *   onNoName()     -> se llama si aún no hay nombre en este dispositivo
 *   me             -> nombre propio (si no se pasa, se lee de localStorage al pulsar)
 * Enfriamiento de NUDGE_COOLDOWN_MS por dispositivo.
 */
export default function NudgeButton({ onSend, onNoName, me, topic = GENERAL, className = 'chip nudge-chip', label = 'Pensando en ti', disabled }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const click = async () => {
    if (busy) return
    const author = (me ?? myName()).trim()
    if (!author) return onNoName?.()
    const wait = nudgeWait()
    if (wait > 0) return toast(`Ya le enviaste uno hace un ratito 💗 Podrás mandar otro en ${Math.ceil(wait / 1000)} s`)
    const draft = { topic: topic || GENERAL, author, type: 'nudge', text: NUDGE_TEXT, hearts: [], date: Date.now() }
    setBusy(true)
    markNudge(draft.date) // se marca antes de enviar para que un doble toque no mande dos
    try {
      const ok = await onSend(draft)
      if (ok) toast(getConfig().mode === 'remote'
        ? '💗 ¡Enviado! Le llegará tu «Pensando en ti»'
        : '💗 Guardado en este navegador. Configura la Mock API (⚙) para que le llegue a tu pareja.')
      else clearNudge()
    } catch {
      clearNudge()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" className={className} onClick={click} disabled={disabled || busy} title="Envíale un «Pensando en ti»" aria-busy={busy}>
      <Icon name="heart" size={14} fill /> {busy ? 'Enviando…' : label}
    </button>
  )
}
