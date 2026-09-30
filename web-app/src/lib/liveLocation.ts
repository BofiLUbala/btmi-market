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

/** The map is shown only while the parcel is on its way (IN_TRANSIT). */
export function shouldShowLiveMap(t: { delivery_status?: string | null; live_tracking_active?: boolean } | null | undefined): boolean {
  if (!t) return false
  return t.delivery_status === 'IN_TRANSIT' || t.live_tracking_active === true
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
