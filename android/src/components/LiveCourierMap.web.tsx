import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { buyerApi, courierApi } from '../api'
import { subscribeOrderEvents } from '../lib/orderEvents'
import { isHeadingToShop } from '../lib/liveTracking'
import { useI18n, type TranslationKey } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, spacing, type Colors } from '../theme'
import type { CourierLocation } from '../types'
import { MAP_STYLES, styleUrl, transformMapRequest, useMapStyle } from '../lib/mapStyle'
import { ROUTE_SOURCE_KEYS, formatClock, formatDistance, formatDuration } from '../lib/routeFormat'
import { useDevicePosition } from '../lib/useDevicePosition'

/**
 * The delivery map in a browser: the website is the same app, and the phone's
 * native MapLibre does not exist there. Same data, same rules as the native
 * map (LiveCourierMap.tsx): the planned route, the path really driven, the
 * start, the destination and the courier's latest real point, refreshed by the
 * order event stream with a poll as fallback. Points are never interpolated.
 *
 * The map follows the courier like a navigation app; a drag by hand pauses it
 * until "recentre" is pressed.
 */

const KINSHASA: [number, number] = [15.3136, -4.3217]
const POLL_MS = 10_000
const ARRIVED_WITHIN_M = 30
const EMPTY = { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection

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

const line = (coords: [number, number][]): GeoJSON.FeatureCollection =>
  coords.length < 2 ? EMPTY : { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] }

function arrowElement(): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = 'width:16px;height:16px;pointer-events:none;'
  el.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M8 1 L14 13 L8 10 L2 13 Z" fill="#ffffff" stroke="#1d4ed8" stroke-width="1.5" stroke-linejoin="round"/></svg>'
  return el
}

function dotElement(label: string, emoji: string, bg: string): HTMLElement {
  // MapLibre owns the root element's opacity: the dot is an inner element.
  const el = document.createElement('div')
  el.setAttribute('aria-label', label)
  const dot = document.createElement('div')
  dot.style.cssText = `width:34px;height:34px;border-radius:50%;background:${bg};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:18px;`
  dot.textContent = emoji
  el.appendChild(dot)
  return el
}

/** Route, trail and accuracy layers; added again after every style change. */
function addDeliveryLayers(m: maplibregl.Map) {
  if (m.getSource('courier-accuracy')) return
  m.addSource('courier-accuracy', { type: 'geojson', data: EMPTY })
  m.addLayer({ id: 'courier-accuracy-fill', type: 'fill', source: 'courier-accuracy', paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.12 } })
  m.addLayer({ id: 'courier-accuracy-line', type: 'line', source: 'courier-accuracy', paint: { 'line-color': '#2563eb', 'line-opacity': 0.4, 'line-width': 1 } })
  m.addSource('delivery-route', { type: 'geojson', data: EMPTY })
  m.addLayer({ id: 'route-casing', type: 'line', source: 'delivery-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.9 } })
  m.addLayer({ id: 'route-line', type: 'line', source: 'delivery-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#2563eb', 'line-width': 6 } })
  m.addSource('delivery-trail', { type: 'geojson', data: EMPTY })
  m.addLayer({ id: 'trail-line', type: 'line', source: 'delivery-trail', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#16a34a', 'line-width': 5, 'line-opacity': 0.9 } })
}

export function LiveCourierMap({ orderId, audience = 'user', refreshKey = 0, preview = false, onExpand, mapHeight = 360 }: {
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

  const [styleId, setStyleId] = useMapStyle()
  const { position: me } = useDevicePosition()

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
  const mine: [number, number] | null = me ? [me.longitude, me.latitude] : null
  const idle = !!data && !live && !(audience === 'courier' && route)

  const container = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const courierMarker = useRef<maplibregl.Marker | null>(null)
  const meMarker = useRef<maplibregl.Marker | null>(null)
  const destMarker = useRef<maplibregl.Marker | null>(null)
  const startMarker = useRef<maplibregl.Marker | null>(null)
  const arrowMarkers = useRef<maplibregl.Marker[]>([])
  const arrowsFor = useRef('')
  const routeFramed = useRef('')
  const framed = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [following, setFollowing] = useState(!preview)

  // One map per mount.
  useEffect(() => {
    if (!container.current || mapRef.current) return
    let m: maplibregl.Map
    try {
      m = new maplibregl.Map({
        container: container.current,
        style: styleUrl(styleId),
        transformRequest: transformMapRequest,
        center: KINSHASA,
        zoom: 12,
        attributionControl: { compact: true },
        interactive: !preview,
      })
    } catch (error) {
      // No WebGL: the figures under the map still say where things are.
      console.warn('[LiveCourierMap] map could not start', error)
      setMapError(true)
      return
    }
    if (!preview) m.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right')
    m.on('load', () => { addDeliveryLayers(m); setMapReady(true) })
    // A hand drag pauses the follow mode; "recentre" resumes it.
    m.on('dragstart', () => setFollowing(false))
    m.on('error', () => undefined) // a missing tile must not break the page
    mapRef.current = m
    return () => { m.remove(); mapRef.current = null; setMapReady(false) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The viewer picked another style: swap it and draw the layers again on top.
  const lastStyle = useRef(styleId)
  useEffect(() => {
    const m = mapRef.current
    if (!m || lastStyle.current === styleId) return
    lastStyle.current = styleId
    setMapReady(false)
    m.setStyle(styleUrl(styleId))
    m.once('style.load', () => { addDeliveryLayers(m); setMapReady(true) })
  }, [styleId])

  // Route, trail and arrows: redrawn whenever the server recomputed them.
  useEffect(() => {
    const m = mapRef.current
    if (!m || !mapReady) return
    ;(m.getSource('delivery-route') as maplibregl.GeoJSONSource | undefined)?.setData(line(route?.geometry ?? []))
    ;(m.getSource('delivery-trail') as maplibregl.GeoJSONSource | undefined)?.setData(line(route?.trail ?? []))

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
      if (!startMarker.current) startMarker.current = new maplibregl.Marker({ color: '#16a34a' }).setLngLat(start).addTo(m)
      else startMarker.current.setLngLat(start)
    } else {
      startMarker.current?.remove()
      startMarker.current = null
    }
    // Frame the whole route once per planned route.
    if (route && (route.geometry?.length ?? 0) > 1 && routeFramed.current !== key) {
      const bounds = new maplibregl.LngLatBounds(route.geometry[0], route.geometry[0])
      route.geometry.forEach((p) => bounds.extend(p))
      if (courier) bounds.extend(courier)
      if (dest) bounds.extend(dest)
      m.resize()
      m.fitBounds(bounds, { padding: 50, maxZoom: 16, duration: 0 })
      routeFramed.current = key
      framed.current = true
    }
  }, [mapReady, route?.computed_at, route?.reroute_count, route?.trail?.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Markers on each new real point; the camera follows the courier.
  useEffect(() => {
    const m = mapRef.current
    if (!m || !mapReady) return

    if (dest) {
      if (!destMarker.current) destMarker.current = new maplibregl.Marker({ color: '#dc2626' }).setLngLat(dest).addTo(m)
      else destMarker.current.setLngLat(dest)
    }
    if (mine) {
      if (!meMarker.current) {
        const el = document.createElement('div')
        el.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 2px rgba(37,99,235,.35);'
        meMarker.current = new maplibregl.Marker({ element: el }).setLngLat(mine).addTo(m)
      } else meMarker.current.setLngLat(mine)
    }

    const accuracy = m.getSource('courier-accuracy') as maplibregl.GeoJSONSource | undefined
    if (!courier) {
      accuracy?.setData(EMPTY)
      courierMarker.current?.remove()
      courierMarker.current = null
      if (!framed.current && (dest || mine)) { m.resize(); m.jumpTo({ center: dest ?? mine ?? KINSHASA, zoom: 14 }); framed.current = true }
      return
    }
    if (!courierMarker.current) courierMarker.current = new maplibregl.Marker({ element: dotElement(tk('liveMap.courier'), '🛵', '#2563eb') }).setLngLat(courier).addTo(m)
    else courierMarker.current.setLngLat(courier)
    const dot = courierMarker.current.getElement().firstElementChild as HTMLElement | null
    if (dot) dot.style.opacity = freshness === 'STALE' ? '0.45' : '1'
    accuracy?.setData(loc?.accuracy
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [accuracyRing(courier[0], courier[1], loc.accuracy)] } }] }
      : EMPTY)

    if (!framed.current) {
      m.resize()
      if (dest) m.fitBounds(new maplibregl.LngLatBounds(courier, courier).extend(dest), { padding: 60, maxZoom: 16, duration: 0 })
      else m.jumpTo({ center: courier, zoom: 15 })
      framed.current = true
    } else if (following && live) {
      // Navigation style: keep the courier in view, turned the way they head.
      const heading = loc?.heading != null && (loc.speed ?? 0) > 1 ? loc.heading : undefined
      m.easeTo({ center: courier, ...(heading != null ? { bearing: heading } : {}), duration: 800 })
    } else if (!m.getBounds().contains(courier)) {
      m.jumpTo({ center: courier })
    }
  }, [mapReady, courier?.[0], courier?.[1], loc?.accuracy, dest?.[0], dest?.[1], mine?.[0], mine?.[1], freshness, following, live]) // eslint-disable-line react-hooks/exhaustive-deps

  const recentre = () => {
    setFollowing(true)
    const m = mapRef.current
    if (!m) return
    if (courier) m.easeTo({ center: courier, zoom: 16, duration: 500 })
    else if (mine) m.easeTo({ center: mine, zoom: 16, duration: 500 })
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
      <View style={{ height: mapHeight, overflow: 'hidden' }}>
        {mapError
          ? <Text style={[styles.muted, { padding: spacing.md }]}>{tk('liveMap.noMap')}</Text>
          : createElement('div', { ref: container, style: { width: '100%', height: '100%' } })}
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
              <Pressable accessibilityRole="button" accessibilityLabel={tk('liveMap.recenter')} style={[styles.ctrl, following && styles.ctrlOn]} onPress={recentre}>
                <Text style={[styles.ctrlText, following && styles.ctrlTextOn]}>⌖</Text>
              </Pressable>
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
        {idle && audience === 'user' ? <Text style={styles.muted}>{t('liveMap.ended')}</Text> : null}
        {!route && !idle && audience === 'user' ? <Text style={styles.muted}>{tk('liveMap.noRoute')}</Text> : null}
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
  ctrlOn: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  ctrlText: { color: '#111827', fontSize: 20, fontWeight: '800' },
  ctrlTextOn: { color: '#ffffff' },
  footer: { padding: spacing.md, gap: 2 },
  muted: { color: c.muted, fontSize: 13, padding: 0 },
})
