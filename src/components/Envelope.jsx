import { useEffect, useRef, useState } from 'react'
import { cachedCouple, daysTogether } from '../lib/couple'
import { useDialog } from '../hooks/useDialog'

/*
 * La sorpresa de entrada: un sobre sellado con su nombre.
 * Ella toca el sello, el sobre se abre, sale una tarjeta y luego entra a la página.
 * Aparece una vez por visita (sessionStorage). Esc o "Saltar" lo cierran.
 */
const SEEN_KEY = 'recuerdos.envelopeSeen'

export const envelopeSeen = () => { try { return sessionStorage.getItem(SEEN_KEY) === '1' } catch { return false } }
const markSeen = () => { try { sessionStorage.setItem(SEEN_KEY, '1') } catch { /* sin storage */ } }

export default function Envelope({ onDone }) {
  const [stage, setStage] = useState('closed') // closed → open → leaving
  const stageRef = useRef('closed') // copia síncrona: Escape y clics rápidos no ven un stage obsoleto
  const rootRef = useRef(null)
  const sealRef = useRef(null)
  const enterRef = useRef(null)
  const doneTimer = useRef(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const couple = cachedCouple()
  const days = daysTogether(couple.since)

  const finish = () => {
    if (stageRef.current === 'leaving') return // ya se está cerrando: no repetir
    stageRef.current = 'leaving'
    markSeen()
    setStage('leaving')
    doneTimer.current = setTimeout(() => onDoneRef.current?.(), 650)
  }

  // Foco inicial en el sello, Escape para saltar, foco atrapado y bloqueo de scroll
  useDialog(rootRef, { onClose: finish, initialFocus: sealRef })

  // Al desmontar, no dejar el temporizador de salida colgando
  useEffect(() => () => clearTimeout(doneTimer.current), [])

  useEffect(() => {
    if (stage !== 'open') return
    const t = setTimeout(() => enterRef.current?.focus(), 1300)
    return () => clearTimeout(t)
  }, [stage])

  const open = () => {
    if (stageRef.current !== 'closed') return
    stageRef.current = 'open'
    navigator.vibrate?.(30)
    setStage('open')
  }

  return (
    <div ref={rootRef} tabIndex={-1} className={`envelope-screen ${stage}`} role="dialog" aria-modal="true" aria-label={`Una carta para ${couple.names.M}`}>
      <button className="envelope-skip" onClick={finish}>Saltar</button>

      <div className="envelope-stage">
        <div className="envelope">
          <div className="env-back" />
          <div className="env-card" aria-hidden={stage === 'closed'}>
            <p className="env-card-hi">Hola, mi amor</p>
            <p className="env-card-text">Guardé aquí nuestros momentos para que los tengas siempre cerca.</p>
            {days !== null && <p className="env-card-days"><b>{days.toLocaleString('es')}</b> días contigo</p>}
            <p className="env-card-sign">— {couple.names.D}</p>
          </div>
          <div className="env-front">
            <span className="env-to">Para {couple.names.M}</span>
          </div>
          <div className="env-flap" />
          <button ref={sealRef} className="env-seal" onClick={open} aria-label="Abrir la carta" tabIndex={stage === 'closed' ? 0 : -1}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-5.2-8-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.8C20 15.8 12 21 12 21z" /></svg>
          </button>
        </div>
      </div>

      <p className="envelope-hint" aria-live="polite">
        {stage === 'closed' ? 'Toca el sello para abrirla' : ''}
      </p>
      <button ref={enterRef} className="btn glow envelope-enter" onClick={finish} tabIndex={stage === 'open' ? 0 : -1}>
        Entrar a nuestros recuerdos
      </button>
    </div>
  )
}
