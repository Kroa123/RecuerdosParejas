import { useEffect, useRef } from 'react'

/*
 * Explosión del corazón: fuegos artificiales + lluvia de corazones + "Te amo".
 * Dura `duration` ms (2 s) y luego llama a onDone.
 */
const COLORS = ['#ff5f8f', '#ff9ab8', '#ffd38a', '#ff8a4c', '#ffffff', '#ffb3c9', '#e8457a']

function heartPoint(t) {
  // curva de corazón clásica, normalizada a ~[-1, 1]
  const x = 16 * Math.pow(Math.sin(t), 3)
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
  return [x / 17, -y / 17]
}

export default function HeartFireworks({ duration = 2000, title = 'Te amo', subtitle = '', onDone }) {
  const ref = useRef(null)

  useEffect(() => {
    const end = setTimeout(() => onDone?.(), duration)
    // Si el sistema pide menos movimiento, solo se muestra el "Te amo" sin fuegos
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => clearTimeout(end)
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = window.innerWidth
    const h = window.innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const parts = []
    const burst = (x, y, n, speed, heart = false) => {
      for (let i = 0; i < n; i++) {
        let vx, vy
        if (heart) {
          const [hx, hy] = heartPoint((i / n) * Math.PI * 2)
          vx = hx * speed; vy = hy * speed
        } else {
          const a = Math.random() * Math.PI * 2
          const s = speed * (0.35 + Math.random() * 0.65)
          vx = Math.cos(a) * s; vy = Math.sin(a) * s
        }
        parts.push({ x, y, vx, vy, life: 1, decay: 0.012 + Math.random() * 0.012, c: COLORS[(Math.random() * COLORS.length) | 0], r: 1.4 + Math.random() * 2.2, heart: !heart && Math.random() < 0.18 })
      }
    }

    // Corazón gigante en el centro y fuegos alrededor, escalonados
    const cx = w / 2
    const cy = h * 0.42
    burst(cx, cy, 120, Math.min(w, h) / 95, true)
    const timers = [0, 180, 380, 560, 760, 950].map((t, i) =>
      setTimeout(() => burst(w * (0.15 + Math.random() * 0.7), h * (0.12 + Math.random() * 0.38), 70, 5 + Math.random() * 2.5), t + i * 10),
    )

    const drawHeart = (x, y, s) => {
      ctx.beginPath()
      ctx.moveTo(x, y + s * 0.3)
      ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3)
      ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s)
      ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3)
      ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3)
      ctx.fill()
    }

    let raf
    const start = performance.now()
    const tick = (now) => {
      const t = now - start
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      for (const p of parts) {
        if (p.life <= 0) continue
        p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.06
        p.x += p.vx; p.y += p.vy
        p.life -= p.decay
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.fillStyle = p.c
        if (p.heart) drawHeart(p.x, p.y, p.r * 5)
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill() }
      }
      if (t < duration) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); clearTimeout(end); timers.forEach(clearTimeout) }
  }, [duration, onDone])

  const hearts = Array.from({ length: 26 }, (_, i) => i)

  return (
    <div className="fireworks" style={{ '--dur': `${duration}ms` }} role="status" aria-live="polite">
      <canvas ref={ref} />
      <div className="fw-hearts" aria-hidden="true">
        {hearts.map((i) => {
          const a = (i / hearts.length) * Math.PI * 2
          const d = 35 + (i % 4) * 9
          return (
            <svg key={i} className="fw-heart" viewBox="0 0 24 24" style={{ '--dx': `${Math.cos(a) * d}vmin`, '--dy': `${Math.sin(a) * d}vmin`, '--s': 0.7 + (i % 3) * 0.35, animationDelay: `${(i % 5) * 40}ms` }}>
              <path d="M12 21s-8-5.2-8-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.8C20 15.8 12 21 12 21z" />
            </svg>
          )
        })}
      </div>
      <div className="fw-text">
        <span className="fw-title">{title}</span>
        {subtitle && <span className="fw-sub">{subtitle}</span>}
      </div>
    </div>
  )
}
