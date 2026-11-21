import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDialog } from '../hooks/useDialog'
import Icon from './Icon'

export default function Modal({ title, subtitle, children, onClose, wide = false }) {
  const ref = useRef(null)
  const titleId = useId()
  // Foco atrapado, Escape solo si es el diálogo de arriba y bloqueo de scroll compartido
  useDialog(ref, { onClose })

  return createPortal(
    <div className="modal-back" onClick={onClose}>
      <div
        ref={ref}
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3 id={titleId}>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
