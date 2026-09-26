import { useEffect } from 'react'
import { router } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '../src/store/auth'
import { useColors } from '../src/store/theme'
import { loadLastRoute } from '../src/lib/lastRoute'

// Buyer tabs are the home itself: reopening one is a plain switch of tab.
// ("/" itself is this screen, so it is left to the default redirect below.)
const HOME_TABS = new Set(['/categories', '/cart', '/favorites', '/profile'])

export default function Index() {
  const colors = useColors()
  const ready = useAuth((state) => state.ready)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    loadLastRoute().then((saved) => {
      if (cancelled) return
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
