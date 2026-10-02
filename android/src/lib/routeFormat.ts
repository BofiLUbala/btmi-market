/** Route figures, same rules as the web map. */

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

/** Local wall-clock time of an ISO instant, "14:05" (or "14:05:09"). */
export function formatClock(iso: string | null | undefined, withSeconds = false): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}${withSeconds ? `:${pad(d.getSeconds())}` : ''}`
}

/** Parses "-4.3035" / "-4,3035"; null unless a real, non-0,0 coordinate. Returns [lng, lat]. */
export function parseCoordinates(latText: string, lngText: string): [number, number] | null {
  const lat = Number(latText.trim().replace(',', '.'))
  const lng = Number(lngText.trim().replace(',', '.'))
  if (!latText.trim() || !lngText.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) return null
  return [lng, lat]
}

export const ROUTE_SOURCE_KEYS = {
  GPS: 'route.source.gps',
  COORDINATES: 'route.source.coordinates',
  ADDRESS: 'route.source.address',
  MAP: 'route.source.map',
  REROUTE: 'route.source.reroute',
  BUYER_GPS: 'route.source.buyerGps',
} as const
