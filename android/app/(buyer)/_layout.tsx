import { Tabs } from 'expo-router'
import { Image } from 'expo-image'
import { View, type ColorValue } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../src/store/auth'
import { useCart } from '../../src/store/cart'
import { useTheme } from '../../src/store/theme'
import { useI18n } from '../../src/store/i18n'
import { resolveMediaUrl } from '../../src/api/client'
import { fonts, spacing } from '../../src/theme'
import { StoreHeader } from '../../src/components/StoreHeader'
import { withBrandFont } from '../../src/typography'
import type { TranslationKey } from '../../src/locales/fr'

// A photo replaces the generic person icon entirely — same rule as the web
// header: circle photo when set, otherwise the plain icon (never both).
function ProfileTabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
  const avatarUrl = useAuth((state) => state.user?.avatar_url)
  const { colors } = useTheme()
  if (avatarUrl) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', borderWidth: focused ? 2 : 0, borderColor: colors.green }}>
        <Image source={resolveMediaUrl(avatarUrl)} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      </View>
    )
  }
  return <Ionicons name="person-outline" size={size} color={color} />
}

export default function BuyerTabs() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { t } = useI18n()
  const isSeller = useAuth((state) => state.user?.account_type === 'SELLER' || state.user?.account_type === 'EMPLOYEE')
  const cartCount = useCart((state) => state.lines.reduce((sum, line) => sum + line.quantity, 0))

  return (
    <Tabs
      safeAreaInsets={{ bottom: insets.bottom }}
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        // Same cream page background as the web storefront.
        sceneStyle: { backgroundColor: colors.cream },
        // The web storefront header on every tab (logo, search, menu).
        header: () => <StoreHeader />,
        headerTitleStyle: withBrandFont({ fontFamily: fonts.display, fontWeight: '500', fontSize: 20 }),
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        // web .mobile-nav a: 10.5px, 500 (600 when active)
        tabBarLabelStyle: withBrandFont({ fontSize: 10.5, fontWeight: '500', marginTop: 2 }),
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 58 + insets.bottom,
          paddingTop: 7,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopColor: colors.border,
          backgroundColor: colors.white,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('nav.home' as TranslationKey), headerShown: false, tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} /> }} />
      <Tabs.Screen name="search" options={{ title: t('nav.search' as TranslationKey), tabBarIcon: ({ color }) => <Ionicons name="search-outline" size={22} color={color} /> }} />
      <Tabs.Screen name="favorites" options={{ title: t('nav.favorites' as TranslationKey), tabBarIcon: ({ color }) => <Ionicons name="heart-outline" size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: isSeller ? t('nav.sellerHub' as TranslationKey) : t('nav.account' as TranslationKey), tabBarIcon: ({ color, focused }) => <ProfileTabIcon color={color} focused={focused} size={22} /> }} />
      <Tabs.Screen name="cart" options={{ title: t('nav.cart' as TranslationKey), tabBarBadge: cartCount > 0 ? cartCount : undefined, tabBarBadgeStyle: { backgroundColor: colors.gold, color: colors.onGold, fontSize: 10.5 }, tabBarIcon: ({ color }) => <Ionicons name="bag-handle-outline" size={22} color={color} /> }} />
      {/* Reached from the home "Tout voir →" and the menu, as on the web. */}
      <Tabs.Screen name="categories" options={{ href: null }} />
    </Tabs>
  )
}
