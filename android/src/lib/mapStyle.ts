import { TransformRequestManager } from '@maplibre/maplibre-react-native'

/**
 * TomTom vector tiles when EXPO_PUBLIC_TOMTOM_API_KEY is set at build time,
 * otherwise OpenFreeMap (OpenStreetMap data, no key). The key ships inside the
 * app: restrict it in the TomTom developer portal.
 */
const TOMTOM_KEY = process.env.EXPO_PUBLIC_TOMTOM_API_KEY?.trim() || ''

export const MAP_STYLE = TOMTOM_KEY
  ? `https://api.tomtom.com/maps/orbis/assets/styles/0.*/style.json?apiVersion=1&map=basic_street-light&key=${encodeURIComponent(TOMTOM_KEY)}`
  : 'https://tiles.openfreemap.org/styles/liberty'

// Adds the key to any TomTom resource the style references without it.
if (TOMTOM_KEY) {
  TransformRequestManager.addUrlSearchParam({
    id: 'tomtom-key',
    match: '^https://api\\.tomtom\\.com/(?!.*[?&]key=)',
    name: 'key',
    value: TOMTOM_KEY,
  })
}
