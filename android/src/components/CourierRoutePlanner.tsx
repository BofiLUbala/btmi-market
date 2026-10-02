import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import * as Location from 'expo-location'
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native'
import { courierApi } from '../api'
import { ApiError } from '../api/client'
import { Button } from './ui'
import { useI18n, type TranslationKey } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, spacing, type Colors } from '../theme'
import type { GeocodeCandidate, RoutePointInput } from '../types'
import { MAP_STYLE } from '../lib/mapStyle'
import { ROUTE_SOURCE_KEYS, formatDistance, formatDuration, parseCoordinates } from '../lib/routeFormat'

type Target = 'start' | 'destination'
type Method = 'gps' | 'buyer' | 'address' | 'coordinates' | 'map'
const KINSHASA: [number, number] = [15.3136, -4.3217]
const METHOD_KEYS: Record<Method, string> = { gps: 'route.method.gps', buyer: 'route.method.buyer', address: 'route.method.address', coordinates: 'route.method.coordinates', map: 'route.method.map' }


/**
 * The map service matches streets, not landmarks: "12, Avenue de la Paix —
 * Face BN" scores 0.55 (refused) where "12, Avenue de la Paix" scores 0.88.
 * The landmark after the dash is dropped from the search, never from the order.
 */
function forSearch(address?: string): string {
  return (address ?? '').split(/\s+[—–]\s+/)[0].trim()
}

/**
 * The courier sets the two ends of the delivery route: GPS, typed
 * coordinates, an address search or a tap on the map. Both points are shown
 * on the map and must be confirmed before the road route is computed. An
 * address the map service cannot place is never guessed.
 */
export function CourierRoutePlanner({ orderId, deliveryAddress, pickupAddress, onSaved }: { orderId: string; deliveryAddress?: string; pickupAddress?: string; onSaved?: () => void }) {
  const { t, lang } = useI18n()
  const tk = (key: string, vars?: Record<string, string | number>) => t(key as TranslationKey, vars)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const live = useQuery({ queryKey: ['courier', 'courierLocation', orderId], queryFn: () => courierApi.live(orderId) })
  const data = live.data
  const route = data?.route ?? null
  const buyerPoint: [number, number] | null = data?.buyer_shared_point && data.delivery_latitude != null && data.delivery_longitude != null
    ? [data.delivery_longitude, data.delivery_latitude] : null

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

  useEffect(() => {
    if (prefilled.current || !data) return
    prefilled.current = true
    if (route) {
      setPoints({
        start: { ...route.start, source: route.start.source === 'REROUTE' ? 'GPS' : route.start.source },
        destination: { ...route.destination, source: route.destination.source as RoutePointInput['source'] },
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

  const choose = async (target: Target, m: Method) => {
    setMethod((cur) => ({ ...cur, [target]: m }))
    setError('')
    setPicking(m === 'map' ? target : null)
    if (m === 'buyer' && buyerPoint) setPoint(target, { longitude: buyerPoint[0], latitude: buyerPoint[1], source: 'BUYER_GPS', label: tk('route.method.buyer') })
    if (m === 'gps') {
      setBusy(`gps-${target}`)
      try {
        const perm = await Location.requestForegroundPermissionsAsync()
        if (!perm.granted) throw new Error('denied')
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
        setPoint(target, { latitude: pos.coords.latitude, longitude: pos.coords.longitude, source: 'GPS', label: `GPS ± ${Math.round(pos.coords.accuracy ?? 0)} m` })
      } catch {
        setError(tk('route.gpsFailed'))
      } finally { setBusy('') }
    }
  }

  const search = async (target: Target) => {
    setBusy(`search-${target}`)
    setError('')
    try {
      const found = await courierApi.geocode(query[target])
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
      const res = await courierApi.setRoute(orderId, { start: points.start, destination: points.destination, confirmed: true })
      const r = res.route
      setDone(r ? tk('route.computed', { distance: formatDistance(r.route_length_m, lang), duration: formatDuration(r.remaining_s) }) : '')
      void live.refetch()
      onSaved?.()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally { setBusy('') }
  }

  const chosen = (['start', 'destination'] as Target[]).map((k) => points[k]).filter(Boolean) as RoutePointInput[]
  const camera = chosen.length > 1
    ? { bounds: [Math.min(...chosen.map((p) => p.longitude)), Math.min(...chosen.map((p) => p.latitude)), Math.max(...chosen.map((p) => p.longitude)), Math.max(...chosen.map((p) => p.latitude))] as [number, number, number, number], padding: { top: 50, bottom: 50, left: 50, right: 50 }, maxZoom: 16 }
    : { center: chosen[0] ? [chosen[0].longitude, chosen[0].latitude] as [number, number] : KINSHASA, zoom: chosen[0] ? 15 : 11 }

  const pointCard = (target: Target) => {
    const p = points[target]
    const m = method[target]
    const methods: Method[] = target === 'start' ? ['gps', 'address', 'coordinates', 'map'] : [...(buyerPoint ? ['buyer' as Method] : []), 'address', 'coordinates', 'map']
    return (
      <View style={styles.block} testID={`route-${target}`}>
        <Text style={styles.blockTitle}>{target === 'start' ? '🟢' : '🔴'} {tk(target === 'start' ? 'route.start' : 'route.destination')}</Text>
        <View style={styles.chips}>
          {methods.map((x) => (
            <Pressable key={x} accessibilityRole="button" onPress={() => void choose(target, x)} style={[styles.chip, m === x && styles.chipOn]} disabled={busy === `gps-${target}`}>
              <Text style={[styles.chipText, m === x && styles.chipTextOn]}>{tk(METHOD_KEYS[x])}</Text>
            </Pressable>
          ))}
        </View>
        {m === 'address' ? (
          <View style={{ gap: 6 }}>
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1 }]} value={query[target]} placeholder={tk('route.searchPlaceholder')} placeholderTextColor={colors.muted}
                onChangeText={(v) => setQuery((q) => ({ ...q, [target]: v }))} onSubmitEditing={() => void search(target)} />
              <Button dense variant="outline" title={busy === `search-${target}` ? tk('route.searching') : tk('route.search')} onPress={() => void search(target)} disabled={!!busy} />
            </View>
            {candidates[target]?.length === 0 ? <Text style={styles.warn}>⚠ {tk('route.notFound')}</Text> : null}
            {candidates[target]?.length ? <Text style={styles.muted}>{tk('route.pickCandidate')}</Text> : null}
            {candidates[target]?.map((c, i) => (
              <Pressable key={i} accessibilityRole="button" style={styles.candidate} onPress={() => setPoint(target, { latitude: c.latitude, longitude: c.longitude, source: 'ADDRESS', label: c.label })}>
                <Text style={styles.candidateText}>📍 {c.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {m === 'coordinates' ? (
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1 }]} keyboardType="numbers-and-punctuation" placeholder={`${tk('route.lat')} -4.3035`} placeholderTextColor={colors.muted}
              value={coords[target].lat} onChangeText={(v) => setCoords((c) => ({ ...c, [target]: { ...c[target], lat: v } }))} />
            <TextInput style={[styles.input, { flex: 1 }]} keyboardType="numbers-and-punctuation" placeholder={`${tk('route.lng')} 15.3065`} placeholderTextColor={colors.muted}
              value={coords[target].lng} onChangeText={(v) => setCoords((c) => ({ ...c, [target]: { ...c[target], lng: v } }))} />
            <Button dense variant="outline" title="OK" onPress={() => applyCoords(target)} />
          </View>
        ) : null}
        {m === 'map' ? <Text style={styles.muted}>👆 {tk('route.tapMapMobile')}</Text> : null}
        <Text style={styles.small} testID={`route-${target}-chosen`}>
          {p ? tk('route.pointSet', { label: `${p.label || tk(ROUTE_SOURCE_KEYS[p.source])} (${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)})` }) : tk('route.notSet')}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.card} testID="route-planner">
      <Text style={styles.title}>🧭 {tk('route.title')}</Text>
      {pointCard('start')}
      {pointCard('destination')}
      <Map style={styles.map} mapStyle={MAP_STYLE} logo={false} attribution attributionPosition={{ bottom: 8, right: 8 }}
        onPress={(e) => {
          if (!picking) return
          const [lng, lat] = e.nativeEvent.lngLat
          setPoint(picking, { longitude: lng, latitude: lat, source: 'MAP', label: '' })
        }}>
        <Camera {...camera} duration={0} />
        {points.start ? <Marker id="plan-start" lngLat={[points.start.longitude, points.start.latitude]}><View style={styles.startDot} /></Marker> : null}
        {points.destination ? <Marker id="plan-dest" lngLat={[points.destination.longitude, points.destination.latitude]} anchor="bottom"><Text style={styles.pin}>📍</Text></Marker> : null}
      </Map>
      <View style={styles.confirm}>
        <Switch value={confirmed} disabled={!points.start || !points.destination} onValueChange={setConfirmed} />
        <Text style={[styles.small, { flex: 1 }]}>{tk('route.confirmCheck')}</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {done ? <Text style={styles.ok}>✓ {done}</Text> : null}
      <Button title={busy === 'compute' ? tk('route.computing') : tk(route ? 'route.change' : 'route.compute')} onPress={() => void compute()} disabled={!points.start || !points.destination || !confirmed || !!busy} />
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  card: { backgroundColor: c.white, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md, gap: spacing.md },
  title: { color: c.ink, fontWeight: '800', fontSize: 16 },
  block: { gap: 6 },
  blockTitle: { color: c.ink, fontWeight: '700', fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  chipOn: { backgroundColor: c.ink, borderColor: c.ink },
  chipText: { color: c.ink, fontSize: 13 },
  chipTextOn: { color: c.white, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, color: c.ink, fontSize: 14 },
  candidate: { borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, padding: 10 },
  candidateText: { color: c.ink, fontSize: 13 },
  map: { height: 260, width: '100%', borderRadius: radius.sm, overflow: 'hidden' },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  small: { color: c.ink, fontSize: 13 },
  muted: { color: c.muted, fontSize: 13 },
  warn: { color: c.warning, fontSize: 13 },
  error: { color: c.danger ?? '#dc2626', fontSize: 13 },
  ok: { color: c.success, fontSize: 13 },
  pin: { fontSize: 30 },
  startDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#16a34a', borderWidth: 3, borderColor: '#ffffff' },
})
