import { api, API_BASE } from '@/api/client'
import { adminApi } from '@/api/admin'
import { translate } from '@/store/i18n'

/**
 * Browser push for TBK. One browser profile holds one push subscription; it
 * belongs to whichever account (user or admin console) last enabled push here.
 * Signing out releases it, so a shared computer never shows the previous
 * person's alerts.
 */
export type PushScope = 'user' | 'admin'

const OWNER_KEY = 'btmi.push.owner'
const KEY_KEY = 'btmi.push.key'

export type NotificationCategory =
  | 'ORDERS' | 'PAYMENTS' | 'MESSAGES' | 'SHOP' | 'ADMIN' | 'SECURITY' | 'WATCHLIST' | 'MARKETING'

export interface NotificationPreference {
  category: NotificationCategory
  push_enabled: boolean
  in_app_enabled: boolean
  requires_consent: boolean
  consented: boolean
  consented_at?: string
  locked: boolean
}

export interface PushConfig {
  web_enabled: boolean
  expo_enabled: boolean
  vapid_public_key?: string
}

export interface PushDevice {
  id: string
  platform: 'WEB' | 'EXPO'
  device_label: string
  created_at: string
  updated_at: string
  last_success_at?: string
  failure_count: number
}

export type PushState = 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on' | 'other-account'

function call<T>(scope: PushScope, path: string, init?: RequestInit): Promise<T> {
  return scope === 'admin' ? adminApi<T>(`/admin${path}`, init) : api<T>(path, init)
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** iPhone/iPad only allow web push from an app added to the home screen. */
export function needsIosInstall(): boolean {
  if (typeof navigator === 'undefined') return false
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
  return ios && !standalone
}

export function deviceLabel(): string {
  const ua = navigator.userAgent
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : translate('libPush.deviceFallback')
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : translate('libPush.browserFallback')
  return translate('libPush.browserOnOs', { browser, os })
}

function keyBytes(base64url: string): Uint8Array {
  const padded = (base64url + '==='.slice((base64url.length + 3) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

let registration: Promise<ServiceWorkerRegistration | null> | null = null

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return Promise.resolve(null)
  if (!registration) {
    registration = navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(() => navigator.serviceWorker.ready)
      .catch(() => null)
  }
  return registration
}

let configCache: Promise<PushConfig> | null = null
export function getPushConfig(): Promise<PushConfig> {
  if (!configCache) {
    configCache = fetch(`${API_BASE}/push/config`).then((r) => r.json() as Promise<PushConfig>).catch(() => {
      configCache = null
      return { web_enabled: false, expo_enabled: false }
    })
  }
  return configCache
}

export function pushOwner(): PushScope | null {
  try {
    const v = localStorage.getItem(OWNER_KEY)
    return v === 'user' || v === 'admin' ? v : null
  } catch {
    return null
  }
}

function setOwner(scope: PushScope | null, key?: string) {
  try {
    if (scope) localStorage.setItem(OWNER_KEY, scope)
    else localStorage.removeItem(OWNER_KEY)
    if (key) localStorage.setItem(KEY_KEY, key)
    else if (!scope) localStorage.removeItem(KEY_KEY)
  } catch { /* storage unavailable */ }
}

async function browserSubscription(): Promise<PushSubscription | null> {
  const reg = await registerServiceWorker()
  return reg ? reg.pushManager.getSubscription() : null
}

export async function pushState(scope: PushScope): Promise<PushState> {
  if (!pushSupported()) return needsIosInstall() ? 'ios-install' : 'unsupported'
  const cfg = await getPushConfig()
  if (!cfg.web_enabled) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  const sub = await browserSubscription()
  if (!sub) return 'off'
  const owner = pushOwner()
  if (owner && owner !== scope) return 'other-account'
  return owner === scope ? 'on' : 'off'
}

/** Subscribes this browser (with the server's current key) and registers it
 * for the signed-in account of `scope`. Must not ask for permission by itself:
 * call enablePush from a click for that. */
async function subscribeAndRegister(scope: PushScope): Promise<boolean> {
  const cfg = await getPushConfig()
  if (!cfg.web_enabled || !cfg.vapid_public_key) return false
  const reg = await registerServiceWorker()
  if (!reg) return false
  let sub = await reg.pushManager.getSubscription()
  let storedKey: string | null = null
  try { storedKey = localStorage.getItem(KEY_KEY) } catch { /* ignore */ }
  // A subscription made with another server key can no longer be used.
  if (sub && storedKey && storedKey !== cfg.vapid_public_key) {
    await sub.unsubscribe().catch(() => undefined)
    sub = null
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(cfg.vapid_public_key) as BufferSource
    })
  }
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  await call(scope, '/push/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      platform: 'WEB',
      endpoint: json.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      device_label: deviceLabel()
    })
  })
  setOwner(scope, cfg.vapid_public_key)
  return true
}

/** Asks for permission (from a click) and turns push on for this account. */
export async function enablePush(scope: PushScope): Promise<PushState> {
  if (!pushSupported()) return needsIosInstall() ? 'ios-install' : 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'
  return (await subscribeAndRegister(scope)) ? 'on' : 'unsupported'
}

/** Keeps the server in step at each session start: the device is (re)attached
 * to the signed-in account when push was already allowed for it. */
export async function syncPush(scope: PushScope): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return
  const owner = pushOwner()
  if (owner && owner !== scope) return
  if (!owner) {
    // Allowed earlier but never attached (or released at sign-out): only the
    // settings screen attaches it again, on purpose.
    return
  }
  try { await subscribeAndRegister(scope) } catch { /* retried at next start */ }
}

/** Stops push to this browser for `scope` (sign-out or switched off). The
 * server is told with the endpoint itself, so this works after the session
 * has already ended. */
export async function releasePush(scope: PushScope): Promise<void> {
  if (pushOwner() !== scope) return
  setOwner(null)
  const sub = await browserSubscription().catch(() => null)
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe().catch(() => undefined)
  await fetch(`${API_BASE}/push/unregister`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
    keepalive: true
  }).catch(() => undefined)
}

export const notificationSettingsApi = {
  preferences: (scope: PushScope) =>
    call<{ items: NotificationPreference[]; push: PushConfig }>(scope, '/notifications/preferences'),
  update: (scope: PushScope, category: NotificationCategory, body: { push_enabled?: boolean; consent?: boolean }) =>
    call<NotificationPreference>(scope, `/notifications/preferences/${category}`, { method: 'PUT', body: JSON.stringify(body) }),
  devices: (scope: PushScope) => call<{ items: PushDevice[] }>(scope, '/push/subscriptions'),
  removeDevice: (scope: PushScope, id: string) => call<unknown>(scope, `/push/subscriptions/${id}`, { method: 'DELETE' }),
  test: (scope: PushScope, audience?: string) =>
    call<unknown>(scope, `/push/test${audience ? `?audience=${audience}` : ''}`, { method: 'POST' })
}

export const watchesApi = {
  watch: (productId: string) => api<unknown>(`/watches/${productId}`, { method: 'PUT' }),
  unwatch: (productId: string) => api<unknown>(`/watches/${productId}`, { method: 'DELETE' }),
  sync: (productIds: string[]) =>
    api<{ product_ids: string[] }>('/watches/sync', { method: 'POST', body: JSON.stringify({ product_ids: productIds }) })
}
