/*
 * Firma bajo la carta: un trazo a mano que se dibuja solo sobre un renglón,
 * como cuando se firma al final de una carta.
 *   <SignatureLine text={info.signature} name="D" />
 */
export default function SignatureLine({ text, name, date = new Date() }) {
  const when = date.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div className="signature-block">
      {text && <p className="signature-text">{text}</p>}
      <div className="signature-sheet">
        <span className="signature-x" aria-hidden="true">x</span>
        <svg className="signature-ink" viewBox="0 0 320 90" aria-hidden="true">
          {/* trazo tipo firma: rúbrica con lazo y subrayado */}
          <path
            pathLength="1"
            d="M14 62 C 30 20, 46 12, 52 30 C 58 50, 40 72, 34 62 C 28 52, 60 34, 78 40 C 92 45, 86 66, 98 60 C 112 52, 116 30, 128 34 C 140 38, 128 66, 142 62 C 156 58, 160 36, 172 40 C 182 44, 174 62, 188 58 C 204 54, 214 30, 226 36 C 238 42, 222 70, 240 64 C 262 56, 284 40, 300 30"
          />
          <path pathLength="1" className="flourish" d="M40 76 C 110 66, 200 70, 306 58" />
        </svg>
        <span className="signature-rule" aria-hidden="true" />
      </div>
      <div className="signature-caption">
        <span>{name ? `Firmado: ${name}` : 'Firma'}</span>
        <span>{when}</span>
      </div>
    </div>
  )
}
