import { useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Recuerdos from './pages/Recuerdos'
import Categorias from './pages/Categorias'
import CategoriaDetalle from './pages/CategoriaDetalle'
import Informacion from './pages/Informacion'
import Settings from './components/Settings'
import FloatingHearts from './components/FloatingHearts'
import { ToastProvider } from './components/Toast'
import { getConfig } from './lib/api'

const links = [
  { to: '/', label: 'Inicio', icon: '♥' },
  { to: '/recuerdos', label: 'Recuerdos', icon: '✿' },
  { to: '/fotos', label: 'Fotos', icon: '📷' },
  { to: '/videos', label: 'Videos', icon: '🎬' },
  { to: '/informacion', label: 'Para ti', icon: '🌷' },
]

export default function App() {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState(false)
  const [, force] = useState(0)
  const { pathname } = useLocation()
  const mode = getConfig().mode

  return (
    <ToastProvider>
      {pathname !== '/informacion' && <FloatingHearts />}
      <header className="topbar">
        <NavLink to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-heart">♥</span> Nuestros recuerdos
        </NavLink>
        <button className="menu-btn" aria-label="Menú" onClick={() => setOpen(!open)}>
          {open ? '✕' : '☰'}
        </button>
        <nav className={`nav ${open ? 'open' : ''}`}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} onClick={() => setOpen(false)}>
              <span className="nav-icon">{l.icon}</span> {l.label}
            </NavLink>
          ))}
          <button
            className="gear"
            title={mode === 'remote' ? 'Conectado a la Mock API' : 'Guardando en este navegador'}
            onClick={() => { setSettings(true); setOpen(false) }}
          >
            ⚙ <span className={`dot ${mode}`} />
          </button>
        </nav>
      </header>

      <main key={pathname.split('/')[1]} className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/recuerdos" element={<Recuerdos />} />
          <Route path="/fotos" element={<Categorias kind="photo" />} />
          <Route path="/fotos/:categoria" element={<CategoriaDetalle kind="photo" />} />
          <Route path="/videos" element={<Categorias kind="video" />} />
          <Route path="/videos/:categoria" element={<CategoriaDetalle kind="video" />} />
          <Route path="/informacion" element={<Informacion />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>

      {settings && (
        <Settings
          onClose={(changed) => {
            setSettings(false)
            if (changed) { force((n) => n + 1); window.location.reload() }
          }}
        />
      )}
    </ToastProvider>
  )
}
