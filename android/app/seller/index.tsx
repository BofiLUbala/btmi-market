import { useMemo } from 'react'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { Button, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'
import { canSell, canOnboardSeller } from '../../src/types'

// Port of web-app/src/pages/seller/dashboard/SellerDashboardPage.tsx at its
// narrow-screen layout: same context pills, same six stat cards (uppercase
// label + tinted icon badge + value + divider + footer link), same orders
// table, quick actions and setup checklist. Style values come from the web's
// tokens/`pages.css` rules for `.seller-stat-card`, `.quick-action-btn`,
// `.checklist-item` and `.seller-data-table`, so the two stay in step.
type StatKey = 'shops' | 'products' | 'orders' | 'employees' | 'cash' | 'growth'

const STAT_ICONS: Record<StatKey, keyof typeof Ionicons.glyphMap> = {
  shops: 'storefront-outline',
  products: 'cube-outline',
  orders: 'receipt-outline',
  employees: 'people-outline',
  cash: 'cash-outline',
  growth: 'trending-up-outline',
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

  const shops = useQuery({ queryKey: ['seller', 'shops', activeBusiness?.id], queryFn: () => sellerApi.shops(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  const products = useQuery({ queryKey: ['seller', 'products', activeBusiness?.id], queryFn: () => sellerApi.products(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  const orders = useQuery({ queryKey: ['seller', 'orders', activeBusiness?.id], queryFn: () => sellerApi.businessOrders(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  const employees = useQuery({ queryKey: ['seller', 'employees', activeBusiness?.id], queryFn: () => sellerApi.employees(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  const cashSummary = useQuery({ queryKey: ['seller', 'cashSummary', activeBusiness?.id], queryFn: () => sellerApi.businessCashSummary(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  const growth = useQuery({ queryKey: ['seller', 'growth', activeBusiness?.id], queryFn: () => sellerApi.growthLevel(activeBusiness!.id), enabled: Boolean(activeBusiness) })

  const refreshAll = () => {
    for (const key of ['shops', 'products', 'orders', 'employees', 'cashSummary', 'growth']) {
      void queryClient.invalidateQueries({ queryKey: ['seller', key] })
    }
  }

  if (!user) return <View style={styles.center}><Text style={styles.title}>{t('seller.workspace')}</Text><Button title={t('seller.signInAsSeller')} onPress={() => router.push('/auth/login')} /></View>
  if (!canSell(user) && !canOnboardSeller(user)) return <View style={styles.center}><Text style={styles.title}>{t('seller.accessRequired')}</Text><Text style={styles.muted}>{t('seller.accessRequiredBody')}</Text><Button variant="outline" title={t('common.backToMarketplace')} onPress={() => router.replace('/(buyer)')} /></View>

  // ── 1. No business exists for this seller (mirrors web's welcome + steps) ──
  if (sellerBusinesses.length === 0) return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={t('seller.dashboard.welcomeTitle')} />
    <Text style={styles.muted}>{t('seller.dashboard.welcomeSubtitle')}</Text>
    <Button title={t('seller.startOnboarding')} onPress={() => router.push('/seller/onboarding')} />
    <Text style={styles.h3}>{t('seller.dashboard.howToStart')}</Text>
    <Step n={1} title={t('seller.createBusiness')} desc={t('seller.dashboard.stepCreateBusinessDesc')} styles={styles} />
    <Step n={2} title={t('seller.dashboard.stepCreateShop')} desc={t('seller.dashboard.stepCreateShopDesc')} styles={styles} />
    <Step n={3} title={t('seller.dashboard.stepAddProducts')} desc={t('seller.dashboard.stepAddProductsDesc')} styles={styles} />
    <Step n={4} title={t('seller.dashboard.stepAddStock')} desc={t('seller.dashboard.stepAddStockDesc')} styles={styles} />
    <Step n={5} title={t('seller.dashboard.stepReceiveOrders')} desc={t('seller.dashboard.stepReceiveOrdersDesc')} styles={styles} />
    <Button variant="outline" title={t('common.backToMarketplace')} onPress={() => router.replace('/(buyer)')} />
  </ScrollView>

  // ── 2. Businesses exist, none currently active (mirrors web's selection grid) ──
  if (!activeBusiness) return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={t('seller.dashboard.selectBusiness')} />
    <Text style={styles.muted}>{t('seller.dashboard.selectBusinessHint')}</Text>
    {sellerBusinesses.map((business) => (
      <Pressable key={business.id} accessibilityRole="button" style={styles.choiceCard} onPress={() => setActiveBusiness(business)}>
        <View style={styles.qaIcon}><Ionicons name="business-outline" size={18} color={colors.green} /></View>
        <View style={styles.flex1}>
          <Text style={styles.qaTitle}>{business.name}</Text>
          <Text style={styles.small}>{t('seller.dashboard.registeredBusiness')}</Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color={colors.muted} />
      </Pressable>
    ))}
    <Button variant="outline" title={t('seller.dashboard.addAnotherBusiness')} onPress={() => router.push('/seller/onboarding')} />
  </ScrollView>

  // ── 3. Active business dashboard ──
  const shopsCount = shops.data?.length ?? 0
  const productsCount = products.data?.length ?? 0
  const publishedProducts = (products.data ?? []).filter((p) => p.publication_status === 'PUBLISHED').length
  const ordersCount = orders.data?.length ?? 0
  const totalRevenue = (orders.data ?? []).reduce((sum, o) => sum + (o.final_total || 0), 0)
  const employeesCount = employees.data?.length ?? 0
  const cashTotal = cashSummary.data?.total_cash_sales ?? 0
  const sellerLevel = growth.data?.level?.name || 'STARTER'
  const sellerPoints = growth.data?.points?.current_points ?? 0
  const trustStatus = growth.data?.trust?.trust_status || 'NORMAL'
  const recentOrders = (orders.data ?? []).slice(0, 5)
  const loadingMetrics = shops.isLoading || products.isLoading || orders.isLoading

  return <ScrollView contentContainerStyle={styles.page}>
    <View>
      <Text style={styles.h1}>{t('seller.dashboard')}</Text>
      <Text style={styles.muted}>{t('seller.dashboard.overviewFor', { name: activeBusiness.name })}</Text>
    </View>
    <View style={styles.headActions}>
      <Button dense variant="outline" title={t('orders.refresh')} onPress={refreshAll} />
      <Button dense title={t('seller.dashboard.addProduct')} onPress={() => router.push('/seller/products/create')} />
    </View>

    {loadingMetrics && <Loading label={t('seller.dashboard.loadingMetrics')} />}

    {/* ── Metrics: same six cards, same order as web ── */}
    <Stat stat="shops" label={t('seller.shops')} value={String(shopsCount)} link={t('seller.dashboard.manageShops')} onPress={() => router.push('/seller/shops')} colors={colors} styles={styles} />
    <Stat stat="products" label={t('seller.products')} value={String(productsCount)} sub={t('seller.dashboard.publishedCount', { count: publishedProducts })} link={t('common.viewAll')} onPress={() => router.push('/seller/products')} colors={colors} styles={styles} />
    <Stat stat="orders" label={t('seller.orders')} value={String(ordersCount)} sub={`${totalRevenue.toLocaleString()} FC`} link={t('seller.dashboard.viewOrders')} onPress={() => router.push('/seller/orders')} colors={colors} styles={styles} />
    <Stat stat="employees" label={t('seller.employees')} value={String(employeesCount)} link={t('seller.dashboard.manageTeam')} onPress={() => router.push('/seller/employees')} colors={colors} styles={styles} />
    <Stat stat="cash" label={t('seller.dashboard.cashSales')} value={cashTotal.toLocaleString()} unit="FC" link={t('seller.dashboard.cashSessions')} onPress={() => router.push('/seller/cash')} colors={colors} styles={styles} />
    <Stat stat="growth" label={t('seller.dashboard.sellerLevel')} value={sellerLevel} tier sub={`${t(`seller.growth.trust.${trustStatus}` as any)} (${sellerPoints} pts)`} link={t('seller.growth')} onPress={() => router.push('/seller/growth')} colors={colors} styles={styles} />

    {/* ── Recent Orders ── */}
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.flex1}>
          <Text style={styles.h3}>{t('seller.dashboard.recentOrders')}</Text>
          <Text style={styles.small}>{t('seller.dashboard.recentOrdersHint')}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/seller/orders')}><Text style={styles.headerLink}>{t('seller.dashboard.viewAllOrders')}</Text></Pressable>
      </View>
      {recentOrders.length === 0 ? <View style={styles.emptyBlock}>
        <Ionicons name="receipt-outline" size={40} color={colors.mutedLight} />
        <Text style={styles.emptyTitle}>{t('seller.dashboard.noOrdersYet')}</Text>
        <Text style={styles.small}>{t('seller.dashboard.noOrdersYetHint')}</Text>
      </View> : <>
        <View style={styles.tableHead}>
          <Text style={[styles.th, styles.colOrder]}>{t('seller.dashboard.orderNumberHeader')}</Text>
          <Text style={[styles.th, styles.colStatus]}>{t('common.status')}</Text>
          <Text style={[styles.th, styles.colTotal]}>{t('common.total')}</Text>
        </View>
        {recentOrders.map((order) => {
          const tint = statusTint(order.status, colors)
          return <Pressable key={order.id} accessibilityRole="button" style={styles.tableRow} onPress={() => router.push('/seller/orders')}>
            <View style={styles.colOrder}>
              <Text style={styles.orderCode}>{order.order_number || `#${order.id.slice(0, 8)}`}</Text>
              <Text style={styles.small}>{order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}</Text>
            </View>
            <View style={styles.colStatus}>
              <Text numberOfLines={1} style={[styles.statusBadge, { backgroundColor: tint.bg, color: tint.color }]}>{order.status.replaceAll('_', ' ')}</Text>
            </View>
            <Text style={[styles.tdStrong, styles.colTotal]}>{(order.final_total ?? 0).toLocaleString()} FC</Text>
          </Pressable>
        })}
      </>}
    </View>

    {/* ── Quick Actions: same six entries as web ── */}
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.flex1}>
          <Text style={styles.h3}>{t('seller.dashboard.quickActions')}</Text>
          <Text style={styles.small}>{t('seller.dashboard.quickActionsHint')}</Text>
        </View>
      </View>
      <QuickAction icon="add" title={t('seller.dashboard.addProduct')} desc={t('seller.dashboard.addProductDesc')} onPress={() => router.push('/seller/products/create')} colors={colors} styles={styles} />
      <QuickAction icon="cube-outline" title={t('seller.dashboard.manageStock')} desc={t('seller.dashboard.manageStockDesc')} onPress={() => router.push('/seller/stock')} colors={colors} styles={styles} />
      <QuickAction icon="receipt-outline" title={t('seller.dashboard.processOrders')} desc={t('seller.dashboard.processOrdersDesc')} onPress={() => router.push('/seller/orders')} colors={colors} styles={styles} />
      <QuickAction icon="storefront-outline" title={t('seller.dashboard.manageShops')} desc={t('seller.dashboard.manageShopsDesc')} onPress={() => router.push('/seller/shops')} colors={colors} styles={styles} />
      <QuickAction icon="people-outline" title={t('seller.dashboard.teamAndStaff')} desc={t('seller.dashboard.teamAndStaffDesc')} onPress={() => router.push('/seller/employees')} colors={colors} styles={styles} />
      <QuickAction icon="cash-outline" title={t('seller.dashboard.cashSessions')} desc={t('seller.dashboard.cashSessionsDesc')} onPress={() => router.push('/seller/cash')} colors={colors} styles={styles} />
    </View>

    {/* ── Setup Checklist: same five items as web ── */}
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.flex1}>
          <Text style={styles.h3}>{t('seller.dashboard.setupChecklist')}</Text>
          <Text style={styles.small}>{t('seller.dashboard.setupChecklistHint')}</Text>
        </View>
      </View>
      <Check done title={t('seller.dashboard.checkBusinessRegistered')} sub={activeBusiness.name} colors={colors} styles={styles} />
      <Check done={shopsCount > 0} title={t('seller.dashboard.checkCreateShop')} sub={shopsCount > 0 ? t('seller.dashboard.shopsActiveCount', { count: shopsCount }) : undefined} linkLabel={shopsCount > 0 ? undefined : t('seller.dashboard.checkCreateShopLink')} onLinkPress={() => router.push('/seller/shops')} colors={colors} styles={styles} />
      <Check done={productsCount > 0} title={t('seller.dashboard.checkAddProducts')} sub={productsCount > 0 ? t('seller.dashboard.productsInCatalogCount', { count: productsCount }) : undefined} linkLabel={productsCount > 0 ? undefined : t('seller.dashboard.addProductLink')} onLinkPress={() => router.push('/seller/products/create')} colors={colors} styles={styles} />
      <Check done={publishedProducts > 0} title={t('seller.dashboard.checkPublishProducts')} sub={publishedProducts > 0 ? t('seller.dashboard.publishedMarketplaceCount', { count: publishedProducts }) : undefined} linkLabel={publishedProducts > 0 ? undefined : t('seller.dashboard.publishLink')} onLinkPress={() => router.push('/seller/products')} colors={colors} styles={styles} />
      <Check done={ordersCount > 0} title={t('seller.dashboard.checkReceiveFirstOrder')} sub={ordersCount > 0 ? t('seller.dashboard.ordersProcessedCount', { count: ordersCount }) : t('seller.dashboard.ordersAppearHint')} colors={colors} styles={styles} />
    </View>

    <Button variant="outline" title={t('common.backToMarketplace')} onPress={() => router.replace('/(buyer)')} />
  </ScrollView>
}

type S = ReturnType<typeof makeStyles>

/** Same tint pairs as web's `.status-*` badge rules. */
function statusTint(status: string, colors: Colors) {
  if (status === 'PENDING' || status === 'READY' || status === 'READY_FOR_PICKUP') return { bg: colors.warningSoft, color: colors.warning }
  if (status === 'ACCEPTED' || status === 'PREPARING') return { bg: colors.infoSoft, color: colors.info }
  if (status === 'DELIVERED' || status === 'COMPLETED' || status === 'RECEIVED') return { bg: colors.successSoft, color: colors.success }
  if (status === 'CANCELLED' || status === 'REJECTED') return { bg: colors.dangerSoft, color: colors.danger }
  return { bg: colors.surface2, color: colors.muted }
}

/** Icon badge tints from web's `.stat-icon--*` rules. */
function statTint(stat: StatKey, colors: Colors) {
  switch (stat) {
    case 'shops': return { bg: colors.infoSoft, color: colors.info }
    case 'products': return { bg: colors.warningSoft, color: colors.warning }
    case 'orders': return { bg: colors.successSoft, color: colors.success }
    case 'employees': return { bg: colors.infoSoft, color: colors.purple }
    case 'cash': return { bg: colors.warningSoft, color: colors.warning }
    case 'growth': return { bg: colors.goldSoft, color: colors.magenta }
  }
}

function Stat({ stat, label, value, unit, sub, link, tier, onPress, colors, styles }: { stat: StatKey; label: string; value: string; unit?: string; sub?: string; link: string; tier?: boolean; onPress: () => void; colors: Colors; styles: S }) {
  const tint = statTint(stat, colors)
  return <Pressable accessibilityRole="button" style={styles.statCard} onPress={onPress}>
    <View style={styles.statHeader}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <View style={[styles.statIcon, { backgroundColor: tint.bg }]}><Ionicons name={STAT_ICONS[stat]} size={18} color={tint.color} /></View>
    </View>
    <Text style={[styles.statValue, tier && styles.statValueTier]}>{value}{unit ? <Text style={styles.currencyUnit}> {unit}</Text> : null}</Text>
    <View style={styles.statFooter}>
      {sub ? <Text numberOfLines={1} style={styles.small}>{sub}</Text> : null}
      <Text style={styles.statLink}>{link} →</Text>
    </View>
  </Pressable>
}

function QuickAction({ icon, title, desc, onPress, colors, styles }: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string; onPress: () => void; colors: Colors; styles: S }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.qaCard}>
    <View style={styles.qaIcon}><Ionicons name={icon} size={18} color={colors.green} /></View>
    <View style={styles.flex1}>
      <Text style={styles.qaTitle}>{title}</Text>
      <Text style={styles.small}>{desc}</Text>
    </View>
  </Pressable>
}

function Check({ done, title, sub, linkLabel, onLinkPress, colors, styles }: { done: boolean; title: string; sub?: string; linkLabel?: string; onLinkPress?: () => void; colors: Colors; styles: S }) {
  return <View style={styles.checkItem}>
    <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={done ? colors.success : colors.mutedLight} />
    <View style={styles.flex1}>
      <Text style={styles.qaTitle}>{title}</Text>
      {sub ? <Text style={styles.small}>{sub}</Text> : null}
      {linkLabel ? <Pressable accessibilityRole="button" onPress={onLinkPress}><Text style={styles.checkLink}>{linkLabel}</Text></Pressable> : null}
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
  // web: .seller-content-area { padding: 14px 12px 28px }, grid gap 16
  page: { padding: 12, paddingTop: 14, paddingBottom: 28, gap: 16 },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  flex1: { flex: 1 },
  title: { fontSize: 25, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  h1: { fontSize: 24, fontWeight: '700', color: colors.green, marginBottom: 2, lineHeight: 30 },
  h3: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: 2 },
  muted: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  small: { color: colors.muted, fontSize: 12 },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  // web: .seller-header-left { grid, 2 equal columns, gap 8 } + .seller-context-btn

  // web: .seller-stat-card
  statCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 16, boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' },
  statHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  statLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.6 },
  statIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.ink, marginBottom: 12 },
  statValueTier: { fontSize: 19, color: colors.goldDark },
  currencyUnit: { fontSize: 14, fontWeight: '600', color: colors.muted },
  statFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  statLink: { fontSize: 12, fontWeight: '700', color: colors.green },

  // web: .seller-section-card / .section-card-header
  sectionCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 16, gap: 12, boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  headerLink: { fontSize: 12, fontWeight: '700', color: colors.green },
  emptyBlock: { alignItems: 'center', paddingVertical: spacing.lg, gap: 2 },
  emptyTitle: { fontWeight: '700', color: colors.ink },

  // web: .seller-data-table
  tableHead: { flexDirection: 'row', backgroundColor: colors.surface2, paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.6 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  colOrder: { flex: 1.2 },
  colStatus: { flex: 1.1, alignItems: 'flex-start' },
  colTotal: { flex: 1, textAlign: 'right' },
  orderCode: { fontWeight: '700', color: colors.green, fontSize: 13 },
  tdStrong: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  statusBadge: { fontSize: 10, fontWeight: '700', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, overflow: 'hidden' },

  // web: .quick-action-btn / .qa-icon
  qaCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm },
  qaIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  qaTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },

  // web: .checklist-item
  checkItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: radius.sm, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  checkLink: { color: colors.green, fontWeight: '700', fontSize: 12, marginTop: 2 },
  choiceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.sm, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: colors.onGreen, fontWeight: '900' },

})
