import { Tabs } from 'expo-router'
import { Image } from 'expo-image'
import { View, type ColorValue } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../src/store/auth'
import { useTheme } from '../../src/store/theme'
import { useI18n } from '../../src/store/i18n'
import { resolveMediaUrl } from '../../src/api/client'
import { PreferenceToggleButtons } from '../../src/components/PreferenceToggles'
import { spacing } from '../../src/theme'

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
  return <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
}

export default function BuyerTabs() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { t } = useI18n()

  return (
    <Tabs
      safeAreaInsets={{ bottom: insets.bottom }}
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800' },
        headerRight: () => <PreferenceToggleButtons />,
        headerRightContainerStyle: { paddingRight: spacing.md },
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.mutedLight,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 58 + insets.bottom,
          paddingTop: 7,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopColor: colors.surfaceAlt,
          backgroundColor: colors.white,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), headerShown: false, tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} /> }} />
      <Tabs.Screen name="categories" options={{ title: t('tabs.categories'), headerTitle: t('tabs.categories'), tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'grid' : 'grid-outline'} size={21} color={color} /> }} />
      <Tabs.Screen name="cart" options={{ title: t('tabs.cart'), headerTitle: t('tabs.myCart'), tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'bag-handle' : 'bag-handle-outline'} size={22} color={color} /> }} />
      <Tabs.Screen name="favorites" options={{ title: t('tabs.favorites'), headerTitle: t('tabs.myFavorites'), tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'heart' : 'heart-outline'} size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), headerTitle: t('tabs.myProfile'), tabBarIcon: ({ color, focused }) => <ProfileTabIcon color={color} focused={focused} size={22} /> }} />
    </Tabs>
  )
}
