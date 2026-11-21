import { useState } from 'react'
import Modal from './Modal'
import { exportAll, getConfig, importAll, resetConfig, setConfig, testConnection } from '../lib/api'
import { useToast } from './Toast'
import Icon from './Icon'

const ENV_URL = (import.meta.env.VITE_MOCKAPI_URL || '').trim()

export default function Settings({ onClose }) {
  const cfg = getConfig()
  const [url, setUrl] = useState(cfg.url)
  const [resource, setResource] = useState(cfg.resource)
  const [testing, setTesting] = useState(false)
  const [importing, setImporting] = useState(false)
  const toast = useToast()

  const test = async () => {
    setTesting(true)
    try {
      await testConnection(url, resource)
      toast('Conexión correcta con la Mock API')
    } catch (e) {
      toast(`No se pudo conectar: ${e.message}`, 'error')
    } finally {
      setTesting(false)
    }
  }

  const save = () => {
    // Con la URL vacía se guarda el modo local explícitamente (aunque exista VITE_MOCKAPI_URL)
    setConfig({ url, resource })
    onClose(true)
  }

  const download = async () => {
    try {
      const data = await exportAll()
      const blob = new Blob([JSON.stringify(data || [])], { type: 'application/json' })
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = 'recuerdos-respaldo.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      // se libera después de que el navegador empiece la descarga
      setTimeout(() => URL.revokeObjectURL(href), 1000)
    } catch (err) {
      toast(`No se pudo descargar el respaldo: ${err.message}`, 'error')
    }
  }

  const upload = async (e) => {
    const input = e.target
    const file = input.files?.[0]
    input.value = '' // permite volver a elegir el mismo archivo
    if (!file) return
    setImporting(true)
    try {
      let items
      try {
        items = JSON.parse(await file.text())
      } catch {
        throw new Error('el archivo no es un JSON válido.')
      }
      const r = await importAll(items)
      const parts = [`${r.imported} importado(s)`]
      if (r.skipped) parts.push(`${r.skipped} ya existían (saltados)`)
      if (r.failed) parts.push(`${r.failed} fallaron`)
      const msg = `Respaldo: ${parts.join(', ')}.`
      if (r.failed) toast(`${msg} ${r.errors[0] || ''}`.trim(), 'error')
      else toast(msg)
      if (r.imported) onClose(true)
    } catch (err) {
      toast(`No se pudo importar: ${err.message}`, 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal title="Almacenamiento" subtitle="Dónde se guardan los recuerdos" onClose={() => onClose(false)}>
      <p className="muted small">
        Ahora mismo: <b>{cfg.mode === 'remote' ? 'Mock API' : 'este navegador (local)'}</b>. Deja la URL vacía y guarda para
        usar solo este navegador.{ENV_URL ? ' “Usar valor por defecto” vuelve a la Mock API configurada en el despliegue.' : ''}
      </p>
      <label className="field">
        <span>URL base de la Mock API</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.mockapi.io/api/v1" />
      </label>
      <label className="field">
        <span>Recurso</span>
        <input value={resource} onChange={(e) => setResource(e.target.value)} placeholder="recuerdos" />
      </label>
      <div className="row gap">
        <button className="btn ghost sm" disabled={!url.trim() || testing} onClick={test}>{testing ? 'Probando…' : 'Probar conexión'}</button>
        <button className="btn sm" onClick={save}>Guardar</button>
        <button className="btn subtle sm" onClick={() => { resetConfig(); onClose(true) }}>Usar valor por defecto</button>
      </div>
      <hr />
      <p className="muted small">Respaldo: descarga todo o súbelo a la fuente actual (sirve para pasar de local a la Mock API). Los elementos que ya existen no se duplican.</p>
      <div className="row gap">
        <button className="btn ghost sm" onClick={download}><Icon name="download" size={15} /> Descargar respaldo</button>
        <label className="btn ghost sm" aria-disabled={importing}>
          <Icon name="upload" size={15} /> {importing ? 'Importando…' : 'Importar respaldo'}
          <input type="file" accept="application/json,.json" hidden disabled={importing} onChange={upload} />
        </label>
      </div>
    </Modal>
  )
}
