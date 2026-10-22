/**
 * What the two route-planner maps share.
 *
 * This file carries no platform suffix on purpose. The maps themselves are
 * split (RoutePlanMap.tsx / RoutePlanMap.web.tsx), and inside the web one the
 * specifier './RoutePlanMap' resolves to that same web file — so anything it
 * tried to re-export from "the native file" would resolve back to itself and
 * recurse until the stack gave out. Shared pieces therefore live here, where
 * both builds resolve to one and the same module.
 */

export const KINSHASA: [number, number] = [15.3136, -4.3217]

export interface RoutePlanMapProps {
  /** Where the run begins, once it has been chosen. */
  start: [number, number] | null
  /** Where it ends, once it has been chosen. */
  destination: [number, number] | null
  /** Taps place the point being picked; null while nothing is being picked. */
  onPick: ((lngLat: [number, number]) => void) | null
  height?: number
}

export type PlanCamera =
  | { bounds: [number, number, number, number]; padding: { top: number; bottom: number; left: number; right: number }; maxZoom: number; center?: undefined; zoom?: undefined }
  | { center: [number, number]; zoom: number; bounds?: undefined }

/**
 * Frames both points once they exist, otherwise sits on the one that does —
 * or on the city, before anything is chosen. Shared by both maps so the two
 * cameras cannot drift apart.
 */
export function cameraFor(start: [number, number] | null, destination: [number, number] | null): PlanCamera {
  const chosen = [start, destination].filter(Boolean) as [number, number][]
  if (chosen.length > 1) {
    return {
      bounds: [
        Math.min(...chosen.map((p) => p[0])), Math.min(...chosen.map((p) => p[1])),
        Math.max(...chosen.map((p) => p[0])), Math.max(...chosen.map((p) => p[1])),
      ] as [number, number, number, number],
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      maxZoom: 16,
    }
  }
  return { center: chosen[0] ?? KINSHASA, zoom: chosen[0] ? 15 : 11 }
}
