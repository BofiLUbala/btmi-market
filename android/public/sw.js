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
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const tab of tabs) {
      if (new URL(tab.url).origin === self.location.origin && 'focus' in tab) {
        await tab.focus()
        tab.postMessage({ type: 'tbk:open', payload: p })
        return
      }
    }
    await self.clients.openWindow(safePath(p.app_link))
  })())
})

// The browser renewed or dropped the subscription: open tabs re-register it.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    tabs.forEach((tab) => tab.postMessage({ type: 'tbk:resubscribe' }))
  })())
})
