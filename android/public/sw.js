/* TBK service worker (website = the Expo app on the web): shows push
 * notifications and opens the notification's screen when one is clicked.
 * Pushes arrive even when no TBK tab is open, as long as the browser runs.
 *
 * A click focuses an open TBK tab and hands it the notification, which checks
 * the account, marks it read and opens its screen (same path as a tap on the
 * phone). With no tab open, a new one opens straight on that screen. */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let p = {}
  try {
    p = event.data ? event.data.json() : {}
  } catch {
    p = { title: 'TBK', body: event.data ? event.data.text() : '' }
  }
  const high = p.priority === 'HIGH'
  event.waitUntil((async () => {
    // Open tabs refresh their badges right away.
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    tabs.forEach((tab) => tab.postMessage({ type: 'tbk:push', payload: p }))
    await self.registration.showNotification(p.title || 'TBK', {
      body: p.body || '',
      icon: '/android-chrome-192x192.png',
      badge: '/favicon-32x32.png',
      // Same tag = the newer alert replaces the older one (same order, same chat).
      tag: p.tag || p.id,
      renotify: high,
      requireInteraction: p.category === 'SECURITY',
      timestamp: p.ts || Date.now(),
      data: p
    })
  })())
})

function safePath(p) {
  return typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : '/notifications'
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const p = event.notification.data || {}
  // Admin alerts open in the web admin console (/admin, web-app/), which
  // reads its own web link and listens for "tbk:navigate".
  const admin = p.kind === 'ADMIN'
  const target = safePath(admin ? p.link : p.app_link)
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const tab of tabs) {
      const url = new URL(tab.url)
      if (url.origin !== self.location.origin || !('focus' in tab)) continue
      if (admin !== url.pathname.startsWith('/admin')) continue
      await tab.focus()
      tab.postMessage(admin ? { type: 'tbk:navigate', url: target } : { type: 'tbk:open', payload: p })
      return
    }
    await self.clients.openWindow(target)
  })())
})

// The browser renewed or dropped the subscription: open tabs re-register it.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    tabs.forEach((tab) => tab.postMessage({ type: 'tbk:resubscribe' }))
  })())
})
