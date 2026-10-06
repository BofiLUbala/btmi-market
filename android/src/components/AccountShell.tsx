import { useMemo, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router, useLocalSearchParams, usePathname } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { buyerApi } from '../api'
import { fetchBuyerUnreadCounts } from '../api/communication'
import { useAuth } from '../store/auth'
import { useColors } from '../store/theme'
import { useI18n, type TranslationKey } from '../store/i18n'
import { canBuy, canSell } from '../types'
import { radius, type Colors } from '../theme'

type Item = { key: TranslationKey; path: string; match: string; icon: keyof typeof Ionicons.glyphMap }

const ITEMS: Item[] = [
  { key: 'nav.account', path: '/(buyer)/profile', match: '/profile', icon: 'grid-outline' },
  { key: 'account.myOrders', path: '/orders', match: '/orders', icon: 'receipt-outline' },
  { key: 'track.title', path: '/tracking', match: '/tracking', icon: 'navigate-outline' },
  { key: 'account.myAddresses', path: '/addresses', match: '/addresses', icon: 'location-outline' },
  { key: 'nav.favorites', path: '/(buyer)/favorites', match: '/favorites', icon: 'heart-outline' },
  { key: 'account.myReviews', path: '/reviews', match: '/reviews', icon: 'star-outline' },
  { key: 'accountNav.points', path: '/points', match: '/points', icon: 'gift-outline' },
  { key: 'accountNav.pending', path: '/purchases', match: '/purchases', icon: 'time-outline' },
  { key: 'notifications.title', path: '/notifications', match: '/notifications', icon: 'notifications-outline' },
  { key: 'notifSettings.title', path: '/notification-settings', match: '/notification-settings', icon: 'options-outline' },
  { key: 'account.help', path: '/help', match: '/help', icon: 'chatbox-ellipses-outline' },
]

/**
 * Buyer account pages on large screens (>= 900 px): the account features in a
 * navy column on the left, the open page on the right (same layout as the
 * seller space). Phones and small screens get the page alone.
 */
export function AccountShell({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions()
  const user = useAuth((s) => s.user)
  const { space } = useLocalSearchParams<{ space?: string }>()
  // The settings screen is shared by every space: only the buyer one gets it.
  if (width < 900 || !user || (space && space !== 'buyer')) return <>{children}</>
  return <View style={{ flex: 1, flexDirection: 'row' }}>
    <AccountSidebar />
    <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
  </View>
}

function AccountSidebar() {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const { t } = useI18n()
  const pathname = usePathname()
  const user = useAuth((st) => st.user)
  const logout = useAuth((st) => st.logout)
  const isBuyer = Boolean(user) && canBuy(user)
  const profile = useQuery({ queryKey: ['buyer', 'profile'], queryFn: buyerApi.profile, enabled: isBuyer })
  const points = useQuery({ queryKey: ['buyer', 'points'], queryFn: buyerApi.points, enabled: isBuyer })
  const unread = useQuery({ queryKey: ['buyer', 'unread-counts'], queryFn: fetchBuyerUnreadCounts, enabled: isBuyer, refetchInterval: 60_000 })
  const unreadNotifications = unread.data?.unread_notifications ?? 0
  const first = profile.data?.first_name ?? user?.first_name ?? ''
  const last = profile.data?.last_name ?? user?.last_name ?? ''
  const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || 'TBK'

  const row = (item: Item) => {
    const active = pathname === item.match || pathname.startsWith(`${item.match}/`)
    const badge = item.match === '/notifications' ? unreadNotifications : 0
    return <Pressable key={item.path} accessibilityRole="link" accessibilityState={{ selected: active }} onPress={() => router.navigate(item.path as never)} style={({ pressed }) => [s.row, pressed && s.rowPressed, active && s.rowActive]}>
      <View style={[s.icon, active && s.iconActive]}><Ionicons name={item.icon} size={17} color={active ? c.onGreen : c.cyan} /></View>
      <Text style={[s.text, active && s.textActive]} numberOfLines={1}>{t(item.key)}</Text>
      {badge > 0 ? <View style={s.badge}><Text style={s.badgeText}>{badge > 99 ? '99+' : badge}</Text></View> : null}
    </Pressable>
  }

  return <View style={s.sidebar}>
    <View style={s.head}>
      <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.name} numberOfLines={1}>{`${first} ${last}`.trim()}</Text>
        <Text style={s.sub} numberOfLines={1}>{profile.data?.phone || user?.email}</Text>
      </View>
    </View>
    <View style={s.chips}>
      <Text style={[s.chip, s.chipLevel]}>{points.data?.level ?? 'BRONZE'}</Text>
      <Text style={s.chip}>{`${(points.data?.available_points ?? 0).toLocaleString()} pts`}</Text>
    </View>
    <ScrollView contentContainerStyle={s.list}>
      {ITEMS.map(row)}
      {canSell(user) ? row({ key: 'profile.openSellerSpace', path: '/seller', match: '/seller', icon: 'storefront-outline' }) : null}
      <View style={s.divider} />
      <Pressable accessibilityRole="button" onPress={async () => { await logout(); router.replace('/auth/login') }} style={({ pressed }) => [s.row, pressed && s.rowPressed]}>
        <View style={s.icon}><Ionicons name="log-out-outline" size={17} color={DANGER_ON_NAVY} /></View>
        <Text style={[s.text, { color: DANGER_ON_NAVY }]}>{t('common.signOut')}</Text>
      </Pressable>
    </ScrollView>
  </View>
}

/** Sign-out red readable on navy (4.5:1). */
const DANGER_ON_NAVY = '#FF9A92'

const makeStyles = (c: Colors) => StyleSheet.create({
  sidebar: { width: 272, backgroundColor: c.navy, borderRightWidth: 1, borderRightColor: c.navyLine },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.onGreen, fontSize: 17, fontWeight: '800' },
  name: { color: c.onNavy, fontSize: 16, fontWeight: '700' },
  sub: { color: c.onNavyMuted, fontSize: 13 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.navyLine },
  chip: { color: c.onNavyMuted, fontSize: 12, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: c.navySoft, borderWidth: 1, borderColor: c.navyLine, overflow: 'hidden' },
  chipLevel: { color: c.cyan, fontWeight: '700' },
  list: { padding: 12, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingVertical: 6, paddingHorizontal: 8, borderRadius: radius.sm },
  rowPressed: { backgroundColor: c.navySoft },
  rowActive: { backgroundColor: c.green },
  icon: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.navySoft, alignItems: 'center', justifyContent: 'center' },
  iconActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  text: { flex: 1, fontSize: 14.5, fontWeight: '600', color: c.onNavyMuted },
  textActive: { color: c.onGreen, fontWeight: '700' },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: c.cyan, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: c.navy, fontSize: 12, fontWeight: '800' },
  divider: { height: 1, backgroundColor: c.navyLine, marginVertical: 8 },
})
