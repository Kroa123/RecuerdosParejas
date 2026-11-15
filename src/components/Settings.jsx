import { useState } from 'react'
import Modal from './Modal'
import { exportAll, getConfig, importAll, resetConfig, setConfig } from '../lib/api'
import { useToast } from './Toast'

export default function Settings({ onClose }) {
  const cfg = getConfig()
  const [url, setUrl] = useState(cfg.url)
  const [resource, setResource] = useState(cfg.resource)
  const [testing, setTesting] = useState(false)
  const toast = useToast()

  const test = async () => {
    setTesting(true)
    try {
      const res = await fetch(`${url.replace(/\/+$/, '')}/${resource}`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      await res.json()
      toast('¡Conexión exitosa con la Mock API! 💖')
    } catch (e) {
      toast(`No se pudo conectar: ${e.message}`, 'error')
    } finally {
      setTesting(false)
    }
  }

  const save = () => {
    setConfig({ url, resource })
    onClose(true)
  }

  const download = async () => {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'recuerdos-respaldo.json'
    a.click()
  }

  const upload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const items = JSON.parse(await file.text())
      await importAll(items)
      toast(`Se importaron ${items.length} elementos`)
      onClose(true)
    } catch (err) {
      toast(`No se pudo importar: ${err.message}`, 'error')
    }
  }

  return (
    <Modal title="Dónde se guardan los recuerdos" onClose={() => onClose(false)}>
      <p className="muted">
        Ahora mismo: <b>{cfg.mode === 'remote' ? 'Mock API' : 'este navegador (local)'}</b>. Deja la URL vacía para
        guardar solo en este navegador.
      </p>
      <label className="field">
        URL base de la Mock API
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.mockapi.io/api/v1" />
      </label>
      <label className="field">
        Recurso
        <input value={resource} onChange={(e) => setResource(e.target.value)} placeholder="recuerdos" />
      </label>
      <div className="row gap">
        <button className="btn ghost" disabled={!url || testing} onClick={test}>{testing ? 'Probando…' : 'Probar conexión'}</button>
        <button className="btn" onClick={save}>Guardar</button>
        <button className="btn ghost" onClick={() => { resetConfig(); onClose(true) }}>Usar valor por defecto</button>
      </div>
      <hr />
      <p className="muted">Respaldo: descarga todo o súbelo a la fuente actual (sirve para pasar de local a la Mock API).</p>
      <div className="row gap">
        <button className="btn ghost" onClick={download}>⬇ Descargar respaldo</button>
        <label className="btn ghost">
          ⬆ Importar respaldo
          <input type="file" accept="application/json" hidden onChange={upload} />
        </label>
      </div>
    </Modal>
  )
}
