/* TBK service worker: shows push notifications and opens the right screen
 * when one is clicked. Pushes arrive even when no TBK tab is open (as long as
 * the browser itself is running, or allowed to run in the background).
 *
 * A click always goes through /notif/:id, which checks the session (asking to
 * sign in first if needed), checks the notification is for the signed-in
 * account, marks it read, then opens the target screen. */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

function openUrl(p) {
  const params = new URLSearchParams({
    to: p.link || '/',
    uid: p.uid || '',
    kind: p.kind || 'USER',
    aud: p.audience || 'BUYER'
  })
  return '/notif/' + encodeURIComponent(p.id || 'none') + '?' + params.toString()
}

self.addEventListener('push', (event) => {
  let p = {}
  try {
    p = event.data ? event.data.json() : {}
  } catch {
    p = { title: 'TBK', body: event.data ? event.data.text() : '' }
  }
  const title = p.title || 'TBK'
  const high = p.priority === 'HIGH'
  event.waitUntil((async () => {
    // Open tabs refresh their badges right away.
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    tabs.forEach((tab) => tab.postMessage({ type: 'tbk:push', payload: p }))
    await self.registration.showNotification(title, {
      body: p.body || '',
      icon: '/android-chrome-192x192.png',
      badge: '/favicon-32x32.png',
      // Same tag = the newer alert replaces the older one (same order, same chat).
      tag: p.tag || p.id,
      renotify: high,
      requireInteraction: p.category === 'SECURITY',
      timestamp: p.ts || Date.now(),
      lang: 'fr',
      data: { url: openUrl(p) }
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin)
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const tab of tabs) {
      if (new URL(tab.url).origin === self.location.origin && 'focus' in tab) {
        await tab.focus()
        tab.postMessage({ type: 'tbk:navigate', url: url.pathname + url.search })
        return
      }
    }
    await self.clients.openWindow(url.href)
  })())
})

// The browser renewed or dropped the subscription: open tabs re-register it
// with the server on their next sync.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    tabs.forEach((tab) => tab.postMessage({ type: 'tbk:resubscribe' }))
  })())
})
