import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, usePathname } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../store/auth'
import { useI18n, type TranslationKey } from '../store/i18n'
import { useColors } from '../store/theme'
import { fonts, radius, type Colors } from '../theme'

/** Sign-out red readable on navy (4.5:1). */
const DOCKED_DANGER = '#FF9A92'

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

/** `docked`: large screens, where the same navigation stays open as the left
 *  sidebar of the seller space (web's `.seller-sidebar`), content on the right. */
export function SellerDrawer({ visible, onClose, docked = false }: { visible: boolean; onClose: () => void; docked?: boolean }) {
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
  if (!visible && !docked) return null
  const row = (item: NavItem) => {
    const active = item.path === '/seller' ? pathname === '/seller' : pathname.startsWith(item.path)
    // Docked (large screens): light text on the navy sidebar, the open page in blue.
    return <Pressable key={item.path} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => go(item.path)} style={({ pressed }) => [styles.row, pressed && (docked ? styles.dRowPressed : styles.rowPressed), active && (docked ? styles.dRowActive : styles.rowActive)]}>
      <View style={[styles.rowIcon, docked && styles.dRowIcon, active && (docked ? styles.dRowIconActive : styles.rowIconActive)]}><Ionicons name={item.icon} size={17} color={active ? colors.onGreen : docked ? colors.cyan : colors.green} /></View>
      <Text style={[styles.rowText, docked && styles.dRowText, active && (docked ? styles.dRowTextActive : styles.rowTextActive)]}>{t(item.key)}</Text>
    </Pressable>
  }
  const panel = <>
      <View style={[styles.head, { paddingTop: insets.top + 16 }]}>
        <View style={styles.brandRow}>
          <View style={styles.brandTile}><Ionicons name="storefront-outline" size={18} color={colors.onGreen} /></View>
          <Text style={styles.brand}>{isEmployee ? t('sellerDrawer.brandEmployee') : 'TBK Seller'}</Text>
        </View>
        {docked ? null : <Pressable accessibilityRole="button" accessibilityLabel={t('nav.closeMenu')} onPress={onClose} hitSlop={8} style={styles.close}>
          <Ionicons name="close" size={20} color={colors.onNavy} />
        </Pressable>}
      </View>
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 12 }]}>
        {(isEmployee ? EMPLOYEE_NAV : NAV).map(row)}
        {!isEmployee && PINNED.map(row)}
        <View style={[styles.divider, docked && styles.dDivider]} />
        <Pressable accessibilityRole="button" onPress={() => go('/')} style={({ pressed }) => [styles.row, pressed && (docked ? styles.dRowPressed : styles.rowPressed)]}>
          <View style={[styles.rowIcon, docked && styles.dRowIcon]}><Ionicons name="bag-handle-outline" size={17} color={docked ? colors.cyan : colors.green} /></View>
          <Text style={[styles.rowText, docked && styles.dRowText]}>{t('nav.marketplace')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { onClose(); void logout(); router.replace('/') }} style={({ pressed }) => [styles.row, pressed && (docked ? styles.dRowPressed : styles.rowPressed)]}>
          <View style={[styles.rowIcon, docked ? styles.dRowIcon : styles.rowIconDanger]}><Ionicons name="log-out-outline" size={17} color={docked ? DOCKED_DANGER : colors.danger} /></View>
          <Text style={[styles.rowTextDanger, docked && styles.dRowTextDanger]}>{t('common.signOut')}</Text>
        </Pressable>
      </ScrollView>
  </>
  if (docked) return <View style={styles.sidebar} accessibilityLabel={t('seller.menu')}>{panel}</View>
  return <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('nav.closeMenu')}>
    <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()} accessibilityLabel={t('seller.menu')}>
      {panel}
    </Pressable>
  </Pressable>
}

// web: .drawer (surface panel, min(320px, 86vw)), .drawer-head (primary band,
// on-primary text), .drawer-nav a (12px 10px, radius 10, weight 600, text colour),
// .drawer-logout-btn (danger colour).
const makeStyles = (colors: Colors) => StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', zIndex: 70 },
  // Docked sidebar: navy ("bleu de nuit") in both themes, like the seller header.
  sidebar: { width: 258, height: '100%', backgroundColor: colors.navy, borderRightWidth: 1, borderRightColor: colors.navyLine },
  dRowPressed: { backgroundColor: colors.navySoft },
  dRowActive: { backgroundColor: colors.green },
  dRowIcon: { backgroundColor: colors.navySoft },
  dRowIconActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  dRowText: { color: colors.onNavyMuted },
  dRowTextActive: { color: colors.onGreen, fontWeight: '700' },
  dRowTextDanger: { color: DOCKED_DANGER },
  dDivider: { backgroundColor: colors.navyLine },
  panel: { width: '86%', maxWidth: 320, backgroundColor: colors.white, height: '100%', boxShadow: '0px 10px 30px rgba(0,0,0,0.18)' },
  // Navy hero band like the seller header (reference 6).
  head: { paddingHorizontal: 16, paddingBottom: 18, backgroundColor: colors.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  brandTile: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  brand: { color: colors.onNavy, fontFamily: fonts.display, fontWeight: '700', fontSize: 17, letterSpacing: -0.2, flexShrink: 1 },
  close: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.navySoft, borderWidth: 1, borderColor: colors.navyLine, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 8, borderRadius: radius.sm },
  rowPressed: { backgroundColor: colors.surface2 },
  rowActive: { backgroundColor: colors.greenSoft },
  rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  rowIconActive: { backgroundColor: colors.green },
  rowIconDanger: { backgroundColor: colors.dangerSoft },
  rowText: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
  rowTextActive: { color: colors.green, fontWeight: '700' },
  rowTextDanger: { fontSize: 14.5, fontWeight: '600', color: colors.danger },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
})
