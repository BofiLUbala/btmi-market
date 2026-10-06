import { useEffect, useState } from 'react'
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native'
import { Stack, router, usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { useCart } from '../../src/store/cart'
import { useColors } from '../../src/store/theme'
import { useI18n } from '../../src/store/i18n'
import { shadow, type Colors } from '../../src/theme'
import { SellerDrawer } from '../../src/components/SellerDrawer'
import { SellerHeader } from '../../src/components/SellerHeader'

/** Mirrors web's `loadShops` effect: whenever the active business's shop
 *  list is known and the persisted `activeShop` isn't one of them (first
 *  visit, or the stored shop was deleted), fall back to the first shop.
 *  Runs at the layout level so every seller screen gets a resolved
 *  `activeShop` on direct navigation, not just after visiting the Dashboard. */
function useAutoSelectShop() {
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const activeShop = useAuth((s) => s.activeShop)
  const setActiveShop = useAuth((s) => s.setActiveShop)
  const shops = useQuery({ queryKey: ['seller', 'shops', activeBusiness?.id], queryFn: () => sellerApi.shops(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  useEffect(() => {
    if (!shops.data?.length) return
    if (!activeShop || !shops.data.some((s) => s.id === activeShop)) setActiveShop(shops.data[0].id)
  }, [shops.data, activeShop, setActiveShop])
}

/** Hidden while the keyboard is up, like the buyer tab bar (`tabBarHideOnKeyboard`). */
function useKeyboardVisible() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false))
    return () => { show.remove(); hide.remove() }
  }, [])
  return visible
}

/** The buyer app's bottom bar (reference 6): Accueil, Catégories, raised
 *  "Vendre", Commandes, Panier. The seller space is the "Vendre" side, so that
 *  entry shows active here; the others jump back to the buyer tabs. It is a
 *  plain bar under the seller Stack, so the seller navigation is untouched. */
function SellerTabBar() {
  const colors = useColors()
  const styles = makeStyles(colors)
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const cartCount = useCart((state) => state.lines.reduce((sum, line) => sum + line.quantity, 0))

  const item = (icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, badge?: number) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.item}>
      <View>
        <Ionicons name={icon} size={22} color={colors.mutedLight} />
        {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text></View> : null}
      </View>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </Pressable>
  )

  return <View style={[styles.bar, { height: 70 + insets.bottom, paddingBottom: Math.max(insets.bottom, 6) }]}>
    {item('home-outline', t('nav.home'), () => router.navigate('/(buyer)'))}
    {item('grid-outline', t('nav.categories'), () => router.navigate('/(buyer)/categories'))}
    <Pressable accessibilityRole="button" accessibilityState={{ selected: true }} accessibilityLabel={t('nav.sell')} onPress={() => router.push('/seller/products/create')} style={styles.item}>
      <View style={[styles.raised, shadow.raised]}><Ionicons name="add" size={26} color={colors.onGreen} /></View>
      <Text style={[styles.label, styles.labelActive]} numberOfLines={1}>{t('nav.sell')}</Text>
    </Pressable>
    {item('cube-outline', t('nav.orders'), () => router.navigate('/(buyer)/my-orders'))}
    {item('bag-handle-outline', t('nav.cart'), () => router.navigate('/(buyer)/cart'), cartCount)}
  </View>
}

export default function SellerLayout() {
  const colors = useColors()
  useAutoSelectShop()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const keyboardVisible = useKeyboardVisible()
  // The publish form (reference 10) carries its own bottom action bar instead.
  const showTabBar = !keyboardVisible && pathname !== '/seller/products/create'
  return <View style={{ flex: 1, backgroundColor: colors.cream }}>
    {/* The seller header is navy in both themes, so the status bar icons are
     *  light here; the root's theme-driven style returns when this unmounts. */}
    <StatusBar style="light" />
    {/* Shared navy header (menu, notifications, preferences, business/shop
     *  switchers); each screen renders its own title in its content. */}
    <SellerHeader onOpenMenu={() => setDrawerOpen(true)} />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }} />
    {showTabBar ? <SellerTabBar /> : null}
    <SellerDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
  </View>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 8, backgroundColor: c.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, ...shadow.card },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  label: { fontSize: 10.5, fontWeight: '600', color: c.mutedLight, marginTop: 2 },
  labelActive: { color: c.green },
  raised: { width: 52, height: 52, borderRadius: 26, marginTop: -26, backgroundColor: c.green, borderWidth: 4, borderColor: c.white, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -10, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: c.onGreen, fontSize: 10, fontWeight: '700' },
})
