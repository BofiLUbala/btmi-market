import { createElement, useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAP_STYLE, transformMapRequest } from '../lib/mapStyle'
import { radius } from '../theme'
import { KINSHASA, cameraFor, type RoutePlanMapProps } from '../lib/routePlan'

export { KINSHASA, cameraFor } from '../lib/routePlan'

/**
 * The route planner's map in a browser. Without it the planner named MapLibre
 * — a native module — and so rendered nothing at all on the web, taking the
 * geocoding and the saving down with it. The framing rule is imported from the
 * native file rather than copied, so the two cameras cannot drift apart.
 */
export function RoutePlanMap({ start, destination, onPick, height = 260 }: RoutePlanMapProps) {
  const container = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markers = useRef<{ start: maplibregl.Marker | null; destination: maplibregl.Marker | null }>({ start: null, destination: null })
  // Read through a ref so changing what is being picked never rebuilds the map.
  const pickRef = useRef(onPick); pickRef.current = onPick

  useEffect(() => {
    if (!container.current || mapRef.current) return
    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: MAP_STYLE,
        transformRequest: transformMapRequest,
        center: KINSHASA,
        zoom: 11,
        attributionControl: { compact: true },
      })
    } catch {
      return // No WebGL; the planner still works from addresses and coordinates.
    }
    mapRef.current = map
    const click = (e: maplibregl.MapMouseEvent) => {
      pickRef.current?.([e.lngLat.lng, e.lngLat.lat])
    }
    map.on('click', click)
    return () => {
      map.off('click', click)
      markers.current.start?.remove()
      markers.current.destination?.remove()
      markers.current = { start: null, destination: null }
      map.remove()
      mapRef.current = null
    }
  }, [])

  // The pointer says whether a click would place something.
  useEffect(() => {
    const canvas = mapRef.current?.getCanvas()
    if (canvas) canvas.style.cursor = onPick ? 'crosshair' : ''
  }, [onPick])

  // Both pins, and the camera framing whatever has been chosen so far.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const place = (key: 'start' | 'destination', at: [number, number] | null) => {
      const existing = markers.current[key]
      if (!at) { existing?.remove(); markers.current[key] = null; return }
      if (existing) { existing.setLngLat(at); return }
      const el = document.createElement('div')
      if (key === 'start') {
        el.style.cssText = 'width:20px;height:20px;border-radius:10px;background:#16a34a;border:3px solid #fff'
      } else {
        el.style.cssText = 'font-size:30px;line-height:30px'
        el.textContent = '📍'
      }
      markers.current[key] = new maplibregl.Marker({ element: el, anchor: key === 'start' ? 'center' : 'bottom' })
        .setLngLat(at).addTo(map)
    }
    place('start', start)
    place('destination', destination)

    const camera = cameraFor(start, destination)
    if (camera.bounds) {
      const [w, s, e, n] = camera.bounds
      map.fitBounds([[w, s], [e, n]], { padding: camera.padding, maxZoom: camera.maxZoom, duration: 0 })
    } else {
      map.jumpTo({ center: camera.center, zoom: camera.zoom })
    }
  }, [start?.[0], start?.[1], destination?.[0], destination?.[1]]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[styles.map, { height }]}>
      {createElement('div', { ref: container, style: { width: '100%', height: '100%' } })}
    </View>
  )
}

const styles = StyleSheet.create({
  map: { width: '100%', borderRadius: radius.sm, overflow: 'hidden' },
})
