import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, usePathname } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../store/auth'
import { useI18n, type TranslationKey } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, type Colors } from '../theme'

type NavItem = { key: TranslationKey; path: string; icon: keyof typeof Ionicons.glyphMap }

/** Mirrors web's SELLER_NAV in components/seller/SellerLayout.tsx: same items,
 *  same order, same icons, then Profile and Seller policy. This is the
 *  small-screen `.drawer.seller-drawer` the web opens from the menu button. */
const NAV: NavItem[] = [
  { key: 'seller.dashboard', path: '/seller', icon: 'grid-outline' },
  { key: 'seller.business', path: '/seller/business', icon: 'business-outline' },
  { key: 'seller.shops', path: '/seller/shops', icon: 'storefront-outline' },
  { key: 'seller.employees', path: '/seller/employees', icon: 'people-outline' },
  { key: 'seller.products', path: '/seller/products', icon: 'cube-outline' },
  { key: 'seller.stock', path: '/seller/stock', icon: 'layers-outline' },
  { key: 'seller.orders', path: '/seller/orders', icon: 'receipt-outline' },
  { key: 'seller.messages', path: '/seller/messages', icon: 'chatbubble-ellipses-outline' },
  { key: 'seller.notifications', path: '/seller/notifications', icon: 'notifications-outline' },
  { key: 'seller.customers', path: '/seller/customers', icon: 'person-circle-outline' },
  { key: 'seller.cash', path: '/seller/cash', icon: 'cash-outline' },
  { key: 'seller.growth', path: '/seller/growth', icon: 'trending-up-outline' },
  { key: 'seller.reviews', path: '/seller/reviews', icon: 'star-outline' },
]
/** web EMPLOYEE_NAV: an employee account only has its own workspace. */
const EMPLOYEE_NAV: NavItem[] = [
  { key: 'seller.dashboard', path: '/seller/employee', icon: 'grid-outline' },
]
const PINNED: NavItem[] = [
  { key: 'seller.profile', path: '/seller/profile', icon: 'settings-outline' },
  { key: 'seller.policy.navLabel', path: '/seller/policy', icon: 'shield-checkmark-outline' },
]

export function SellerDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const logout = useAuth((s) => s.logout)
  const isEmployee = useAuth((s) => s.user?.account_type === 'EMPLOYEE')

  const go = (path: string) => { onClose(); router.push(path as any) }

  // A plain conditionally-rendered overlay, not RN's <Modal>: toggling a
  // Modal's `visible` prop back to false reliably fails to hide it on web
  // (confirmed live -- onPress fires and state updates, the portal just
  // stays on screen), and since it's the same component that risk carries
  // over to the native build too. This overlay unmounts outright instead.
  if (!visible) return null
  const row = (item: NavItem) => {
    const active = item.path === '/seller' ? pathname === '/seller' : pathname.startsWith(item.path)
    return <Pressable key={item.path} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => go(item.path)} style={({ pressed }) => [styles.row, (pressed || active) && styles.rowActive]}>
      <Ionicons name={item.icon} size={18} color={colors.ink} />
      <Text style={styles.rowText}>{t(item.key)}</Text>
    </Pressable>
  }
  return <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('nav.closeMenu')}>
    <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()} accessibilityLabel={t('seller.menu')}>
      <View style={[styles.head, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.brand}>{isEmployee ? 'TBK Employee' : 'TBK Seller'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('nav.closeMenu')} onPress={onClose} hitSlop={8} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.onGreen} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 12 }]}>
        {(isEmployee ? EMPLOYEE_NAV : NAV).map(row)}
        {!isEmployee && PINNED.map(row)}
        <View style={styles.divider} />
        <Pressable accessibilityRole="button" onPress={() => go('/(buyer)')} style={({ pressed }) => [styles.row, pressed && styles.rowActive]}>
          <Text style={styles.rowText}>{t('nav.marketplace')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { onClose(); void logout(); router.replace('/(buyer)') }} style={styles.row}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.rowTextDanger}>{t('common.signOut')}</Text>
        </Pressable>
      </ScrollView>
    </Pressable>
  </Pressable>
}

// web: .drawer (surface panel, min(320px, 86vw)), .drawer-head (primary band,
// on-primary text), .drawer-nav a (12px 10px, radius 10, weight 600, text colour),
// .drawer-logout-btn (danger colour).
const makeStyles = (colors: Colors) => StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', zIndex: 70 },
  panel: { width: '86%', maxWidth: 320, backgroundColor: colors.white, height: '100%', boxShadow: '0px 10px 30px rgba(0,0,0,0.18)' },
  head: { paddingHorizontal: 16, paddingBottom: 16, backgroundColor: colors.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: colors.onGreen, fontWeight: '700', fontSize: 16 },
  close: { padding: 4 },
  list: { padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: radius.sm },
  rowActive: { backgroundColor: colors.surface2 },
  rowText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  rowTextDanger: { fontSize: 15, fontWeight: '600', color: colors.danger },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
})
