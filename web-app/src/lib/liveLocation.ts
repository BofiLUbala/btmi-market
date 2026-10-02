import type { CourierLocation, LocationFreshness } from '@/api/types'

/**
 * Live courier map rules, shared by the buyer's tracking page and the
 * Commerce Admin delivery drawer. The map shows the latest real point only:
 * no interpolation, no animation between points.
 */

/** Fallback refetch while the SSE stream may be down (page visible only). */
export const LOCATION_POLL_MS = 10_000

export const LIVE_WITHIN_S = 30
export const RECENT_WITHIN_S = 120

/**
 * Delivery statuses during which the courier shares their position: from the
 * moment they accept the mission (on the way to the shop) until they arrive.
 * Same list as the server (models.LiveTrackingStatuses).
 */
export const LIVE_TRACKING_STATUSES = ['COURIER_ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT']

/** Before pickup the courier is heading to the shop, not yet to the buyer. */
export const isHeadingToShop = (status?: string | null) => status === 'COURIER_ACCEPTED' || status === 'READY_FOR_PICKUP'

/** The map is shown from the courier's acceptance until arrival. */
export function shouldShowLiveMap(t: { delivery_status?: string | null; live_tracking_active?: boolean } | null | undefined): boolean {
  if (!t) return false
  if (typeof t.live_tracking_active === 'boolean') return t.live_tracking_active
  return LIVE_TRACKING_STATUSES.includes(t.delivery_status || '')
}

/**
 * Age of the point now, in seconds: the server's age when it answered plus the
 * time since. Using the server's measure keeps a wrong phone or PC clock out.
 */
export function currentAgeSeconds(loc: Pick<CourierLocation, 'age_seconds'> | null | undefined, fetchedAtMs: number, nowMs: number): number | null {
  if (!loc || loc.age_seconds == null) return null
  return Math.max(0, loc.age_seconds + Math.floor((nowMs - fetchedAtMs) / 1000))
}

export function freshnessFor(ageSeconds: number | null): LocationFreshness {
  if (ageSeconds == null) return 'UNAVAILABLE'
  if (ageSeconds < LIVE_WITHIN_S) return 'LIVE'
  if (ageSeconds <= RECENT_WITHIN_S) return 'RECENT'
  return 'STALE'
}

export type Translate = (key: 'liveMap.live' | 'liveMap.lastSeen' | 'liveMap.unavailable', vars?: Record<string, string | number>) => string

/**
 *   < 30 s     "En direct"
 *   30 s–2 min "Dernière position reçue il y a X s"
 *   > 2 min    "Position temporairement indisponible" (also: no point yet)
 */
export function freshnessText(ageSeconds: number | null, t: Translate): string {
  const freshness = freshnessFor(ageSeconds)
  if (freshness === 'LIVE') return t('liveMap.live')
  if (freshness === 'RECENT') return t('liveMap.lastSeen', { count: ageSeconds ?? 0 })
  return t('liveMap.unavailable')
}

/** A destination point is drawn only when the buyer actually shared one. */
export function destinationPoint(loc: Pick<CourierLocation, 'delivery_latitude' | 'delivery_longitude'> | null | undefined): [number, number] | null {
  const lat = loc?.delivery_latitude
  const lng = loc?.delivery_longitude
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return [lng, lat]
}

/** Polygon ring approximating the accuracy circle (radius in metres). */
export function accuracyRing(lng: number, lat: number, radiusM: number, steps = 48): [number, number][] {
  const ring: [number, number][] = []
  const dLat = radiusM / 111_320
  const dLng = radiusM / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 1e-6))
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return ring
}

/** "850 m" under a kilometre, "2,4 km" above (decimal comma in French). */
export function formatDistance(m: number | null | undefined, lang: string = 'fr'): string {
  if (m == null || !Number.isFinite(m)) return '—'
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  const km = (m / 1000).toFixed(m < 10_000 ? 1 : 0)
  return `${lang === 'fr' ? km.replace('.', ',') : km} km`
}

/** "12 min", "1 h 05". */
export function formatDuration(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(s)) return '—'
  const min = Math.max(1, Math.round(s / 60))
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

/** Local wall-clock time of an ISO instant, "14:05". */
export function formatClock(iso: string | null | undefined, withSeconds = false): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('fr-FR', withSeconds ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } : { hour: '2-digit', minute: '2-digit' })
}

/** Where a route point came from, as shown under the map. */
export const ROUTE_SOURCE_KEYS = {
  GPS: 'route.source.gps',
  COORDINATES: 'route.source.coordinates',
  ADDRESS: 'route.source.address',
  MAP: 'route.source.map',
  REROUTE: 'route.source.reroute',
  BUYER_GPS: 'route.source.buyerGps',
} as const

/** Parses "-4.3035" / "-4,3035"; null unless a real, non-0,0 coordinate. */
export function parseCoordinates(latText: string, lngText: string): [number, number] | null {
  const lat = Number(latText.trim().replace(',', '.'))
  const lng = Number(lngText.trim().replace(',', '.'))
  if (!latText.trim() || !lngText.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) return null
  return [lng, lat]
}
