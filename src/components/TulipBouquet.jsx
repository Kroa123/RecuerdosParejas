/* Ramo de tulipanes que se dibuja por partes:
   1) tallos  2) hojas  3) flores que se abren una a una  4) papel  5) moño  6) destellos */

const TULIPS = [
  { x: 200, y: 120, r: 0, c: ['#ff5f6d', '#ffc3a0'] },
  { x: 150, y: 150, r: -14, c: ['#ff8fab', '#ffe5ec'] },
  { x: 252, y: 148, r: 13, c: ['#ffb347', '#ffe0a3'] },
  { x: 108, y: 200, r: -26, c: ['#f4b860', '#fff1c1'] },
  { x: 294, y: 198, r: 26, c: ['#e85d75', '#ffc2c7'] },
  { x: 172, y: 196, r: -6, c: ['#ff7a5c', '#ffd1b8'] },
  { x: 230, y: 202, r: 7, c: ['#ff9eb5', '#fff0f3'] },
  { x: 140, y: 250, r: -18, c: ['#ffa07a', '#ffe6d5'] },
  { x: 262, y: 250, r: 18, c: ['#ff6f91', '#ffd6e0'] },
]

const BASE = { x: 200, y: 395 }

const LEAVES = [
  { d: 'M188 360 C 150 330, 120 300, 112 262 C 140 290, 165 315, 192 345 Z', delay: 1.6 },
  { d: 'M212 360 C 250 330, 282 300, 290 262 C 262 290, 236 315, 208 345 Z', delay: 1.75 },
  { d: 'M195 370 C 170 320, 168 290, 176 250 C 186 290, 194 320, 202 360 Z', delay: 1.9 },
  { d: 'M205 370 C 232 330, 240 300, 236 268 C 224 300, 214 330, 198 362 Z', delay: 2.05 },
]

function stemPath({ x, y }) {
  const cx = BASE.x + (x - BASE.x) * 0.15
  const cy = (BASE.y + y) / 2 + 20
  return `M${BASE.x} ${BASE.y} Q ${cx} ${cy} ${x} ${y}`
}

export default function TulipBouquet() {
  // orden de florecimiento: del centro hacia afuera
  const bloomOrder = [0, 5, 6, 1, 2, 7, 8, 3, 4]

  return (
    <svg className="bouquet" viewBox="0 0 400 520" role="img" aria-label="Ramo de tulipanes">
      <defs>
        {TULIPS.map((t, i) => (
          <linearGradient key={i} id={`tg${i}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={t.c[0]} />
            <stop offset="100%" stopColor={t.c[1]} />
          </linearGradient>
        ))}
        <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e9cfb4" />
          <stop offset="100%" stopColor="#b98a63" />
        </linearGradient>
        <linearGradient id="paperIn" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f3e2cf" />
          <stop offset="100%" stopColor="#d9b995" />
        </linearGradient>
        <linearGradient id="leaf" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#4f8a4b" />
          <stop offset="100%" stopColor="#8cc66d" />
        </linearGradient>
      </defs>

      {/* 1) tallos */}
      <g className="stems">
        {TULIPS.map((t, i) => (
          <path key={i} d={stemPath(t)} className="stem" style={{ animationDelay: `${0.1 * i}s` }} />
        ))}
      </g>

      {/* 2) hojas */}
      <g>
        {LEAVES.map((l, i) => (
          <path key={i} d={l.d} className="leaf" fill="url(#leaf)" style={{ animationDelay: `${l.delay}s` }} />
        ))}
      </g>

      {/* 3) tulipanes */}
      {bloomOrder.map((idx, n) => {
        const t = TULIPS[idx]
        const delay = 2.3 + n * 0.32
        return (
          <g key={idx} transform={`translate(${t.x} ${t.y}) rotate(${t.r})`}>
            <g className="tulip" style={{ animationDelay: `${delay}s, 8s`, '--sway': `${3 + (idx % 3)}s` }}>
              <path className="petal side left" d="M0 2 C -26 0, -28 -34, -19 -56 C -10 -44, -3 -36, 0 -28 Z" fill={`url(#tg${idx})`} style={{ animationDelay: `${delay + 0.4}s` }} />
              <path className="petal side right" d="M0 2 C 26 0, 28 -34, 19 -56 C 10 -44, 3 -36, 0 -28 Z" fill={`url(#tg${idx})`} style={{ animationDelay: `${delay + 0.4}s` }} />
              <path className="petal" d="M0 4 C -19 2, -21 -36, 0 -60 C 21 -36, 19 2, 0 4 Z" fill={`url(#tg${idx})`} />
              <path d="M0 -6 C -6 -20, -6 -38, 0 -52" stroke="rgba(255,255,255,.45)" strokeWidth="2" fill="none" strokeLinecap="round" />
            </g>
          </g>
        )
      })}

      {/* 4) papel del ramo */}
      <g className="wrap" style={{ animationDelay: '5.4s' }}>
        <path d="M118 318 L200 300 L282 318 L236 478 L164 478 Z" fill="url(#paperIn)" />
        <path d="M104 312 C 150 340, 250 340, 296 312 L240 486 C 215 494, 185 494, 160 486 Z" fill="url(#paper)" />
        <path d="M104 312 C 140 360, 170 420, 160 486" stroke="#c99a6e" strokeWidth="1.5" fill="none" opacity=".6" />
        <path d="M296 312 C 260 360, 230 420, 240 486" stroke="#c99a6e" strokeWidth="1.5" fill="none" opacity=".6" />
      </g>

      {/* 5) moño */}
      <g className="bow" style={{ animationDelay: '6.1s' }}>
        <path d="M200 402 C 170 380, 140 386, 150 404 C 158 420, 184 414, 200 402 Z" fill="#e85d75" />
        <path d="M200 402 C 230 380, 260 386, 250 404 C 242 420, 216 414, 200 402 Z" fill="#e85d75" />
        <path d="M196 404 L178 452 L188 448 L194 458 L200 408 Z" fill="#d9435f" />
        <path d="M204 404 L222 452 L212 448 L206 458 L200 408 Z" fill="#d9435f" />
        <circle cx="200" cy="403" r="8" fill="#ff7a8a" />
      </g>

      {/* 6) destellos */}
      {[[90, 120], [320, 110], [60, 300], [345, 290], [200, 60], [120, 70], [285, 60]].map(([x, y], i) => (
        <path
          key={i}
          className="sparkle"
          style={{ animationDelay: `${6.5 + i * 0.15}s` }}
          transform={`translate(${x} ${y})`}
          d="M0 -9 L2 -2 L9 0 L2 2 L0 9 L-2 2 L-9 0 L-2 -2 Z"
          fill="#f4b860"
        />
      ))}
    </svg>
  )
}
