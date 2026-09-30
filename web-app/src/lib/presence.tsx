import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { API_BASE, tokenStore } from '@/api/client'

/**
 * Live presence: tells the server, every 30 s while the site is open, that
 * this device is on the site and on which page, so the Direction console can
 * see who is here right now (signed in, signed out or anonymous). The device id
 * is a random value kept in this browser; it identifies no one by itself. The
 * signed-in account, when there is one, rides on the usual access token.
 */
const VISITOR_KEY = 'btmi.visitorId'
const INTERVAL_MS = 30_000

function visitorId(): string | null {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

function send(path: string, action: 'heartbeat' | 'leave') {
  const id = visitorId()
  if (!id) return
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = action === 'heartbeat' ? tokenStore.getAccess() : null
  if (token) headers.Authorization = `Bearer ${token}`
  const body = action === 'heartbeat'
    ? { visitor_id: id, path, platform: 'web', has_session: !!tokenStore.getRefresh(), background: document.visibilityState !== 'visible' }
    : { visitor_id: id }
  // keepalive lets the "leave" survive the page being closed.
  fetch(`${API_BASE}/presence/${action}`, { method: 'POST', headers, body: JSON.stringify(body), keepalive: true })
    .catch(() => undefined)
}

export function PresenceBeacon() {
  const { pathname } = useLocation()
  const pathRef = useRef(pathname)
  pathRef.current = pathname
  // The admin console is not the marketplace; it is not counted as a visit.
  const tracked = !pathname.startsWith('/admin')

  // A new page is reported at once.
  useEffect(() => {
    if (tracked) send(pathname, 'heartbeat')
  }, [pathname, tracked])

  useEffect(() => {
    if (!tracked) return
    // An open tab in the background still counts (flagged as such); browsers slow
    // its timer to about once a minute, which stays inside the server's window.
    const beat = () => send(pathRef.current, 'heartbeat')
    const onVisibility = () => beat()
    const onLeave = () => send(pathRef.current, 'leave')
    const timer = window.setInterval(beat, INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onLeave)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onLeave)
    }
  }, [tracked])

  return null
}
