import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { TransformRequestManager } from '@maplibre/maplibre-react-native'

/**
 * TomTom vector tiles when EXPO_PUBLIC_TOMTOM_API_KEY is set at build time,
 * otherwise OpenFreeMap (OpenStreetMap data, no key). The key ships inside the
 * app: restrict it in the TomTom developer portal.
 */
const TOMTOM_KEY = process.env.EXPO_PUBLIC_TOMTOM_API_KEY?.trim() || ''

const tomtom = (map: string) =>
  `https://api.tomtom.com/maps/orbis/assets/styles/0.*/style.json?apiVersion=1&map=${map}&key=${encodeURIComponent(TOMTOM_KEY)}`

export type MapStyleId = 'street' | 'dark' | 'satellite'

/** The styles the viewer can pick; satellite imagery needs TomTom. */
export const MAP_STYLES: { id: MapStyleId; labelKey: string; url: string }[] = TOMTOM_KEY
  ? [
      { id: 'street', labelKey: 'liveMap.style.street', url: tomtom('basic_street-light') },
      { id: 'dark', labelKey: 'liveMap.style.dark', url: tomtom('basic_street-dark') },
      { id: 'satellite', labelKey: 'liveMap.style.satellite', url: tomtom('basic_street-satellite') },
    ]
  : [
      { id: 'street', labelKey: 'liveMap.style.street', url: 'https://tiles.openfreemap.org/styles/liberty' },
      { id: 'dark', labelKey: 'liveMap.style.dark', url: 'https://tiles.openfreemap.org/styles/dark' },
    ]

export const MAP_STYLE = MAP_STYLES[0].url

const STYLE_KEY = 'tbk.mapStyle'

/** The viewer's last chosen map style, remembered on this phone. */
export function useMapStyle(): [MapStyleId, (id: MapStyleId) => void] {
  const [id, setId] = useState<MapStyleId>('street')
  useEffect(() => {
    void AsyncStorage.getItem(STYLE_KEY).then((v) => {
      if (v && MAP_STYLES.some((s) => s.id === v)) setId(v as MapStyleId)
    }).catch(() => undefined)
  }, [])
  const choose = (next: MapStyleId) => {
    setId(next)
    void AsyncStorage.setItem(STYLE_KEY, next).catch(() => undefined)
  }
  return [id, choose]
}

export const styleUrl = (id: MapStyleId) => (MAP_STYLES.find((s) => s.id === id) ?? MAP_STYLES[0]).url

// Adds the key to any TomTom resource the style references without it.
if (TOMTOM_KEY) {
  TransformRequestManager.addUrlSearchParam({
    id: 'tomtom-key',
    match: '^https://api\\.tomtom\\.com/(?!.*[?&]key=)',
    name: 'key',
    value: TOMTOM_KEY,
  })
}
