import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createItem, listByKind, mutateItem } from '../lib/api'
import { myName, sameName } from '../lib/chat'
import { cachedCouple } from '../lib/couple'
import { dailyQuestion, questionForKey } from '../lib/questions'
import Icon from '../components/Icon'
import { useToast } from '../components/Toast'

const HISTORY_DAYS = 30
const latest = (list) => list.reduce((best, a) => (!best || (a.date || 0) > (best.date || 0) ? a : best), null)

/* "2026-11-25" -> "martes, 25 de noviembre" (la clave ya es el día de Lima) */
function keyLabel(key) {
  const d = new Date(`${key}T12:00:00Z`)
  return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

/* El nombre de la otra persona: el de la pareja que no soy yo (o el autor de su respuesta) */
function partnerName(me, answers) {
  const names = Object.values(cachedCouple().names || {})
  return answers.find((a) => !sameName(a.author, me))?.author || names.find((n) => n && !sameName(n, me)) || 'Tu amor'
}

export default function Pregunta() {
  const me = myName()
  const [today, setToday] = useState(() => dailyQuestion())
  const [answers, setAnswers] = useState(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  // Cada carga invalida la anterior
  const reqRef = useRef(0)
  const load = () => {
    const req = ++reqRef.current
    setError('')
    return listByKind('answer')
      .then((l) => { if (req === reqRef.current) setAnswers(l) })
      .catch((e) => { if (req === reqRef.current) { setError(e.message); setAnswers((p) => p || []) } })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); return () => { reqRef.current++ } }, [])

  // Si la página queda abierta pasada la medianoche de Lima, cambia la pregunta
  useEffect(() => {
    const id = setInterval(() => {
      const q = dailyQuestion()
      setToday((t) => (t.key === q.key ? t : q))
    }, 60000)
    return () => clearInterval(id)
  }, [])

  const todays = useMemo(() => (answers || []).filter((a) => a.key === today.key), [answers, today.key])
  const mine = useMemo(() => latest(todays.filter((a) => sameName(a.author, me))), [todays, me])
  const theirs = useMemo(() => latest(todays.filter((a) => !sameName(a.author, me))), [todays, me])
  const partner = partnerName(me, answers || [])

  // Al cargar (o cambiar de día), el borrador parte de mi respuesta guardada
  useEffect(() => { setDraft(mine?.text || ''); setEditing(false) }, [mine?.id, today.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const history = useMemo(() => {
    const byKey = new Map()
    for (const a of answers || []) {
      if (!a.key || a.key >= today.key) continue
      if (!byKey.has(a.key)) byKey.set(a.key, [])
      byKey.get(a.key).push(a)
    }
    return [...byKey.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, HISTORY_DAYS)
      .map(([key, list]) => {
        // Una respuesta por autor (la más reciente)
        const byAuthor = new Map()
        for (const a of list) {
          const k = (a.author || '').trim().toLowerCase()
          if (!byAuthor.has(k) || (a.date || 0) > (byAuthor.get(k).date || 0)) byAuthor.set(k, a)
        }
        return { key, text: questionForKey(key).text, answers: [...byAuthor.values()] }
      })
  }, [answers, today.key])

  const save = async (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return toast('Escribe tu respuesta', 'error')
    setBusy(true)
    try {
      const saved = mine
        ? await mutateItem(mine.id, (x) => ({ ...x, text, edited: Date.now() }))
        : await createItem('answer', { key: today.key, author: me, text })
      setAnswers((l) => [...(l || []).filter((a) => a.id !== saved.id), saved])
      setEditing(false)
      toast(mine ? 'Respuesta actualizada' : 'Respuesta guardada')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const showForm = !mine || editing

  return (
    <section>
      <header className="page-head">
        <h1 className="page-title">Pregunta del día</h1>
        <p className="page-sub">Una pregunta nueva cada día. Responde para ver lo que dijo tu pareja.</p>
      </header>

      <article className="question-card glass">
        <span className="eyebrow mono">{keyLabel(today.key)}</span>
        <h2 className="question-text">{today.text}</h2>
      </article>

      {error && (
        <div className="empty-state" role="alert">
          <Icon name="cloud" size={28} />
          <h3>No se pudieron cargar las respuestas</h3>
          <p>{error}</p>
          <button className="btn ghost" onClick={load}><Icon name="refresh" /> Reintentar</button>
        </div>
      )}

      {!me && (
        <div className="empty-state">
          <Icon name="user" size={28} />
          <h3>Primero dinos quién eres</h3>
          <p>Elige tu nombre en el chat para poder responder.</p>
          <Link className="btn" to="/chat"><Icon name="message" /> Ir al chat</Link>
        </div>
      )}

      {me && !answers && !error && <div className="answer-grid" aria-busy="true"><div className="answer-card skeleton" /><div className="answer-card skeleton" /></div>}

      {me && answers && (
        <div className="answer-grid">
          <div className="answer-card glass mine">
            <h3><Icon name="user" size={16} /> Tu respuesta</h3>
            {showForm ? (
              <form onSubmit={save}>
                <label className="field">
                  <textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escribe con el corazón…" maxLength={2000} aria-label="Tu respuesta" />
                </label>
                <div className="row gap">
                  <button className="btn" disabled={busy || !draft.trim()}>
                    <Icon name="send" size={16} /> {busy ? 'Guardando…' : mine ? 'Guardar cambios' : 'Responder'}
                  </button>
                  {mine && <button type="button" className="btn ghost" onClick={() => { setDraft(mine.text || ''); setEditing(false) }}>Cancelar</button>}
                </div>
              </form>
            ) : (
              <>
                <p className="answer-text">{mine.text}</p>
                <button className="btn ghost sm" onClick={() => setEditing(true)}><Icon name="pencil" size={14} /> Editar</button>
              </>
            )}
          </div>

          <div className={`answer-card glass theirs ${theirs && !mine ? 'is-hidden' : ''}`}>
            <h3><Icon name="heart" size={16} /> {theirs?.author || partner}</h3>
            {!theirs && <p className="muted">Todavía no ha respondido.</p>}
            {theirs && !mine && (
              <p className="answer-locked"><Icon name="lock" size={16} /> {theirs.author || partner} ya respondió. Responde para ver su respuesta.</p>
            )}
            {theirs && mine && <p className="answer-text">{theirs.text}</p>}
          </div>
        </div>
      )}

      {me && answers && history.length > 0 && (
        <section className="question-history">
          <h2 className="block-head">Días anteriores</h2>
          <ul>
            {history.map((h) => (
              <li key={h.key} className="history-item glass">
                <span className="eyebrow mono">{keyLabel(h.key)}</span>
                <p className="history-q">{h.text}</p>
                {h.answers.map((a) => (
                  <p key={a.id} className={`history-a ${sameName(a.author, me) ? 'mine' : ''}`}>
                    <b>{a.author}:</b> {a.text}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
