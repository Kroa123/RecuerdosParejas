import { useEffect, useRef } from 'react'

/*
 * Comportamiento común de los diálogos (Modal, Lightbox, Confirm, Envelope):
 *  - foco inicial dentro del diálogo y Tab / Shift+Tab atrapados en él;
 *  - al cerrar, el foco vuelve al elemento que lo abrió;
 *  - Escape cierra SOLO el diálogo de arriba (pila a nivel de módulo);
 *  - bloqueo de scroll del body mientras quede algún diálogo abierto.
 *
 *   const ref = useRef(null)
 *   useDialog(ref, { onClose, onKeyDown, initialFocus })
 *   <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true">…</div>
 *
 * onClose y onKeyDown se guardan en refs: no hace falta memorizarlos.
 * onKeyDown solo recibe teclas cuando este diálogo es el de arriba.
 */

const stack = [] // diálogos abiertos; el último es el de arriba
let locks = 0
let prevOverflow = ''

const FOCUSABLE = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', 'audio[controls]', 'video[controls]',
  '[tabindex]', '[contenteditable="true"]',
].join(',')

/* ¿Hay algún diálogo abierto? (p. ej. para que el menú no reaccione a Escape) */
export const hasOpenDialog = () => stack.length > 0

function focusablesIn(node) {
  if (!node) return []
  return [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0)
}

export function useDialog(ref, { onClose, onKeyDown, initialFocus } = {}) {
  const onCloseRef = useRef(onClose)
  const onKeyRef = useRef(onKeyDown)
  onCloseRef.current = onClose
  onKeyRef.current = onKeyDown

  // Se captura al renderizar: si un hijo usa autoFocus, el foco ya se habrá movido al llegar al efecto
  const opener = useRef(undefined)
  if (opener.current === undefined) opener.current = typeof document !== 'undefined' ? document.activeElement : null
  const mounted = useRef(false)
  const autoFocused = useRef(null) // elemento interno con autoFocus (se recuerda para el re-montaje de StrictMode)

  useEffect(() => {
    mounted.current = true
    const token = {}
    stack.push(token)
    if (locks++ === 0) {
      prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }

    const node = ref.current
    // Foco inicial: el pedido, o lo que ya tenga autoFocus dentro, o el primer enfocable, o el propio diálogo
    if (node) {
      const active = document.activeElement
      if (node.contains(active) && active !== node) {
        autoFocused.current = active // un hijo ya tomó el foco (autoFocus): se respeta
      } else {
        const remembered = autoFocused.current && node.contains(autoFocused.current) ? autoFocused.current : null
        const target = remembered || initialFocus?.current || focusablesIn(node)[0] || node
        target.focus?.({ preventScroll: true })
      }
    }

    const onKey = (e) => {
      if (stack[stack.length - 1] !== token) return // no somos el diálogo de arriba
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current?.()
        return
      }
      const node = ref.current
      if (e.key === 'Tab' && node) {
        const list = focusablesIn(node)
        if (!list.length) { e.preventDefault(); node.focus?.(); return }
        const first = list[0]
        const last = list[list.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || !node.contains(active))) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && (active === last || !node.contains(active))) { e.preventDefault(); first.focus() }
        return
      }
      onKeyRef.current?.(e)
    }
    document.addEventListener('keydown', onKey)

    const back = opener.current
    return () => {
      mounted.current = false
      document.removeEventListener('keydown', onKey)
      const i = stack.indexOf(token)
      if (i !== -1) stack.splice(i, 1)
      if (--locks === 0) document.body.style.overflow = prevOverflow
      // Devolver el foco a quien abrió el diálogo (si sigue en la página). Se difiere: si el
      // mismo diálogo se vuelve a montar enseguida (StrictMode en desarrollo) no se le quita el foco.
      queueMicrotask(() => {
        if (mounted.current) return
        if (back && back !== document.body && typeof back.focus === 'function' && document.contains(back)) {
          back.focus({ preventScroll: true })
        }
      })
    }
    // Solo al montar/desmontar: los callbacks viven en refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
