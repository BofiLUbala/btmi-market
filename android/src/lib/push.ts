import { Platform } from 'react-native'
import Constants from 'expo-constants'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { requireOptionalNativeModule } from 'expo-modules-core'
import { API_URL, request } from '../api/client'
import { adminApi } from '../api/admin'
import { translate, type TranslationKey } from '../store/i18n'
import { enableWebPush, releaseWebPush, syncWebPush, webPushState } from './webPush'

/**
 * Mobile push for TBK, through Expo's push service (FCM on Android).
 *
 * The phone's token belongs to whichever account last turned push on here
 * (a regular account or the admin console) and is released at sign-out, so
 * the next person on this phone never sees the previous one's alerts.
 *
 * expo-notifications is a native module: binaries built before it was added
 * receive this code through OTA updates without it. Everything here checks
 * for the module first and quietly does nothing when it is missing.
 */
export type PushScope = 'user' | 'admin'
export type PushState = 'unavailable' | 'expo-go' | 'denied' | 'off' | 'on' | 'other-account'

type NotificationsModule = typeof import('expo-notifications')

const OWNER_KEY = 'btmi.push.owner'
const TOKEN_KEY = 'btmi.push.token'

let mod: NotificationsModule | null | undefined
function notifications(): NotificationsModule | null {
  if (mod !== undefined) return mod
  mod = null
  if (Platform.OS === 'web') return mod
  // Expo Go on Android has no remote push since SDK 53: merely requiring the
  // module throws an uncaught error overlay there, so never load it.
  if (Platform.OS === 'android' && isExpoGo()) return mod
  try {
    if (!requireOptionalNativeModule('ExpoPushTokenManager')) return mod
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-notifications') as NotificationsModule
  } catch {
    mod = null
  }
  return mod
}

export function pushAvailable(): boolean {
  return notifications() !== null
}

// On the web (the website is this app), push goes through the browser's
// service worker instead of expo-notifications: see webPush.ts.
const isWeb = Platform.OS === 'web'

/** Expo Go (since SDK 53) cannot receive remote push on Android. */
export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient'
}

/** Android channels, one per category, so the user can tune them in the
 * system settings too. Urgent categories ring; marketing stays quiet. */
const CHANNELS: { id: string; nameKey: TranslationKey; high: boolean }[] = [
  { id: 'orders', nameKey: 'libPush.channelOrders', high: true },
  { id: 'payments', nameKey: 'libPush.channelPayments', high: true },
  { id: 'messages', nameKey: 'libPush.channelMessages', high: true },
  { id: 'shop', nameKey: 'libPush.channelShop', high: false },
  { id: 'admin', nameKey: 'libPush.channelAdmin', high: true },
  { id: 'security', nameKey: 'libPush.channelSecurity', high: true },
  { id: 'watchlist', nameKey: 'libPush.channelWatchlist', high: false },
  { id: 'marketing', nameKey: 'libPush.channelMarketing', high: false },
]

let configured = false
/** Shows alerts while the app is open and creates the Android channels. */
export async function configurePush(): Promise<void> {
  const N = notifications()
  if (!N || configured) return
  configured = true
  N.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
  })
  if (Platform.OS === 'android') {
    await Promise.all(CHANNELS.map((c) =>
      N.setNotificationChannelAsync(c.id, {
        name: translate(c.nameKey),
        importance: c.high ? N.AndroidImportance.HIGH : N.AndroidImportance.DEFAULT,
        lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE,
      }).catch(() => undefined)
    ))
  }
}

async function owner(): Promise<PushScope | null> {
  const v = await AsyncStorage.getItem(OWNER_KEY).catch(() => null)
  return v === 'user' || v === 'admin' ? v : null
}

function deviceLabel(): string {
  const name = Constants.deviceName
  return name ? translate('libPush.deviceNamed', { name }) : translate('libPush.devicePlatform', { platform: Platform.OS === 'ios' ? 'iOS' : 'Android' })
}

function call<T>(scope: PushScope, path: string, init?: RequestInit): Promise<T> {
  return scope === 'admin' ? adminApi<T>(`/admin${path}`, init) : request<T>(path, init)
}

export async function pushState(scope: PushScope): Promise<PushState> {
  if (isWeb) return webPushState(scope)
  const N = notifications()
  if (!N) return isExpoGo() ? 'expo-go' : 'unavailable'
  const perm = await N.getPermissionsAsync()
  if (perm.status === 'denied' && !perm.canAskAgain) return 'denied'
  if (perm.status !== 'granted') return 'off'
  const o = await owner()
  if (o && o !== scope) return 'other-account'
  return o === scope ? 'on' : 'off'
}

async function registerToken(scope: PushScope): Promise<boolean> {
  const N = notifications()
  if (!N) return false
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId
    ?? Constants.easConfig?.projectId
  const { data: token } = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
  await call(scope, '/push/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ platform: 'EXPO', expo_token: token, device_label: deviceLabel() }),
  })
  await AsyncStorage.multiSet([[OWNER_KEY, scope], [TOKEN_KEY, token]])
  return true
}

/** Asks for permission (from a tap) and turns push on for this account. */
export async function enablePush(scope: PushScope): Promise<PushState> {
  if (isWeb) return enableWebPush(scope)
  const N = notifications()
  if (!N) return isExpoGo() ? 'expo-go' : 'unavailable'
  await configurePush()
  let perm = await N.getPermissionsAsync()
  if (perm.status !== 'granted') perm = await N.requestPermissionsAsync()
  if (perm.status !== 'granted') return perm.canAskAgain ? 'off' : 'denied'
  // Expo Go has no remote push token on Android: only an installed TBK build does.
  if (isExpoGo() && Platform.OS === 'android') return 'expo-go'
  return (await registerToken(scope)) ? 'on' : 'unavailable'
}

/** At each session start: re-attach this phone when push was on for it. */
export async function syncPush(scope: PushScope): Promise<void> {
  if (isWeb) return syncWebPush(scope)
  const N = notifications()
  if (!N || (await owner()) !== scope) return
  try {
    await configurePush()
    if ((await N.getPermissionsAsync()).status === 'granted') await registerToken(scope)
  } catch { /* retried at next start */ }
}

/** Stops push to this phone for `scope` (sign-out or switched off). The
 * server is told with the token itself, which works without a session. */
export async function releasePush(scope: PushScope): Promise<void> {
  if (isWeb) return releaseWebPush(scope)
  if ((await owner()) !== scope) return
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null)
  await AsyncStorage.multiRemove([OWNER_KEY, TOKEN_KEY]).catch(() => undefined)
  if (!token) return
  await fetch(`${API_URL}/push/unregister`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expo_token: token }),
  }).catch(() => undefined)
}

export type NotificationCategory = 'ORDERS' | 'PAYMENTS' | 'MESSAGES' | 'SHOP' | 'ADMIN' | 'SECURITY' | 'WATCHLIST' | 'MARKETING'

export interface NotificationPreference {
  category: NotificationCategory
  push_enabled: boolean
  in_app_enabled: boolean
  requires_consent: boolean
  consented: boolean
  locked: boolean
}

export interface PushDevice {
  id: string
  platform: 'WEB' | 'EXPO'
  device_label: string
  last_success_at?: string
}

export const notificationSettingsApi = {
  preferences: (scope: PushScope) => call<{ items: NotificationPreference[] }>(scope, '/notifications/preferences'),
  update: (scope: PushScope, category: NotificationCategory, body: { push_enabled?: boolean; consent?: boolean }) =>
    call<NotificationPreference>(scope, `/notifications/preferences/${category}`, { method: 'PUT', body: JSON.stringify(body) }),
  devices: (scope: PushScope) => call<{ items: PushDevice[] }>(scope, '/push/subscriptions'),
  removeDevice: (scope: PushScope, id: string) => call<unknown>(scope, `/push/subscriptions/${id}`, { method: 'DELETE' }),
  test: (scope: PushScope, audience: string) => call<unknown>(scope, `/push/test?audience=${audience}`, { method: 'POST' }),
}

export const watchesApi = {
  watch: (productId: string) => request<unknown>(`/watches/${productId}`, { method: 'PUT' }),
  unwatch: (productId: string) => request<unknown>(`/watches/${productId}`, { method: 'DELETE' }),
  sync: (productIds: string[]) => request<unknown>('/watches/sync', { method: 'POST', body: JSON.stringify({ product_ids: productIds }) }),
}

/** What a push carries (see backend/internal/push.Payload). */
export interface PushData {
  id?: string
  app_link?: string
  uid?: string
  kind?: 'USER' | 'ADMIN'
  audience?: string
}

/** Internal app paths only. */
export function safeAppPath(p?: string): string | null {
  if (!p || !p.startsWith('/') || p.startsWith('//') || p.includes('\\') || /^\/[a-z]+:/i.test(p)) return null
  return p
}

/** Fires for each notification the user taps (including the one that
 * launched the app). Returns an unsubscribe function. */
export function onNotificationTap(handler: (data: PushData) => void): () => void {
  const N = notifications()
  if (!N) return () => undefined
  let lastId: string | null = null
  const handle = (response: { notification: { request: { identifier: string; content: { data?: unknown } } } } | null) => {
    if (!response) return
    const id = response.notification.request.identifier
    if (id === lastId) return
    lastId = id
    handler((response.notification.request.content.data ?? {}) as PushData)
  }
  void N.getLastNotificationResponseAsync().then(handle).catch(() => undefined)
  const sub = N.addNotificationResponseReceivedListener(handle)
  return () => sub.remove()
}

/** A notification read in the app also leaves the phone's notification tray:
 *  the alerts carrying these TBK notification ids are dismissed (all of them
 *  when `ids` is 'all', after "mark all as read"). */
export async function dismissDelivered(ids: string[] | 'all'): Promise<void> {
  const N = notifications()
  if (!N) return
  try {
    if (ids === 'all') { await N.dismissAllNotificationsAsync(); return }
    const wanted = new Set(ids)
    const shown = await N.getPresentedNotificationsAsync()
    await Promise.all(shown
      .filter((n) => wanted.has(String((n.request.content.data as PushData | undefined)?.id ?? '')))
      .map((n) => N.dismissNotificationAsync(n.request.identifier)))
  } catch { /* the tray is best effort */ }
}

/** Shows a local notification with a push payload: used by the settings
 * screen's test in Expo Go, where remote push is unavailable. */
export async function presentLocal(title: string, body: string, data: PushData): Promise<boolean> {
  const N = notifications()
  if (!N) return false
  await configurePush()
  await N.scheduleNotificationAsync({ content: { title, body, data: data as Record<string, unknown> }, trigger: null })
  return true
}
