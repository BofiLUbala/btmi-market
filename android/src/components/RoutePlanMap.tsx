import { StyleSheet, Text, View } from 'react-native'
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native'
import { MAP_STYLE } from '../lib/mapStyle'
import { radius } from '../theme'
import { cameraFor, type RoutePlanMapProps } from '../lib/routePlan'

export { KINSHASA, cameraFor } from '../lib/routePlan'
export type { PlanCamera, RoutePlanMapProps } from '../lib/routePlan'

/**
 * The map inside the courier's route planner, in its own module so the planner
 * never names MapLibre itself: that is a native module, and importing it
 * directly is what left the whole planner blank in a browser. The web build
 * picks up RoutePlanMap.web.tsx instead, and the planner's own logic — the
 * geocoding, the candidates, the saving — stays in one place for both.
 */
export function RoutePlanMap({ start, destination, onPick, height = 260 }: RoutePlanMapProps) {
  return (
    <Map
      style={[styles.map, { height }]}
      mapStyle={MAP_STYLE}
      logo={false}
      attribution
      attributionPosition={{ bottom: 8, right: 8 }}
      onPress={(e) => {
        if (!onPick) return
        const [lng, lat] = e.nativeEvent.lngLat
        onPick([lng, lat])
      }}
    >
      <Camera {...cameraFor(start, destination)} duration={0} />
      {start ? <Marker id="plan-start" lngLat={start}><View style={styles.startDot} /></Marker> : null}
      {destination ? <Marker id="plan-dest" lngLat={destination} anchor="bottom"><Text style={styles.pin}>📍</Text></Marker> : null}
    </Map>
  )
}

const styles = StyleSheet.create({
  map: { width: '100%', borderRadius: radius.sm, overflow: 'hidden' },
  pin: { fontSize: 30 },
  startDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#16a34a', borderWidth: 3, borderColor: '#ffffff' },
})
