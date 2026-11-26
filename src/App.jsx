import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Recuerdos from './pages/Recuerdos'
import Categorias from './pages/Categorias'
import CategoriaDetalle from './pages/CategoriaDetalle'
import Informacion from './pages/Informacion'
import Chat from './pages/Chat'
import SunsetSky, { sceneFor } from './components/SunsetSky'
import Settings from './components/Settings'
import Envelope, { envelopeSeen } from './components/Envelope'
import Icon from './components/Icon'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/Confirm'
import ErrorBoundary from './components/ErrorBoundary'
import { getConfig, listByKind } from './lib/api'
import { authorOf, chatSeenAt, myName } from './lib/chat'
import { cachedCouple } from './lib/couple'
import { hasOpenDialog } from './hooks/useDialog'

/*
 * Carga diferida con un reintento: si falla la descarga de un chunk (p. ej. tras un despliegue
 * nuevo los nombres cambian y da 404), recarga la página una sola vez por sesión antes de mostrar
 * el error. La marca vive en sessionStorage y se borra cuando una carga sale bien.
 */
const CHUNK_RELOAD_KEY = 'recuerdos.chunkReload'
function lazyPage(load) {
  return lazy(() => load().then(
    (mod) => {
      try { sessionStorage.removeItem(CHUNK_RELOAD_KEY) } catch { /* sin storage */ }
      return mod
    },
    (err) => {
      let retried = true // sin storage no se recarga (evita bucles)
      try {
        retried = sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1'
        if (!retried) sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
      } catch { /* sin storage */ }
      if (retried) throw err
      window.location.reload()
      return new Promise(() => {}) // la página se recarga: se queda en "Cargando…"
    },
  ))
}

// Secciones de "Más": se cargan aparte (Leaflet no entra en el bundle principal)
const Capsula = lazyPage(() => import('./pages/Capsula'))
const Mapa = lazyPage(() => import('./pages/Mapa'))
const Pregunta = lazyPage(() => import('./pages/Pregunta'))

const links = [
  { to: '/', label: 'Inicio', icon: 'home' },
  { to: '/recuerdos', label: 'Recuerdos', icon: 'book' },
  { to: '/fotos', label: 'Fotos', icon: 'image' },
  { to: '/videos', label: 'Videos', icon: 'film' },
  { to: '/chat', label: 'Chat', icon: 'message' },
  { to: '/informacion', label: 'Para ti', icon: 'mail' },
]

// Agrupadas en el desplegable "Más" (en el menú móvil se ven como una sección)
const moreLinks = [
  { to: '/capsula', label: 'Cápsula del tiempo', icon: 'gift' },
  { to: '/mapa', label: 'Mapa de recuerdos', icon: 'map' },
  { to: '/pregunta', label: 'Pregunta del día', icon: 'help' },
]

/*
 * Cuenta mensajes nuevos de la otra persona (solo con Mock API, cada 20 s).
 * Un único intervalo estable: la ruta se lee desde una ref para no reiniciarlo al navegar.
 */
function useUnread(pathname) {
  const [n, setN] = useState(0)
  const pathRef = useRef(pathname)
  const remote = getConfig().mode === 'remote'

  useEffect(() => {
    pathRef.current = pathname
    if (pathname === '/chat') setN(0) // dentro del chat todo cuenta como leído
  }, [pathname])

  useEffect(() => {
    if (!remote) return
    let alive = true
    let busy = false
    const check = async () => {
      if (busy || pathRef.current === '/chat' || document.visibilityState !== 'visible') return
      busy = true
      try {
        const me = myName()
        const seen = chatSeenAt()
        const couple = cachedCouple()
        const list = await listByKind('message')
        // Los mensajes antiguos solo traen `from`: se compara con el mismo nombre derivado que usa el chat
        if (alive && pathRef.current !== '/chat') setN(list.filter((m) => authorOf(m, couple) !== me && (m.date || 0) > seen).length)
      } catch { /* sin conexión: no mostramos nada */ } finally {
        busy = false
      }
    }
    check()
    const id = setInterval(check, 20000)
    return () => { alive = false; clearInterval(id) }
  }, [remote])
  return n
}

/* Carga de las páginas diferidas */
function Lazy({ children }) {
  return (
    <Suspense fallback={<div className="empty-state" role="status"><span className="spinner" /> <p>Cargando…</p></div>}>
      {children}
    </Suspense>
  )
}

export default function App() {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState(false)
  // La sorpresa del sobre: solo al entrar por la portada, una vez por visita
  const [envelope, setEnvelope] = useState(() => window.location.pathname === '/' && !envelopeSeen())
  const { pathname } = useLocation()
  const mode = getConfig().mode
  const unread = useUnread(pathname)
  const scene = sceneFor(pathname)

  const menuBtnRef = useRef(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef(null)
  const moreBtnRef = useRef(null)
  const moreOpenRef = useRef(false)
  const moreActive = moreLinks.some((l) => pathname.startsWith(l.to))

  useEffect(() => { window.scrollTo(0, 0); setOpen(false); setMoreOpen(false) }, [pathname])

  // Desplegable "Más": se cierra con Escape (devolviendo el foco), con clic fuera y al tabular fuera
  useEffect(() => {
    moreOpenRef.current = moreOpen
    if (!moreOpen) return
    const onKey = (e) => {
      if (e.key !== 'Escape' || hasOpenDialog()) return
      setMoreOpen(false)
      moreBtnRef.current?.focus()
    }
    const onDown = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [moreOpen])

  // Escape cierra el menú (si no hay un diálogo encima) y devuelve el foco al botón
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      // Con "Más" abierto, Escape solo cierra "Más" (su propio listener); el menú sigue abierto
      if (e.key !== 'Escape' || hasOpenDialog() || moreOpenRef.current) return
      setOpen(false)
      menuBtnRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <ToastProvider>
      <ConfirmProvider>
        <SunsetSky scene={scene} />
        <header className="topbar dark">
          <NavLink to="/" className="brand">
            <span className="brand-mark"><Icon name="heart" size={15} fill /></span>
            <span><b>MyD</b> siempre juntos</span>
          </NavLink>
          <button ref={menuBtnRef} className="menu-btn icon-btn" aria-label="Menú" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen(!open)}>
            <Icon name={open ? 'x' : 'menu'} size={20} />
          </button>
          <nav id="main-nav" className={`nav ${open ? 'open' : ''}`}>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'} onClick={() => setOpen(false)}>
                <Icon name={l.icon} size={16} /> {l.label}
                {l.to === '/chat' && unread > 0 && <span className="badge">{unread}</span>}
              </NavLink>
            ))}
            <div
              ref={moreRef}
              className={`nav-more ${moreOpen ? 'open' : ''}`}
              onBlur={(e) => { if (moreOpen && e.relatedTarget && !moreRef.current?.contains(e.relatedTarget)) setMoreOpen(false) }}
            >
              <button
                ref={moreBtnRef}
                type="button"
                className={`nav-more-btn ${moreActive ? 'active' : ''}`}
                aria-expanded={moreOpen}
                aria-controls="more-menu"
                onClick={() => setMoreOpen((v) => !v)}
              >
                <Icon name="more" size={16} /> Más <Icon name="chevronDown" size={14} className="nav-more-caret" />
              </button>
              <span className="nav-more-label" aria-hidden="true">Más</span>
              <div id="more-menu" className="nav-more-menu">
                {moreLinks.map((l) => (
                  <NavLink key={l.to} to={l.to} onClick={() => { setMoreOpen(false); setOpen(false) }}>
                    <Icon name={l.icon} size={16} /> {l.label}
                  </NavLink>
                ))}
              </div>
            </div>
            <button
              className="gear"
              title={mode === 'remote' ? 'Conectado a la Mock API' : 'Guardando en este navegador'}
              onClick={() => { setSettings(true); setOpen(false) }}
            >
              <Icon name="settings" size={16} />
              <span className="gear-label">{mode === 'remote' ? 'API' : 'Local'}</span>
              <span className={`dot ${mode}`} />
            </button>
          </nav>
        </header>

        <main key={pathname.split('/')[1]} className={`page page-${scene} ${pathname === '/informacion' ? 'page-wide' : ''}`}>
          <ErrorBoundary resetKey={pathname}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/recuerdos" element={<Recuerdos />} />
              <Route path="/fotos" element={<Categorias kind="photo" />} />
              <Route path="/fotos/:categoria" element={<CategoriaDetalle kind="photo" />} />
              <Route path="/videos" element={<Categorias kind="video" />} />
              <Route path="/videos/:categoria" element={<CategoriaDetalle kind="video" />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/informacion" element={<Informacion />} />
              <Route path="/capsula" element={<Lazy><Capsula /></Lazy>} />
              <Route path="/mapa" element={<Lazy><Mapa /></Lazy>} />
              <Route path="/pregunta" element={<Lazy><Pregunta /></Lazy>} />
              <Route path="*" element={<Home />} />
            </Routes>
          </ErrorBoundary>
        </main>

        <footer className="foot mono dark">
          <span>hecho con cariño · {new Date().getFullYear()}</span>
          <span className={`dot ${mode}`} /> <span>{mode === 'remote' ? 'mockapi' : 'indexeddb'}</span>
        </footer>

        {envelope && <Envelope onDone={() => setEnvelope(false)} />}

        {settings && (
          <Settings
            onClose={(changed) => {
              setSettings(false)
              if (changed) window.location.reload()
            }}
          />
        )}
      </ConfirmProvider>
    </ToastProvider>
  )
}
