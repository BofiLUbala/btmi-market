import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native'
import { buyerApi } from '../api'
import { subscribeOrderEvents } from '../lib/orderEvents'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, spacing, type Colors } from '../theme'
import type { CourierLocation } from '../types'

/** Free vector tiles, no key: OpenFreeMap (OpenStreetMap data). */
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const KINSHASA: [number, number] = [15.3136, -4.3217]
/** Fallback when the event stream is down. */
const POLL_MS = 10_000

export function freshnessOf(age: number | null): CourierLocation['freshness'] {
  if (age == null) return 'UNAVAILABLE'
  if (age < 30) return 'LIVE'
  if (age <= 120) return 'RECENT'
  return 'STALE'
}

function accuracyRing(lng: number, lat: number, radiusM: number, steps = 48): [number, number][] {
  const dLat = radiusM / 111_320
  const dLng = radiusM / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 1e-6))
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * 2 * Math.PI
    return [lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)] as [number, number]
  })
}

/**
 * The courier's latest real position for the buyer's own order, while it is
 * IN_TRANSIT. A `location` event refetches the position only; points are
 * never interpolated. Viewing it needs no location permission from the buyer.
 */
export function LiveCourierMap({ orderId }: { orderId: string }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [now, setNow] = useState(() => Date.now())

  const query = useQuery({
    queryKey: ['buyer', 'courierLocation', orderId],
    queryFn: () => buyerApi.courierLocation(orderId),
    refetchInterval: (q) => (q.state.data && !q.state.data.live_tracking_active ? false : POLL_MS),
  })
  const { refetch } = query

  useEffect(() => subscribeOrderEvents('user', (event) => {
    if ((event.kind === 'location' || event.kind === 'order') && event.order_id === orderId) void refetch()
    if (event.kind === 'resync') void refetch()
  }), [orderId, refetch])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000)
    return () => clearInterval(id)
  }, [])

  const data = query.data
  const loc = data?.available ? data.location : null
  const age = data?.age_seconds != null && data.available
    ? data.age_seconds + Math.max(0, Math.floor((now - query.dataUpdatedAt) / 1000))
    : null
  const freshness = freshnessOf(age)
  const dest: [number, number] | null = data?.delivery_latitude != null && data.delivery_longitude != null
    ? [data.delivery_longitude, data.delivery_latitude] : null
  const courier: [number, number] | null = loc ? [loc.longitude, loc.latitude] : null

  if (data && !data.live_tracking_active) {
    return <View style={styles.card}><Text style={styles.muted}>{t('liveMap.ended')}</Text></View>
  }

  const camera = courier && dest
    ? { bounds: [Math.min(courier[0], dest[0]), Math.min(courier[1], dest[1]), Math.max(courier[0], dest[0]), Math.max(courier[1], dest[1])] as [number, number, number, number], padding: { top: 60, bottom: 60, left: 60, right: 60 }, maxZoom: 16 }
    : { center: courier ?? dest ?? KINSHASA, zoom: courier || dest ? 15 : 11 }

  const statusText = freshness === 'LIVE' ? t('liveMap.live')
    : freshness === 'RECENT' ? t('liveMap.lastSeen', { count: age ?? 0 })
      : t('liveMap.unavailable')
  const dot = freshness === 'LIVE' ? colors.success : freshness === 'RECENT' ? colors.warning : colors.muted

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🛵 {t('liveMap.enRoute')}</Text>
        <View style={styles.status}>
          <View style={[styles.dot, { backgroundColor: dot }]} />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      </View>
      <Map style={styles.map} mapStyle={MAP_STYLE} logo={false} attribution attributionPosition={{ bottom: 8, right: 8 }}>
        <Camera {...camera} duration={0} />
        {courier && loc?.accuracy ? (
          <GeoJSONSource id="courier-accuracy" data={{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [accuracyRing(courier[0], courier[1], loc.accuracy)] } }}>
            <Layer id="courier-accuracy-fill" type="fill" paint={{ 'fill-color': '#2563eb', 'fill-opacity': 0.12 }} />
          </GeoJSONSource>
        ) : null}
        {dest ? (
          <Marker id="destination" lngLat={dest} anchor="bottom">
            <Text style={styles.pin}>📍</Text>
          </Marker>
        ) : null}
        {courier ? (
          <Marker id="courier" lngLat={courier}>
            <View style={[styles.courier, freshness === 'STALE' && styles.stale]}><Text style={styles.courierIcon}>🛵</Text></View>
          </Marker>
        ) : null}
      </Map>
      <View style={styles.footer}>
        {loc?.accuracy != null ? <Text style={styles.muted}>{t('liveMap.accuracy', { meters: Math.round(loc.accuracy) })}</Text> : null}
        {data?.delivery_address ? <Text style={styles.muted}>📍 {data.delivery_address}</Text> : null}
        {!dest ? <Text style={styles.muted}>{t('liveMap.noDestinationPoint')}</Text> : null}
      </View>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  card: { backgroundColor: c.white, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, padding: spacing.md, flexWrap: 'wrap' },
  title: { color: c.ink, fontWeight: '800', fontSize: 16 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: c.ink, fontSize: 13 },
  map: { height: 360, width: '100%' },
  footer: { padding: spacing.md, gap: 2 },
  muted: { color: c.muted, fontSize: 13, padding: 0 },
  pin: { fontSize: 30 },
  courier: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2563eb', borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  stale: { opacity: 0.45 },
  courierIcon: { fontSize: 18 },
})
