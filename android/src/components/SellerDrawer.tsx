import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../store/auth'
import { useI18n, type TranslationKey } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, spacing, type Colors } from '../theme'

/** Mirrors web's SELLER_NAV in components/seller/SellerLayout.tsx: same items,
 *  same order, Profile and Seller policy pinned at the bottom. This is the
 *  mobile equivalent of that persistent sidebar -- reached via a menu button
 *  on every seller screen instead of always being on-screen. */
const NAV: { key: TranslationKey; path: string }[] = [
  { key: 'seller.dashboard', path: '/seller' },
  { key: 'seller.business', path: '/seller/business' },
  { key: 'seller.shops', path: '/seller/shops' },
  { key: 'seller.employees', path: '/seller/employees' },
  { key: 'seller.products', path: '/seller/products' },
  { key: 'seller.stock', path: '/seller/stock' },
  { key: 'seller.orders', path: '/seller/orders' },
  { key: 'seller.customers', path: '/seller/customers' },
  { key: 'seller.cash', path: '/seller/cash' },
  { key: 'seller.growth', path: '/seller/growth' },
  { key: 'seller.reviews', path: '/seller/reviews' },
]
const PINNED: { key: TranslationKey; path: string }[] = [
  { key: 'seller.profile', path: '/seller/profile' },
  { key: 'seller.policy.navLabel', path: '/seller/policy' },
]

export function SellerDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const logout = useAuth((s) => s.logout)

  const go = (path: string) => { onClose(); router.push(path as any) }

  // A plain conditionally-rendered overlay, not RN's <Modal>: toggling a
  // Modal's `visible` prop back to false reliably fails to hide it on web
  // (confirmed live -- onPress fires and state updates, the portal just
  // stays on screen), and since it's the same component that risk carries
  // over to the native build too. This overlay unmounts outright instead.
  if (!visible) return null
  return <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('nav.closeMenu')}>
    <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
      <View style={styles.head}><Text style={styles.brand}>TBK Seller</Text><Text style={styles.sub}>{t('seller.workspace')}</Text></View>
      <ScrollView contentContainerStyle={styles.list}>
        {NAV.map((item) => <Pressable key={item.path} accessibilityRole="button" onPress={() => go(item.path)} style={styles.row}><Text style={styles.rowText}>{t(item.key)}</Text></Pressable>)}
        <View style={styles.divider} />
        {PINNED.map((item) => <Pressable key={item.path} accessibilityRole="button" onPress={() => go(item.path)} style={styles.row}><Text style={styles.rowText}>{t(item.key)}</Text></Pressable>)}
        <View style={styles.divider} />
        <Pressable accessibilityRole="button" onPress={() => go('/(buyer)')} style={styles.row}><Text style={styles.rowText}>{t('common.backToMarketplace')}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => { onClose(); void logout(); router.replace('/(buyer)') }} style={styles.row}><Text style={styles.rowTextDanger}>{t('common.signOut')}</Text></Pressable>
      </ScrollView>
    </Pressable>
  </Pressable>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' },
  panel: { width: '78%', maxWidth: 320, backgroundColor: colors.white, height: '100%' },
  head: { backgroundColor: colors.green, padding: spacing.md, paddingTop: spacing.xl },
  brand: { color: colors.white, fontWeight: '900', fontSize: 20 },
  sub: { color: colors.white, opacity: 0.85, marginTop: 2 },
  list: { padding: spacing.sm },
  row: { paddingVertical: 14, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  rowText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  rowTextDanger: { fontSize: 16, fontWeight: '700', color: colors.danger },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
})
