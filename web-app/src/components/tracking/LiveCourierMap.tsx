import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useT } from '@/store/i18n'
import { useCourierLocation } from '@/lib/useCourierLocation'
import { accuracyRing, currentAgeSeconds, destinationPoint, freshnessFor, freshnessText } from '@/lib/liveLocation'

/** Free vector tiles, no key: OpenFreeMap (OpenStreetMap data). */
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const KINSHASA: [number, number] = [15.3136, -4.3217]
const ACCURACY_SOURCE = 'courier-accuracy'

interface Props {
  orderId: string
  /** 'user': the buyer who owns the order. 'admin': Commerce Admin, read-only. */
  audience?: 'user' | 'admin'
  /** Shown under the map, and the only destination when no point was shared. */
  destinationAddress?: string
}

/**
 * The courier's latest real position while the parcel is IN_TRANSIT, with the
 * delivery point when the buyer shared one. Points are never interpolated or
 * animated: the marker jumps to each new real point.
 */
export default function LiveCourierMap({ orderId, audience = 'user', destinationAddress }: Props) {
  const t = useT()
  const { data, fetchedAt, failed } = useCourierLocation(orderId, audience, true)
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const courierMarker = useRef<maplibregl.Marker | null>(null)
  const destMarker = useRef<maplibregl.Marker | null>(null)
  const framed = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000)
    return () => clearInterval(id)
  }, [])

  // One map per mount.
  useEffect(() => {
    if (!container.current) return
    let m: maplibregl.Map
    try {
      m = new maplibregl.Map({
        container: container.current,
        style: MAP_STYLE,
        center: KINSHASA,
        zoom: 12,
        attributionControl: { compact: true },
      })
    } catch {
      // No WebGL: the status text below still tells the buyer where things are.
      setMapError(true)
      return
    }
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    m.on('load', () => {
      m.addSource(ACCURACY_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({ id: 'courier-accuracy-fill', type: 'fill', source: ACCURACY_SOURCE, paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.12 } })
      m.addLayer({ id: 'courier-accuracy-line', type: 'line', source: ACCURACY_SOURCE, paint: { 'line-color': '#2563eb', 'line-opacity': 0.4, 'line-width': 1 } })
      setMapReady(true)
    })
    m.on('error', () => undefined) // a missing tile must not break the page
    map.current = m
    return () => {
      m.remove()
      map.current = null
      courierMarker.current = null
      destMarker.current = null
      framed.current = false
    }
  }, [])

  const age = currentAgeSeconds(data, fetchedAt, now)
  const freshness = data?.available ? freshnessFor(age) : 'UNAVAILABLE'
  const loc = data?.available ? data.location : null
  const dest = destinationPoint(data)
  const address = data?.delivery_address || destinationAddress

  // Place the markers on each new real point.
  useEffect(() => {
    const m = map.current
    if (!m || !mapReady) return

    if (dest) {
      if (!destMarker.current) {
        destMarker.current = new maplibregl.Marker({ color: '#dc2626' })
          .setPopup(new maplibregl.Popup({ offset: 24 }).setText(t('liveMap.destination')))
          .setLngLat(dest)
          .addTo(m)
      } else destMarker.current.setLngLat(dest)
    }

    const source = m.getSource(ACCURACY_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (!loc) {
      source?.setData({ type: 'FeatureCollection', features: [] })
      if (!framed.current && dest) { m.jumpTo({ center: dest, zoom: 14 }); framed.current = true }
      return
    }
    const point: [number, number] = [loc.longitude, loc.latitude]
    if (!courierMarker.current) {
      // MapLibre owns the root element's opacity; the dot is an inner element.
      const el = document.createElement('div')
      el.setAttribute('aria-label', t('liveMap.courier'))
      const dot = document.createElement('div')
      dot.dataset.courierDot = ''
      dot.style.cssText = 'width:34px;height:34px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:18px;'
      dot.textContent = '🛵'
      el.appendChild(dot)
      courierMarker.current = new maplibregl.Marker({ element: el }).setLngLat(point).addTo(m)
    } else courierMarker.current.setLngLat(point)
    const dot = courierMarker.current.getElement().firstElementChild as HTMLElement | null
    if (dot) dot.style.opacity = freshness === 'STALE' ? '0.45' : '1'

    source?.setData(loc.accuracy
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [accuracyRing(point[0], point[1], loc.accuracy)] } }] }
      : { type: 'FeatureCollection', features: [] })

    if (!framed.current) {
      if (dest) {
        m.fitBounds(new maplibregl.LngLatBounds(point, point).extend(dest), { padding: 60, maxZoom: 16, duration: 0 })
      } else m.jumpTo({ center: point, zoom: 15 })
      framed.current = true
    } else if (!m.getBounds().contains(point)) {
      m.jumpTo({ center: point })
    }
  }, [mapReady, loc?.latitude, loc?.longitude, loc?.accuracy, dest?.[0], dest?.[1], freshness]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tracking ended (arrived, failed, cancelled...): the parent's status takes over.
  if (data && !data.live_tracking_active) return null

  const dot = freshness === 'LIVE' ? '#16a34a' : freshness === 'RECENT' ? '#d97706' : '#9ca3af'
  return (
    <div className="card" data-testid="live-courier-map" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 14px', flexWrap: 'wrap' }}>
        <strong>🛵 {t('liveMap.enRoute')}</strong>
        <span className="small" data-testid="live-map-freshness" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block' }} />
          {failed && !data ? t('liveMap.unavailable') : freshnessText(freshness === 'UNAVAILABLE' ? null : age, t)}
        </span>
      </div>
      {mapError
        ? <div className="small muted" style={{ padding: '24px 14px' }}>{t('liveMap.noMap')}</div>
        : <div ref={container} style={{ width: '100%', height: 300 }} />}
      <div className="small muted" style={{ padding: '8px 14px 12px', display: 'grid', gap: 2 }}>
        {loc?.accuracy != null && <span>{t('liveMap.accuracy', { meters: Math.round(loc.accuracy) })}</span>}
        {address && <span>📍 {address}</span>}
        {!dest && <span>{t('liveMap.noDestinationPoint')}</span>}
      </div>
    </div>
  )
}
