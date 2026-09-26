import { useMemo } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { buyerApi, authApi, courierApi } from '../../src/api'
import { AvatarPicker } from '../../src/components/AvatarPicker'
import { formatDate } from '../../src/lib/format'
import { useAuth } from '../../src/store/auth'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { Button, Loading } from '../../src/components/ui'
import { PreferenceToggles } from '../../src/components/PreferenceToggles'
import { spacing, type Colors } from '../../src/theme'
import { canSell, canOnboardSeller } from '../../src/types'

// Port of web-app/src/pages/buyer/AccountPage.tsx at phone width, where its
// `.order-summary-grid` collapses to one column: identity card (avatar + Edit,
// name, email, contact, location, member since), then the points card, the
// orders / favorites / reviews / pending-purchases cards and Sign out. Same
// three requests as web: /buyer/points, /buyer/purchases/pending, /buyer/orders.

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
  // Courier space is shown only when the backend recognises this account as a courier.
  const courierProfile = useQuery({ queryKey: ['courier', 'profile'], queryFn: courierApi.profile, enabled: Boolean(user), retry: false, staleTime: 5 * 60_000 })
  const becomeSeller = useMutation({ mutationFn: authApi.becomeSeller, onSuccess: async () => { await useAuth.getState().refresh(); router.push('/seller/onboarding') }, onError: () => Alert.alert(t('common.error'), t('seller.becomeFailed')) })

  if (!user) {
    return (
      <View style={styles.center}>
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

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {/* ── Identity card ── */}
      <View style={themed.card}>
        <View style={styles.rowBetween}>
          <AvatarPicker size={56} name={fullName} />
          <Button dense variant="outline" title={t('common.edit')} onPress={() => router.push('/profile-edit')} />
        </View>
        <View>
          <Text style={themed.name}>{p?.first_name} {p?.last_name}</Text>
          <Text style={themed.small}>{p?.email ?? user.email}</Text>
        </View>
        <View style={themed.contactBlock}>
          <Text style={themed.eyebrow}>{t('account.contact')}</Text>
          <InfoRow k={t('account.primary')} v={p?.phone || '—'} themed={themed} />
          <InfoRow k={t('account.backup')} v={p?.backup_phone || '—'} themed={themed} />
        </View>
        <View style={themed.contactBlock}>
          <Text style={themed.eyebrow}>{t('account.location')}</Text>
          {hasStructuredAddress ? <>
            <Text style={themed.address}>{[p?.street, p?.building_number].filter(Boolean).join(', ') || p?.address || t('account.noAddress')}</Text>
            <Text style={themed.small}>{[p?.commune, p?.city, p?.province].filter(Boolean).join(', ')}</Text>
            {p?.landmark ? <Text style={themed.small}>Point de repère : {p.landmark}</Text> : null}
          </> : <>
            <Text style={themed.address}>{p?.address || t('account.noAddress')}</Text>
            <Text style={themed.small}>{[p?.commune, p?.city, p?.country].filter(Boolean).join(', ') || t('account.noLocation')}</Text>
          </>}
          {p?.latitude != null && p?.longitude != null ? <Text style={[themed.small, { marginTop: 4 }]}>📍 GPS: {p.latitude}, {p.longitude}</Text> : null}
        </View>
        <InfoRow k={t('common.memberSince')} v={formatDate(user.created_at)} themed={themed} />
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
          <PointsCell label={t('points.level')} value={pts?.level ?? 'BRONZE'} themed={themed} />
        </View>
        {available === 0 ? <Text style={[themed.small, { marginTop: 14 }]}>{t('points.earnByPurchase')}</Text> : null}
      </View>

      {/* ── Link cards ── */}
      <LinkCard onPress={() => router.push('/orders')} label={t('account.myOrders')} title={t('account.ordersCount', { count: orderList.length })}
        sub={orderList[0] ? t('account.lastOrder', { date: formatDate(orderList[0].created_at) }) : undefined} cta={`${t('common.viewAll')} →`} themed={themed} />
      <LinkCard onPress={() => router.push('/favorites')} label={t('nav.favorites')} title={t('account.savedProducts')} cta={`${t('common.view')} →`} themed={themed} />
      <LinkCard onPress={() => router.push('/reviews')} label={t('account.myReviews')} title={t('account.reviewsSubtitle')} cta={`${t('common.view')} →`} themed={themed} />
      {pendingList.length > 0 ? <LinkCard onPress={() => router.push('/purchases')} label={t('account.pendingPurchases')} title={t('account.pendingToConfirm', { count: pendingList.length })} cta={`${t('account.reviewPending')} →`} themed={themed} /> : null}

      {/* ── What web reaches from its header and drawer (notifications bell,
           seller hub, courier space, language/theme) lives here on mobile ── */}
      <LinkCard onPress={() => router.push('/notifications')} label={t('notifications.title')} title={t('notifications.title')} cta={`${t('common.view')} →`} themed={themed} />
      {canSell(user) ? (
        <LinkCard onPress={() => router.push('/seller')} label={t('profile.sellerAccount')} title={t('profile.openSellerSpace')} cta="→" themed={themed} />
      ) : canOnboardSeller(user) ? (
        <LinkCard onPress={() => router.push('/seller/onboarding')} label={t('profile.sellerAccount')} title={t('seller.finishSetup')} cta="→" themed={themed} />
      ) : (
        <LinkCard onPress={() => { if (!becomeSeller.isPending) becomeSeller.mutate() }} label={t('profile.sellerAccount')} title={becomeSeller.isPending ? t('common.oneMoment') : t('profile.createSellerAccount')} cta="→" themed={themed} />
      )}
      {user.account_type === 'EMPLOYEE' ? <LinkCard onPress={() => router.push('/seller/employee')} label={t('nav.workspace')} title={t('employee.dashboard.title')} cta="→" themed={themed} /> : null}
      {courierProfile.data ? <LinkCard onPress={() => router.push('/courier')} label={t('courier.spaceTitle')} title={t('courier.spaceTitle')} cta="→" themed={themed} /> : null}
      <PreferenceToggles />

      <Pressable accessibilityRole="button" style={({ pressed }) => [themed.dangerButton, pressed && { opacity: 0.85 }]} onPress={async () => { await logout(); router.replace('/auth/login') }}>
        <Text style={themed.dangerButtonText}>{t('common.signOut')}</Text>
      </Pressable>
    </ScrollView>
  )
}

type Themed = ReturnType<typeof makeStyles>

function InfoRow({ k, v, themed }: { k: string; v: string; themed: Themed }) {
  return <View style={themed.infoRow}><Text style={themed.infoK}>{k}</Text><Text style={themed.infoV}>{v}</Text></View>
}

function PointsCell({ label, value, themed }: { label: string; value: string; themed: Themed }) {
  return <View style={themed.pointsCell}><Text style={themed.pointsCellLabel} numberOfLines={2}>{label}</Text><Text style={themed.pointsCellValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text></View>
}

function LinkCard({ label, title, sub, cta, onPress, themed }: { label: string; title: string; sub?: string; cta: string; onPress: () => void; themed: Themed }) {
  return <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [themed.card, styles.linkCard, pressed && themed.cardPressed]}>
    <View style={styles.flex1}>
      <Text style={themed.small}>{label}</Text>
      <Text style={themed.bold}>{title}</Text>
      {sub ? <Text style={themed.small}>{sub}</Text> : null}
    </View>
    <Text style={themed.sectionLink}>{cta}</Text>
  </Pressable>
}

/** Colour-bearing styles are rebuilt per theme; layout-only rules stay static
 *  in `styles` below so they are created once. Values follow web's `.card`,
 *  `.info-row`, `.profile-contact-block`, `.eyebrow` and `.account-points-grid`. */
const makeStyles = (c: Colors) =>
  StyleSheet.create({
    title: { fontSize: 25, fontWeight: '900', color: c.ink, textAlign: 'center' },
    muted: { color: c.muted },
    small: { color: c.muted, fontSize: 14 },
    bold: { color: c.ink, fontWeight: '700', fontSize: 16 },
    card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, gap: 16, boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' },
    cardPressed: { boxShadow: '0px 4px 12px rgba(0,0,0,0.10)' },
    name: { fontSize: 22.4, fontWeight: '700', color: c.ink, lineHeight: 28 },
    eyebrow: { color: c.green, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.3, marginBottom: 8 },
    contactBlock: { paddingTop: 14, borderTopWidth: 1, borderTopColor: c.border },
    address: { color: c.ink, fontWeight: '700', marginBottom: 4, fontSize: 16 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.border, borderStyle: 'dashed' },
    infoK: { color: c.muted, fontSize: 14 },
    infoV: { color: c.ink, fontSize: 14, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
    pointsTitle: { color: c.ink, fontSize: 19.2, fontWeight: '700', marginTop: 5 },
    sectionLink: { color: c.green, fontSize: 14, fontWeight: '600' },
    pointsCell: { flex: 1, minWidth: 0, gap: 4, padding: 12, borderRadius: 10, backgroundColor: c.surface2 },
    pointsCellLabel: { color: c.muted, fontSize: 12 },
    pointsCellValue: { color: c.green, fontSize: 16.8, fontWeight: '700' },
    // web: <Button variant="danger"> — full-width danger fill
    dangerButton: { backgroundColor: c.danger, borderRadius: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 18 },
    dangerButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  })

// web: .page (24px top) inside .container (16px sides); .stack gap 16
const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 48, gap: 16 },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  flex1: { flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointsGrid: { flexDirection: 'row', gap: 10 },
})
