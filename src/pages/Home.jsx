import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listByKind } from '../lib/api'
import { cachedCouple, daysTogether, loadCouple, saveCouple } from '../lib/couple'
import { formatDate, fromDateInput, toDateInput } from '../lib/media'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import HeartFireworks from '../components/HeartFireworks'

const HOLD_MS = 4000 // tiempo manteniendo presionado para que explote
const BOOM_MS = 2000 // duración de la explosión
const SMALL_HEART = 'M12 21s-8-5.2-8-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.8C20 15.8 12 21 12 21z'

const SECTIONS = [
  { to: '/recuerdos', title: 'Recuerdos', text: 'Nuestros momentos como publicaciones, con fotos, videos y comentarios', icon: 'book', key: 'post', tone: 'rose', cta: 'Ver los recuerdos' },
  { to: '/fotos', title: 'Fotos', text: 'Una carpeta por cada lugar que conocimos juntos', icon: 'image', key: 'photo', tone: 'peach', cta: 'Ver las fotos' },
  { to: '/videos', title: 'Videos', text: 'Momentos en movimiento, separados por lugar', icon: 'film', key: 'video', tone: 'gold', cta: 'Ver los videos' },
  { to: '/chat', title: 'Chat', text: 'Mensajitos solo para nosotros dos, cuando quieras', icon: 'message', key: null, tone: 'plum', cta: 'Escribirle' },
  { to: '/informacion', title: 'Para ti', text: 'Una carta y un ramo de tulipanes que se dibuja solo', icon: 'mail', key: null, tone: 'pink', cta: 'Leer la carta' },
]

const PHRASES = ['Te amo Maryori Huamanchumo', 'Eres mi lugar favorito', 'Mi persona favorita', 'Contigo todo es mejor', 'Para siempre mi monita hermosa']
const HEART = 'M100 170 C 40 125, 5 95, 5 55 C 5 25, 30 5, 58 5 C 78 5, 92 16, 100 32 C 108 16, 122 5, 142 5 C 170 5, 195 25, 195 55 C 195 95, 160 125, 100 170 Z'

/* Fotos más recientes (de Fotos y de las publicaciones) */
function latestPhotos(all, n = 6) {
  const out = []
  for (const it of all) {
    if (it.kind === 'photo' && it.src) out.push({ src: it.src, label: it.category, date: it.date })
    if (it.kind === 'post') for (const m of it.media || []) if (m.type === 'image') out.push({ src: m.src, label: it.title || it.category, date: it.date })
  }
  return out.sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, n)
}

function CoupleForm({ couple, onSaved, onClose }) {
  const [names, setNames] = useState(couple.names)
  const [since, setSince] = useState(toDateInput(couple.since))
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      onSaved(await saveCouple({ ...couple, names, since: fromDateInput(since) }))
      toast('Guardado')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal title="Nuestra historia" subtitle="Los nombres también se usan en el chat" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid-2">
          <label className="field"><span>Nombre de M</span><input value={names.M} onChange={(e) => setNames({ ...names, M: e.target.value })} /></label>
          <label className="field"><span>Nombre de D</span><input value={names.D} onChange={(e) => setNames({ ...names, D: e.target.value })} /></label>
        </div>
        <label className="field"><span>¿Desde cuándo estamos juntos?</span><input type="date" value={since} onChange={(e) => setSince(e.target.value)} /></label>
        <button className="btn wide" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </form>
    </Modal>
  )
}

export default function Home() {
  const [bursts, setBursts] = useState([])
  const [stats, setStats] = useState(null)
  const [photos, setPhotos] = useState(null)
  const [clicks, setClicks] = useState(0)
  const [couple, setCouple] = useState(cachedCouple())
  const [editing, setEditing] = useState(false)
  const [charge, setCharge] = useState(0) // 0..1 mientras mantienes presionado
  const [boom, setBoom] = useState(false)
  const hold = useRef(null)

  const timers = useRef(new Set())

  useEffect(() => {
    let alive = true
    // Solo los tipos que se muestran aquí (no se descargan mensajes, categorías, etc.)
    Promise.all([listByKind('post'), listByKind('photo'), listByKind('video')])
      .then(([posts, photoList, videos]) => {
        if (!alive) return
        const places = new Set([...photoList, ...videos].map((i) => i.category))
        setStats({ post: posts.length, photo: photoList.length, video: videos.length, places: places.size })
        setPhotos(latestPhotos([...photoList, ...posts]))
      })
      .catch(() => { if (alive) { setStats(null); setPhotos([]) } })
    loadCouple().then((c) => { if (alive) setCouple(c) }).catch(() => {})
    const pending = timers.current
    return () => {
      alive = false
      pending.forEach(clearTimeout)
      pending.clear()
    }
  }, [])

  const burst = () => {
    setClicks((n) => n + 1)
    const id = Date.now()
    const parts = Array.from({ length: 14 }, (_, i) => ({
      id: `${id}-${i}`,
      angle: (i / 14) * Math.PI * 2 + Math.random() * 0.4,
      dist: 90 + Math.random() * 90,
      size: 12 + Math.random() * 14,
    }))
    setBursts((b) => [...b, ...parts])
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      setBursts((b) => b.filter((p) => !p.id.startsWith(`${id}-`)))
    }, 1200)
    timers.current.add(timer)
  }

  /* Mantener presionado 4 s: el corazón se carga y explota */
  const stopHold = useCallback(() => {
    if (hold.current) cancelAnimationFrame(hold.current.raf)
    hold.current = null
    setCharge(0)
  }, [])

  const startHold = (e) => {
    if (boom || hold.current) return
    if (e.pointerId !== undefined) e.currentTarget.setPointerCapture?.(e.pointerId)
    const t0 = performance.now()
    const loop = (now) => {
      const c = Math.min(1, (now - t0) / HOLD_MS)
      setCharge(c)
      if (c >= 1) {
        hold.current = null
        setCharge(0)
        setBoom(true)
        navigator.vibrate?.([60, 40, 120])
        return
      }
      hold.current = { t0, raf: requestAnimationFrame(loop) }
    }
    hold.current = { t0, raf: requestAnimationFrame(loop) }
  }

  const endHold = () => {
    if (!hold.current) return
    const quick = performance.now() - hold.current.t0 < 300
    stopHold()
    if (quick) burst()
  }

  useEffect(() => stopHold, [stopHold])
  const endBoom = useCallback(() => setBoom(false), [])

  const days = daysTogether(couple.since)
  const left = Math.ceil((1 - charge) * (HOLD_MS / 1000))

  return (
    <section className="home">
      {/* ---------- Portada sobre el atardecer ---------- */}
      <div className="hero">
        <h1 className="hero-title">
          <span className="hero-pre">{couple.names.M} &amp; {couple.names.D}, recuerdos con</span>
          <span className="hero-main">el amor de mi vida</span>
        </h1>

        <div className="hero-heart">
          <button
            className={`big-heart ${charge > 0 ? 'charging' : ''} ${charge > 0.6 ? 'shake' : ''} ${boom ? 'boomed' : ''}`}
            style={{ '--charge': charge }}
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerCancel={stopHold}
            onLostPointerCapture={endHold}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); startHold(e) } }}
            onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); endHold() } }}
            onBlur={stopHold}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Corazón. Tócalo, o mantenlo presionado 4 segundos (también con Enter o Espacio) para que explote"
          >
            <svg className="charge-ring" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="47" pathLength="100" style={{ strokeDashoffset: 100 - charge * 100 }} />
            </svg>
            <svg viewBox="0 0 200 180">
              <defs>
                <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffb07a" />
                  <stop offset="50%" stopColor="#ff5f8f" />
                  <stop offset="100%" stopColor="#b8326a" />
                </linearGradient>
                <radialGradient id="shine" cx="0.32" cy="0.28" r="0.35">
                  <stop offset="0%" stopColor="#fff" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
              </defs>
              <path className="heart-path" d={HEART} fill="url(#hg)" />
              <path d={HEART} fill="url(#shine)" />
              <path className="heart-outline" d={HEART} fill="none" />
            </svg>
            <span className="heart-ring" />
            <span className="heart-ring r2" />
          </button>
          {bursts.map((p) => (
            <svg key={p.id} className="burst" viewBox="0 0 24 24" width={p.size} height={p.size} style={{ '--dx': `${Math.cos(p.angle) * p.dist}px`, '--dy': `${Math.sin(p.angle) * p.dist}px` }} aria-hidden="true">
              <path d={SMALL_HEART} fill="currentColor" />
            </svg>
          ))}
          <p className="heart-hint" key={charge > 0 ? 'hold' : clicks}>
            {charge > 0 ? `Sigue presionando… ${left}` : clicks === 0 ? 'Tócalo, o mantenlo presionado' : PHRASES[(clicks - 1) % PHRASES.length]}
          </p>
        </div>

        <div className="hero-cta">
          <Link to="/recuerdos" className="btn glow">Ver nuestros recuerdos</Link>
          <Link to="/chat" className="btn glass-btn"><Icon name="message" size={16} /> Escribirle</Link>
        </div>
      </div>

      {/* ---------- Contador y números ---------- */}
      <div className="together glass">
        <button className="together-days" onClick={() => setEditing(true)} title="Editar fecha y nombres">
          {days !== null ? (
            <>
              <span className="together-num">{days.toLocaleString('es')}</span>
              <span className="together-label">días juntos <small>desde el {formatDate(couple.since)}</small></span>
            </>
          ) : (
            <>
              <span className="together-num"><Icon name="calendar" size={30} /></span>
              <span className="together-label">¿Desde cuándo estamos juntos? <small>Toca para poner la fecha</small></span>
            </>
          )}
          <Icon name="pencil" size={14} className="together-edit" />
        </button>
        <dl className="stats">
          {[['post', 'recuerdos'], ['photo', 'fotos'], ['video', 'videos'], ['places', 'lugares']].map(([k, label]) => (
            <div key={k}>
              <dd>{stats ? stats[k] : '–'}</dd>
              <dt>{label}</dt>
            </div>
          ))}
        </dl>
      </div>

      {/* ---------- Últimas fotos en polaroid ---------- */}
      <div className="polaroids-wrap">
        <div className="block-head">
          <h2>Lo último que guardamos</h2>
          <Link to="/fotos" className="link-light">Ver todas las fotos</Link>
        </div>
        {photos && photos.length === 0 && (
          <Link to="/fotos" className="polaroid-empty glass">
            <Icon name="image" size={26} />
            <b>Aquí aparecerán sus fotos más recientes</b>
            <span>Sube la primera desde la galería o Google Fotos</span>
          </Link>
        )}
        <div className="polaroids">
          {(photos || []).map((p, i) => (
            <Link to="/fotos" key={i} className="polaroid" style={{ '--r': `${[-6, 4, -3, 7, -5, 3][i % 6]}deg`, animationDelay: `${i * 90}ms` }}>
              <img src={p.src} alt="" loading="lazy" />
              <span>{p.label || formatDate(p.date, true)}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ---------- Secciones ---------- */}
      <div className="block-head">
        <h2>¿Qué quieres recordar hoy?</h2>
      </div>
      <div className="sections">
        {SECTIONS.map((s, i) => (
          <Link key={s.to} to={s.to} className={`section-card tone-${s.tone} ${i === 0 ? 'featured' : ''}`} style={{ animationDelay: `${120 + i * 70}ms`, ...(i === 0 && photos?.[0] ? { '--cover': `url(${JSON.stringify(photos[0].src)})` } : {}) }}>
            <span className="section-icon"><Icon name={s.icon} size={22} /></span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
            <div className="section-foot">
              <span>{s.cta}</span>
              {s.key && stats && <span className="section-count">{stats[s.key]}</span>}
            </div>
          </Link>
        ))}
      </div>

      {/* ---------- Frase final ---------- */}
      <div className="quote">
        <blockquote>
          Cada atardecer a tu lado se convierte en mi recuerdo favorito.
        </blockquote>
        <Link to="/informacion" className="btn glow">Leer tu carta</Link>
      </div>

      {boom && <HeartFireworks duration={BOOM_MS} title="Te amo" subtitle={`${couple.names.M} & ${couple.names.D}, para siempre`} onDone={endBoom} />}
      {editing && <CoupleForm couple={couple} onClose={() => setEditing(false)} onSaved={(c) => { setCouple(c); setEditing(false) }} />}
    </section>
  )
}
