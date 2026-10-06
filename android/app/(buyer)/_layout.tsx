import { Tabs, router } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, View, type GestureResponderEvent, type PressableProps } from 'react-native'

/** The props expo-router hands a custom `tabBarButton` that this file uses. */
type BottomTabBarButtonProps = { children?: ReactNode; onPress?: ((e: GestureResponderEvent) => void) | null; onLongPress?: ((e: GestureResponderEvent) => void) | null; accessibilityState?: PressableProps['accessibilityState']; accessibilityLabel?: string; testID?: string }
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../src/store/auth'
import { canSell } from '../../src/types'
import { useCart } from '../../src/store/cart'
import { useTheme } from '../../src/store/theme'
import { useI18n } from '../../src/store/i18n'
import { fonts, shadow } from '../../src/theme'
import { StoreHeader } from '../../src/components/StoreHeader'
import { withBrandFont } from '../../src/typography'
import type { TranslationKey } from '../../src/locales/fr'

/** The reference's raised centre action: a blue disc lifted above the bar.
 *  Used for the seller hub (the "sell" entry) when the account can sell. */
function RaisedTabButton({ children, onPress, onLongPress, accessibilityState, accessibilityLabel, testID }: BottomTabBarButtonProps) {
  return (
    <Pressable onPress={onPress ?? undefined} onLongPress={onLongPress ?? undefined} accessibilityRole="button" accessibilityState={accessibilityState} accessibilityLabel={accessibilityLabel} testID={testID} style={{ flex: 1, alignItems: 'center' }}>
      {children}
    </Pressable>
  )
}

function RaisedTabIcon({ focused }: { focused: boolean }) {
  const { colors } = useTheme()
  return (
    <View style={[{ width: 52, height: 52, borderRadius: 26, marginTop: -26, backgroundColor: focused ? colors.gold : colors.green, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }, shadow.raised]}>
      <Ionicons name="add" size={26} color={colors.onGreen} />
    </View>
  )
}

export default function BuyerTabs() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { t } = useI18n()
  // The server's capability flags decide who may publish (same rule as the
  // seller space), not the raw account type.
  const isSeller = useAuth((state) => canSell(state.user))
  const cartCount = useCart((state) => state.lines.reduce((sum, line) => sum + line.quantity, 0))

  const isSignedIn = useAuth((state) => Boolean(state.user))
  // "Vendre": sellers publish an item; buyers land on their account, where the
  // become-a-seller action lives; guests start a seller sign-up.
  const openSell = () => {
    if (isSeller) router.push('/seller/products/create')
    else if (isSignedIn) router.navigate('/(buyer)/profile')
    else router.push('/auth/register-seller')
  }

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
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.mutedLight,
        tabBarLabelStyle: withBrandFont({ fontSize: 10.5, fontWeight: '600', marginTop: 2 }),
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 62 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopColor: colors.border,
          backgroundColor: colors.white,
          ...shadow.card,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('nav.home' as TranslationKey), headerShown: false, tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} /> }} />
      <Tabs.Screen name="categories" options={{ title: t('nav.categories' as TranslationKey), tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'grid' : 'grid-outline'} size={21} color={color} /> }} />
      <Tabs.Screen
        name="sell"
        options={{ title: t('nav.sell' as TranslationKey), tabBarButton: (props: BottomTabBarButtonProps) => <RaisedTabButton {...props} />, tabBarIcon: ({ focused }: { focused: boolean }) => <RaisedTabIcon focused={focused} /> }}
        listeners={{ tabPress: (e) => { e.preventDefault(); openSell() } }}
      />
      <Tabs.Screen name="my-orders" options={{ title: t('nav.orders' as TranslationKey), tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'cube' : 'cube-outline'} size={22} color={color} /> }} />
      <Tabs.Screen name="cart" options={{ title: t('nav.cart' as TranslationKey), tabBarBadge: cartCount > 0 ? cartCount : undefined, tabBarBadgeStyle: { backgroundColor: colors.green, color: colors.onGreen, fontSize: 10.5 }, tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'bag-handle' : 'bag-handle-outline'} size={22} color={color} /> }} />
      {/* Not in the bar (reference layout): reached from the home header,
          the home search field and the account quick tiles. */}
      <Tabs.Screen name="search" options={{ href: null, title: t('nav.search' as TranslationKey) }} />
      <Tabs.Screen name="favorites" options={{ href: null, title: t('nav.favorites' as TranslationKey) }} />
      <Tabs.Screen name="profile" options={{ href: null, title: isSeller ? t('nav.sellerHub' as TranslationKey) : t('nav.account' as TranslationKey) }} />
    </Tabs>
  )
}
