import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import * as Location from 'expo-location'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Button } from './ui'
import { useI18n, type TranslationKey } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, spacing, type Colors } from '../theme'
import { useDevicePosition } from '../lib/useDevicePosition'
import type { DeliveryPointMapProps } from './DeliveryPointMap'

export interface DeliveryPoint { latitude: number; longitude: number; accuracy?: number | null }

/** Kinshasa: something to show in the half-second before the first fix. */
const KINSHASA: [number, number] = [15.3136, -4.3217]
/** Above this, the fix alone would put the pin on the wrong street. */
const MAX_ACCURACY_M = 200
/** Close enough to the phone's own fix that the point is still "the GPS one". */
const SAME_SPOT_M = 8
const PIN_ZOOM = 17
const MAP_HEIGHT = 230

/** Tells the picker the map is not available, then renders nothing. */
function MapUnavailable({ onFailed }: DeliveryPointMapProps) {
  useEffect(() => { onFailed() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return <></>
}

// MapLibre is a native module: loaded only when the card is open, so a binary
// without it (Expo Go, the web build) never evaluates it and the picker falls
// back to taking the point from the GPS fix alone.
const LazyDeliveryPointMap = lazy(() => import('./DeliveryPointMap')
  .then((m) => ({ default: m.DeliveryPointMap ?? MapUnavailable }))
  .catch(() => ({ default: MapUnavailable })))

/** Metres between two lng/lat points, flat-earth - fine over a few streets. */
function metresBetween(a: [number, number], b: [number, number]): number {
  const dLat = (a[1] - b[1]) * 111_320
  const dLng = (a[0] - b[0]) * 111_320 * Math.max(Math.cos((a[1] * Math.PI) / 180), 1e-6)
  return Math.hypot(dLat, dLng)
}

/**
 * The exact delivery point, picked on a map that loads itself - the way a ride
 * app does it: the card opens, the phone is asked for its position, the map
 * lands on the buyer with the pin already on them, and dragging the map moves
 * the pin to the door. No "locate me" tap to get started.
 *
 * While the buyer has not touched the map the camera follows the phone; the
 * first pan hands the camera over and the point becomes hand-placed - its
 * accuracy is then unknown rather than pretended.
 *
 * Without MapLibre (Expo Go, the web build) or without tiles, the card keeps
 * working as the single "Utiliser ma position" button it used to be; with no
 * map to adjust on, a fix too imprecise to trust is refused instead.
 *
 * Still optional: "Retirer" collapses the card back to one button and the
 * written address carries the delivery on its own. The position is only ever
 * read in the foreground, while this card is open.
 */
export function DeliveryPointPicker({ value, onChange, onGesture }: {
  value: DeliveryPoint | null
  onChange: (p: DeliveryPoint | null) => void
  /** Tells a scrolling parent to stop scrolling while a finger is on the map. */
  onGesture?: (active: boolean) => void
}) {
  const { t } = useI18n()
  const tk = (key: string, vars?: Record<string, string | number>) => t(key as TranslationKey, vars)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  // Open by default: the map is the picker. A saved point is kept as it is -
  // it is the buyer's own door, so the camera starts there instead of chasing
  // the phone, and "Ma position" is one tap away.
  const [open, setOpen] = useState(true)
  const [following, setFollowing] = useState(!value)
  const [handPlaced, setHandPlaced] = useState(false)
  const [mapOff, setMapOff] = useState(false)
  const [address, setAddress] = useState('')
  // Asked as soon as the card opens - that is what "the map loads itself" is.
  const { position: device, status: geo, refresh } = useDevicePosition({ enabled: open })
  const locating = geo === 'locating'

  const point = value
  const centre: [number, number] = point
    ? [point.longitude, point.latitude]
    : device
      ? [device.longitude, device.latitude]
      : KINSHASA
  // With no map to drag, a fix this vague cannot be corrected: refuse it.
  const tooVague = mapOff && device?.accuracy != null && device.accuracy > MAX_ACCURACY_M

  // While the buyer has not taken the camera over, the pin walks with them.
  // A saved point owns the camera instead, and each fix only feeds the dot.
  useEffect(() => {
    if (!open || !following || !device || tooVague) return
    setHandPlaced(false)
    onChange(device)
  }, [open, following, tooVague, device?.latitude, device?.longitude, device?.accuracy]) // eslint-disable-line react-hooks/exhaustive-deps

  // The street name under the pin, from the OS geocoder. It is unavailable in
  // parts of the country, and the written address is the real one either way.
  useEffect(() => {
    if (!open || !point) { setAddress(''); return }
    let cancelled = false
    const id = setTimeout(() => {
      void Location.reverseGeocodeAsync({ latitude: point.latitude, longitude: point.longitude })
        .then((hits) => {
          if (cancelled) return
          const hit = hits[0]
          const street = hit?.name || [hit?.streetNumber, hit?.street].filter(Boolean).join(' ')
          setAddress([street, hit?.district || hit?.city].filter(Boolean).join(', '))
        })
        .catch(() => { if (!cancelled) setAddress('') })
    }, 600)
    return () => { cancelled = true; clearTimeout(id) }
  }, [open, point?.latitude, point?.longitude]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pan or pinch: the pin is wherever the map centre now is. A pinch that left
  // the centre on the phone's own fix keeps that fix's accuracy.
  const settle = (next: [number, number], userInteraction: boolean) => {
    if (!userInteraction) return
    const onDevice = device ? metresBetween(next, [device.longitude, device.latitude]) < SAME_SPOT_M : false
    setFollowing(false)
    setHandPlaced(!onDevice)
    onChange({ latitude: next[1], longitude: next[0], accuracy: onDevice ? device?.accuracy ?? null : null })
  }

  const remove = () => {
    setOpen(false)
    setFollowing(true)
    setHandPlaced(false)
    setAddress('')
    onChange(null)
  }

  const imprecise = !handPlaced && point?.accuracy != null && point.accuracy > MAX_ACCURACY_M
  const message = geo === 'denied' ? tk(mapOff ? 'deliveryPoint.denied' : 'deliveryPoint.deniedMap')
    : geo === 'failed' ? tk(mapOff ? 'deliveryPoint.failed' : 'deliveryPoint.failedMap')
      : tooVague ? tk('deliveryPoint.imprecise', { meters: Math.round(device!.accuracy!) })
        : imprecise ? tk('deliveryPoint.approximate', { meters: Math.round(point!.accuracy!) })
          : ''

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <View style={styles.tile}><Ionicons name="navigate" size={17} color={colors.green} /></View>
        <View style={styles.headText}>
          <Text style={styles.title}>{t('deliveryPoint.title')}</Text>
          <Text style={styles.muted}>{open && !mapOff ? t('deliveryPoint.dragHint') : t('deliveryPoint.hint')}</Text>
        </View>
      </View>

      {!open ? (
        <Button variant="outline" dense title={`📍 ${t('deliveryPoint.add')}`} onPress={() => setOpen(true)} />
      ) : mapOff ? (
        // No map on this build: the point comes from the fix alone, on demand.
        <Button
          variant="outline"
          dense
          title={`📍 ${locating ? t('deliveryPoint.locating') : t('deliveryPoint.useMyLocation')}`}
          loading={locating}
          onPress={() => { setFollowing(true); refresh() }}
        />
      ) : (
        <Suspense fallback={<View style={[styles.mapPlaceholder, { height: MAP_HEIGHT }]} />}>
          <LazyDeliveryPointMap
            initialCentre={centre}
            followCentre={device ? [device.longitude, device.latitude] : null}
            following={following}
            showDot={geo !== 'denied'}
            zoom={PIN_ZOOM}
            height={MAP_HEIGHT}
            onSettle={settle}
            onFailed={() => setMapOff(true)}
            onMyLocation={() => { setFollowing(true); refresh() }}
            onGesture={onGesture}
          />
        </Suspense>
      )}

      {open ? (
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.ok}>
              📍 {locating && !point ? t('deliveryPoint.locating')
                : !point ? t('deliveryPoint.hint')
                  : handPlaced ? t('deliveryPoint.manual')
                    : point.accuracy != null ? t('deliveryPoint.addedWithAccuracy', { meters: Math.round(point.accuracy) })
                      : t('deliveryPoint.added')}
            </Text>
            {address ? <Text style={styles.muted}>{address}</Text> : null}
          </View>
          <Button variant="outline" dense title={t('deliveryPoint.remove')} onPress={remove} />
        </View>
      ) : null}

      {message ? <Text style={styles.muted}>{message}</Text> : null}
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  box: { borderWidth: 1, borderColor: c.border, borderRadius: 14, backgroundColor: c.white, padding: 12, gap: spacing.sm, marginVertical: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tile: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1, gap: 2 },
  title: { color: c.ink, fontWeight: '700', fontSize: 14 },
  muted: { color: c.muted, fontSize: 12.5, lineHeight: 17 },
  ok: { color: c.ink, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: 10, borderRadius: radius.sm, backgroundColor: c.successSoft },
  mapPlaceholder: { borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2 },
})
