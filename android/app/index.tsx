import { useEffect } from 'react'
import { router } from 'expo-router'
import { ActivityIndicator, Platform, View } from 'react-native'
import { useAuth } from '../src/store/auth'
import { useColors } from '../src/store/theme'
import { loadLastRoute } from '../src/lib/lastRoute'
import { hasSeenWelcome } from '../src/lib/welcome'

// Buyer tabs are the home itself: reopening one is a plain switch of tab.
// ("/" itself is this screen, so it is left to the default redirect below.)
const HOME_TABS = new Set(['/categories', '/my-orders', '/cart', '/favorites', '/profile'])

/** The last screen is reopened once, when the app starts. After that "/" is
 *  the marketplace home: the logo, "Marketplace" and every home link land
 *  there instead of bouncing back to the screen just left. On the web the
 *  address bar already says which page to open, so "/" is always home. */
let restoredThisSession = Platform.OS === 'web'

export default function Index() {
  const colors = useColors()
  const ready = useAuth((state) => state.ready)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    // First launch, signed out: the "Bienvenue" onboarding is shown once.
    const restore = !restoredThisSession
    restoredThisSession = true
    Promise.all([hasSeenWelcome(), restore ? loadLastRoute() : Promise.resolve(null)]).then(([seen, saved]) => {
      if (cancelled) return
      if (!seen && !useAuth.getState().user) {
        router.replace('/welcome')
        return
      }
      if (saved && HOME_TABS.has(saved.pathname)) {
        router.replace({ pathname: saved.pathname as never, params: saved.params })
        return
      }
      router.replace('/(buyer)')
      // Any other screen is reopened on top of home so that "back" still
      // leads somewhere instead of closing the app.
      if (saved && saved.pathname !== '/') setTimeout(() => router.push({ pathname: saved.pathname as never, params: saved.params }), 0)
    })
    return () => { cancelled = true }
  }, [ready])

  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.green} size="large"/></View>
}
