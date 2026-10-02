import { Platform } from 'react-native'
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { create } from 'zustand'
import { courierApi } from '../api'
import { ApiError } from '../api/client'
import type { CourierLocationPoint, CourierMission } from '../types'

/**
 * Live courier GPS during a delivery.
 *
 * Tracking follows the mission, never the other way round: it starts only
 * after the server accepted PICKED_UP -> IN_TRANSIT, stops when the courier
 * arrives (or the server answers TRACKING_NOT_ACTIVE), and a refused
 * permission never blocks a delivery step.
 *
 * A foreground service ("Livraison TBK en cours") keeps it running with the
 * screen off; it needs only the while-in-use permission when started from the
 * app. Offline, only the latest point is kept and sent on reconnection: no
 * backlog is ever replayed.
 */

export const COURIER_LOCATION_TASK = 'tbk-courier-location'

const ORDER_KEY = 'tbk.courierTracking.orderId'
const PENDING_KEY = 'tbk.courierTracking.pending'
const BACKGROUND_ASKED_KEY = 'tbk.courierTracking.backgroundAsked'

/** active: sharing; pending: a point waits for the network; denied: no permission; ended: stopped after the delivery. */
export type TrackingState = 'idle' | 'active' | 'pending' | 'denied' | 'ended'

export const useCourierTracking = create<{ state: TrackingState; orderId: string | null }>(() => ({ state: 'idle', orderId: null }))
const setState = (state: TrackingState, orderId?: string | null) =>
  useCourierTracking.setState((s) => ({ state, orderId: orderId === undefined ? s.orderId : orderId }))

/** Android reports "unknown" as -1; the server nulls those too. */
const known = (v: number | null | undefined) => (v == null || !Number.isFinite(v) || v < 0 ? null : v)

export function toLocationPoint(loc: Location.LocationObject): CourierLocationPoint {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: known(loc.coords.accuracy),
    heading: known(loc.coords.heading),
    speed: known(loc.coords.speed),
    captured_at: new Date(loc.timestamp).toISOString(),
  }
}

/** The newest point of a batch: an older one is never sent after it. */
export function latestLocation(locations: Location.LocationObject[] | undefined): Location.LocationObject | null {
  if (!locations?.length) return null
  return locations.reduce((a, b) => (b.timestamp > a.timestamp ? b : a))
}

async function readPending(): Promise<CourierLocationPoint | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY)
    return raw ? (JSON.parse(raw) as CourierLocationPoint) : null
  } catch { return null }
}

let sending = false

/** Sends one point; keeps it (and only it) when the network is down. */
async function upload(orderId: string, point: CourierLocationPoint): Promise<void> {
  try {
    await courierApi.reportLocation(orderId, point)
    await AsyncStorage.removeItem(PENDING_KEY)
    setState('active', orderId)
  } catch (e) {
    if (e instanceof ApiError && e.code === 'TRACKING_NOT_ACTIVE') {
      // The mission left IN_TRANSIT (arrived, failed, cancelled...): stop.
      await stopCourierTracking()
      return
    }
    if (e instanceof ApiError && e.status === 0) {
      // Offline: this point replaces any older unsent one.
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(point))
      setState('pending', orderId)
      return
    }
    // A point the server refused (inaccurate, too old) is simply dropped.
  }
}

// Registered at module load: the task must exist before Android delivers
// locations to it, including when the app process was restarted headless.
if (Platform.OS !== 'web') TaskManager.defineTask<{ locations: Location.LocationObject[] }>(COURIER_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return
  const latest = latestLocation(data.locations)
  const orderId = await AsyncStorage.getItem(ORDER_KEY)
  if (!orderId) {
    await Location.stopLocationUpdatesAsync(COURIER_LOCATION_TASK).catch(() => undefined)
    return
  }
  if (!latest || sending) {
    if (latest) await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(toLocationPoint(latest)))
    return
  }
  sending = true
  try { await upload(orderId, toLocationPoint(latest)) } finally { sending = false }
})

/** Back online: send the latest waiting point, if tracking is still on. */
async function flushPending() {
  const [orderId, pending] = await Promise.all([AsyncStorage.getItem(ORDER_KEY), readPending()])
  if (!orderId || !pending || sending) return
  sending = true
  try { await upload(orderId, pending) } finally { sending = false }
}
if (Platform.OS !== 'web') NetInfo.addEventListener((net) => { if (net.isConnected) void flushPending() })

export type StartResult = 'active' | 'denied' | 'unavailable'

/**
 * Called once the server confirmed IN_TRANSIT. Never throws: the delivery has
 * already started whatever happens here.
 */
/** Location updates were (re)started by this app process, foreground service included. */
let startedThisProcess = false

export async function startCourierTracking(orderId: string): Promise<StartResult> {
  try {
    await AsyncStorage.setItem(ORDER_KEY, orderId)
    await AsyncStorage.removeItem(PENDING_KEY)
    const fg = await Location.requestForegroundPermissionsAsync()
    if (!fg.granted) {
      setState('denied', orderId)
      return 'denied'
    }
    if (await Location.hasStartedLocationUpdatesAsync(COURIER_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(COURIER_LOCATION_TASK)
    }
    await Location.startLocationUpdatesAsync(COURIER_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10_000,
      distanceInterval: 25,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'Livraison TBK en cours',
        notificationBody: 'Partage de position actif',
        notificationColor: '#091223',
      },
    })
    startedThisProcess = true
    setState('active', orderId)
    // Send a first point right away rather than after the first interval.
    void Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 150 })
      .then((loc) => (loc ? upload(orderId, toLocationPoint(loc)) : undefined))
      .catch(() => undefined)
    void askBackgroundOnce()
    return 'active'
  } catch {
    setState('denied', orderId)
    return 'unavailable'
  }
}

/**
 * "Allow all the time" lets tracking survive the app being closed and
 * restarted from the background. Asked once, to couriers only, never blocking:
 * the foreground service works without it.
 */
async function askBackgroundOnce() {
  try {
    if (await AsyncStorage.getItem(BACKGROUND_ASKED_KEY)) return
    await AsyncStorage.setItem(BACKGROUND_ASKED_KEY, '1')
    const bg = await Location.getBackgroundPermissionsAsync()
    if (!bg.granted && bg.canAskAgain) await Location.requestBackgroundPermissionsAsync()
  } catch { /* optional */ }
}

export async function stopCourierTracking(): Promise<void> {
  startedThisProcess = false
  const orderId = await AsyncStorage.getItem(ORDER_KEY)
  await AsyncStorage.multiRemove([ORDER_KEY, PENDING_KEY]).catch(() => undefined)
  try {
    if (await Location.hasStartedLocationUpdatesAsync(COURIER_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(COURIER_LOCATION_TASK)
    }
  } catch { /* already stopped */ }
  setState(orderId ? 'ended' : 'idle', null)
}

/**
 * On app start / dashboard load: an IN_TRANSIT mission must be tracked, and
 * nothing else may be. Does not prompt for permission: a courier who refused
 * sees the "Autorisez la localisation" notice instead.
 */
export async function resumeCourierTrackingIfNeeded(missions: CourierMission[] | undefined): Promise<void> {
  if (!missions) return
  const inTransit = missions.find((m) => m.delivery_status === 'IN_TRANSIT')
  const running = await Location.hasStartedLocationUpdatesAsync(COURIER_LOCATION_TASK).catch(() => false)
  const tracked = await AsyncStorage.getItem(ORDER_KEY)
  if (!inTransit) {
    if (running || tracked) await stopCourierTracking()
    return
  }
  if (running && tracked === inTransit.order_id) {
    if (startedThisProcess) {
      const pending = await readPending()
      setState(pending ? 'pending' : 'active', inTransit.order_id)
      return
    }
    // "Started" survives the app process being killed, but the foreground
    // service does not: restart it once per launch so tracking keeps working
    // with the screen off.
    await flushPending().catch(() => undefined)
  }
  const fg = await Location.getForegroundPermissionsAsync().catch(() => null)
  if (!fg?.granted) {
    await AsyncStorage.setItem(ORDER_KEY, inTransit.order_id)
    setState('denied', inTransit.order_id)
    return
  }
  await startCourierTracking(inTransit.order_id)
}
