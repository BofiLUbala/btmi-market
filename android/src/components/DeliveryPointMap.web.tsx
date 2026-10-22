import { createElement, useEffect, useMemo, useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useI18n, type TranslationKey } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, type Colors } from '../theme'
import { styleUrl, transformMapRequest, useMapStyle } from '../lib/mapStyle'
import type { DeliveryPointMapProps } from './DeliveryPointMap'

/**
 * The delivery-point map in a browser. The website is the same app, and the
 * phone's native MapLibre does not exist there, so without this file the
 * picker had no map at all on the web: it fell back to the raw GPS fix and the
 * buyer could not nudge the pin onto their own gate.
 *
 * Same contract and same rules as the native map (DeliveryPointMap.tsx): the
 * pin is painted over the centre rather than placed on it, so the pointer
 * never hides it and it cannot drift from the centre reported back.
 */
export function DeliveryPointMap({
  initialCentre, followCentre, following, showDot, zoom, height, onSettle, onFailed, onMyLocation, onGesture,
}: DeliveryPointMapProps) {
  const { t } = useI18n()
  const tk = (key: string) => t(key as TranslationKey)
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [styleId] = useMapStyle()
  const container = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const dotRef = useRef<maplibregl.Marker | null>(null)

  // The callbacks are read through refs so re-rendering the picker never tears
  // the map down and rebuilds it — that would lose the camera, and with it the
  // point the buyer had just lined up.
  const settleRef = useRef(onSettle); settleRef.current = onSettle
  const failedRef = useRef(onFailed); failedRef.current = onFailed
  const gestureRef = useRef(onGesture); gestureRef.current = onGesture

  useEffect(() => {
    if (!container.current || mapRef.current) return
    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: styleUrl(styleId),
        transformRequest: transformMapRequest,
        center: initialCentre,
        zoom,
        maxZoom: 19,
        attributionControl: { compact: true },
      })
    } catch {
      // No WebGL: an old browser, or hardware acceleration switched off.
      failedRef.current()
      return
    }
    mapRef.current = map

    // `originalEvent` is present only when a pointer caused the move, which is
    // how a drag by hand is told apart from the camera easing to a new fix.
    const settle = (event: { originalEvent?: unknown }) => {
      const c = map.getCenter()
      settleRef.current([c.lng, c.lat], !!event.originalEvent)
    }
    const failed = () => failedRef.current()
    const hold = () => gestureRef.current?.(true)
    const release = () => gestureRef.current?.(false)
    map.on('moveend', settle)
    map.on('error', failed)
    // Keeps a scrolling parent still while the map is being dragged.
    map.on('dragstart', hold)
    map.on('dragend', release)

    return () => {
      map.off('moveend', settle)
      map.off('error', failed)
      dotRef.current?.remove()
      dotRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // A style the viewer picked elsewhere; the camera stays where it is.
  useEffect(() => {
    mapRef.current?.setStyle(styleUrl(styleId))
  }, [styleId])

  // Each new position while following. A programmatic ease carries no
  // `originalEvent`, so it never counts as the buyer taking over.
  useEffect(() => {
    if (!following || !followCentre) return
    mapRef.current?.easeTo({ center: followCentre, zoom, duration: 400 })
  }, [following, followCentre?.[0], followCentre?.[1], zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  // The viewer's own dot, drawn only where the position is known and the
  // permission was granted.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!showDot || !followCentre) {
      dotRef.current?.remove()
      dotRef.current = null
      return
    }
    if (dotRef.current) {
      dotRef.current.setLngLat(followCentre)
      return
    }
    const el = document.createElement('div')
    el.style.cssText = `width:14px;height:14px;border-radius:7px;background:${colors.green};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.2)`
    dotRef.current = new maplibregl.Marker({ element: el }).setLngLat(followCentre).addTo(map)
  }, [showDot, followCentre?.[0], followCentre?.[1], colors.green]) // eslint-disable-line react-hooks/exhaustive-deps

  const zoomBy = (delta: number) => {
    const map = mapRef.current
    if (!map) return
    map.easeTo({ zoom: Math.max(3, Math.min(19, map.getZoom() + delta)), duration: 200 })
  }

  return (
    <View style={[styles.mapBox, { height }]}>
      {createElement('div', { ref: container, style: { width: '100%', height: '100%' } })}

      <View pointerEvents="none" style={styles.pinLayer}>
        <Ionicons name="location" size={42} color={colors.green} style={styles.pin} />
        <View style={styles.pinFoot} />
      </View>

      <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel={tk('liveMap.zoomIn')} style={styles.ctrl} onPress={() => zoomBy(1)}>
          <Text style={styles.ctrlText}>+</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={tk('liveMap.zoomOut')} style={styles.ctrl} onPress={() => zoomBy(-1)}>
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
  pinLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  // The icon's tip is its bottom edge: lift it by half its height so the tip,
  // not the middle, sits on the centre the map reports back.
  pin: { marginBottom: 21 },
  pinFoot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(9,18,35,0.45)' },
  controls: { position: 'absolute', top: 8, right: 8, gap: 8, zIndex: 2 },
  ctrl: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  ctrlOn: { backgroundColor: c.green, borderColor: c.green },
  ctrlText: { color: '#111827', fontSize: 19, fontWeight: '800' },
})
