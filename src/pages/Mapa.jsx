import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { byDateDesc, listByKind, mutateItem, runAll } from '../lib/api'
import { catOf } from '../lib/categories'
import { GEO_GAP_MS, PERU_CENTER, PERU_ZOOM, cacheGeo, cachedGeo, geocode, hasCoords, wait } from '../lib/geo'
import { SCOPE_TEXT, plural } from '../lib/scopes'
import { hasOpenDialog } from '../hooks/useDialog'
import Icon from '../components/Icon'
import { useToast } from '../components/Toast'

const norm = (name) => (name || '').trim().toLowerCase()
const round6 = (n) => Math.round(n * 1e6) / 1e6

/* Marcador propio (divIcon): evita las imágenes por defecto de Leaflet, que Vite no resuelve */
const HEART_PATH = 'M19.5 12.572 12 20l-7.5-7.428A5 5 0 1 1 12 6.006a5 5 0 1 1 7.5 6.572'
const pinIcon = (moving) => L.divIcon({
  className: `map-pin${moving ? ' is-moving' : ''}`,
  html: `<span class="map-pin-body"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="${HEART_PATH}" fill="currentColor"/></svg></span>`,
  iconSize: [34, 42],
  iconAnchor: [17, 40],
  popupAnchor: [0, -36],
})

/* Lugares = categorías de fotos y videos, unidas por nombre (sin distinguir mayúsculas) */
function buildPlaces(data) {
  if (!data) return []
  const map = new Map()
  for (const c of data.cats) {
    if (c.scope !== 'photo' && c.scope !== 'video') continue
    const key = norm(c.name)
    if (!key) continue
    if (!map.has(key)) map.set(key, { key, name: c.name.trim(), entities: [], scopes: new Set(), photos: [], videos: [], lat: null, lng: null })
    const p = map.get(key)
    p.entities.push(c)
    p.scopes.add(c.scope)
    if (!hasCoords(p) && hasCoords(c)) { p.lat = Number(c.lat); p.lng = Number(c.lng) }
  }
  for (const it of data.photos) map.get(norm(catOf(it)))?.photos.push(it)
  for (const it of data.videos) map.get(norm(catOf(it)))?.videos.push(it)
  for (const p of map.values()) p.photos.sort(byDateDesc)
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export default function Mapa() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [geo, setGeo] = useState({}) // key -> { lat, lng } | 'miss' (resultados de esta visita)
  const [geocoding, setGeocoding] = useState(false)
  const [moving, setMoving] = useState(null) // key del pin arrastrable
  const [placing, setPlacing] = useState(null) // key del lugar que se ubica con un clic
  const boxRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const placingRef = useRef(null)
  const placesRef = useRef([])
  const fitRef = useRef('')
  const markersRef = useRef(new Map()) // key -> { marker, place, moving }
  const navigate = useNavigate()
  const toast = useToast()

  /* ---------- Datos ---------- */
  const reqRef = useRef(0)
  const load = () => {
    const req = ++reqRef.current
    setError('')
    return Promise.all([listByKind('category'), listByKind('photo'), listByKind('video')])
      .then(([cats, photos, videos]) => { if (req === reqRef.current) setData({ cats, photos, videos }) })
      .catch((e) => { if (req === reqRef.current) { setError(e.message); setData((d) => d || { cats: [], photos: [], videos: [] }) } })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); return () => { reqRef.current++ } }, [])

  const places = useMemo(() => buildPlaces(data).map((p) => {
    const g = geo[p.key]
    return g && g !== 'miss' ? { ...p, lat: g.lat, lng: g.lng } : p
  }), [data, geo])
  const located = useMemo(() => places.filter(hasCoords), [places])
  const unlocated = places.filter((p) => !hasCoords(p))
  placesRef.current = places

  /* Guarda lat/lng en todas las categorías del lugar (fotos y videos) */
  const saveCoords = async (place, { lat, lng }, { quiet = false } = {}) => {
    const pos = { lat: round6(lat), lng: round6(lng) }
    setGeo((g) => ({ ...g, [place.key]: pos }))
    cacheGeo(place.name, pos)
    const results = await runAll(place.entities, (e) => mutateItem(e.id, (x) => ({ ...x, ...pos })))
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed) toast(`No se pudo guardar la ubicación de "${place.name}". Inténtalo de nuevo.`, 'error')
    else if (!quiet) toast(`Ubicación de "${place.name}" guardada`)
  }
  const saveRef = useRef(saveCoords)
  saveRef.current = saveCoords

  /* ---------- Geocodificación en secuencia (1 petición por segundo) ---------- */
  useEffect(() => {
    if (!data) return
    const ctrl = new AbortController()
    const queue = []
    const cached = []
    for (const p of buildPlaces(data)) {
      if (hasCoords(p)) continue
      const c = cachedGeo(p.name)
      if (c?.miss) setGeo((g) => ({ ...g, [p.key]: 'miss' }))
      else if (c) cached.push([p, c])
      else queue.push(p)
    }
    // Las coordenadas en caché se guardan fuera del efecto y solo si no se canceló
    // (en StrictMode el efecto se monta dos veces: así no hay doble mutateItem)
    if (cached.length) {
      Promise.resolve().then(() => {
        if (ctrl.signal.aborted) return
        for (const [p, c] of cached) saveRef.current(p, c, { quiet: true })
      })
    }
    // Al cancelar (cambio de datos o salida) se apaga "buscando ubicaciones…"; si hay otra ronda, la vuelve a encender
    const stop = () => { ctrl.abort(); setGeocoding(false) }
    if (!queue.length) return stop
    setGeocoding(true)
    ;(async () => {
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i]
        try {
          if (i > 0) await wait(GEO_GAP_MS, ctrl.signal)
          const hit = await geocode(p.name, ctrl.signal)
          if (ctrl.signal.aborted) return
          if (hit) await saveRef.current(p, hit, { quiet: true })
          else { cacheGeo(p.name, null); setGeo((g) => ({ ...g, [p.key]: 'miss' })) }
        } catch (e) {
          if (e?.name === 'AbortError') return
          // Error de red o límite de Nominatim: se marca sin ubicar en esta visita (sin cachear)
          setGeo((g) => ({ ...g, [p.key]: 'miss' }))
          if (/429|403/.test(e?.message || '')) {
            queue.slice(i + 1).forEach((q) => setGeo((g) => ({ ...g, [q.key]: 'miss' })))
            break
          }
        }
      }
      if (!ctrl.signal.aborted) setGeocoding(false)
    })()
    return stop
  }, [data])

  /* ---------- Mapa (se crea una vez y se destruye al salir) ---------- */
  useEffect(() => {
    const map = L.map(boxRef.current, { center: PERU_CENTER, zoom: PERU_ZOOM, worldCopyJump: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    const markers = markersRef.current

    // "Ubicar manualmente": clic en el mapa para colocar el lugar elegido
    map.on('click', (e) => {
      const key = placingRef.current
      if (!key) return
      const place = placesRef.current.find((p) => p.key === key)
      setPlacing(null)
      if (place) saveRef.current(place, { lat: e.latlng.lat, lng: e.latlng.lng })
    })

    // La altura del contenedor cambia con el responsive (y con la carga del CSS)
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(boxRef.current)

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      layerRef.current = null
      markers.clear()
    }
  }, [])

  useEffect(() => { placingRef.current = placing }, [placing])

  /*
   * ---------- Marcadores ----------
   * Se actualizan de forma incremental (key -> marcador): añadir los nuevos, quitar los que
   * ya no están y ajustar los existentes. Así un cambio de datos (p. ej. un "no encontrado"
   * de la geocodificación) no cierra el popup abierto ni rompe un pin a mitad de arrastre.
   */
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    const markers = markersRef.current
    const keys = new Set()

    for (const p of located) {
      keys.add(p.key)
      const isMoving = moving === p.key
      let entry = markers.get(p.key)
      if (!entry) {
        const marker = L.marker([p.lat, p.lng], { icon: pinIcon(isMoving), draggable: isMoving, title: p.name, alt: p.name, riseOnHover: true })
        const created = { marker, place: p, moving: isMoving }
        entry = created
        // El popup y el arrastre leen el lugar más reciente desde la entrada (no un cierre viejo)
        marker.bindPopup(() => popupContent(created.place), { minWidth: 180, maxWidth: 240 })
        marker.on('dragend', () => {
          if (!created.moving) return
          const { lat, lng } = marker.getLatLng()
          setMoving(null)
          saveRef.current(created.place, { lat, lng })
        })
        markers.set(p.key, entry)
        layer.addLayer(marker)
        continue
      }
      entry.place = p
      if (entry.moving !== isMoving) {
        entry.moving = isMoving
        entry.marker.options.draggable = isMoving
        // setIcon reinstala el arrastre: primero el icono y luego activar/desactivar
        entry.marker.setIcon(pinIcon(isMoving))
        if (isMoving) entry.marker.dragging?.enable()
        else entry.marker.dragging?.disable()
      }
      // Mientras se mueve, la posición la decide el arrastre
      const cur = entry.marker.getLatLng()
      if (!isMoving && (cur.lat !== p.lat || cur.lng !== p.lng)) entry.marker.setLatLng([p.lat, p.lng])
    }

    for (const [key, entry] of markers) {
      if (keys.has(key)) continue
      layer.removeLayer(entry.marker)
      markers.delete(key)
    }

    // Encuadra todos los pines cuando cambia el conjunto de lugares ubicados (no mientras se edita)
    const sig = located.map((p) => p.key).join('|')
    if (!moving && sig !== fitRef.current) {
      fitRef.current = sig
      if (located.length === 1) map.setView([located[0].lat, located[0].lng], 11)
      else if (located.length > 1) map.fitBounds(L.latLngBounds(located.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 12 })
      else map.setView(PERU_CENTER, PERU_ZOOM)
    }
    // popupContent depende de navigate/setMoving (estables)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located, moving])

  /* Contenido del popup como nodos DOM (sin HTML interpolado) */
  function popupContent(p) {
    const el = (tag, cls, text) => {
      const n = document.createElement(tag)
      if (cls) n.className = cls
      if (text) n.textContent = text
      return n
    }
    const box = el('div', 'map-popup')
    box.append(el('strong', 'map-popup-title', p.name))
    const counts = []
    if (p.scopes.has('photo') || p.photos.length) counts.push(plural(p.photos.length, SCOPE_TEXT.photo.unit))
    if (p.scopes.has('video') || p.videos.length) counts.push(plural(p.videos.length, SCOPE_TEXT.video.unit))
    box.append(el('span', 'map-popup-meta', counts.join(' · ')))
    if (p.photos[0]?.src) {
      const img = el('img', 'map-popup-thumb')
      img.src = p.photos[0].src
      img.alt = ''
      img.loading = 'lazy'
      box.append(img)
    }
    const links = el('div', 'map-popup-links')
    for (const scope of ['photo', 'video']) {
      if (!p.scopes.has(scope)) continue
      const t = SCOPE_TEXT[scope]
      const href = `${t.base}/${encodeURIComponent(p.name)}`
      const a = el('a', 'map-popup-link', `Ver ${t.unit[1]}`)
      a.href = href
      a.addEventListener('click', (e) => { e.preventDefault(); navigate(href) })
      links.append(a)
    }
    box.append(links)
    const move = el('button', 'map-popup-move', 'Mover pin')
    move.type = 'button'
    move.addEventListener('click', () => {
      mapRef.current?.closePopup()
      setPlacing(null)
      setMoving(p.key)
    })
    box.append(move)
    return box
  }

  /* Escape cancela "Mover pin" / "Ubicar manualmente" */
  useEffect(() => {
    if (!moving && !placing) return
    const onKey = (e) => {
      if (e.key !== 'Escape' || hasOpenDialog()) return
      setMoving(null)
      setPlacing(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [moving, placing])

  const startPlacing = (p) => {
    setMoving(null)
    setPlacing(p.key)
    boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const editing = moving || placing
  const editingName = places.find((p) => p.key === editing)?.name || ''
  const pending = (p) => geocoding && !geo[p.key]

  return (
    <section>
      <header className="page-head">
        <h1 className="page-title">Mapa de recuerdos</h1>
        <p className="page-sub">Cada corazón es un lugar donde guardamos fotos o videos.</p>
        <div className="page-actions">
          {data && (
            <span className="mono muted">
              {plural(located.length, ['lugar ubicado', 'lugares ubicados'])}
              {geocoding && ' · buscando ubicaciones…'}
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="empty-state" role="alert">
          <Icon name="cloud" size={28} />
          <h3>No se pudieron cargar los lugares</h3>
          <p>{error}</p>
          <button className="btn ghost" onClick={load}><Icon name="refresh" /> Reintentar</button>
        </div>
      )}

      {editing && (
        <div className="map-banner glass" role="status">
          <Icon name={moving ? 'move' : 'pin'} size={16} />
          <span>
            {moving
              ? <>Arrastra el pin de <b>{editingName}</b> y suéltalo en su sitio.</>
              : <>Haz clic en el mapa para ubicar <b>{editingName}</b>.</>}
          </span>
          <button className="btn ghost sm" onClick={() => { setMoving(null); setPlacing(null) }}>Cancelar</button>
        </div>
      )}

      <div className={`map-wrap glass ${placing ? 'is-placing' : ''}`}>
        <div ref={boxRef} className="map-box" style={{ minHeight: 320 }} role="region" aria-label="Mapa de lugares" />
        {!data && <div className="map-loading" role="status"><span className="spinner" /> Cargando lugares…</div>}
      </div>

      {data && !error && places.length === 0 && (
        <div className="empty-state">
          <Icon name="map" size={32} />
          <h3>Todavía no hay lugares</h3>
          <p>Crea lugares en Fotos o Videos y aparecerán aquí como corazones.</p>
          <div className="row gap center">
            <button className="btn ghost" onClick={() => navigate('/fotos')}><Icon name="image" /> Ir a Fotos</button>
            <button className="btn ghost" onClick={() => navigate('/videos')}><Icon name="film" /> Ir a Videos</button>
          </div>
        </div>
      )}

      {unlocated.length > 0 && (
        <div className="map-unlocated glass">
          <h3><Icon name="pin" size={16} /> Sin ubicar</h3>
          <p className="hint">No encontramos estos lugares por su nombre. Ubícalos tú con un clic en el mapa.</p>
          <ul>
            {unlocated.map((p) => (
              <li key={p.key}>
                <span>{p.name}</span>
                {pending(p)
                  ? <span className="mono muted">buscando…</span>
                  : (
                    <button className="btn ghost sm" onClick={() => startPlacing(p)} aria-pressed={placing === p.key}>
                      <Icon name="pin" size={14} /> Ubicar manualmente
                    </button>
                  )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
