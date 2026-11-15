import { useMemo } from 'react'

/* Corazoncitos que suben suavemente por el fondo */
export default function FloatingHearts({ count = 18 }) {
  const hearts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 10 + Math.random() * 22,
        delay: -Math.random() * 20,
        dur: 14 + Math.random() * 16,
        hue: ['#ff9a8b', '#ffb38a', '#f4b860', '#e85d75', '#ffc2c7'][i % 5],
      })),
    [count],
  )
  return (
    <div className="floating-hearts" aria-hidden="true">
      {hearts.map((h) => (
        <span
          key={h.id}
          style={{
            left: `${h.left}%`,
            fontSize: h.size,
            color: h.hue,
            animationDelay: `${h.delay}s`,
            animationDuration: `${h.dur}s`,
          }}
        >
          ♥
        </span>
      ))}
    </div>
  )
}
