import { useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useGlobalSearchParams, usePathname, useSegments } from 'expo-router'

/* Remembers the screen the user was on so that reopening the app lands them
 * back on it instead of the home tab. Same storage as the other preferences. */
const LAST_ROUTE_KEY = 'btmi.lastRoute'
// Past this age the saved screen is stale; the app opens on home as usual.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export interface SavedRoute {
  pathname: string
  params: Record<string, string>
}

/** Screens never worth reopening: sign-in flows (the session decides where to
 *  go) and the courier camera, which must be opened on purpose. */
function isRestorable(pathname: string) {
  return !(
    pathname.startsWith('/auth')
    || pathname === '/admin/login'
    || pathname === '/courier/scan'
  )
}

/** Mounted once in the root navigator: saves every screen change. */
export function useRememberRoute() {
  const pathname = usePathname()
  const segments: string[] = useSegments()
  const params = useGlobalSearchParams()
  const query = JSON.stringify(params)

  useEffect(() => {
    // No segments = the launch screen (app/index), which also reads "/": saving
    // it would overwrite the route it is about to restore.
    if (!pathname || segments.length === 0 || !isRestorable(pathname)) return
    // Dynamic segments ([id], [slug]…) are already part of the pathname; only
    // the real query string needs to be kept alongside it.
    const dynamicKeys = new Set(segments.map((s) => /^\[(?:\.\.\.)?(\w+)\]$/.exec(s)?.[1]).filter(Boolean))
    const kept: Record<string, string> = {}
    for (const [key, value] of Object.entries(JSON.parse(query) as Record<string, string | string[]>)) {
      if (dynamicKeys.has(key) || value == null) continue
      kept[key] = Array.isArray(value) ? value.join(',') : String(value)
    }
    AsyncStorage.setItem(LAST_ROUTE_KEY, JSON.stringify({ pathname, params: kept, at: Date.now() })).catch(() => {})
    // segments change together with pathname; tracking it too would only re-save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, query])
}

/** The screen to reopen at launch, or null for the default home tab. */
export async function loadLastRoute(): Promise<SavedRoute | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_ROUTE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as SavedRoute & { at?: number }
    if (!saved?.pathname || !isRestorable(saved.pathname)) return null
    if (!saved.at || Date.now() - saved.at > MAX_AGE_MS) return null
    return { pathname: saved.pathname, params: saved.params ?? {} }
  } catch {
    return null
  }
}

export function clearLastRoute() {
  return AsyncStorage.removeItem(LAST_ROUTE_KEY).catch(() => {})
}
