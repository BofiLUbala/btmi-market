import { API_URL, request } from '../api/client'
import { translate } from '../store/i18n'

/**
 * Browser push for the website (the Expo app on the web), through the
 * service worker in public/sw.js and the server's VAPID key. One browser
 * profile holds one subscription, owned by the account that enabled it; it
 * is released at sign-out so a shared computer never shows someone else's
 * alerts. Same server endpoints as the phone (platform WEB instead of EXPO).
 */
const OWNER_KEY = 'btmi.push.owner'
const KEY_KEY = 'btmi.push.key'

type Config = { web_enabled: boolean; vapid_public_key?: string }
export type WebPushState = 'unavailable' | 'denied' | 'off' | 'on' | 'other-account'

export function webPushSupported(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch { /* storage unavailable */ }
}
function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

/**
 * Every browser step below can hang instead of failing: `serviceWorker.ready`
 * never settles while no worker activates, and `pushManager.subscribe` waits
 * on the push service, which a restricted network never answers. Unbounded,
 * they leave the opt-in button spinning for ever, so each one gets a deadline
 * and a plain failure instead.
 */
const SW_READY_MS = 10_000
const SUBSCRIBE_MS = 20_000
const CONFIG_MS = 8_000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

let registration: Promise<ServiceWorkerRegistration | null> | null = null
function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!webPushSupported()) return Promise.resolve(null)
  if (!registration) {
    const attempt = navigator.serviceWorker.register('/sw.js', { scope: '/' })
      // An already-active worker needs no wait; otherwise wait for one, but
      // not for ever.
      .then((reg) => (reg.active ? reg : withTimeout(navigator.serviceWorker.ready, SW_READY_MS)))
      .catch(() => null)
    // Only a success is remembered: a one-off failure must not leave push
    // switched off for the rest of the session.
    registration = attempt.then((reg) => {
      if (!reg) registration = null
      return reg
    })
  }
  return registration
}

let config: Promise<Config> | null = null
function pushConfig(): Promise<Config> {
  if (!config) {
    config = withTimeout(fetch(`${API_URL}/push/config`).then((r) => r.json()), CONFIG_MS)
      .then((j) => {
        if (!j) { config = null; return { web_enabled: false } }
        return ((j as { data?: Config }).data ?? j) as Config
      })
      .catch(() => {
        config = null
        return { web_enabled: false }
      })
  }
  return config
}

function keyBytes(base64url: string): Uint8Array {
  const padded = (base64url + '==='.slice((base64url.length + 3) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function deviceLabel(): string {
  const ua = navigator.userAgent
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : 'Linux'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Web'
  return translate('libPush.deviceNamed', { name: `${browser} · ${os}` })
}

export async function webPushState(scope: string): Promise<WebPushState> {
  if (!webPushSupported()) return 'unavailable'
  const cfg = await pushConfig()
  if (!cfg.web_enabled || !cfg.vapid_public_key) return 'unavailable'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  const reg = await registerServiceWorker()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  const owner = read(OWNER_KEY)
  if (!sub) return 'off'
  if (owner && owner !== scope) return 'other-account'
  return owner === scope ? 'on' : 'off'
}

async function subscribeAndRegister(scope: string): Promise<boolean> {
  const cfg = await pushConfig()
  if (!cfg.web_enabled || !cfg.vapid_public_key) return false
  const reg = await registerServiceWorker()
  if (!reg) return false
  let sub = await reg.pushManager.getSubscription()
  // A subscription made with another server key can no longer be used.
  const storedKey = read(KEY_KEY)
  if (sub && storedKey && storedKey !== cfg.vapid_public_key) {
    await sub.unsubscribe().catch(() => undefined)
    sub = null
  }
  if (!sub) {
    sub = await withTimeout(
      reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(cfg.vapid_public_key) as BufferSource }),
      SUBSCRIBE_MS,
    )
  }
  // No subscription: the browser could not reach its push service.
  if (!sub) return false
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  await request('/push/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ platform: 'WEB', endpoint: json.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth }, device_label: deviceLabel() }),
  })
  store(OWNER_KEY, scope)
  store(KEY_KEY, cfg.vapid_public_key)
  return true
}

/** Asks the browser (must follow a click) and turns push on for `scope`. */
export async function enableWebPush(scope: string): Promise<WebPushState> {
  if (!webPushSupported()) return 'unavailable'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'
  return (await subscribeAndRegister(scope)) ? 'on' : 'unavailable'
}

/** Session start: re-attach this browser when push was on for `scope`. */
export async function syncWebPush(scope: string): Promise<void> {
  if (!webPushSupported() || Notification.permission !== 'granted' || read(OWNER_KEY) !== scope) return
  try { await subscribeAndRegister(scope) } catch { /* retried at next start */ }
}

/** Sign-out or switched off: this browser stops receiving `scope`'s alerts. */
export async function releaseWebPush(scope: string): Promise<void> {
  if (read(OWNER_KEY) !== scope) return
  store(OWNER_KEY, null)
  const reg = await registerServiceWorker().catch(() => null)
  const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe().catch(() => undefined)
  await fetch(`${API_URL}/push/unregister`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint }), keepalive: true }).catch(() => undefined)
}

/** Service-worker messages: a clicked notification, or a renewed subscription. */
export function onWebPushMessage(handlers: { open: (payload: Record<string, unknown>) => void; resubscribe: () => void }): () => void {
  if (!webPushSupported()) return () => undefined
  const listener = (event: MessageEvent) => {
    const msg = event.data as { type?: string; payload?: Record<string, unknown> } | null
    if (msg?.type === 'tbk:open' && msg.payload) handlers.open(msg.payload)
    else if (msg?.type === 'tbk:resubscribe') handlers.resubscribe()
  }
  navigator.serviceWorker.addEventListener('message', listener)
  return () => navigator.serviceWorker.removeEventListener('message', listener)
}
