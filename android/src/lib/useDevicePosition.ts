import { useCallback, useEffect, useRef, useState } from 'react'
import * as Location from 'expo-location'

export interface DevicePosition {
  latitude: number
  longitude: number
  accuracy: number | null
}

export type DevicePositionStatus = 'locating' | 'ready' | 'denied' | 'failed'

/**
 * Where this phone is, for a screen that is open right now.
 *
 * The sequence is the one a ride app uses, so a map can land on the viewer
 * instead of on a default city: ask for the foreground permission, take the
 * last known fix (it arrives in milliseconds and is usually the right street),
 * refine it with a high-accuracy fix, then follow with a watch while the
 * caller stays mounted.
 *
 * Foreground only, and only while `enabled`: the watch is removed as soon as
 * the screen that asked for it goes away. Courier mission tracking is a
 * different thing entirely and lives in `courierTracking` - this hook never
 * uploads anything.
 */
export function useDevicePosition({ enabled = true, watch = true }: { enabled?: boolean; watch?: boolean } = {}): {
  position: DevicePosition | null
  status: DevicePositionStatus
  /** Ask again - after the viewer granted the permission in Settings, or to refresh. */
  refresh: () => void
} {
  const [position, setPosition] = useState<DevicePosition | null>(null)
  const [status, setStatus] = useState<DevicePositionStatus>('locating')
  const [attempt, setAttempt] = useState(0)
  // A fix that lands after the caller unmounted must not set state.
  const alive = useRef(true)

  const refresh = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) return
    alive.current = true
    let sub: Location.LocationSubscription | null = null

    const take = (pos: Location.LocationObject) => {
      if (!alive.current) return
      setPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null })
      setStatus('ready')
    }

    void (async () => {
      try {
        let perm = await Location.getForegroundPermissionsAsync()
        if (!perm.granted && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync()
        if (!alive.current) return
        if (!perm.granted) { setStatus('denied'); return }

        const last = await Location.getLastKnownPositionAsync().catch(() => null)
        if (last) take(last)
        const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
        take(fresh)

        if (!watch || !alive.current) return
        const s = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5_000 },
          take,
        )
        if (alive.current) sub = s
        else s.remove()
      } catch {
        // No fix right now (no signal, location services off): the caller
        // falls back to whatever it shows without a position.
        if (alive.current) setStatus((prev) => (prev === 'ready' || prev === 'denied' ? prev : 'failed'))
      }
    })()

    return () => {
      alive.current = false
      sub?.remove()
    }
  }, [enabled, watch, attempt])

  return { position, status, refresh }
}
