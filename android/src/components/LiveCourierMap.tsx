import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Camera, GeoJSONSource, Layer, Map, Marker, type CameraRef, type MapRef } from '@maplibre/maplibre-react-native'
import { buyerApi, courierApi } from '../api'
import { subscribeOrderEvents } from '../lib/orderEvents'
import { isHeadingToShop } from '../lib/liveTracking'
import { useI18n, type TranslationKey } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, spacing, type Colors } from '../theme'
import type { CourierLocation } from '../types'
import { MAP_STYLES, styleUrl, useMapStyle } from '../lib/mapStyle'
import { ROUTE_SOURCE_KEYS, formatClock, formatDistance, formatDuration } from '../lib/routeFormat'

const KINSHASA: [number, number] = [15.3136, -4.3217]
/** Fallback when the event stream is down. */
const POLL_MS = 10_000
/** Closer than this to the destination, the courier is there: no countdown. */
const ARRIVED_WITHIN_M = 30

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

type Bounds = [number, number, number, number]
const FIT_PADDING = { top: 60, bottom: 60, left: 50, right: 50 }

function boundsOf(pts: [number, number][]): Bounds | null {
  if (pts.length < 2) return null
  return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))]
}

const lineFeature = (coords: [number, number][]) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: coords } })

/**
 * The delivery map: the planned road route (blue) with arrows for the
 * direction, the path really driven (green), the start, the destination and
 * the courier's latest real point, with the distances and the arrival time.
 * 'user': the buyer's own order, from acceptance to arrival; viewing it asks for no
 * permission. 'courier': the assigned courier, with the next instruction.
 *
 * The map is framed once, then left to the viewer: drag, pinch, rotate like
 * any map app, with zoom, "recentre" and "courier" buttons and a style picker.
 * preview: a still map inside a scrolling page; tapping it calls onExpand.
 * onGesture tells a scrolling parent to stop scrolling while a finger is on the map.
 */
export function LiveCourierMap({ orderId, audience = 'user', refreshKey = 0, preview = false, onExpand, onGesture, mapHeight = 360 }: {
  orderId: string
  audience?: 'user' | 'courier'
  refreshKey?: number
  preview?: boolean
  onExpand?: () => void
  onGesture?: (active: boolean) => void
  mapHeight?: number
}) {
  const { t, lang } = useI18n()
  const tk = (key: string, vars?: Record<string, string | number>) => t(key as TranslationKey, vars)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [now, setNow] = useState(() => Date.now())

  const query = useQuery({
    queryKey: [audience === 'courier' ? 'courier' : 'buyer', 'courierLocation', orderId],
    queryFn: () => (audience === 'courier' ? courierApi.live(orderId) : buyerApi.courierLocation(orderId)),
    refetchInterval: (q) => (audience === 'user' && q.state.data && !q.state.data.live_tracking_active ? false : POLL_MS),
  })
  const { refetch } = query

  useEffect(() => { if (refreshKey) void refetch() }, [refreshKey, refetch])

  useEffect(() => subscribeOrderEvents('user', (event) => {
    if ((event.kind === 'location' || event.kind === 'order') && event.order_id === orderId) void refetch()
    if (event.kind === 'resync') void refetch()
  }), [orderId, refetch])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000)
    return () => clearInterval(id)
  }, [])

  const cameraRef = useRef<CameraRef>(null)
  const mapRef = useRef<MapRef>(null)
  const [styleId, setStyleId] = useMapStyle()

  const data = query.data
  const route = data?.route ?? null
  const live = !!data?.live_tracking_active
  const loc = data?.available ? data.location : null
  const age = data?.age_seconds != null && data.available
    ? data.age_seconds + Math.max(0, Math.floor((now - query.dataUpdatedAt) / 1000))
    : null
  const freshness = freshnessOf(age)
  const dest: [number, number] | null = data?.delivery_latitude != null && data.delivery_longitude != null
    ? [data.delivery_longitude, data.delivery_latitude] : null
  const courier: [number, number] | null = loc ? [loc.longitude, loc.latitude] : null

  if (data && !live && !(audience === 'courier' && route)) {
    return audience === 'user' ? <View style={styles.card}><Text style={styles.muted}>{t('liveMap.ended')}</Text></View> : null
  }

  // The first framing: the whole route with the courier on it; without a route,
  // courier and destination. Later updates never move the map under the finger.
  const pts: [number, number][] = [...(route?.geometry ?? []), ...(courier ? [courier] : []), ...(dest ? [dest] : [])]
  const bounds = boundsOf(pts)
  const initialView = bounds
    ? { bounds, padding: FIT_PADDING }
    : { center: courier ?? dest ?? KINSHASA, zoom: courier || dest ? 15 : 11 }
  const recentre = () => {
    if (bounds) cameraRef.current?.fitBounds(bounds, { padding: FIT_PADDING, duration: 500 })
    else cameraRef.current?.easeTo({ center: courier ?? dest ?? KINSHASA, zoom: 15, duration: 500 })
  }
  const zoomBy = async (delta: number) => {
    const z = await mapRef.current?.getZoom().catch(() => null)
    if (z != null) cameraRef.current?.zoomTo(Math.max(3, Math.min(19, z + delta)), { duration: 200 })
  }

  const statusText = freshness === 'LIVE' ? t('liveMap.live')
    : freshness === 'RECENT' ? t('liveMap.lastSeen', { count: age ?? 0 })
      : t('liveMap.unavailable')
  const dot = freshness === 'LIVE' ? colors.success : freshness === 'RECENT' ? colors.warning : colors.muted

  return (
    <View style={styles.card} testID="live-courier-map">
      <View style={styles.header}>
        <Text style={styles.title}>🛵 {live ? tk(isHeadingToShop(data?.delivery_status) ? 'liveMap.toShop' : 'liveMap.enRoute') : tk('route.title')}</Text>
        {live ? (
          <View style={styles.status}>
            <View style={[styles.dot, { backgroundColor: dot }]} />
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        ) : null}
      </View>
      {route ? (
        <View style={styles.stats}>
          {([
            ['liveMap.total', formatDistance(route.total_m, lang)],
            ['liveMap.travelled', formatDistance(route.travelled_m, lang)],
            ['liveMap.remaining', formatDistance(route.remaining_m, lang)],
            ['liveMap.eta', live && route.remaining_m < ARRIVED_WITHIN_M ? tk('liveMap.atDestination') : live && route.eta ? `${formatClock(route.eta)} · ${tk('liveMap.etaIn', { duration: formatDuration(route.remaining_s) })}` : formatDuration(route.remaining_s)],
          ] as const).map(([label, value]) => (
            <View key={label} style={styles.stat}>
              <Text style={styles.statLabel}>{tk(label)}</Text>
              <Text style={styles.statValue}>{value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {audience === 'courier' && live && route?.next_instruction ? (
        <View style={styles.next}>
          <Text style={styles.nextText}>➜ {route.next_instruction.message}</Text>
          <Text style={styles.nextIn}>{tk('liveMap.nextStepIn', { distance: formatDistance(route.next_instruction.in_m, lang) })}</Text>
        </View>
      ) : null}
      <View
        style={{ height: mapHeight, overflow: 'hidden' }}
        onTouchStart={() => onGesture?.(true)}
        onTouchEnd={() => onGesture?.(false)}
        onTouchCancel={() => onGesture?.(false)}
      >
      {data ? (
      <Map
        ref={mapRef}
        style={styles.map}
        mapStyle={styleUrl(styleId)}
        logo={false}
        attribution
        attributionPosition={{ bottom: 8, right: 8 }}
        dragPan={!preview}
        touchZoom={!preview}
        doubleTapZoom={!preview}
        doubleTapHoldZoom={!preview}
        touchRotate={!preview}
        touchPitch={!preview}
      >
        <Camera ref={cameraRef} initialViewState={initialView} maxZoom={19} />
        {route && (route.geometry?.length ?? 0) > 1 ? (
          <GeoJSONSource id="delivery-route" data={lineFeature(route.geometry)}>
            <Layer id="route-casing" type="line" layout={{ 'line-join': 'round', 'line-cap': 'round' }} paint={{ 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.9 }} />
            <Layer id="route-line" type="line" layout={{ 'line-join': 'round', 'line-cap': 'round' }} paint={{ 'line-color': '#2563eb', 'line-width': 6 }} />
          </GeoJSONSource>
        ) : null}
        {route && (route.trail?.length ?? 0) > 1 ? (
          <GeoJSONSource id="delivery-trail" data={lineFeature(route.trail ?? [])}>
            <Layer id="trail-line" type="line" layout={{ 'line-join': 'round', 'line-cap': 'round' }} paint={{ 'line-color': '#16a34a', 'line-width': 5, 'line-opacity': 0.9 }} />
          </GeoJSONSource>
        ) : null}
        {courier && loc?.accuracy ? (
          <GeoJSONSource id="courier-accuracy" data={{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [accuracyRing(courier[0], courier[1], loc.accuracy)] } }}>
            <Layer id="courier-accuracy-fill" type="fill" paint={{ 'fill-color': '#2563eb', 'fill-opacity': 0.12 }} />
          </GeoJSONSource>
        ) : null}
        {(route?.arrows ?? []).map((a, i) => (
          <Marker key={`arrow-${route!.computed_at}-${i}`} id={`arrow-${i}`} lngLat={[a.longitude, a.latitude]}>
            <Text style={[styles.arrow, { transform: [{ rotate: `${a.bearing}deg` }] }]}>▲</Text>
          </Marker>
        ))}
        {route ? (
          <Marker id="start" lngLat={[route.start.longitude, route.start.latitude]}>
            <View style={styles.start} />
          </Marker>
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
      ) : null}
      {preview ? (
        <Pressable accessibilityRole="button" accessibilityLabel={tk('liveMap.tapToExpand')} style={styles.previewOverlay} onPress={onExpand}>
          <View style={styles.previewBadge}><Text style={styles.previewText}>⤢ {tk('liveMap.tapToExpand')}</Text></View>
        </Pressable>
      ) : (
        <>
          {MAP_STYLES.length > 1 ? (
            <View style={styles.styleBar}>
              {MAP_STYLES.map((s) => (
                <Pressable key={s.id} accessibilityRole="button" accessibilityState={{ selected: s.id === styleId }} onPress={() => setStyleId(s.id)} style={[styles.styleChip, s.id === styleId && styles.styleChipOn]}>
                  <Text style={[styles.styleChipText, s.id === styleId && styles.styleChipTextOn]}>{tk(s.labelKey)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.controls}>
            <Pressable accessibilityRole="button" accessibilityLabel={tk('liveMap.zoomIn')} style={styles.ctrl} onPress={() => void zoomBy(1)}><Text style={styles.ctrlText}>+</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={tk('liveMap.zoomOut')} style={styles.ctrl} onPress={() => void zoomBy(-1)}><Text style={styles.ctrlText}>−</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={tk('liveMap.recenter')} style={styles.ctrl} onPress={recentre}><Text style={styles.ctrlText}>⌖</Text></Pressable>
            {courier ? (
              <Pressable accessibilityRole="button" accessibilityLabel={tk('liveMap.showCourier')} style={styles.ctrl} onPress={() => cameraRef.current?.easeTo({ center: courier, zoom: 16, duration: 500 })}><Text style={styles.ctrlText}>🛵</Text></Pressable>
            ) : null}
          </View>
        </>
      )}
      </View>
      <View style={styles.footer}>
        {route ? <Text style={styles.muted}>{tk('liveMap.routeLegend')}</Text> : null}
        {route?.off_route && live ? <Text style={[styles.muted, { color: colors.warning }]}>⚠ {tk('liveMap.offRoute', { meters: Math.round(route.off_route_m) })}</Text> : null}
        {route && route.reroute_count > 0 ? <Text style={styles.muted}>↻ {tk('liveMap.rerouted', { count: route.reroute_count })}</Text> : null}
        {loc && freshness !== 'LIVE' ? <Text style={styles.muted}>🕒 {tk('liveMap.lastUpdate', { time: formatClock(loc.captured_at, true) })}</Text> : null}
        {loc?.accuracy != null ? <Text style={styles.muted}>{t('liveMap.accuracy', { meters: Math.round(loc.accuracy) })}</Text> : null}
        {route ? <Text style={styles.muted}>🟢 {tk('liveMap.start')} : {route.start.label || `${route.start.latitude.toFixed(5)}, ${route.start.longitude.toFixed(5)}`} ({tk(ROUTE_SOURCE_KEYS[route.start.source])})</Text> : null}
        {route
          ? <Text style={styles.muted}>📍 {route.destination.label || data?.delivery_address} ({tk(ROUTE_SOURCE_KEYS[route.destination.source])})</Text>
          : data?.delivery_address ? <Text style={styles.muted}>📍 {data.delivery_address}</Text> : null}
        {!dest ? <Text style={styles.muted}>{t('liveMap.noDestinationPoint')}</Text> : null}
        {!route && audience === 'user' ? <Text style={styles.muted}>{tk('liveMap.noRoute')}</Text> : null}
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
  stats: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderColor: c.border },
  stat: { width: '50%', paddingVertical: 8, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderColor: c.border },
  statLabel: { color: c.muted, fontSize: 12 },
  statValue: { color: c.ink, fontSize: 15, fontWeight: '800' },
  next: { backgroundColor: '#eff6ff', paddingVertical: 10, paddingHorizontal: spacing.md },
  nextText: { color: '#1e3a8a', fontWeight: '800', fontSize: 15 },
  nextIn: { color: '#1e3a8a', fontSize: 13 },
  map: { flex: 1, width: '100%' },
  previewOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 14 },
  previewBadge: { backgroundColor: 'rgba(9,18,35,0.85)', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  previewText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  styleBar: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', gap: 6 },
  styleChip: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#d1d5db' },
  styleChipOn: { backgroundColor: '#091223', borderColor: '#091223' },
  styleChipText: { color: '#111827', fontWeight: '700', fontSize: 13 },
  styleChipTextOn: { color: '#ffffff' },
  controls: { position: 'absolute', top: 10, right: 10, gap: 8 },
  ctrl: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  ctrlText: { color: '#111827', fontSize: 20, fontWeight: '800' },
  footer: { padding: spacing.md, gap: 2 },
  muted: { color: c.muted, fontSize: 13, padding: 0 },
  pin: { fontSize: 30 },
  arrow: { color: '#ffffff', fontSize: 13, fontWeight: '900', textShadowColor: '#1d4ed8', textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } },
  start: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#16a34a', borderWidth: 3, borderColor: '#ffffff' },
  courier: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2563eb', borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  stale: { opacity: 0.45 },
  courierIcon: { fontSize: 18 },
})
