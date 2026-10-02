import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useI18n } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'
import { ApiError, type GeocodeCandidate, type RoutePointInput } from '@/api/types'
import { courierApi } from '@/api/courier'
import { adminCommerceApi } from '@/api/admin'
import { useCourierLocation } from '@/lib/useCourierLocation'
import { ROUTE_SOURCE_KEYS, destinationPoint, formatDistance, formatDuration, parseCoordinates } from '@/lib/liveLocation'
import { MAP_STYLE, transformMapRequest } from '@/lib/mapStyle'

type Target = 'start' | 'destination'
type Method = 'gps' | 'courier' | 'buyer' | 'address' | 'coordinates' | 'map'

const KINSHASA: [number, number] = [15.3136, -4.3217]

interface Props {
  orderId: string
  /** 'courier': the assigned courier. 'admin': Commerce Admin checking or correcting. */
  as: 'courier' | 'admin'
  /** The order's written delivery address, the first thing to search for. */
  deliveryAddress?: string
  /** The shop address, the first thing to search for as a start. */
  pickupAddress?: string
  onSaved?: () => void
}


/**
 * The map service matches streets, not landmarks: "12, Avenue de la Paix —
 * Face BN" scores 0.55 (refused) where "12, Avenue de la Paix" scores 0.88.
 * The landmark after the dash is dropped from the search, never from the order.
 */
function forSearch(address?: string): string {
  return (address ?? '').split(/\s+[—–]\s+/)[0].trim()
}

/**
 * Sets the two ends of a delivery route. Each point comes from GPS, typed
 * coordinates, an address search or a pin placed on the map, is shown on the
 * map, and both must be confirmed before the road route is computed. An
 * address the map service cannot place is never guessed: the planner says so
 * and offers the pin or the coordinates instead.
 */
export default function RoutePlanner({ orderId, as, deliveryAddress, pickupAddress, onSaved }: Props) {
  const { t, lang } = useI18n()
  const tk = (key: string, vars?: Record<string, string | number>) => t(key as TranslationKey, vars)
  const { data } = useCourierLocation(orderId, as, true)
  const route = data?.route ?? null
  // Only the buyer's own checkout point, never a destination someone placed.
  const buyerPoint = data?.buyer_shared_point ? destinationPoint(data) : null
  const courierPoint: [number, number] | null = data?.location ? [data.location.longitude, data.location.latitude] : null

  const [points, setPoints] = useState<Record<Target, RoutePointInput | null>>({ start: null, destination: null })
  const [method, setMethod] = useState<Record<Target, Method | null>>({ start: null, destination: null })
  const [picking, setPicking] = useState<Target | null>(null)
  const [query, setQuery] = useState<Record<Target, string>>({ start: forSearch(pickupAddress), destination: forSearch(deliveryAddress) })
  const [candidates, setCandidates] = useState<Record<Target, GeocodeCandidate[] | null>>({ start: null, destination: null })
  const [coords, setCoords] = useState<Record<Target, { lat: string; lng: string }>>({ start: { lat: '', lng: '' }, destination: { lat: '', lng: '' } })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [done, setDone] = useState('')
  const prefilled = useRef(false)

  // Start from the stored route, or from the buyer's own point when shared.
  useEffect(() => {
    if (prefilled.current || !data) return
    prefilled.current = true
    if (route) {
      const { start, destination } = route
      setPoints({
        start: start.source === 'REROUTE' ? { ...start, source: 'GPS' } : { ...start, source: start.source },
        destination: { ...destination, source: destination.source as RoutePointInput['source'] },
      })
    } else if (buyerPoint) {
      setPoints((p) => ({ ...p, destination: { longitude: buyerPoint[0], latitude: buyerPoint[1], source: 'BUYER_GPS', label: tk('route.method.buyer') } }))
      setMethod((m) => ({ ...m, destination: 'buyer' }))
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const setPoint = (target: Target, point: RoutePointInput | null) => {
    setPoints((p) => ({ ...p, [target]: point }))
    setConfirmed(false)
    setDone('')
  }

  const choose = (target: Target, m: Method) => {
    setMethod((cur) => ({ ...cur, [target]: m }))
    setError('')
    setPicking(m === 'map' ? target : null)
    if (m === 'buyer' && buyerPoint) setPoint(target, { longitude: buyerPoint[0], latitude: buyerPoint[1], source: 'BUYER_GPS', label: tk('route.method.buyer') })
    if (m === 'courier' && courierPoint) setPoint(target, { longitude: courierPoint[0], latitude: courierPoint[1], source: 'GPS', label: tk('route.method.courier') })
    if (m === 'gps') {
      setBusy(`gps-${target}`)
      navigator.geolocation?.getCurrentPosition(
        (pos) => { setBusy(''); setPoint(target, { latitude: pos.coords.latitude, longitude: pos.coords.longitude, source: 'GPS', label: `GPS ± ${Math.round(pos.coords.accuracy)} m` }) },
        () => { setBusy(''); setError(tk('route.gpsFailed')) },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
      ) ?? (setBusy(''), setError(tk('route.gpsFailed')))
    }
  }

  const search = async (target: Target) => {
    setBusy(`search-${target}`)
    setError('')
    try {
      const found = as === 'admin' ? await adminCommerceApi.geocode(query[target]) : await courierApi.geocode(query[target])
      // Only a confident match is offered: a weak one is another street.
      setCandidates((c) => ({ ...c, [target]: found.filter((x) => x.confident) }))
    } catch (e) {
      setCandidates((c) => ({ ...c, [target]: [] }))
      setError(e instanceof ApiError ? e.message : tk('route.notFound'))
    } finally { setBusy('') }
  }

  const applyCoords = (target: Target) => {
    const p = parseCoordinates(coords[target].lat, coords[target].lng)
    if (!p) { setError(tk('route.invalidCoordinates')); return }
    setError('')
    setPoint(target, { longitude: p[0], latitude: p[1], source: 'COORDINATES', label: '' })
  }

  const compute = async () => {
    if (!points.start || !points.destination || !confirmed) return
    setBusy('compute')
    setError('')
    try {
      const body = { start: points.start, destination: points.destination, confirmed: true as const }
      const res = as === 'admin' ? await adminCommerceApi.setRoute(orderId, body) : await courierApi.setRoute(orderId, body)
      const r = res.route
      setDone(r ? tk('route.computed', { distance: formatDistance(r.route_length_m, lang), duration: formatDuration(r.remaining_s) }) : '')
      onSaved?.()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally { setBusy('') }
  }

  // --- the picking map -----------------------------------------------------
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef<Record<Target, maplibregl.Marker | null>>({ start: null, destination: null })
  const pickingRef = useRef<Target | null>(null)
  pickingRef.current = picking

  useEffect(() => {
    if (!container.current || map.current) return
    let m: maplibregl.Map
    try {
      m = new maplibregl.Map({ container: container.current, style: MAP_STYLE, transformRequest: transformMapRequest, center: KINSHASA, zoom: 12, attributionControl: { compact: true } })
    } catch { return }
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    m.on('click', (e) => {
      const target = pickingRef.current
      if (!target) return
      setPoint(target, { longitude: e.lngLat.lng, latitude: e.lngLat.lat, source: 'MAP', label: '' })
    })
    m.on('error', () => undefined)
    map.current = m
    return () => { m.remove(); map.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current
    if (!m) return
    const bounds = new maplibregl.LngLatBounds()
    ;(['start', 'destination'] as Target[]).forEach((target) => {
      const p = points[target]
      if (!p) { markers.current[target]?.remove(); markers.current[target] = null; return }
      const at: [number, number] = [p.longitude, p.latitude]
      bounds.extend(at)
      if (!markers.current[target]) {
        const mk = new maplibregl.Marker({ color: target === 'start' ? '#16a34a' : '#dc2626', draggable: true }).setLngLat(at).addTo(m)
        mk.on('dragend', () => {
          const ll = mk.getLngLat()
          setPoint(target, { longitude: ll.lng, latitude: ll.lat, source: 'MAP', label: '' })
        })
        markers.current[target] = mk
      } else markers.current[target]!.setLngLat(at)
    })
    if (!bounds.isEmpty()) {
      m.resize()
      m.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 0 })
    }
  }, [points.start?.latitude, points.start?.longitude, points.destination?.latitude, points.destination?.longitude]) // eslint-disable-line react-hooks/exhaustive-deps

  const methods = (target: Target): Method[] => target === 'start'
    ? [as === 'courier' ? 'gps' : 'courier', 'address', 'coordinates', 'map'].filter((m) => m !== 'courier' || courierPoint) as Method[]
    : [...(buyerPoint ? ['buyer' as Method] : []), 'address', 'coordinates', 'map']
  const methodLabel: Record<Method, string> = { gps: 'route.method.gps', courier: 'route.method.courier', buyer: 'route.method.buyer', address: 'route.method.address', coordinates: 'route.method.coordinates', map: 'route.method.map' }

  const pointCard = (target: Target) => {
    const p = points[target]
    const m = method[target]
    return (
      <div className="stack" data-testid={`route-${target}`} style={{ gap: 6 }}>
        <div className="bold">{target === 'start' ? '🟢' : '🔴'} {tk(target === 'start' ? 'route.start' : 'route.destination')}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {methods(target).map((x) => (
            <button key={x} type="button" className={`btn btn-sm ${m === x ? 'btn-primary' : 'btn-outline'}`} onClick={() => choose(target, x)} disabled={busy === `gps-${target}`}>
              {tk(methodLabel[x])}
            </button>
          ))}
        </div>
        {m === 'address' && (
          <div className="stack" style={{ gap: 4 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="input" style={{ flex: 1 }} value={query[target]} placeholder={tk('route.searchPlaceholder')}
                onChange={(e) => setQuery((q) => ({ ...q, [target]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') void search(target) }} />
              <button type="button" className="btn btn-outline btn-sm" onClick={() => void search(target)} disabled={!!busy}>
                {busy === `search-${target}` ? tk('route.searching') : tk('route.search')}
              </button>
            </div>
            {candidates[target] && candidates[target]!.length === 0 && (
              <div className="small" data-testid={`route-${target}-notfound`} style={{ color: '#b45309' }}>
                ⚠ {tk('route.notFound')}{' '}
                <button type="button" className="btn btn-sm btn-outline" onClick={() => choose(target, 'map')}>{tk('route.method.map')}</button>{' '}
                <button type="button" className="btn btn-sm btn-outline" onClick={() => choose(target, 'coordinates')}>{tk('route.method.coordinates')}</button>
              </div>
            )}
            {candidates[target] && candidates[target]!.length > 0 && (
              <div className="stack small" style={{ gap: 4 }}>
                <span className="muted">{tk('route.pickCandidate')}</span>
                {candidates[target]!.map((c, i) => (
                  <button key={i} type="button" className="btn btn-sm btn-outline" style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                    onClick={() => setPoint(target, { latitude: c.latitude, longitude: c.longitude, source: 'ADDRESS', label: c.label })}>
                    📍 {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {m === 'coordinates' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'end' }}>
            <label className="small">{tk('route.lat')}<input className="input" inputMode="decimal" value={coords[target].lat} placeholder="-4.3035" onChange={(e) => setCoords((c) => ({ ...c, [target]: { ...c[target], lat: e.target.value } }))} /></label>
            <label className="small">{tk('route.lng')}<input className="input" inputMode="decimal" value={coords[target].lng} placeholder="15.3065" onChange={(e) => setCoords((c) => ({ ...c, [target]: { ...c[target], lng: e.target.value } }))} /></label>
            <button type="button" className="btn btn-sm btn-outline" onClick={() => applyCoords(target)}>{tk('route.useCoordinates')}</button>
          </div>
        )}
        {m === 'map' && <div className="small muted">👆 {tk('route.tapMap')}</div>}
        <div className="small" data-testid={`route-${target}-chosen`}>
          {p ? tk('route.pointSet', { label: `${p.label || tk(ROUTE_SOURCE_KEYS[p.source])} (${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)})` }) : <span className="muted">{tk('route.notSet')}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="card stack" data-testid="route-planner" style={{ gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: '1rem' }}>🧭 {tk(as === 'admin' ? 'route.verifyTitle' : 'route.title')}</h3>
      {pointCard('start')}
      {pointCard('destination')}
      <div ref={container} style={{ width: '100%', height: 280, borderRadius: 8, overflow: 'hidden', cursor: picking ? 'crosshair' : undefined }} />
      <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={confirmed} disabled={!points.start || !points.destination} onChange={(e) => setConfirmed(e.target.checked)} />
        {tk('route.confirmCheck')}
      </label>
      {error && <div className="small" role="alert" style={{ color: '#dc2626' }}>{error}</div>}
      {done && <div className="small" data-testid="route-done" style={{ color: '#16a34a' }}>✓ {done}</div>}
      <button type="button" className="btn btn-primary" data-testid="route-compute" disabled={!points.start || !points.destination || !confirmed || !!busy} onClick={() => void compute()}>
        {busy === 'compute' ? tk('route.computing') : tk(route ? 'route.change' : 'route.compute')}
      </button>
    </div>
  )
}
