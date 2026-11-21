import { createContext, useCallback, useContext, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDialog } from '../hooks/useDialog'
import Icon from './Icon'

/* Diálogo de confirmación propio (reemplaza window.confirm).
   const confirm = useConfirm()
   if (await confirm({ title, message, confirmText, danger: true })) { ... } */
const Ctx = createContext(async () => false)
export const useConfirm = () => useContext(Ctx)

/* El diálogo en sí: se monta al pedir confirmación, así el foco y la pila de diálogos funcionan */
function ConfirmDialog({ state, onClose }) {
  const ref = useRef(null)
  const cancelRef = useRef(null)
  const okRef = useRef(null)
  const titleId = useId()
  const msgId = useId()
  // Si la acción es destructiva, el foco inicial va a "Cancelar" (Enter no borra por accidente)
  useDialog(ref, { onClose: () => onClose(false), initialFocus: state.danger ? cancelRef : okRef })

  // Portal al body: así queda por encima de un Modal/Lightbox abierto antes
  return createPortal(
    <div className="modal-back" onClick={() => onClose(false)}>
      <div
        ref={ref}
        className="modal confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={state.message ? msgId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`confirm-ico ${state.danger ? 'danger' : ''}`}>
          <Icon name={state.danger ? 'trash' : 'check'} size={20} />
        </div>
        <h3 id={titleId}>{state.title || '¿Estás seguro?'}</h3>
        {state.message && <p id={msgId}>{state.message}</p>}
        <div className="confirm-actions">
          <button ref={cancelRef} className="btn ghost" onClick={() => onClose(false)}>Cancelar</button>
          <button ref={okRef} className={`btn ${state.danger ? 'danger' : ''}`} onClick={() => onClose(true)}>
            {state.confirmText || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  // resolve fuera del estado: los updaters de setState deben ser puros (StrictMode los llama dos veces)
  const resolveRef = useRef(null)

  const confirm = useCallback(
    (opts) => new Promise((resolve) => {
      resolveRef.current?.(false) // si había otra confirmación abierta, se da por cancelada
      resolveRef.current = resolve
      setState({ ...(typeof opts === 'string' ? { message: opts } : opts) })
    }),
    [],
  )

  const close = useCallback((value) => {
    const resolve = resolveRef.current
    resolveRef.current = null
    setState(null)
    resolve?.(value)
  }, [])

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {state && <ConfirmDialog state={state} onClose={close} />}
    </Ctx.Provider>
  )
}
