import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useI18n } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'
import type { DeliveryRoute } from '@/api/types'
import { useCourierLocation } from '@/lib/useCourierLocation'
import {
  ROUTE_SOURCE_KEYS, accuracyRing, currentAgeSeconds, destinationPoint, formatClock, formatDistance, formatDuration,
  freshnessFor, freshnessText,
} from '@/lib/liveLocation'
import { MAP_STYLE, transformMapRequest } from '@/lib/mapStyle'

const KINSHASA: [number, number] = [15.3136, -4.3217]
const ACCURACY_SOURCE = 'courier-accuracy'
const ROUTE_SOURCE = 'delivery-route'
const TRAIL_SOURCE = 'delivery-trail'
/** Closer than this to the destination, the courier is there: no countdown. */
const ARRIVED_WITHIN_M = 30
const EMPTY = { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection

interface Props {
  orderId: string
  /** 'user': the buyer who owns the order. 'admin': Commerce Admin. 'courier': the assigned courier. */
  audience?: 'user' | 'admin' | 'courier'
  /** Shown under the map, and the only destination when no point was placed. */
  destinationAddress?: string
  /** Bumped by the parent after it changed the route: refetch at once. */
  refreshKey?: number
}

const line = (coords: [number, number][]): GeoJSON.FeatureCollection =>
  coords.length < 2 ? EMPTY : { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] }

/** A small arrow pointing north; the marker rotates it to the route's bearing. */
function arrowElement(): HTMLElement {
  const el = document.createElement('div')
  el.dataset.routeArrow = ''
  el.style.cssText = 'width:16px;height:16px;pointer-events:none;'
  el.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M8 1 L14 13 L8 10 L2 13 Z" fill="#ffffff" stroke="#1d4ed8" stroke-width="1.5" stroke-linejoin="round"/></svg>'
  return el
}

/**
 * The delivery map: the planned road route (blue) with arrows for the
 * direction, the path the courier really drove (green), the start, the
 * destination and the courier's latest real point. Points are never
 * interpolated or animated: the marker jumps to each new real point.
 */
export default function LiveCourierMap({ orderId, audience = 'user', destinationAddress, refreshKey = 0 }: Props) {
  const { t, lang } = useI18n()
  const tk = (key: string, vars?: Record<string, string | number>) => t(key as TranslationKey, vars)
  const { data, fetchedAt, failed, refetch } = useCourierLocation(orderId, audience, true)
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const courierMarker = useRef<maplibregl.Marker | null>(null)
  const destMarker = useRef<maplibregl.Marker | null>(null)
  const startMarker = useRef<maplibregl.Marker | null>(null)
  const arrowMarkers = useRef<maplibregl.Marker[]>([])
  const arrowsFor = useRef('')
  const framed = useRef(false)
  const destFramed = useRef(false)
  const routeFramed = useRef('')
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { if (refreshKey) void refetch() }, [refreshKey, refetch])

  const route: DeliveryRoute | null = data?.route ?? null
  // The buyer follows the parcel while it travels; the courier and Commerce
  // Admin also see a planned route before departure.
  const visible = !!data && (data.live_tracking_active || (audience !== 'user' && !!route))

  // One map per mount, once there is something to show.
  useEffect(() => {
    if (!visible || !container.current || map.current) return
    let m: maplibregl.Map
    try {
      m = new maplibregl.Map({
        container: container.current,
        style: MAP_STYLE,
        transformRequest: transformMapRequest,
        center: KINSHASA,
        zoom: 12,
        attributionControl: { compact: true },
      })
    } catch {
      // No WebGL: the figures below still tell everyone where things are.
      setMapError(true)
      return
    }
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    m.on('load', () => {
      m.addSource(ACCURACY_SOURCE, { type: 'geojson', data: EMPTY })
      m.addLayer({ id: 'courier-accuracy-fill', type: 'fill', source: ACCURACY_SOURCE, paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.12 } })
      m.addLayer({ id: 'courier-accuracy-line', type: 'line', source: ACCURACY_SOURCE, paint: { 'line-color': '#2563eb', 'line-opacity': 0.4, 'line-width': 1 } })
      m.addSource(ROUTE_SOURCE, { type: 'geojson', data: EMPTY })
      m.addLayer({ id: 'route-casing', type: 'line', source: ROUTE_SOURCE, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.9 } })
      m.addLayer({ id: 'route-line', type: 'line', source: ROUTE_SOURCE, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#2563eb', 'line-width': 6 } })
      m.addSource(TRAIL_SOURCE, { type: 'geojson', data: EMPTY })
      m.addLayer({ id: 'trail-line', type: 'line', source: TRAIL_SOURCE, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#16a34a', 'line-width': 5, 'line-opacity': 0.9 } })
      setMapReady(true)
    })
    m.on('error', () => undefined) // a missing tile must not break the page
    map.current = m
  }, [visible])

  useEffect(() => () => {
    map.current?.remove()
    map.current = null
  }, [])

  const age = currentAgeSeconds(data, fetchedAt, now)
  const freshness = data?.available ? freshnessFor(age) : 'UNAVAILABLE'
  const loc = data?.available ? data.location : null
  const dest = destinationPoint(data)
  const address = data?.delivery_address || destinationAddress

  // Route, trail and arrows: redrawn whenever the server recomputed them.
  useEffect(() => {
    const m = map.current
    if (!m || !mapReady) return
    ;(m.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(line(route?.geometry ?? []))
    ;(m.getSource(TRAIL_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(line(route?.trail ?? []))

    const key = route ? `${route.computed_at}:${route.reroute_count}` : ''
    if (key !== arrowsFor.current) {
      arrowMarkers.current.forEach((a) => a.remove())
      arrowMarkers.current = (route?.arrows ?? []).map((a) =>
        new maplibregl.Marker({ element: arrowElement(), rotation: a.bearing, rotationAlignment: 'map', pitchAlignment: 'map' })
          .setLngLat([a.longitude, a.latitude]).addTo(m))
      arrowsFor.current = key
    }

    if (route) {
      const start: [number, number] = [route.start.longitude, route.start.latitude]
      if (!startMarker.current) {
        startMarker.current = new maplibregl.Marker({ color: '#16a34a' })
          .setPopup(new maplibregl.Popup({ offset: 24 }).setText(tk('liveMap.start')))
          .setLngLat(start).addTo(m)
      } else startMarker.current.setLngLat(start)
    } else {
      startMarker.current?.remove()
      startMarker.current = null
    }

    // Frame the whole route once per planned route, with the courier on it.
    if (route && (route.geometry?.length ?? 0) > 1 && routeFramed.current !== key) {
      const bounds = new maplibregl.LngLatBounds(route.geometry[0], route.geometry[0])
      route.geometry.forEach((p) => bounds.extend(p))
      if (loc) bounds.extend([loc.longitude, loc.latitude])
      if (dest) bounds.extend(dest)
      m.resize()
      m.fitBounds(bounds, { padding: 50, maxZoom: 16, duration: 0 })
      routeFramed.current = key
      framed.current = true
    }
  }, [mapReady, route?.computed_at, route?.reroute_count, route?.trail?.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Place the markers on each new real point.
  useEffect(() => {
    const m = map.current
    if (!m || !mapReady) return

    if (dest) {
      if (!destMarker.current) {
        destMarker.current = new maplibregl.Marker({ color: '#dc2626' })
          .setPopup(new maplibregl.Popup({ offset: 24 }).setText(tk('liveMap.destination')))
          .setLngLat(dest)
          .addTo(m)
      } else destMarker.current.setLngLat(dest)
    }

    const source = m.getSource(ACCURACY_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (!loc) {
      source?.setData(EMPTY)
      courierMarker.current?.remove()
      courierMarker.current = null
      // Destination only for now: the first courier point still reframes on both.
      if (!framed.current && !destFramed.current && dest) { m.resize(); m.jumpTo({ center: dest, zoom: 14 }); destFramed.current = true }
      return
    }
    const point: [number, number] = [loc.longitude, loc.latitude]
    if (!courierMarker.current) {
      // MapLibre owns the root element's opacity; the dot is an inner element.
      const el = document.createElement('div')
      el.setAttribute('aria-label', tk('liveMap.courier'))
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
      : EMPTY)

    if (!framed.current) {
      // The container may have been sized while a drawer was still opening.
      m.resize()
      if (dest) {
        m.fitBounds(new maplibregl.LngLatBounds(point, point).extend(dest), { padding: 60, maxZoom: 16, duration: 0 })
      } else m.jumpTo({ center: point, zoom: 15 })
      framed.current = true
    } else if (!m.getBounds().contains(point)) {
      m.jumpTo({ center: point })
    }
  }, [mapReady, loc?.latitude, loc?.longitude, loc?.accuracy, dest?.[0], dest?.[1], freshness]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null

  const live = !!data?.live_tracking_active
  const dotColour = freshness === 'LIVE' ? '#16a34a' : freshness === 'RECENT' ? '#d97706' : '#9ca3af'
  const showInstructions = audience !== 'user'
  return (
    <div className="card" data-testid="live-courier-map" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 14px', flexWrap: 'wrap' }}>
        <strong>🛵 {live ? tk('liveMap.enRoute') : tk('route.title')}</strong>
        {live && (
          <span className="small" data-testid="live-map-freshness" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColour, display: 'inline-block' }} />
            {failed && !data ? tk('liveMap.unavailable') : freshnessText(freshness === 'UNAVAILABLE' ? null : age, t)}
          </span>
        )}
      </div>

      {route && (
        <div data-testid="route-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 1, background: 'var(--color-border, #e5e7eb)', borderTop: '1px solid var(--color-border, #e5e7eb)' }}>
          {[
            ['liveMap.total', formatDistance(route.total_m, lang)],
            ['liveMap.travelled', formatDistance(route.travelled_m, lang)],
            ['liveMap.remaining', formatDistance(route.remaining_m, lang)],
            ['liveMap.eta', live && route.remaining_m < ARRIVED_WITHIN_M ? tk('liveMap.atDestination') : live && route.eta ? `${formatClock(route.eta)} · ${tk('liveMap.etaIn', { duration: formatDuration(route.remaining_s) })}` : formatDuration(route.remaining_s)],
          ].map(([label, value]) => (
            <div key={label} style={{ background: 'var(--color-surface, #fff)', padding: '8px 12px' }}>
              <div className="small muted">{tk(label)}</div>
              <div className="bold" data-testid={`route-${label.split('.')[1]}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {showInstructions && route?.next_instruction && live && (
        <div data-testid="route-next-step" style={{ padding: '8px 14px', background: 'var(--color-accent-soft, #eff6ff)', fontWeight: 600 }}>
          ➜ {tk('liveMap.nextStep')} : {route.next_instruction.message} · {tk('liveMap.nextStepIn', { distance: formatDistance(route.next_instruction.in_m, lang) })}
        </div>
      )}

      {mapError
        ? <div className="small muted" style={{ padding: '24px 14px' }}>{tk('liveMap.noMap')}</div>
        : <div ref={container} style={{ width: '100%', height: 340 }} />}

      <div className="small muted" style={{ padding: '8px 14px 12px', display: 'grid', gap: 2 }}>
        {route && <span>{tk('liveMap.routeLegend')}</span>}
        {route?.off_route && live && <span style={{ color: '#b45309' }}>⚠ {tk('liveMap.offRoute', { meters: Math.round(route.off_route_m) })}</span>}
        {route && route.reroute_count > 0 && <span data-testid="route-rerouted">↻ {tk('liveMap.rerouted', { count: route.reroute_count })}</span>}
        {loc && freshness !== 'LIVE' && <span>🕒 {tk('liveMap.lastUpdate', { time: formatClock(loc.captured_at, true) })}</span>}
        {loc?.accuracy != null && <span>{tk('liveMap.accuracy', { meters: Math.round(loc.accuracy) })}</span>}
        {route && <span>🟢 {tk('liveMap.start')} : {route.start.label || `${route.start.latitude.toFixed(5)}, ${route.start.longitude.toFixed(5)}`} ({tk(ROUTE_SOURCE_KEYS[route.start.source])})</span>}
        {route
          ? <span>📍 {route.destination.label || address} ({tk(ROUTE_SOURCE_KEYS[route.destination.source])})</span>
          : address && <span>📍 {address}</span>}
        {!dest && <span>{tk('liveMap.noDestinationPoint')}</span>}
        {!route && audience === 'user' && <span>{tk('liveMap.noRoute')}</span>}
      </div>

      {showInstructions && route?.instructions && route.instructions.length > 0 && (
        <details style={{ padding: '0 14px 12px' }}>
          <summary className="small bold">{tk('route.instructions')} ({route.instructions.length})</summary>
          <ol className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {route.instructions.map((s, i) => <li key={i}>{s.message} <span className="muted">· {formatDistance(s.offset_m, lang)}</span></li>)}
          </ol>
        </details>
      )}
    </div>
  )
}
