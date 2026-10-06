import { useMemo } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { buyerApi, authApi, courierApi } from '../../src/api'
import { fetchBuyerUnreadCounts } from '../../src/api/communication'
import { useFavorites } from '../../src/store/favorites'
import { AvatarPicker } from '../../src/components/AvatarPicker'
import { formatDate } from '../../src/lib/format'
import { useAuth } from '../../src/store/auth'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { Button, Loading } from '../../src/components/ui'
import { PreferenceToggles } from '../../src/components/PreferenceToggles'
import { spacing, type Colors, fonts, kicker, radius, shadow } from '../../src/theme'
import { canSell, canOnboardSeller } from '../../src/types'

// Port of web-app/src/pages/buyer/AccountPage.tsx at phone width: identity
// (avatar + Edit, name, email, contact, location, member since), then the
// points card, the orders / favorites / reviews / pending-purchases links and
// Sign out. Same three requests as web: /buyer/points, /buyer/purchases/pending,
// /buyer/orders. Presented as the reference "Mon compte" screen: navy header,
// grouped list cards with tinted icon tiles.

type IconName = keyof typeof Ionicons.glyphMap

/** Orders that no longer move (same set as the order history's polling rule). */
const TERMINAL_ORDER = ['COMPLETED', 'CANCELLED', 'REJECTED', 'RECEIVED']

export default function ProfileScreen() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const { t } = useI18n()
  const colors = useColors()
  const themed = useMemo(() => makeStyles(colors), [colors])
  const isBuyer = Boolean(user) && user?.account_type !== 'EMPLOYEE'
  const profile = useQuery({ queryKey: ['buyer', 'profile'], queryFn: buyerApi.profile, enabled: isBuyer })
  const points = useQuery({ queryKey: ['buyer', 'points'], queryFn: buyerApi.points, enabled: isBuyer })
  const pending = useQuery({ queryKey: ['buyer', 'purchases', 'pending'], queryFn: buyerApi.pendingPurchases, enabled: isBuyer })
  const orders = useQuery({ queryKey: ['buyer', 'orders'], queryFn: buyerApi.orders, enabled: isBuyer })
  // Same cache entry as the home header bell.
  const unread = useQuery({ queryKey: ['buyer', 'unread-counts'], queryFn: fetchBuyerUnreadCounts, enabled: isBuyer })
  const favoritesCount = useFavorites((state) => state.items.length)
  // Courier space is shown only when the backend recognises this account as a courier.
  const courierProfile = useQuery({ queryKey: ['courier', 'profile'], queryFn: courierApi.profile, enabled: Boolean(user), retry: false, staleTime: 5 * 60_000 })
  const becomeSeller = useMutation({ mutationFn: authApi.becomeSeller, onSuccess: async () => { await useAuth.getState().refresh(); router.push('/seller/onboarding') }, onError: () => Alert.alert(t('common.error'), t('seller.becomeFailed')) })

  if (!user) {
    return (
      <View style={[styles.center, themed.screen]}>
        <View style={themed.guestTile}><Ionicons name="person-outline" size={28} color={colors.onGreen} /></View>
        <Text style={themed.title}>{t('profile.yourAccount')}</Text>
        <Text style={themed.muted}>{t('profile.signInPrompt')}</Text>
        <Button title={t('common.signIn')} onPress={() => router.push('/auth/login')} />
        <Button title={t('auth.createAccount')} variant="outline" onPress={() => router.push('/auth/register-choice')} />
        <PreferenceToggles />
      </View>
    )
  }

  // web: one LoadingBlock until all three requests settle
  if (isBuyer && (profile.isLoading || points.isLoading || pending.isLoading || orders.isLoading)) return <Loading label={t('account.loadingPage')} />

  const p = profile.data
  const pts = points.data
  const pendingList = pending.data ?? []
  const orderList = Array.isArray(orders.data) ? orders.data : []
  const fullName = `${p?.first_name ?? user.first_name ?? ''} ${p?.last_name ?? user.last_name ?? ''}`.trim()
  const hasStructuredAddress = Boolean(p?.commune || p?.city || p?.province)
  const available = pts?.available_points ?? 0
  // The orders tile badge counts what is still in progress, not the whole history.
  const activeOrders = orderList.filter((o) => !TERMINAL_ORDER.includes(o.status)).length
  const unreadNotifications = unread.data?.unread_notifications ?? 0

  const initialsLabel = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  const addressLine = hasStructuredAddress
    ? [[p?.street, p?.building_number].filter(Boolean).join(', ') || p?.address, p?.commune].filter(Boolean).join(' · ')
    : p?.address || t('account.noAddress')
  const openShop = () => {
    if (canSell(user)) router.push('/seller')
    else if (canOnboardSeller(user)) router.push('/seller/onboarding')
    else if (!becomeSeller.isPending) becomeSeller.mutate()
  }

  return (
    <ScrollView style={themed.screen} contentContainerStyle={styles.page}>
      {/* ── Navy account header ── */}
      <View style={themed.hero}>
        <View style={styles.heroRow}>
          <AvatarPicker size={52} name={fullName || initialsLabel} />
          <View style={styles.flex1}>
            <Text style={themed.name} numberOfLines={1}>{fullName}</Text>
            <Text style={themed.heroSub} numberOfLines={1}>{p?.phone || user.phone || (p?.email ?? user.email)}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.edit')} onPress={() => router.push('/profile-edit')} style={({ pressed }) => [themed.editButton, pressed && styles.pressed]} hitSlop={8}>
            <Ionicons name="pencil" size={15} color={colors.onNavy} />
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        {/* ── Quick tiles, lifted over the header ── */}
        <View style={[styles.tiles, styles.overlap]}>
          <QuickTile icon="cube-outline" label={t('account.tileOrders')} badge={activeOrders || undefined} onPress={() => router.push('/orders')} themed={themed} colors={colors} />
          <QuickTile icon="heart-outline" label={t('account.tileFavorites')} badge={favoritesCount || undefined} onPress={() => router.push('/(buyer)/favorites')} themed={themed} colors={colors} />
          <QuickTile active icon="storefront-outline" label={becomeSeller.isPending ? t('common.oneMoment') : t('account.tileShop')} onPress={openShop} themed={themed} colors={colors} />
        </View>

        {/* ── Points ── */}
        <View style={themed.card}>
          <View style={styles.rowBetween}>
            <View style={styles.flex1}>
              <Text style={themed.eyebrow}>{t('points.myPoints')}</Text>
              <Text style={themed.pointsTitle}>{t('points.available', { count: available.toLocaleString() })}</Text>
            </View>
            <Pressable accessibilityRole="link" onPress={() => router.push('/points')}><Text style={themed.sectionLink}>{t('points.viewHistory')} →</Text></Pressable>
          </View>
          <View style={styles.pointsGrid}>
            <PointsCell label={t('points.availableLabel')} value={available.toLocaleString()} themed={themed} />
            <PointsCell label={t('points.reserved')} value={(pts?.reserved_points ?? 0).toLocaleString()} themed={themed} />
            <PointsCell label={t('points.lifetimeEarned')} value={(pts?.lifetime_points ?? 0).toLocaleString()} themed={themed} />
            <PointsCell label={t('points.level')} value={pts?.level ?? '—'} themed={themed} />
          </View>
          {available === 0 ? <Text style={themed.small}>{t('points.earnByPurchase')}</Text> : null}
        </View>

        {/* ── MON COMPTE ── */}
        <Text style={themed.sectionKicker}>{t('account.kickerAccount')}</Text>
        <View style={themed.group}>
          <LinkRow first icon="location-outline" onPress={() => router.push('/addresses')} title={t('account.myAddresses')} sub={addressLine} themed={themed} colors={colors} />
          <LinkRow icon="receipt-outline" onPress={() => router.push('/orders')} title={t('account.myOrders')}
            sub={[t('account.ordersCount', { count: orderList.length }), orderList[0] ? t('account.lastOrder', { date: formatDate(orderList[0].created_at) }) : ''].filter(Boolean).join(' · ')} themed={themed} colors={colors} />
          <LinkRow icon="star-outline" onPress={() => router.push('/reviews')} title={t('account.myReviews')} sub={t('account.reviewsSubtitle')} themed={themed} colors={colors} />
          {pendingList.length > 0 ? <LinkRow icon="time-outline" onPress={() => router.push('/purchases')} title={t('account.pendingPurchases')} sub={t('account.pendingToConfirm', { count: pendingList.length })} themed={themed} colors={colors} /> : null}
          <LinkRow icon="mail-unread-outline" onPress={() => router.push('/notifications')} title={t('notifications.title')} sub={unreadNotifications > 0 ? t('notifications.unreadCount', { count: unreadNotifications }) : undefined} themed={themed} colors={colors} />
          <LinkRow icon="notifications-outline" onPress={() => router.push('/notification-settings')} title={t('notifSettings.title')} themed={themed} colors={colors} />
          <LinkRow icon="storefront-outline" onPress={openShop} title={t('profile.sellerAccount')}
            sub={canSell(user) ? t('profile.openSellerSpace') : canOnboardSeller(user) ? t('seller.finishSetup') : becomeSeller.isPending ? t('common.oneMoment') : t('profile.createSellerAccount')} themed={themed} colors={colors} />
          {user.account_type === 'EMPLOYEE' ? <LinkRow icon="briefcase-outline" onPress={() => router.push('/seller/employee')} title={t('nav.workspace')} sub={t('employee.dashboard.title')} themed={themed} colors={colors} /> : null}
          {courierProfile.data ? <LinkRow icon="bicycle-outline" onPress={() => router.push('/courier')} title={t('courier.spaceTitle')} themed={themed} colors={colors} /> : null}
        </View>

        {/* ── Contact details (from the old identity card) ── */}
        <View style={themed.card}>
          <Text style={themed.eyebrow}>{t('account.contact')}</Text>
          <View>
            <InfoRow k={t('auth.email')} v={p?.email ?? user.email} themed={themed} />
            <InfoRow k={t('account.primary')} v={p?.phone || '—'} themed={themed} />
            <InfoRow k={t('account.backup')} v={p?.backup_phone || '—'} themed={themed} />
            <InfoRow k={t('common.memberSince')} v={formatDate(user.created_at)} themed={themed} last />
          </View>
        </View>

        <PreferenceToggles />

        {/* ── AIDE ── */}
        <Text style={themed.sectionKicker}>{t('account.kickerHelp')}</Text>
        <View style={themed.group}>
          <LinkRow first icon="chatbox-ellipses-outline" onPress={() => router.push('/help' as never)} title={t('account.help')} themed={themed} colors={colors} />
          <Pressable accessibilityRole="button" style={({ pressed }) => [themed.row, themed.rowDivider, pressed && themed.rowPressed]} onPress={async () => { await logout(); router.replace('/auth/login') }}>
            <View style={[themed.iconTile, themed.dangerTile]}><Ionicons name="log-out-outline" size={17} color={colors.danger} /></View>
            <Text style={themed.dangerButtonText}>{t('common.signOut')}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

type Themed = ReturnType<typeof makeStyles>

function InfoRow({ k, v, themed, last }: { k: string; v: string; themed: Themed; last?: boolean }) {
  return <View style={[themed.infoRow, last && themed.infoRowLast]}><Text style={themed.infoK}>{k}</Text><Text style={themed.infoV}>{v}</Text></View>
}

function PointsCell({ label, value, themed }: { label: string; value: string; themed: Themed }) {
  return <View style={themed.pointsCell}><Text style={themed.pointsCellLabel} numberOfLines={2}>{label}</Text><Text style={themed.pointsCellValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text></View>
}

function QuickTile({ icon, label, onPress, active, badge, themed, colors }: { icon: IconName; label: string; onPress: () => void; active?: boolean; badge?: number; themed: Themed; colors: Colors }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [themed.tile, active && themed.tileActive, pressed && styles.pressed]}>
    <View>
      <Ionicons name={icon} size={22} color={active ? colors.onGreen : colors.green} />
      {badge ? <View style={themed.tileBadge}><Text style={themed.tileBadgeText}>{badge > 99 ? '99+' : badge}</Text></View> : null}
    </View>
    <Text style={[themed.tileLabel, active && themed.tileLabelActive]} numberOfLines={1}>{label}</Text>
  </Pressable>
}

function LinkRow({ icon, title, sub, onPress, themed, colors, first }: { icon: IconName; title: string; sub?: string; onPress: () => void; themed: Themed; colors: Colors; first?: boolean }) {
  return <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [themed.row, !first && themed.rowDivider, pressed && themed.rowPressed]}>
    <View style={themed.iconTile}><Ionicons name={icon} size={17} color={colors.green} /></View>
    <View style={styles.flex1}>
      <Text style={themed.bold}>{title}</Text>
      {sub ? <Text style={themed.rowSub} numberOfLines={1}>{sub}</Text> : null}
    </View>
    <Ionicons name="chevron-forward" size={18} color={colors.faint} />
  </Pressable>
}

/** Colour-bearing styles are rebuilt per theme; layout-only rules stay static
 *  in `styles` below so they are created once. */
const makeStyles = (c: Colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.cream },
    guestTile: { alignSelf: 'center', width: 60, height: 60, borderRadius: radius.md, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', ...shadow.raised },
    title: { fontSize: 24, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3, color: c.ink, textAlign: 'center' },
    muted: { color: c.muted, textAlign: 'center', lineHeight: 21 },
    small: { color: c.muted, fontSize: 13, lineHeight: 19 },
    bold: { color: c.ink, fontWeight: '600', fontSize: 14 },
    // Navy header (dark in both themes)
    hero: { backgroundColor: c.navy, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 52 },
    name: { fontSize: 19, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.2, color: c.onNavy, lineHeight: 24 },
    heroSub: { color: c.onNavyMuted, fontSize: 13, marginTop: 2 },
    editButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: c.navySoft, borderWidth: 1, borderColor: c.navyLine },
    tile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 16, backgroundColor: c.white, borderWidth: 1, borderColor: c.border, ...shadow.card },
    tileActive: { backgroundColor: c.green, borderColor: c.green, ...shadow.raised },
    tileLabel: { color: c.ink, fontSize: 12, fontWeight: '600' },
    tileLabelActive: { color: c.onGreen },
    tileBadge: { position: 'absolute', top: -6, right: -12, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
    tileBadgeText: { color: c.onGreen, fontSize: 10, fontWeight: '700' },
    sectionKicker: { ...kicker, color: c.muted, marginTop: 6, marginLeft: 4 },
    card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 16, gap: 14, ...shadow.card },
    eyebrow: { ...kicker, color: c.muted, marginBottom: 6 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
    infoRowLast: { borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 14, paddingBottom: 0 },
    infoK: { color: c.muted, fontSize: 13 },
    infoV: { color: c.ink, fontSize: 13, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
    pointsTitle: { color: c.ink, fontSize: 20, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3 },
    sectionLink: { color: c.green, fontSize: 13, fontWeight: '600' },
    pointsCell: { flex: 1, minWidth: 0, gap: 4, padding: 10, borderRadius: radius.sm, backgroundColor: c.greenSoft },
    pointsCellLabel: { color: c.muted, fontSize: 11 },
    pointsCellValue: { color: c.green, fontSize: 16, fontWeight: '700' },
    // Grouped list card: tinted icon tiles + chevrons
    group: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 18, overflow: 'hidden', ...shadow.card },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
    rowDivider: { borderTopWidth: 1, borderTopColor: c.border },
    rowPressed: { backgroundColor: c.surface2 },
    iconTile: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
    dangerTile: { backgroundColor: c.dangerSoft },
    rowSub: { color: c.muted, fontSize: 12, marginTop: 1 },
    dangerButtonText: { flex: 1, color: c.danger, fontWeight: '600', fontSize: 14 },
  })

const styles = StyleSheet.create({
  page: { paddingBottom: 48 },
  body: { paddingHorizontal: 16, gap: 12 },
  overlap: { marginTop: -34 },
  tiles: { flexDirection: 'row', gap: 10 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  flex1: { flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pointsGrid: { flexDirection: 'row', gap: 8 },
  pressed: { opacity: 0.8 },
})
