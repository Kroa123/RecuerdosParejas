import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listItems } from '../lib/api'

const cards = [
  { to: '/recuerdos', title: 'Recuerdos', text: 'Nuestros momentos, con fotos, videos y comentarios.', icon: '✿' },
  { to: '/fotos', title: 'Fotos', text: 'Cada lugar que hemos conocido juntos.', icon: '📷' },
  { to: '/videos', title: 'Videos', text: 'Momentos en movimiento, para volver a vivirlos.', icon: '🎬' },
  { to: '/informacion', title: 'Para ti', text: 'Unas palabras y un ramo de tulipanes.', icon: '🌷' },
]

export default function Home() {
  const [bursts, setBursts] = useState([])
  const [stats, setStats] = useState(null)
  const [clicks, setClicks] = useState(0)
  const heartRef = useRef(null)

  useEffect(() => {
    listItems()
      .then((all) => {
        const c = (k) => all.filter((i) => i.kind === k).length
        setStats({ post: c('post'), photo: c('photo'), video: c('video') })
      })
      .catch(() => setStats(null))
  }, [])

  const burst = () => {
    setClicks((n) => n + 1)
    const id = Date.now()
    const parts = Array.from({ length: 14 }, (_, i) => ({
      id: `${id}-${i}`,
      angle: (i / 14) * Math.PI * 2 + Math.random() * 0.4,
      dist: 90 + Math.random() * 90,
      size: 12 + Math.random() * 16,
    }))
    setBursts((b) => [...b, ...parts])
    setTimeout(() => setBursts((b) => b.filter((p) => !p.id.startsWith(`${id}-`))), 1300)
  }

  const phrases = ['Te amo ♥', 'Eres mi lugar favorito', 'Mi persona favorita', 'Contigo todo es mejor', 'Para siempre']

  return (
    <section className="home">
      <div className="hero">
        <p className="hero-kicker">Un rincón solo para nosotros</p>
        <h1 className="hero-title">
          <span>Recuerdos con</span>
          <span className="script">el amor de mi vida</span>
        </h1>

        <div className="big-heart-wrap">
          <button ref={heartRef} className="big-heart" onClick={burst} aria-label="Corazón">
            <svg viewBox="0 0 200 180">
              <defs>
                <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffb38a" />
                  <stop offset="50%" stopColor="#ff7a6b" />
                  <stop offset="100%" stopColor="#d9435f" />
                </linearGradient>
                <radialGradient id="shine" cx="0.32" cy="0.28" r="0.35">
                  <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
              </defs>
              <path
                className="heart-path"
                d="M100 170 C 40 125, 5 95, 5 55 C 5 25, 30 5, 58 5 C 78 5, 92 16, 100 32 C 108 16, 122 5, 142 5 C 170 5, 195 25, 195 55 C 195 95, 160 125, 100 170 Z"
                fill="url(#hg)"
              />
              <path
                d="M100 170 C 40 125, 5 95, 5 55 C 5 25, 30 5, 58 5 C 78 5, 92 16, 100 32 C 108 16, 122 5, 142 5 C 170 5, 195 25, 195 55 C 195 95, 160 125, 100 170 Z"
                fill="url(#shine)"
              />
              <path
                className="heart-outline"
                d="M100 170 C 40 125, 5 95, 5 55 C 5 25, 30 5, 58 5 C 78 5, 92 16, 100 32 C 108 16, 122 5, 142 5 C 170 5, 195 25, 195 55 C 195 95, 160 125, 100 170 Z"
                fill="none"
              />
            </svg>
            <span className="heart-ring" />
            <span className="heart-ring r2" />
          </button>
          {bursts.map((p) => (
            <span
              key={p.id}
              className="burst"
              style={{
                '--dx': `${Math.cos(p.angle) * p.dist}px`,
                '--dy': `${Math.sin(p.angle) * p.dist}px`,
                fontSize: p.size,
              }}
            >
              ♥
            </span>
          ))}
        </div>
        <p className="heart-hint" key={clicks}>
          {clicks === 0 ? 'Toca el corazón' : phrases[(clicks - 1) % phrases.length]}
        </p>

        {stats && (
          <div className="stats">
            <div><b>{stats.post}</b><span>recuerdos</span></div>
            <div><b>{stats.photo}</b><span>fotos</span></div>
            <div><b>{stats.video}</b><span>videos</span></div>
          </div>
        )}
      </div>

      <div className="home-cards">
        {cards.map((c, i) => (
          <Link key={c.to} to={c.to} className="home-card" style={{ animationDelay: `${0.15 * i + 0.3}s` }}>
            <span className="home-card-icon">{c.icon}</span>
            <h3>{c.title}</h3>
            <p>{c.text}</p>
            <span className="home-card-go">Entrar →</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
