import { useMemo } from 'react'
import { Redirect, router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { Button, Loading } from '../../src/components/ui'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'
import { canSell, canOnboardSeller } from '../../src/types'
import { statusLabel } from '../../src/lib/statusLabels'
import { formatMoney } from '../../src/lib/money'
import { formatDateTime } from '../../src/lib/format'

// Port of web-app/src/pages/seller/dashboard/SellerDashboardPage.tsx at its
// narrow-screen layout (<640px): page header, five stat cards stacked one per
// row, recent-orders table, quick actions (one column below 480px) and the
// setup checklist. It reads the same endpoints with the same parameters —
// orders are the latest 10, exactly as web — so every figure matches.
// Style values come from web's tokens and `pages.css` rules for
// `.seller-stat-card`, `.seller-section-card`, `.quick-action-btn`,
// `.checklist-item` and `.seller-data-table`.
type StatKey = 'shops' | 'products' | 'orders' | 'employees' | 'growth'

const STAT_ICONS: Record<StatKey, keyof typeof Ionicons.glyphMap> = {
  shops: 'storefront-outline',
  products: 'cube-outline',
  orders: 'receipt-outline',
  employees: 'people-outline',
  growth: 'trending-up-outline',
}

const TRUST_STATUS_KEYS: Record<string, TranslationKey> = {
  HIGH: 'seller.growth.trust.HIGH',
  NORMAL: 'seller.growth.trust.NORMAL',
  LOW: 'seller.growth.trust.LOW',
  SUSPENDED: 'seller.growth.trust.SUSPENDED',
}

export default function SellerHome() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const user = useAuth((s) => s.user)
  const sellerBusinesses = useAuth((s) => s.sellerBusinesses)
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const setActiveBusiness = useAuth((s) => s.setActiveBusiness)
  const enabled = Boolean(activeBusiness)

  const shops = useQuery({ queryKey: ['seller', 'shops', activeBusiness?.id], queryFn: () => sellerApi.shops(activeBusiness!.id), enabled })
  const products = useQuery({ queryKey: ['seller', 'products', activeBusiness?.id], queryFn: () => sellerApi.products(activeBusiness!.id), enabled })
  const orders = useQuery({ queryKey: ['seller', 'orders', activeBusiness?.id, 'dashboard'], queryFn: () => sellerApi.businessOrders(activeBusiness!.id, { limit: 10 }), enabled })
  const employees = useQuery({ queryKey: ['seller', 'employees', activeBusiness?.id], queryFn: () => sellerApi.employees(activeBusiness!.id), enabled })
  const growth = useQuery({ queryKey: ['seller', 'growth', activeBusiness?.id], queryFn: () => sellerApi.growthLevel(activeBusiness!.id), enabled })
  const all = [shops, products, orders, employees, growth]
  const loading = all.some((q) => q.isFetching)

  const refreshAll = () => {
    for (const key of ['shops', 'products', 'orders', 'employees', 'growth']) {
      void queryClient.invalidateQueries({ queryKey: ['seller', key, activeBusiness?.id] })
    }
  }

  // web: an EMPLOYEE account's workspace is /employee/dashboard, not the seller dashboard
  if (user?.account_type === 'EMPLOYEE') return <Redirect href="/seller/employee" />
  if (!user) return <View style={styles.center}><Text style={styles.title}>{t('seller.workspace')}</Text><Button title={t('seller.signInAsSeller')} onPress={() => router.push('/auth/login')} /></View>
  if (!canSell(user) && !canOnboardSeller(user)) return <View style={styles.center}><Text style={styles.title}>{t('seller.accessRequired')}</Text><Text style={styles.muted}>{t('seller.accessRequiredBody')}</Text><Button variant="outline" title={t('common.backToMarketplace')} onPress={() => router.replace('/(buyer)')} /></View>

  // ── 1. No business exists for this seller ──
  if (sellerBusinesses.length === 0) return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconWrap}><Ionicons name="business-outline" size={32} color={colors.green} /></View>
      <Text style={styles.emptyH2}>{t('seller.dashboard.welcomeTitle')}</Text>
      <Text style={[styles.muted, styles.center_]}>{t('seller.dashboard.welcomeSubtitle')}</Text>
      <Button title={`+  ${t('seller.onboarding.createBusiness')}`} onPress={() => router.push('/seller/onboarding')} />
      <View style={styles.stepsPreview}>
        <Text style={styles.stepsTitle}>{t('seller.dashboard.howToStart')}</Text>
        <Step n={1} title={t('seller.onboarding.createBusiness')} desc={t('seller.dashboard.stepCreateBusinessDesc')} styles={styles} />
        <Step n={2} title={t('seller.dashboard.stepCreateShop')} desc={t('seller.dashboard.stepCreateShopDesc')} styles={styles} />
        <Step n={3} title={t('seller.dashboard.stepAddProducts')} desc={t('seller.dashboard.stepAddProductsDesc')} styles={styles} />
        <Step n={4} title={t('seller.dashboard.stepAddStock')} desc={t('seller.dashboard.stepAddStockDesc')} styles={styles} />
        <Step n={5} title={t('seller.dashboard.stepReceiveOrders')} desc={t('seller.dashboard.stepReceiveOrdersDesc')} styles={styles} />
      </View>
    </View>
  </ScrollView>

  // ── 2. Businesses exist, none currently active ──
  if (!activeBusiness) return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconWrap}><Ionicons name="business-outline" size={32} color={colors.green} /></View>
      <Text style={styles.emptyH2}>{t('seller.dashboard.selectBusiness')}</Text>
      <Text style={[styles.muted, styles.center_]}>{t('seller.dashboard.selectBusinessHint')}</Text>
      {sellerBusinesses.map((business) => (
        <Pressable key={business.id} accessibilityRole="button" style={styles.choiceCard} onPress={() => setActiveBusiness(business)}>
          <View style={styles.choiceBrand}><Ionicons name="business-outline" size={20} color={colors.green} /></View>
          <View style={styles.flex1}>
            <Text style={styles.qaTitle}>{business.name}</Text>
            <Text style={styles.small}>{business.category || business.business_type || t('seller.dashboard.registeredBusiness')}</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={colors.muted} />
        </Pressable>
      ))}
      <Button variant="outline" title={`+  ${t('seller.dashboard.addAnotherBusiness')}`} onPress={() => router.push('/seller/onboarding')} />
    </View>
  </ScrollView>

  // ── 3. Active business dashboard ──
  const unavailable = { shops: shops.isError, products: products.isError, orders: orders.isError, employees: employees.isError, growth: growth.isError }
  const shopsCount = shops.data?.length ?? 0
  const productsCount = products.data?.length ?? 0
  const publishedProducts = (products.data ?? []).filter((p) => p.publication_status === 'PUBLISHED').length
  const ordersCount = orders.data?.length ?? 0
  const totalRevenue = (orders.data ?? []).reduce((sum, o) => sum + (o.final_total || 0), 0)
  const employeesCount = employees.data?.length ?? 0
  const sellerLevel = growth.data?.level?.name || 'STARTER'
  const sellerPoints = growth.data?.points?.current_points || 0
  const trustStatus = growth.data?.trust?.trust_status || 'NORMAL'
  const recentOrders = (orders.data ?? []).slice(0, 5)
  const hasData = all.some((q) => q.data !== undefined)
  const partialFailureSections = [
    unavailable.shops ? t('seller.shops') : null,
    unavailable.products ? t('seller.products') : null,
    unavailable.orders ? t('seller.orders') : null,
    unavailable.employees ? t('seller.employees') : null,
    unavailable.growth ? t('seller.growth') : null,
  ].filter(Boolean) as string[]

  return <ScrollView contentContainerStyle={styles.page}>
    {/* ── Page header (web: .dashboard-page-header, column below 640px) ── */}
    <View style={styles.pageHeader}>
      <View>
        <Text style={styles.h1}>{t('seller.dashboard')}</Text>
        <Text style={styles.muted}>{t('seller.dashboard.overviewFor', { name: activeBusiness.name })}</Text>
      </View>
      <View style={styles.headActions}>
        <Button dense variant="outline" title={`↻  ${t('orders.refresh')}`} disabled={loading} onPress={refreshAll} />
        <Button dense title={`+  ${t('seller.dashboard.addProduct')}`} onPress={() => router.push('/seller/products/create')} />
      </View>
    </View>

    {partialFailureSections.length > 0 && <View style={styles.partialWarning} accessibilityRole="alert">
      <Text style={styles.partialTitle}>{t('seller.dashboard.partialErrorTitle')}</Text>
      <Text style={styles.partialBody}>{t('seller.dashboard.partialErrorBody', { sections: partialFailureSections.join(', ') })}</Text>
      <Button dense variant="outline" title={`↻  ${t('seller.dashboard.retrySections')}`} disabled={loading} onPress={refreshAll} />
    </View>}

    {loading && !hasData && <Loading label={t('seller.dashboard.loadingMetrics')} />}

    {/* ── Metrics: same five cards, same order as web ── */}
    <View style={styles.metrics}>
      <Stat stat="shops" label={t('seller.shops')} value={unavailable.shops ? '—' : String(shopsCount)} link={t('seller.dashboard.manageShops')} onPress={() => router.push('/seller/shops')} colors={colors} styles={styles} />
      <Stat stat="products" label={t('seller.products')} value={unavailable.products ? '—' : String(productsCount)} sub={t('seller.dashboard.publishedCount', { count: publishedProducts })} link={t('common.viewAll')} onPress={() => router.push('/seller/products')} colors={colors} styles={styles} />
      <Stat stat="orders" label={t('seller.orders')} value={unavailable.orders ? '—' : String(ordersCount)} sub={formatMoney(totalRevenue)} link={t('seller.dashboard.viewOrders')} onPress={() => router.push('/seller/orders')} colors={colors} styles={styles} />
      <Stat stat="employees" label={t('seller.employees')} value={unavailable.employees ? '—' : String(employeesCount)} link={t('seller.dashboard.manageTeam')} onPress={() => router.push('/seller/employees')} colors={colors} styles={styles} />
      <Stat stat="growth" label={t('seller.dashboard.sellerLevel')} value={unavailable.growth ? '—' : sellerLevel} tier
        trust={`${t(TRUST_STATUS_KEYS[trustStatus] ?? 'seller.growth.trust.NORMAL')} (${sellerPoints} pts)`}
        link={t('seller.growth')} onPress={() => router.push('/seller/growth')} colors={colors} styles={styles} />
    </View>

    {/* ── Recent Orders ── */}
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.flex1}>
          <Text style={styles.h3}>{t('seller.dashboard.recentOrders')}</Text>
          <Text style={styles.small}>{t('seller.dashboard.recentOrdersHint')}</Text>
        </View>
        <Pressable accessibilityRole="link" onPress={() => router.push('/seller/orders')}><Text style={styles.headerLink}>{t('seller.dashboard.viewAllOrders')}</Text></Pressable>
      </View>
      {recentOrders.length === 0 ? <View style={styles.emptyBlock}>
        <Ionicons name="receipt-outline" size={40} color={colors.mutedLight} />
        <Text style={styles.emptyTitle}>{t('seller.dashboard.noOrdersYet')}</Text>
        <Text style={[styles.small, styles.center_]}>{t('seller.dashboard.noOrdersYetHint')}</Text>
      </View> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScroll}>
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colOrder]}>{t('seller.dashboard.orderNumberHeader').toUpperCase()}</Text>
            <Text style={[styles.th, styles.colStatus]}>{t('common.status').toUpperCase()}</Text>
            <Text style={[styles.th, styles.colTotal]}>{t('common.total').toUpperCase()}</Text>
            <Text style={[styles.th, styles.colDate]}>{t('common.date').toUpperCase()}</Text>
          </View>
          {recentOrders.map((order) => {
            const tint = statusTint(order.status, colors)
            return <View key={order.id} style={styles.tableRow}>
              <Pressable accessibilityRole="link" style={styles.colOrder} onPress={() => router.push({ pathname: '/seller/orders', params: { orderId: order.id } })}>
                <Text style={styles.orderCode}>{order.order_number || `#${order.id.slice(0, 8)}`}</Text>
              </Pressable>
              <View style={styles.colStatus}>
                <Text numberOfLines={1} style={[styles.statusBadge, tint && { backgroundColor: tint.bg, color: tint.color }]}>{order.status ? statusLabel(t, order.status).toUpperCase() : '—'}</Text>
              </View>
              <Text style={[styles.tdStrong, styles.colTotal]}>{formatMoney(order.final_total || 0, order.currency)}</Text>
              <Text style={[styles.small, styles.colDate]}>{order.created_at ? formatDateTime(order.created_at) : '—'}</Text>
            </View>
          })}
        </View>
      </ScrollView>}
    </View>

    {/* ── Quick Actions: same five entries as web ── */}
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.flex1}>
          <Text style={styles.h3}>{t('seller.dashboard.quickActions')}</Text>
          <Text style={styles.small}>{t('seller.dashboard.quickActionsHint')}</Text>
        </View>
      </View>
      <View style={styles.qaGrid}>
        <QuickAction icon="add" title={t('seller.dashboard.addProduct')} desc={t('seller.dashboard.addProductDesc')} onPress={() => router.push('/seller/products/create')} colors={colors} styles={styles} />
        <QuickAction icon="cube-outline" title={t('seller.dashboard.manageStock')} desc={t('seller.dashboard.manageStockDesc')} onPress={() => router.push('/seller/stock')} colors={colors} styles={styles} />
        <QuickAction icon="receipt-outline" title={t('seller.dashboard.processOrders')} desc={t('seller.dashboard.processOrdersDesc')} onPress={() => router.push('/seller/orders')} colors={colors} styles={styles} />
        <QuickAction icon="storefront-outline" title={t('seller.dashboard.manageShops')} desc={t('seller.dashboard.manageShopsDesc')} onPress={() => router.push('/seller/shops')} colors={colors} styles={styles} />
        <QuickAction icon="people-outline" title={t('seller.dashboard.teamAndStaff')} desc={t('seller.dashboard.teamAndStaffDesc')} onPress={() => router.push('/seller/employees')} colors={colors} styles={styles} />
      </View>
    </View>

    {/* ── Setup Checklist: same five items as web ── */}
    <View style={[styles.sectionCard, styles.setupCard]}>
      <View style={styles.sectionHeader}>
        <View style={styles.flex1}>
          <Text style={styles.h3}>{t('seller.dashboard.setupChecklist')}</Text>
          <Text style={styles.small}>{t('seller.dashboard.setupChecklistHint')}</Text>
        </View>
      </View>
      <View style={styles.checkGrid}>
        <Check done title={t('seller.dashboard.checkBusinessRegistered')} sub={activeBusiness.name} colors={colors} styles={styles} />
        <Check done={shopsCount > 0} title={t('seller.dashboard.checkCreateShop')} sub={shopsCount > 0 ? t('seller.dashboard.shopsActiveCount', { count: shopsCount }) : undefined} linkLabel={shopsCount > 0 ? undefined : t('seller.dashboard.checkCreateShopLink')} onLinkPress={() => router.push('/seller/shops')} colors={colors} styles={styles} />
        <Check done={productsCount > 0} title={t('seller.dashboard.checkAddProducts')} sub={productsCount > 0 ? t('seller.dashboard.productsInCatalogCount', { count: productsCount }) : undefined} linkLabel={productsCount > 0 ? undefined : t('seller.dashboard.addProductLink')} onLinkPress={() => router.push('/seller/products/create')} colors={colors} styles={styles} />
        <Check done={publishedProducts > 0} title={t('seller.dashboard.checkPublishProducts')} sub={publishedProducts > 0 ? t('seller.dashboard.publishedMarketplaceCount', { count: publishedProducts }) : undefined} linkLabel={publishedProducts > 0 ? undefined : t('seller.dashboard.publishLink')} onLinkPress={() => router.push('/seller/products')} colors={colors} styles={styles} />
        <Check done={ordersCount > 0} title={t('seller.dashboard.checkReceiveFirstOrder')} sub={ordersCount > 0 ? t('seller.dashboard.ordersProcessedCount', { count: ordersCount }) : t('seller.dashboard.ordersAppearHint')} colors={colors} styles={styles} />
      </View>
    </View>
  </ScrollView>
}

type S = ReturnType<typeof makeStyles>

/** Same tint pairs as web's `.status-*` badge rules; statuses web leaves
 *  unstyled (RECEIVED, READY_FOR_PICKUP, …) stay unstyled here too. */
function statusTint(status: string | undefined, colors: Colors) {
  switch (status) {
    case 'COMPLETED': case 'DELIVERED': return { bg: colors.successSoft, color: colors.success }
    case 'PENDING': return { bg: colors.warningSoft, color: colors.warning }
    case 'ACCEPTED': case 'PREPARING': case 'READY': return { bg: colors.infoSoft, color: colors.info }
    case 'OUT_FOR_DELIVERY': return { bg: colors.outSoft, color: colors.out }
    case 'CANCELLED': case 'REJECTED': return { bg: colors.dangerSoft, color: colors.danger }
    default: return null
  }
}

/** Icon badge tints from web's `.stat-icon--*` rules. */
function statTint(stat: StatKey, colors: Colors) {
  switch (stat) {
    case 'shops': return { bg: colors.infoSoft, color: colors.info }
    case 'products': return { bg: colors.warningSoft, color: colors.warning }
    case 'orders': return { bg: colors.successSoft, color: colors.success }
    case 'employees': return { bg: colors.infoSoft, color: colors.purple }
    case 'growth': return { bg: colors.goldSoft, color: colors.magenta }
  }
}

function Stat({ stat, label, value, sub, trust, link, tier, onPress, colors, styles }: { stat: StatKey; label: string; value: string; sub?: string; trust?: string; link: string; tier?: boolean; onPress: () => void; colors: Colors; styles: S }) {
  const tint = statTint(stat, colors)
  return <View style={styles.statCard}>
    <View style={styles.statHeader}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <View style={[styles.statIcon, { backgroundColor: tint.bg }]}><Ionicons name={STAT_ICONS[stat]} size={18} color={tint.color} /></View>
    </View>
    <Text style={[styles.statValue, tier && styles.statValueTier]}>{value}</Text>
    <View style={[styles.statFooter, !sub && !trust && styles.statFooterEnd]}>
      {sub ? <Text numberOfLines={1} style={styles.small}>{sub}</Text> : null}
      {trust ? <View style={styles.trustPill}><Ionicons name="shield-checkmark-outline" size={14} color={colors.success} /><Text numberOfLines={1} style={styles.trustText}>{trust}</Text></View> : null}
      <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}><Text style={styles.statLink}>{link} →</Text></Pressable>
    </View>
  </View>
}

function QuickAction({ icon, title, desc, onPress, colors, styles }: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string; onPress: () => void; colors: Colors; styles: S }) {
  return <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.qaCard, pressed && styles.qaCardPressed]}>
    <View style={styles.qaIcon}><Ionicons name={icon} size={18} color={colors.green} /></View>
    <View style={styles.flex1}>
      <Text style={styles.qaTitle}>{title}</Text>
      <Text style={styles.small}>{desc}</Text>
    </View>
  </Pressable>
}

function Check({ done, title, sub, linkLabel, onLinkPress, colors, styles }: { done: boolean; title: string; sub?: string; linkLabel?: string; onLinkPress?: () => void; colors: Colors; styles: S }) {
  return <View style={styles.checkItem}>
    <Ionicons name="checkmark-circle-outline" size={20} color={done ? colors.success : colors.faint} style={styles.checkIcon} />
    <View style={styles.flex1}>
      <Text style={styles.qaTitle}>{title}</Text>
      {sub ? <Text style={styles.small}>{sub}</Text> : null}
      {linkLabel ? <Pressable accessibilityRole="link" onPress={onLinkPress}><Text style={styles.checkLink}>{linkLabel}</Text></Pressable> : null}
    </View>
  </View>
}

function Step({ n, title, desc, styles }: { n: number; title: string; desc: string; styles: S }) {
  return <View style={styles.checkItem}>
    <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
    <View style={styles.flex1}><Text style={styles.qaTitle}>{title}</Text><Text style={styles.small}>{desc}</Text></View>
  </View>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  // web: .seller-content-area { padding: 14px 12px 28px }; .seller-dashboard-page gap --space-5
  page: { padding: 12, paddingTop: 14, paddingBottom: 28, gap: 24 },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  center_: { textAlign: 'center' },
  flex1: { flex: 1 },
  title: { fontSize: 25, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  // web: .header-titles h1 — clamp(1.5rem, …) → 24px, primary colour
  h1: { fontSize: 24, fontWeight: '700', color: colors.green, marginBottom: 2, lineHeight: 30 },
  // web: .section-card-header h3 — --text-lg
  h3: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 2 },
  muted: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  small: { color: colors.muted, fontSize: 12 },
  // web: .dashboard-page-header — column, gap --space-3
  pageHeader: { gap: 12 },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  partialWarning: { gap: 6, padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.warningSoft, alignItems: 'flex-start' },
  partialTitle: { fontWeight: '700', color: colors.ink },
  partialBody: { color: colors.ink, fontSize: 14 },

  // web: .seller-metrics-grid — auto-fit minmax(180px) → one column at phone width, gap --space-4
  metrics: { gap: 16 },
  // web: .seller-stat-card
  statCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 16, boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' },
  statHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  statLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.6 },
  statIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 22.4, fontWeight: '800', color: colors.ink, lineHeight: 25, marginBottom: 12 },
  statValueTier: { fontSize: 19.2, color: colors.goldDark },
  statFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  statFooterEnd: { justifyContent: 'flex-start' },
  statLink: { fontSize: 12, fontWeight: '700', color: colors.green },
  trustPill: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  trustText: { fontSize: 12, fontWeight: '700', color: colors.success, flexShrink: 1 },

  // web: .seller-section-card (padding --space-5) / .section-card-header (margin-bottom --space-4)
  sectionCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 24, boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' },
  setupCard: { marginTop: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 16 },
  headerLink: { fontSize: 12, fontWeight: '700', color: colors.green },
  emptyBlock: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16, gap: 2 },
  emptyTitle: { fontWeight: '700', color: colors.ink, marginTop: 8 },

  // web: .seller-table-wrap { overflow-x: auto } + .seller-data-table
  tableScroll: { minWidth: '100%' },
  table: { flexGrow: 1, minWidth: 420 },
  tableHead: { flexDirection: 'row', backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.6, paddingVertical: 8, paddingHorizontal: 10 },
  tableRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  colOrder: { flex: 1.3, paddingVertical: 10, paddingHorizontal: 10 },
  colStatus: { flex: 1.2, paddingVertical: 10, paddingHorizontal: 10, alignItems: 'flex-start' },
  colTotal: { flex: 1, paddingVertical: 10, paddingHorizontal: 10 },
  colDate: { flex: 1, paddingVertical: 10, paddingHorizontal: 10 },
  orderCode: { fontWeight: '700', color: colors.green, fontSize: 14 },
  tdStrong: { fontWeight: '700', color: colors.ink, fontSize: 14 },
  statusBadge: { fontSize: 11.5, fontWeight: '700', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, overflow: 'hidden', color: colors.ink },

  // web: .seller-quick-actions-grid — one column ≤480px, gap --space-3
  qaGrid: { gap: 12 },
  // web: .quick-action-btn / .qa-icon
  qaCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm },
  qaCardPressed: { backgroundColor: colors.white, borderColor: colors.green },
  qaIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  qaTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },

  // web: .seller-checklist-grid (gap --space-4) / .checklist-item
  checkGrid: { gap: 16 },
  checkItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: radius.sm, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  checkIcon: { marginTop: 2 },
  checkLink: { color: colors.green, fontWeight: '700', fontSize: 12, marginTop: 2 },

  // web: .seller-onboarding-empty-card / .empty-icon-wrap / .business-choice-card / .onboarding-step-item
  emptyCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 24, gap: 16, alignItems: 'stretch', marginVertical: 24, boxShadow: '0px 4px 12px rgba(0,0,0,0.08)' },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 16, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  emptyH2: { fontSize: 25.6, fontWeight: '700', color: colors.green, textAlign: 'center' },
  stepsPreview: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 24, gap: 16 },
  stepsTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  choiceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.sm, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  choiceBrand: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: colors.onGreen, fontWeight: '800' },
})
