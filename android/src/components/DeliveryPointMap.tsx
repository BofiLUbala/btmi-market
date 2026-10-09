import { useEffect, useMemo, useRef } from 'react'
import { Pressable, StyleSheet, Text, View, type NativeSyntheticEvent } from 'react-native'
import { Camera, Map, UserLocation, type CameraRef, type MapRef, type ViewStateChangeEvent } from '@maplibre/maplibre-react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useI18n, type TranslationKey } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, type Colors } from '../theme'
import { styleUrl, useMapStyle } from '../lib/mapStyle'

export interface DeliveryPointMapProps {
  /** Where the camera starts; read once, like MapLibre's own initial view state. */
  initialCentre: [number, number]
  /** While following, the camera eases to each new phone position. */
  followCentre: [number, number] | null
  following: boolean
  /** The viewer's own blue dot; off when the permission was refused. */
  showDot: boolean
  zoom: number
  height: number
  /** The map centre after a pan or pinch, which is where the pin now is. */
  onSettle: (centre: [number, number], userInteraction: boolean) => void
  /** The style could not be loaded (no tiles, no network). */
  onFailed: () => void
  /** "Ma position": the picker turns following back on and asks for a fresh fix. */
  onMyLocation: () => void
  /** Tells a scrolling parent to stop scrolling while a finger is on the map. */
  onGesture?: (active: boolean) => void
}

/**
 * The map half of the delivery-point picker, kept in its own module because
 * MapLibre is a native module: the picker loads this lazily so a binary
 * without it (Expo Go, the web build) never evaluates it and falls back to
 * picking the point from the GPS fix alone.
 *
 * The pin is painted over the centre of the map rather than placed on it, so
 * the finger never hides it and it cannot drift from the centre reported back.
 */
export function DeliveryPointMap({
  initialCentre, followCentre, following, showDot, zoom, height, onSettle, onFailed, onMyLocation, onGesture,
}: DeliveryPointMapProps) {
  const { t } = useI18n()
  const tk = (key: string) => t(key as TranslationKey)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [styleId] = useMapStyle()
  const cameraRef = useRef<CameraRef>(null)
  const mapRef = useRef<MapRef>(null)

  // Each new phone position while following; a programmatic move reports
  // userInteraction false, so it never counts as the buyer taking over.
  useEffect(() => {
    if (!following || !followCentre) return
    cameraRef.current?.easeTo({ center: followCentre, zoom, duration: 400 })
  }, [following, followCentre?.[0], followCentre?.[1], zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  const settle = (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
    const { center, userInteraction } = event.nativeEvent
    onSettle([center[0], center[1]], userInteraction)
  }

  const zoomBy = async (delta: number) => {
    const z = await mapRef.current?.getZoom().catch(() => null)
    if (z != null) cameraRef.current?.zoomTo(Math.max(3, Math.min(19, z + delta)), { duration: 200 })
  }

  return (
    <View
      style={[styles.mapBox, { height }]}
      onTouchStart={() => onGesture?.(true)}
      onTouchEnd={() => onGesture?.(false)}
      onTouchCancel={() => onGesture?.(false)}
    >
      <Map
        ref={mapRef}
        style={styles.map}
        mapStyle={styleUrl(styleId)}
        logo={false}
        attribution
        attributionPosition={{ bottom: 6, right: 6 }}
        onRegionDidChange={settle}
        onDidFailLoadingMap={onFailed}
      >
        <Camera ref={cameraRef} initialViewState={{ center: initialCentre, zoom }} maxZoom={19} />
        {showDot ? <UserLocation accuracy animated minDisplacement={5} /> : null}
      </Map>

      <View pointerEvents="none" style={styles.pinLayer}>
        <Ionicons name="location" size={42} color={colors.green} style={styles.pin} />
        <View style={styles.pinFoot} />
      </View>

      <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel={tk('liveMap.zoomIn')} style={styles.ctrl} onPress={() => void zoomBy(1)}>
          <Text style={styles.ctrlText}>+</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={tk('liveMap.zoomOut')} style={styles.ctrl} onPress={() => void zoomBy(-1)}>
          <Text style={styles.ctrlText}>−</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tk('deliveryPoint.myLocation')}
          accessibilityState={{ selected: following }}
          style={[styles.ctrl, following && styles.ctrlOn]}
          onPress={onMyLocation}
        >
          <Ionicons name="locate" size={19} color={following ? colors.onGreen : colors.ink} />
        </Pressable>
      </View>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  mapBox: { borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: c.border },
  map: { flex: 1, width: '100%' },
  pinLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  // The icon's tip is its bottom edge: lift it by half its height so the tip,
  // not the middle, sits on the centre the map reports back.
  pin: { marginBottom: 21 },
  pinFoot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(9,18,35,0.45)' },
  controls: { position: 'absolute', top: 8, right: 8, gap: 8 },
  ctrl: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  ctrlOn: { backgroundColor: c.green, borderColor: c.green },
  ctrlText: { color: '#111827', fontSize: 19, fontWeight: '800' },
})
