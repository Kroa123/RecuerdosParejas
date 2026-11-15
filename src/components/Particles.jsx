import { useEffect, useRef } from 'react'

/* Fondo de partículas cálidas (puntos y corazoncitos) que flotan y reaccionan al mouse/dedo */
export default function Particles() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const colors = ['#ffb38a', '#ff9a8b', '#f4b860', '#ffd6a5', '#e85d75', '#ffc2c7']
    let w, h, dpr, raf
    let parts = []
    const mouse = { x: -9999, y: -9999 }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const make = (init) => ({
      x: Math.random() * w,
      y: init ? Math.random() * h : h + 20,
      r: 1 + Math.random() * 3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(0.2 + Math.random() * 0.6),
      c: colors[(Math.random() * colors.length) | 0],
      heart: Math.random() < 0.18,
      a: 0.4 + Math.random() * 0.6,
      tw: Math.random() * Math.PI * 2,
    })

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.min(140, Math.round((w * h) / 9000))
      parts = Array.from({ length: n }, () => make(true))
    }

    const heart = (x, y, s) => {
      ctx.beginPath()
      ctx.moveTo(x, y + s * 0.3)
      ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3)
      ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s)
      ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3)
      ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3)
      ctx.fill()
    }

    const tick = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of parts) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const d2 = dx * dx + dy * dy
        if (d2 < 120 * 120) {
          const f = (1 - Math.sqrt(d2) / 120) * 1.6
          p.x += (dx / (Math.sqrt(d2) + 0.1)) * f
          p.y += (dy / (Math.sqrt(d2) + 0.1)) * f
        }
        p.x += p.vx + Math.sin(p.tw) * 0.2
        p.y += p.vy
        p.tw += 0.02
        if (p.y < -20 || p.x < -20 || p.x > w + 20) Object.assign(p, make(false))
        ctx.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(p.tw * 2))
        ctx.fillStyle = p.c
        if (p.heart) heart(p.x, p.y, p.r * 4)
        else {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      // líneas suaves entre partículas cercanas
      ctx.globalAlpha = 1
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const a = parts[i], b = parts[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < 90) {
            ctx.strokeStyle = `rgba(255, 170, 140, ${0.18 * (1 - d / 90)})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }
      if (!reduce) raf = requestAnimationFrame(tick)
    }

    const move = (e) => {
      const r = canvas.getBoundingClientRect()
      const t = e.touches?.[0] || e
      mouse.x = t.clientX - r.left
      mouse.y = t.clientY - r.top
    }
    const leave = () => { mouse.x = mouse.y = -9999 }

    resize()
    tick()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', move)
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('mouseout', leave)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('mouseout', leave)
    }
  }, [])

  return <canvas ref={ref} className="particles" aria-hidden="true" />
}
