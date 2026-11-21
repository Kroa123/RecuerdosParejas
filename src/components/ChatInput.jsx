import { useRef } from 'react'
import Icon from './Icon'

/* Barra de escritura del chat: foto adjunta, texto y botón Enviar */
export default function ChatInput({ text, setText, image, setImage, onSend, onPickImage, tab }) {
  const fileRef = useRef(null)

  const onKeyDown = (e) => {
    // Con IME (teclados asiáticos, predicción en algunos móviles) Enter confirma la palabra, no envía
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter' && !e.shiftKey) onSend(e)
  }

  return (
    <form className="chat-input" onSubmit={onSend}>
      {image && (
        <div className="chat-attach">
          <img src={image} alt="" />
          <button type="button" className="preview-del" onClick={() => setImage(null)} aria-label="Quitar foto"><Icon name="x" size={12} /></button>
        </div>
      )}
      <button type="button" className="icon-btn attach" title="Enviar una foto" aria-label="Adjuntar una foto" onClick={() => fileRef.current?.click()}>
        <Icon name="image" size={20} />
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { onPickImage(e.target.files?.[0]); e.target.value = '' }} />
      <textarea
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={`Escribe en "${tab}"…`}
        aria-label="Mensaje"
      />
      <button className="send" disabled={!text.trim() && !image} aria-label="Enviar"><Icon name="send" size={18} /></button>
    </form>
  )
}
