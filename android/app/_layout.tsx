import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import NetInfo from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { useAuth } from '../src/store/auth'
import { ThemeProvider, useTheme } from '../src/store/theme'
import { I18nProvider, useI18n } from '../src/store/i18n'
import { PreferenceToggleButtons } from '../src/components/PreferenceToggles'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 2, refetchOnReconnect: true }, mutations: { retry: 0 } } })

/** Split out of RootLayout so it can read the theme and language contexts —
 *  screen titles and header colours both have to follow them. */
function RootNavigator() {
  const { colors, theme } = useTheme()
  const { t } = useI18n()

  return (
    <>
      {/* On a dark header the status bar icons must be light, and vice versa. */}
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.white },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: colors.cream },
          // Language and appearance live in the header on every stack screen
          // rather than only inside the profile.
          headerRight: () => <PreferenceToggleButtons />,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(buyer)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ title: t('common.signIn') }} />
        <Stack.Screen name="auth/forgot-password" options={{ title: t('auth.forgotPassword') }} />
        <Stack.Screen name="auth/reset-password" options={{ title: t('auth.newPassword') }} />
        <Stack.Screen name="profile-edit" options={{ title: t('editProfile.title') }} />
        <Stack.Screen name="products/[id]" options={{ title: t('product.title') }} />
        <Stack.Screen name="categories/[slug]" options={{ title: t('categories.pageTitle') }} />
        <Stack.Screen name="checkout/delivery" options={{ title: t('checkout.delivery') }} />
        <Stack.Screen name="checkout/payment" options={{ title: t('checkout.payment') }} />
        <Stack.Screen name="orders/index" options={{ title: t('profile.myOrders') }} />
        <Stack.Screen name="orders/[id]" options={{ title: t('orders.detailTitle') }} />
        <Stack.Screen name="reviews/index" options={{ title: t('profile.myReviews') }} />
        <Stack.Screen name="reviews/write" options={{ title: t('review.publish') }} />
        <Stack.Screen name="seller" options={{ headerShown: false }} />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  const bootstrap = useAuth((state) => state.bootstrap)
  useEffect(() => {
    bootstrap()
    return NetInfo.addEventListener((state) => onlineManager.setOnline(Boolean(state.isConnected)))
  }, [bootstrap])

  return (
    <ThemeProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <RootNavigator />
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}
