import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import Icon from './Icon'
import { useToast } from './Toast'
import { videoLimitMB } from '../lib/media'
import { createSession, deleteSession, downloadItem, getToken, googleClientId, isTooBig, listPicked, waitForSelection } from '../lib/googlePhotos'

/* Logo de Google Fotos (molinete de 4 colores) */
const GPhotosLogo = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 12V2a5 5 0 0 1 0 10z" fill="#EA4335" transform="rotate(0 12 12)" />
    <path d="M12 12V2a5 5 0 0 1 0 10z" fill="#FBBC04" transform="rotate(90 12 12)" />
    <path d="M12 12V2a5 5 0 0 1 0 10z" fill="#34A853" transform="rotate(180 12 12)" />
    <path d="M12 12V2a5 5 0 0 1 0 10z" fill="#4285F4" transform="rotate(270 12 12)" />
  </svg>
)

/*
 * Botón "Google Fotos". accept: 'image' | 'video' | 'all'.
 * onFiles(files: File[]) recibe los archivos descargados.
 */
export default function GooglePhotosButton({ accept = 'all', onFiles, disabled, className = 'tool' }) {
  const [step, setStep] = useState(null) // null | 'setup' | 'login' | 'open' | 'waiting' | 'downloading'
  const [session, setSession] = useState(null)
  const [progress, setProgress] = useState('')
  const tokenRef = useRef(null)
  const abortRef = useRef(null)
  const sessionRef = useRef(null)
  const alive = useRef(true)
  const toast = useToast()

  const updateSession = (s) => { sessionRef.current = s; setSession(s) }

  // Al desmontar: cortar el sondeo / descarga y cerrar la sesión de Google Fotos
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      abortRef.current?.abort()
      if (sessionRef.current && tokenRef.current) deleteSession(tokenRef.current, sessionRef.current.id)
      sessionRef.current = null
    }
  }, [])

  const close = () => {
    abortRef.current?.abort()
    if (sessionRef.current && tokenRef.current) deleteSession(tokenRef.current, sessionRef.current.id)
    updateSession(null); setStep(null); setProgress('')
  }

  const start = async () => {
    if (!googleClientId()) return setStep('setup')
    setStep('login')
    try {
      const token = await getToken()
      tokenRef.current = token
      const s = await createSession(token)
      if (!alive.current) return deleteSession(token, s.id)
      updateSession(s)
      setStep('open')
    } catch (e) {
      if (!alive.current) return
      toast(e.message, 'error')
      setStep(null)
    }
  }

  const openPicker = async () => {
    // Se abre con un clic para que el navegador no bloquee la ventana
    window.open(`${session.pickerUri}/autoclose`, 'gphotos', 'width=1000,height=760')
    setStep('waiting')
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const token = tokenRef.current
      await waitForSelection(token, session, { signal: ctrl.signal })
      const items = (await listPicked(token, session.id)).filter((it) => {
        const v = it.type === 'VIDEO' || (it.mediaFile?.mimeType || '').startsWith('video/')
        return accept === 'all' || (accept === 'video' ? v : !v)
      })
      if (!items.length) throw new Error(accept === 'video' ? 'No elegiste ningún video.' : accept === 'image' ? 'No elegiste ninguna foto.' : 'No elegiste nada.')
      setStep('downloading')
      const files = []
      const lim = videoLimitMB()
      let tooBig = 0
      for (let i = 0; i < items.length; i++) {
        if (ctrl.signal.aborted) throw new Error('cancelado')
        setProgress(`${i + 1} de ${items.length}`)
        try {
          // downloadItem corta la descarga del video en cuanto supera el límite (Content-Length o streaming)
          const f = await downloadItem(token, items[i], { maxBytes: lim * 1024 * 1024, signal: ctrl.signal })
          // respaldo: por si el tamaño real no se pudo conocer durante la descarga
          if (f.type.startsWith('video/') && f.size > lim * 1024 * 1024) tooBig++
          else files.push(f)
        } catch (err) {
          if (isTooBig(err)) tooBig++
          else if (err.name !== 'AbortError') toast(err.message, 'error')
        }
      }
      if (ctrl.signal.aborted) throw new Error('cancelado')
      deleteSession(token, session.id)
      updateSession(null)
      if (tooBig) toast(`${tooBig} video(s) superan ${lim} MB y no se agregaron. Súbelos a YouTube o Drive y pega el enlace.`, 'error')
      if (files.length) {
        onFiles(files)
        toast(`${files.length} archivo(s) traído(s) de Google Fotos`)
      }
      setStep(null)
    } catch (e) {
      if (!alive.current) return // el componente ya no está en pantalla
      if (e.message !== 'cancelado') toast(e.message, 'error')
      close()
    }
  }

  return (
    <>
      <button type="button" className={`${className} gphotos-btn`} disabled={disabled} onClick={start}>
        <GPhotosLogo /> Google Fotos
      </button>

      {step && (
        <Modal title="Importar de Google Fotos" subtitle={step === 'setup' ? 'Falta un paso de configuración' : 'Elige tus fotos y videos favoritos'} onClose={close}>
          {step === 'setup' && (
            <div className="gp-step">
              <p>Para traer fotos directamente desde Google Fotos hay que crear una llave gratuita de Google (se hace una sola vez). Los pasos están en el README, sección <b>“Conectar Google Fotos”</b>, y la llave va en la variable <code>VITE_GOOGLE_CLIENT_ID</code>.</p>
              <p className="gp-tip"><Icon name="sparkles" size={16} /><span>Mientras tanto: en un celular Android, al tocar <b>“Fotos / videos”</b> o el recuadro de subir, puedes elegir la app <b>Google Fotos</b> como origen y funciona igual.</span></p>
              <button className="btn wide" onClick={close}>Entendido</button>
            </div>
          )}
          {step === 'login' && <div className="gp-step center"><span className="spinner" /> <p>Inicia sesión con Google en la ventana que se abrió…</p></div>}
          {step === 'open' && (
            <div className="gp-step center">
              <GPhotosLogo size={44} />
              <p>¡Listo! Ahora abre Google Fotos, elige lo que quieras y toca <b>Listo</b>.</p>
              <button className="btn wide" onClick={openPicker}>Abrir Google Fotos</button>
            </div>
          )}
          {step === 'waiting' && (
            <div className="gp-step center">
              <span className="spinner" />
              <p>Esperando que elijas en Google Fotos…<br /><small className="muted">Cuando toques “Listo” allá, las fotos aparecen aquí solas.</small></p>
              <button className="btn subtle" onClick={() => window.open(`${session.pickerUri}/autoclose`, 'gphotos', 'width=1000,height=760')}>Volver a abrir la ventana</button>
            </div>
          )}
          {step === 'downloading' && <div className="gp-step center"><span className="spinner" /><p>Trayendo tus fotos… {progress}</p></div>}
        </Modal>
      )}
    </>
  )
}
