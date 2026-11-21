import { useEffect, useMemo, useRef } from 'react'

/*
 * Fondo panorámico: cielo naranja y rosa al atardecer, con sol, nubes que se
 * mueven, estrellas, aves y un paisaje distinto en cada vista.
 * Todo se dibuja con código (sin imágenes), así que pesa muy poco.
 */

const W = 1600
const H = 900
const HORIZON = 610

/* Paisaje y posición del sol por vista */
export const SCENES = {
  home: { land: 'sea', sun: [800, 605], label: 'Mar al atardecer', reflect: 1 },
  recuerdos: { land: 'hills', sun: [800, 590], label: 'Colinas' },
  fotos: { land: 'mountains', sun: [800, 600], label: 'Montañas' },
  videos: { land: 'city', sun: [800, 600], label: 'Ciudad' },
  chat: { land: 'beach', sun: [800, 608], label: 'Playa', reflect: 0.9 },
  informacion: { land: 'sea', sun: [800, 612], label: 'Mar al anochecer', dusk: true, reflect: 0.7 },
}

export function sceneFor(pathname) {
  const key = pathname.split('/')[1] || 'home'
  return SCENES[key] ? key : 'home'
}

/* Números aleatorios repetibles (así el paisaje no cambia en cada render) */
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* Cordillera irregular (desplazamiento de punto medio) */
function ridge(seed, base, amp, rough = 0.55) {
  const r = rng(seed)
  let pts = [base - r() * amp, base - r() * amp]
  let disp = amp
  while (pts.length < 129) {
    const next = []
    for (let i = 0; i < pts.length - 1; i++) {
      next.push(pts[i], (pts[i] + pts[i + 1]) / 2 + (r() - 0.5) * disp)
    }
    next.push(pts[pts.length - 1])
    pts = next
    disp *= rough
  }
  const step = W / (pts.length - 1)
  return `M0 ${H} ` + pts.map((y, i) => `L${(i * step).toFixed(1)} ${Math.min(y, base + 30).toFixed(1)}`).join(' ') + ` L${W} ${H} Z`
}

/* Colinas suaves */
function hills(seed, base, amp) {
  const r = rng(seed)
  const f = [0.002 + r() * 0.002, 0.005 + r() * 0.003, 0.011 + r() * 0.004]
  const p = [r() * 6, r() * 6, r() * 6]
  let d = `M0 ${H}`
  for (let x = 0; x <= W; x += 16) {
    const y = base - amp * (0.55 * Math.sin(x * f[0] + p[0]) + 0.3 * Math.sin(x * f[1] + p[1]) + 0.15 * Math.sin(x * f[2] + p[2]))
    d += ` L${x} ${y.toFixed(1)}`
  }
  return d + ` L${W} ${H} Z`
}

function skyline(seed, base) {
  const r = rng(seed)
  const blds = []
  const wins = []
  let x = -10
  while (x < W) {
    const w = 34 + r() * 70
    const h = 50 + Math.pow(r(), 1.6) * 230
    blds.push({ x, w, h })
    for (let wy = base - h + 12; wy < base - 10; wy += 16) {
      for (let wx = x + 7; wx < x + w - 8; wx += 13) {
        if (r() < 0.2) wins.push({ x: wx, y: wy, o: 0.35 + r() * 0.6 })
      }
    }
    x += w + r() * 6
  }
  return { blds, wins }
}

function Palm({ x, base, h, lean }) {
  const topX = x + lean
  const topY = base - h
  const fronds = [-150, -115, -70, -35, 10, 45, 200, 160]
  return (
    <g>
      <path d={`M${x - 6} ${base} Q${x + lean * 0.2} ${base - h * 0.5} ${topX} ${topY} Q${x + lean * 0.25 + 9} ${base - h * 0.5} ${x + 8} ${base} Z`} />
      {fronds.map((a, i) => {
        const rad = (a * Math.PI) / 180
        const len = 70 + (i % 3) * 14
        const tx = topX + Math.cos(rad) * len
        const ty = topY + Math.sin(rad) * len * 0.55 + 26
        const cx = topX + Math.cos(rad) * len * 0.5
        const cy = topY + Math.sin(rad) * len * 0.3 - 18
        return <path key={i} d={`M${topX} ${topY} Q${cx} ${cy - 8} ${tx} ${ty} Q${cx} ${cy + 10} ${topX} ${topY + 4} Z`} />
      })}
    </g>
  )
}

/*
 * Mar: 4 capas de olas con paralaje de profundidad (fondo lento, bajo y claro;
 * delante rápido, alto y oscuro). Cada ola es periódica (periodo p) y mide W + p:
 * al desplazarla exactamente un periodo en bucle no hay saltos.
 * Encima, un vaivén vertical (bob) con duraciones no múltiplos entre sí.
 */
function waveY(x, w) {
  const t = (x / w.p) * Math.PI * 2
  // dos armónicos del mismo periodo: crestas más marcadas, valles más suaves
  return w.y - w.amp * (Math.sin(t + w.ph) + 0.35 * Math.sin(2 * t + w.ph * 2 + 0.8))
}
function waveTop(w, x0, x1, step) {
  let d = ''
  for (let x = x0; x <= x1 + 0.01; x += step) d += `${d ? ' L' : 'M'}${x.toFixed(1)} ${waveY(x, w).toFixed(1)}`
  return d
}
const WAVES = [
  { y: HORIZON + 16, amp: 2.2, p: 200, ph: 0.4, dur: 16, bob: 1.2, bobDur: 5.3, cls: 'far' },
  { y: HORIZON + 52, amp: 4, p: 320, ph: 1.9, dur: 17, bob: 2.2, bobDur: 6.7, cls: 'mid' },
  { y: HORIZON + 110, amp: 6.5, p: 400, ph: 3.1, dur: 15, bob: 3.4, bobDur: 7.9, cls: 'mid' },
  { y: HORIZON + 190, amp: 10, p: 800, ph: 5.2, dur: 19, bob: 5, bobDur: 9.7, cls: 'near' },
]
/* Mar azul: más claro y algo desaturado hacia el horizonte, profundo delante */
const SEA = {
  day: {
    grad: ['#9aa6c4', '#3f6f9e', '#1d3f6b', '#0e2340'],
    waves: [['#8fa9c9', 0.5], ['#4f7fae', 0.55], ['#2a5687', 0.65], ['#132f55', 0.8]],
    foam: ['#e6efff', '#dbe8ff', '#cfe0ff', '#c4d8f5'],
  },
  dusk: {
    grad: ['#6f6f9c', '#2c4a78', '#16294d', '#0a1428'],
    waves: [['#7f86b0', 0.45], ['#3c5a8c', 0.55], ['#223f6c', 0.65], ['#0b1a36', 0.8]],
    foam: ['#d9dcf5', '#cdd3f0', '#c0cbea', '#b4c2e2'],
  },
}
/* Geometría precalculada una sola vez (no depende de la escena) */
const WAVE_GEOM = WAVES.map((w) => {
  const top = waveTop(w, 0, W + w.p, 10)
  const body = `${top} L${W + w.p} ${H} L0 ${H} Z`
  // cresta dentro de un periodo (punto más alto)
  let xc = 0
  let yc = Infinity
  for (let x = 0; x < w.p; x += 2) { const y = waveY(x, w); if (y < yc) { yc = y; xc = x } }
  const half = w.p * 0.12
  const foam = []
  for (let k = 0; k * w.p <= W + w.p; k++) {
    const c = xc + k * w.p
    foam.push(waveTop({ ...w, y: w.y - 1 }, c - half, c + half, 4))
  }
  return { body, foam }
})
function Waves({ dusk }) {
  const pal = dusk ? SEA.dusk : SEA.day
  const r = rng(dusk ? 71 : 53)
  return (
    <g className="waves">
      {WAVES.map((w, i) => (
        <g key={i} className="wave-bob" style={{ '--bob': `${w.bob}px`, animationDuration: `${w.bobDur}s`, animationDelay: `${-i * 1.7}s` }}>
          <g className="wave" style={{ '--p': w.p, animationDuration: `${w.dur}s`, animationDirection: i % 2 ? 'reverse' : 'normal' }}>
            <path d={WAVE_GEOM[i].body} fill={pal.waves[i][0]} opacity={pal.waves[i][1]} />
            <g className={`foams ${w.cls}`} stroke={pal.foam[i]} strokeWidth={0.8 + i * 0.45} strokeLinecap="round" fill="none">
              {WAVE_GEOM[i].foam.map((d, j) => (
                <path key={j} className="foam" d={d} style={{ '--fo': 0.3 + i * 0.1, animationDuration: `${4 + r() * 3}s`, animationDelay: `${-r() * 7}s` }} />
              ))}
            </g>
          </g>
        </g>
      ))}
    </g>
  )
}

/* Reflejo del sol: franja cálida (dorado y naranja) que se ensancha hacia delante y ondula */
function SunReflection({ sun, dusk, k }) {
  const r = rng(dusk ? 17 : 29)
  const rows = Array.from({ length: 22 }, (_, i) => {
    const y = HORIZON + 8 + i * i * 0.62
    const w = 30 + i * 9
    return { x: sun[0] - w / 2 + Math.sin(i * 1.7) * 12, y, w, h: 1.6 + i * 0.12, op: (0.85 - i * 0.033) * k, cls: i % 3 === 2 ? 'glint w' : i < 4 ? 'glint core' : 'glint' }
  })
  // destellos sueltos: la mayoría dentro del cono del reflejo, algunos por todo el mar
  const sparks = Array.from({ length: 30 }, (_, i) => {
    const t = r()
    const y = HORIZON + 10 + t * t * 240
    const inCone = i < 20
    const spread = inCone ? 20 + t * 170 : W / 2
    return { x: sun[0] + (r() - 0.5) * 2 * spread, y, rx: 2 + t * 4, op: (inCone ? 0.9 : 0.45) * k, dur: 2.4 + r() * 2.6, delay: -r() * 5 }
  })
  return (
    <>
      <g className="shimmer">
        {rows.map((g, i) => (
          <rect key={i} className={g.cls} x={g.x} y={g.y} width={g.w} height={g.h} rx="1" opacity={g.op} style={{ '--gx': `${i % 2 ? 7 : -7}px`, animationDuration: `${2.3 + (i % 5) * 0.41}s`, animationDelay: `${-i * 0.23}s` }} />
        ))}
      </g>
      <g className="sea-sparks">
        {sparks.map((s, i) => (
          <ellipse key={i} className="sea-spark" cx={s.x} cy={s.y} rx={s.rx} ry={0.9} style={{ '--so': s.op, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }} />
        ))}
      </g>
    </>
  )
}

function Land({ type, sun, dusk, reflect = 1 }) {
  const layers = ['#c35a83', '#87336b', '#561f4f', '#2e1030']
  if (type === 'sea' || type === 'beach' || type === 'lake') {
    const far = type === 'lake' ? ridge(31, HORIZON - 4, 150, 0.52) : ridge(11, HORIZON + 2, 70, 0.5)
    return (
      <>
        <g className="sky-layer" style={{ '--k': 0.05 }}>
          <path d={far} fill={layers[0]} opacity=".75" />
          {type === 'lake' && <path d={ridge(37, HORIZON + 2, 80, 0.5)} fill={layers[1]} opacity=".85" />}
        </g>
        <rect x="0" y={HORIZON} width={W} height={H - HORIZON} fill="url(#seaGrad)" />
        {/* calidez del cielo reflejada junto al horizonte */}
        <rect x="0" y={HORIZON} width={W} height="70" fill="url(#seaHorizonWarm)" />
        <Waves dusk={dusk} />
        {/* resplandor cálido fijo bajo el sol: tiñe de dorado las crestas cercanas */}
        <rect x="0" y={HORIZON} width={W} height={H - HORIZON} fill="url(#seaSunWarm)" />
        <SunReflection sun={sun} dusk={dusk} k={reflect} />
        {type === 'beach' && (
          <g className="sky-layer" style={{ '--k': 0.14 }} fill={layers[3]}>
            <path d={`M0 ${H} L0 800 Q300 760 640 790 Q980 820 1600 770 L1600 ${H} Z`} />
            <Palm x={140} base={810} h={260} lean={60} />
            <Palm x={250} base={800} h={200} lean={-30} />
            <Palm x={1420} base={790} h={240} lean={-55} />
          </g>
        )}
        {type === 'sea' && (
          <g className="sky-layer" style={{ '--k': 0.12 }} fill={layers[3]}>
            <path d={`M0 ${H} L0 700 Q90 640 170 668 Q240 690 300 760 Q360 820 420 ${H} Z`} />
            <path d={`M${W} ${H} L${W} 730 Q1520 690 1450 745 Q1400 790 1360 ${H} Z`} />
          </g>
        )}
        {type === 'lake' && (
          <g className="sky-layer" style={{ '--k': 0.12 }}>
            <path d={hills(41, 820, 50)} fill={layers[3]} />
          </g>
        )}
      </>
    )
  }
  if (type === 'hills') {
    return (
      <>
        <g className="sky-layer" style={{ '--k': 0.04 }}><path d={hills(5, HORIZON + 10, 50)} fill={layers[0]} opacity=".8" /></g>
        <g className="sky-layer" style={{ '--k': 0.08 }}><path d={hills(8, 690, 60)} fill={layers[1]} /></g>
        <g className="sky-layer" style={{ '--k': 0.12 }}><path d={hills(13, 770, 70)} fill={layers[2]} /></g>
        <g className="sky-layer" style={{ '--k': 0.16 }} fill={layers[3]}>
          <path d={hills(21, 850, 50)} />
          <path d="M1250 830 L1256 720 Q1260 700 1262 720 L1268 830 Z" />
          <circle cx="1259" cy="700" r="44" />
          <circle cx="1228" cy="722" r="30" />
          <circle cx="1292" cy="718" r="32" />
        </g>
      </>
    )
  }
  if (type === 'mountains') {
    return (
      <>
        <g className="sky-layer" style={{ '--k': 0.04 }}><path d={ridge(3, HORIZON + 10, 260, 0.56)} fill={layers[0]} opacity=".75" /></g>
        <g className="sky-layer" style={{ '--k': 0.08 }}><path d={ridge(7, 700, 220, 0.55)} fill={layers[1]} /></g>
        <g className="sky-layer" style={{ '--k': 0.12 }}><path d={ridge(19, 790, 170, 0.5)} fill={layers[2]} /></g>
        <g className="sky-layer" style={{ '--k': 0.16 }}><path d={hills(23, 870, 40)} fill={layers[3]} /></g>
      </>
    )
  }
  if (type === 'city') {
    const { blds, wins } = skyline(17, 720)
    return (
      <>
        <g className="sky-layer" style={{ '--k': 0.04 }}><path d={ridge(9, HORIZON + 20, 120, 0.5)} fill={layers[0]} opacity=".7" /></g>
        <g className="sky-layer" style={{ '--k': 0.1 }}>
          {blds.map((b, i) => <rect key={i} x={b.x} y={720 - b.h} width={b.w} height={b.h + 200} fill={i % 3 ? layers[2] : layers[1]} />)}
          {wins.map((w, i) => <rect key={`w${i}`} className={i % 7 === 0 ? 'win blink' : 'win'} x={w.x} y={w.y} width="6" height="8" fill="#ffcf7a" opacity={w.o} />)}
        </g>
        <g className="sky-layer" style={{ '--k': 0.16 }}><path d={hills(27, 860, 30)} fill={layers[3]} /></g>
      </>
    )
  }
  return null
}

export default function SunsetSky({ scene = 'home' }) {
  const cfg = SCENES[scene] || SCENES.home
  const ref = useRef(null)

  const stars = useMemo(() => {
    const r = rng(99)
    return Array.from({ length: cfg.dusk ? 110 : 55 }, () => ({ x: r() * W, y: r() * (cfg.dusk ? 380 : 260), r: 0.6 + r() * 1.4, d: r() * 5, t: r() < 0.4 }))
  }, [cfg.dusk])

  const clouds = useMemo(() => {
    const r = rng(scene.length * 7 + 3)
    return Array.from({ length: 7 }, (_, i) => ({
      y: 120 + r() * 340,
      s: 0.6 + r() * 0.9,
      dur: 90 + r() * 120,
      delay: -r() * 200,
      puffs: Array.from({ length: 5 }, (_, j) => ({ x: j * 46 + r() * 20, y: (r() - 0.5) * 18, rx: 50 + r() * 50, ry: 14 + r() * 10 })),
      i,
    }))
  }, [scene])

  // Paralaje: el paisaje se mueve un poco al hacer scroll
  // (desactivado si el sistema pide movimiento reducido; se reevalúa si cambia la preferencia)
  useEffect(() => {
    let raf = 0
    let listening = false
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => ref.current?.style.setProperty('--sy', String(Math.min(window.scrollY, 1200))))
    }
    const apply = () => {
      if (mq?.matches) {
        if (listening) window.removeEventListener('scroll', onScroll)
        listening = false
        cancelAnimationFrame(raf)
        ref.current?.style.setProperty('--sy', '0')
      } else {
        if (!listening) window.addEventListener('scroll', onScroll, { passive: true })
        listening = true
        onScroll()
      }
    }
    apply()
    mq?.addEventListener?.('change', apply)
    return () => {
      mq?.removeEventListener?.('change', apply)
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  const [sx, sy] = cfg.sun
  const sky = cfg.dusk
    ? ['#140a2b', '#2d1446', '#5b1f5c', '#a3346f', '#e0607a', '#ff9a62']
    : ['#3a1a52', '#7a2a6e', '#c9427c', '#f46f6f', '#ff9a52', '#ffc46b']

  return (
    <div ref={ref} className={`sky ${cfg.dusk ? 'dusk' : ''}`} aria-hidden="true">
      <svg key={scene} className="sky-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            {sky.map((c, i) => <stop key={i} offset={`${[0, 18, 38, 55, 64, 69][i]}%`} stopColor={c} />)}
          </linearGradient>
          <radialGradient id="sunGlow" cx={sx / W} cy={sy / H} r="0.55" gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor="#fff2c4" stopOpacity=".95" />
            <stop offset="12%" stopColor="#ffc46b" stopOpacity=".7" />
            <stop offset="40%" stopColor="#ff7f6b" stopOpacity=".25" />
            <stop offset="100%" stopColor="#ff7f6b" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sunBody" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0%" stopColor="#fffbe8" />
            <stop offset="55%" stopColor="#ffe3a0" />
            <stop offset="100%" stopColor="#ffab6b" />
          </radialGradient>
          {/* mar azul (frío) para que el reflejo cálido del sol contraste */}
          <linearGradient id="seaGrad" x1="0" y1="0" x2="0" y2="1">
            {(cfg.dusk ? SEA.dusk : SEA.day).grad.map((c, i) => <stop key={i} offset={`${[0, 30, 65, 100][i]}%`} stopColor={c} />)}
          </linearGradient>
          <linearGradient id="seaHorizonWarm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cfg.dusk ? '#ff9a62' : '#ffb84d'} stopOpacity={cfg.dusk ? 0.3 : 0.42} />
            <stop offset="100%" stopColor={cfg.dusk ? '#ff9a62' : '#ffb84d'} stopOpacity="0" />
          </linearGradient>
          <radialGradient id="seaSunWarm" cx={sx / W} cy="0" r="0.8" fx={sx / W} fy="0" gradientTransform={`translate(${sx / W} 0) scale(.4 1) translate(${-sx / W} 0)`}>
            <stop offset="0%" stopColor="#ffb84d" stopOpacity={0.34 * (cfg.reflect ?? 1)} />
            <stop offset="45%" stopColor="#ff8a4c" stopOpacity={0.14 * (cfg.reflect ?? 1)} />
            <stop offset="100%" stopColor="#ff8a4c" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="cloudGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffd3c2" />
            <stop offset="60%" stopColor="#ff9fae" />
            <stop offset="100%" stopColor="#c45a8a" />
          </linearGradient>
          <filter id="soft" x="-30%" y="-150%" width="160%" height="400%"><feGaussianBlur stdDeviation="7" /></filter>
        </defs>

        <rect width={W} height={H} fill="url(#skyGrad)" />

        <g className="stars">
          {stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff6ea" className={s.t ? 'twinkle' : ''} style={{ animationDelay: `${-s.d}s` }} opacity={cfg.dusk ? 0.9 : 0.55} />
          ))}
        </g>

        <rect width={W} height={H} fill="url(#sunGlow)" className="sun-glow" />
        <circle cx={sx} cy={sy} r="150" fill="#ffb36b" opacity=".18" className="sun-halo" />
        <circle cx={sx} cy={sy} r="108" fill="#ffc77a" opacity=".22" className="sun-halo h2" />
        <circle cx={sx} cy={sy} r="80" fill="url(#sunBody)" className="sun" />

        {/* El desenfoque va en cada nube (no en todo el grupo): al moverse una nube solo se
            recalcula su propia región filtrada, mucho más barato en móvil */}
        <g className="clouds">
          {clouds.map((c) => (
            <g key={c.i} className="cloud" filter="url(#soft)" style={{ animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}>
              <g transform={`translate(0 ${c.y}) scale(${c.s})`} opacity=".85">
                {c.puffs.map((p, j) => <ellipse key={j} cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} fill="url(#cloudGrad)" />)}
              </g>
            </g>
          ))}
        </g>

        <g className="birds" stroke="#3a1236" strokeWidth="2.2" fill="none" strokeLinecap="round">
          {[[0, 210, 1], [40, 235, 0.8], [-30, 250, 0.7], [70, 205, 0.6]].map(([dx, y, s], i) => (
            <g key={i} className="bird-path" style={{ animationDelay: `${-i * 4 - 20}s` }}>
              <g className="bird-bob" style={{ animationDelay: `${-i * 1.7}s` }}>
                <path className="bird" transform={`translate(${dx} ${y}) scale(${s})`} d="M-12 0 Q-6 -7 0 0 Q6 -7 12 0" style={{ animationDelay: `${-i * 0.45}s` }} />
              </g>
            </g>
          ))}
        </g>

        <Land type={cfg.land} sun={cfg.sun} dusk={cfg.dusk} reflect={cfg.reflect} />
      </svg>
      <div className="sky-veil" />
    </div>
  )
}
