import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDialog } from '../hooks/useDialog'
import VideoPlayer from './VideoPlayer'
import Icon from './Icon'

/* Visor a pantalla completa. Si recibe onDelete, muestra el botón Eliminar. */
export default function Lightbox({ items, index, onClose, onIndex, onDelete }) {
  const ref = useRef(null)
  const item = items[index]
  const n = items.length

  // Las flechas solo navegan si el visor es el diálogo de arriba (no con un Confirm encima)
  useDialog(ref, {
    onClose,
    onKeyDown: (e) => {
      if (e.key === 'ArrowRight' && n > 1) onIndex((index + 1) % n)
      if (e.key === 'ArrowLeft' && n > 1) onIndex((index - 1 + n) % n)
    },
  })

  if (!item) return null
  const stop = (fn) => (e) => { e.stopPropagation(); fn() }

  return createPortal(
    <div
      ref={ref}
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={item.title ? `Visor: ${item.title}` : 'Visor de fotos y videos'}
      tabIndex={-1}
      onClick={onClose}
    >
      <div className="lb-bar" onClick={(e) => e.stopPropagation()}>
        <span className="lb-count">{String(index + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</span>
        <div className="lb-tools">
          {onDelete && (
            <button className="btn danger sm" onClick={() => onDelete(item, index)}>
              <Icon name="trash" size={16} /> Eliminar
            </button>
          )}
          <button className="lb-btn" onClick={onClose} aria-label="Cerrar"><Icon name="x" size={20} /></button>
        </div>
      </div>
      {n > 1 && (
        <>
          <button className="lb-btn lb-nav left" onClick={stop(() => onIndex((index - 1 + n) % n))} aria-label="Anterior">
            <Icon name="chevronLeft" size={24} />
          </button>
          <button className="lb-btn lb-nav right" onClick={stop(() => onIndex((index + 1) % n))} aria-label="Siguiente">
            <Icon name="chevronRight" size={24} />
          </button>
        </>
      )}
      <figure onClick={(e) => e.stopPropagation()}>
        {item.type === 'video'
          ? <VideoPlayer src={item.src} className="lb-media" />
          : <img key={item.src.slice(-40)} src={item.src} alt={item.title || ''} className="lb-media" />}
        {item.title && <figcaption>{item.title}</figcaption>}
      </figure>
    </div>,
    document.body,
  )
}
