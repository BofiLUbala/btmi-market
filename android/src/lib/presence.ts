import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { usePathname } from 'expo-router'
import { API_URL } from '../api/client'
import { tokenStore } from '../api/tokenStore'

/* Live presence: tells the server, every 30 s while the app is in the
 * foreground, that this device is in the app and on which screen, so the
 * Direction console can see who is here right now (signed in, signed out or
 * anonymous). The device id is random and kept on this phone only. */
const VISITOR_KEY = 'btmi.visitorId'
const INTERVAL_MS = 30_000

let cachedId: string | null = null

function uuidV4(): string {
  const hex = '0123456789abcdef'
  let out = ''
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-'
    else if (i === 14) out += '4'
    else if (i === 19) out += hex[(Math.random() * 4) | 8]
    else out += hex[(Math.random() * 16) | 0]
  }
  return out
}

async function visitorId(): Promise<string | null> {
  if (cachedId) return cachedId
  try {
    let id = await AsyncStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = uuidV4()
      await AsyncStorage.setItem(VISITOR_KEY, id)
    }
    cachedId = id
    return id
  } catch {
    return null
  }
}

async function send(path: string, action: 'heartbeat' | 'leave') {
  try {
    const id = await visitorId()
    if (!id) return
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    let body: Record<string, unknown> = { visitor_id: id }
    if (action === 'heartbeat') {
      const [access, refresh] = await Promise.all([tokenStore.getAccess(), tokenStore.getRefresh()])
      if (access) headers.Authorization = `Bearer ${access}`
      body = { visitor_id: id, path, platform: 'android', has_session: !!refresh }
    }
    await fetch(`${API_URL}/presence/${action}`, { method: 'POST', headers, body: JSON.stringify(body) })
  } catch {
    // Presence is best effort; the app never waits on it.
  }
}

/** Mounted once in the root navigator. */
export function usePresenceHeartbeat() {
  const pathname = usePathname()
  const pathRef = useRef(pathname)
  pathRef.current = pathname
  // The admin screens are not the marketplace; they are not counted as a visit.
  const tracked = !pathname.startsWith('/admin')

  useEffect(() => {
    if (tracked && AppState.currentState === 'active') void send(pathname, 'heartbeat')
  }, [pathname, tracked])

  useEffect(() => {
    if (!tracked) return
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void send(pathRef.current, 'heartbeat')
    }, INTERVAL_MS)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void send(pathRef.current, 'heartbeat')
      else if (state === 'background') void send(pathRef.current, 'leave')
    })
    return () => {
      clearInterval(timer)
      sub.remove()
    }
  }, [tracked])
}
