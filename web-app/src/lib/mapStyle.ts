import type { RequestTransformFunction } from 'maplibre-gl'

/**
 * TomTom vector tiles when VITE_TOMTOM_API_KEY is set at build time, otherwise
 * OpenFreeMap (OpenStreetMap data, no key). The key ends up in the browser
 * bundle: restrict it to our domains in the TomTom developer portal.
 */
const TOMTOM_KEY = (import.meta.env.VITE_TOMTOM_API_KEY as string | undefined)?.trim() || ''

export const MAP_STYLE = TOMTOM_KEY
  ? `https://api.tomtom.com/maps/orbis/assets/styles/0.*/style.json?apiVersion=1&map=basic_street-light&key=${encodeURIComponent(TOMTOM_KEY)}`
  : 'https://tiles.openfreemap.org/styles/liberty'

/** Adds the key to any TomTom resource the style references without it. */
export const transformMapRequest: RequestTransformFunction | undefined = TOMTOM_KEY
  ? (url) => {
      if (!url.startsWith('https://api.tomtom.com/') || /[?&]key=/.test(url)) return { url }
      return { url: `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(TOMTOM_KEY)}` }
    }
  : undefined
