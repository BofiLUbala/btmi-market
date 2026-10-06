import { Tabs, router } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, View, type GestureResponderEvent, type PressableProps } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../../src/store/theme'
import { useI18n } from '../../../src/store/i18n'
import { shadow } from '../../../src/theme'
import { withBrandFont } from '../../../src/typography'
import { useCourierHeaderColors } from '../../../src/components/CourierUI'

/** The props expo-router hands a custom `tabBarButton` that this file uses. */
type BottomTabBarButtonProps = { children?: ReactNode; onPress?: ((e: GestureResponderEvent) => void) | null; onLongPress?: ((e: GestureResponderEvent) => void) | null; accessibilityState?: PressableProps['accessibilityState']; accessibilityLabel?: string; testID?: string }

/** Same raised centre disc as the buyer bar (app/(buyer)/_layout.tsx). */
function RaisedTabButton({ children, onPress, onLongPress, accessibilityState, accessibilityLabel, testID }: BottomTabBarButtonProps) {
  return (
    <Pressable onPress={onPress ?? undefined} onLongPress={onLongPress ?? undefined} accessibilityRole="button" accessibilityState={accessibilityState} accessibilityLabel={accessibilityLabel} testID={testID} style={{ flex: 1, alignItems: 'center' }}>
      {children}
    </Pressable>
  )
}

function RaisedScanIcon() {
  const { colors } = useTheme()
  return (
    <View style={[{ width: 56, height: 56, borderRadius: 28, marginTop: -28, backgroundColor: colors.green, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }, shadow.raised]}>
      <Ionicons name="qr-code-outline" size={24} color={colors.onGreen} />
    </View>
  )
}

/** Courier space: Accueil · Mes livraisons · [scan] · Gains · Profil. */
export default function CourierTabs() {
  const insets = useSafeAreaInsets()
  const header = useCourierHeaderColors()
  const { colors } = useTheme()
  const { t } = useI18n()

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      safeAreaInsets={{ bottom: insets.bottom }}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.cream },
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.mutedLight,
        tabBarLabelStyle: withBrandFont({ fontSize: 10, fontWeight: '600', marginTop: 2, letterSpacing: -0.1 }),
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 70 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
          borderTopColor: colors.border,
          backgroundColor: colors.white,
          ...shadow.card,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('courierUi.tabs.home'), tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} /> }} />
      <Tabs.Screen name="deliveries" options={{ title: t('courierUi.tabs.deliveries'), tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'reader' : 'reader-outline'} size={22} color={color} /> }} />
      {/* Placeholder route: pressing it opens the full-screen scanner instead. */}
      <Tabs.Screen
        name="qr"
        options={{ title: t('courierUi.tabs.scan'), tabBarLabel: () => null, tabBarButton: (props: BottomTabBarButtonProps) => <RaisedTabButton {...props} accessibilityLabel={t('courierUi.tabs.scan')} />, tabBarIcon: () => <RaisedScanIcon /> }}
        listeners={{ tabPress: (e) => { e.preventDefault(); router.push('/courier/scan') } }}
      />
      <Tabs.Screen name="earnings" options={{ title: t('courierUi.tabs.earnings'), tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: t('courierUi.tabs.profile'), tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} /> }} />
    </Tabs>
    {/* Every courier tab opens on the blue header; this fixed band keeps the
        status bar area filled while the screen content scrolls under it. */}
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: header.bg, zIndex: 10, elevation: 10 }} />
    </View>
  )
}
