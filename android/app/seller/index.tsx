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
import { radius, spacing, type Colors, fonts, kicker, shadow } from '../../src/theme'
import { canSell, canOnboardSeller } from '../../src/types'
import { statusLabel } from '../../src/lib/statusLabels'
import { formatMoney } from '../../src/lib/money'
import { formatDateTime } from '../../src/lib/format'
import { Image } from 'expo-image'
import { resolveMediaUrl } from '../../src/api/client'
import { BrandLogo } from '../../src/components/BrandLogo'

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
  const activeShop = useAuth((s) => s.activeShop)
  // "Ventes du mois" / "Commandes à préparer": the seller finance dashboard
  // for the current calendar month, scoped to the active shop.
  const monthScope = useMemo(() => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return { shop_id: activeShop || undefined, date_from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, date_to: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` }
  }, [activeShop])
  const month = useQuery({ queryKey: ['seller', 'finances', 'dashboard', monthScope], queryFn: () => sellerApi.financeDashboard(monthScope), enabled })
  const all = [shops, products, orders, employees, growth]
  const loading = all.some((q) => q.isFetching)

  const refreshAll = () => {
    for (const key of ['shops', 'products', 'orders', 'employees', 'growth']) {
      void queryClient.invalidateQueries({ queryKey: ['seller', key, activeBusiness?.id] })
    }
    void queryClient.invalidateQueries({ queryKey: ['seller', 'finances', 'dashboard'] })
  }

  // web: an EMPLOYEE account's workspace is /employee/dashboard, not the seller dashboard
  if (user?.account_type === 'EMPLOYEE') return <Redirect href="/seller/employee" />
  if (!user) return <View style={styles.center}><Text style={styles.title}>{t('seller.workspace')}</Text><Button title={t('seller.signInAsSeller')} onPress={() => router.push('/auth/login')} /></View>
  if (!canSell(user) && !canOnboardSeller(user)) return <View style={styles.center}><Text style={styles.title}>{t('seller.accessRequired')}</Text><Text style={styles.muted}>{t('seller.accessRequiredBody')}</Text><Button variant="outline" title={t('common.backToMarketplace')} onPress={() => router.replace('/(buyer)')} /></View>

  // ── 1. No business exists for this seller ──
  if (sellerBusinesses.length === 0) return <ScrollView style={styles.scene} contentContainerStyle={styles.page}>
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconWrap}><Ionicons name="business-outline" size={30} color={colors.onGreen} /></View>
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
  if (!activeBusiness) return <ScrollView style={styles.scene} contentContainerStyle={styles.page}>
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconWrap}><Ionicons name="business-outline" size={30} color={colors.onGreen} /></View>
      <Text style={styles.emptyH2}>{t('seller.dashboard.selectBusiness')}</Text>
      <Text style={[styles.muted, styles.center_]}>{t('seller.dashboard.selectBusinessHint')}</Text>
      {sellerBusinesses.map((business) => (
        <Pressable key={business.id} accessibilityRole="button" style={({ pressed }) => [styles.choiceCard, pressed && styles.qaCardPressed]} onPress={() => setActiveBusiness(business)}>
          <View style={styles.choiceBrand}><Ionicons name="business-outline" size={20} color={colors.onGreen} /></View>
          <View style={styles.flex1}>
            <Text style={styles.qaTitle}>{business.name}</Text>
            <Text style={styles.small}>{business.category || business.business_type || t('seller.dashboard.registeredBusiness')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.onNavyMuted} />
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
  const currentShop = (shops.data ?? []).find((shop) => shop.id === activeShop)
  const latestProducts = (products.data ?? []).filter((p) => p.publication_status !== 'ARCHIVED').slice(0, 3)
  const hasData = all.some((q) => q.data !== undefined)
  const partialFailureSections = [
    unavailable.shops ? t('seller.shops') : null,
    unavailable.products ? t('seller.products') : null,
    unavailable.orders ? t('seller.orders') : null,
    unavailable.employees ? t('seller.employees') : null,
    unavailable.growth ? t('seller.growth') : null,
  ].filter(Boolean) as string[]

  return <ScrollView style={styles.scene} contentContainerStyle={styles.page}>
    {/* ── Header (reference 6): blue shop tile, "Ma boutique" kicker, shop
        name, TBK wordmark; refresh sits beside the wordmark. ── */}
    <View style={styles.headRow}>
      <View style={styles.headTile}><Ionicons name="storefront-outline" size={22} color={colors.onGreen} /></View>
      <View style={styles.flex1}>
        <Text style={styles.headKicker}>{t('sellerUi.myShop')}</Text>
        <Text style={styles.h1} numberOfLines={1}>{currentShop?.name || activeBusiness.name}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('orders.refresh')} disabled={loading} onPress={refreshAll} hitSlop={6} style={({ pressed }) => [styles.refreshBtn, (pressed || loading) && styles.refreshBtnBusy]}>
        <Ionicons name="refresh" size={17} color={colors.onNavy} />
      </Pressable>
      <BrandLogo size={30} />
    </View>

    {partialFailureSections.length > 0 && <View style={styles.partialWarning} accessibilityRole="alert">
      <Text style={styles.partialTitle}>{t('seller.dashboard.partialErrorTitle')}</Text>
      <Text style={styles.partialBody}>{t('seller.dashboard.partialErrorBody', { sections: partialFailureSections.join(', ') })}</Text>
      <Button dense variant="outline" title={`↻  ${t('seller.dashboard.retrySections')}`} disabled={loading} onPress={refreshAll} />
    </View>}

    {loading && !hasData && <Loading label={t('seller.dashboard.loadingMetrics')} />}

    {/* ── KPI pair: month sales (blue) + orders to prepare (navy), from the
        seller finance dashboard scoped to this month and the active shop ── */}
    <View style={styles.kpiRow}>
      <Pressable accessibilityRole="link" onPress={() => router.push('/seller/finances')} style={({ pressed }) => [styles.kpi, styles.kpiBlue, pressed && styles.kpiPressed]}>
        <Text style={[styles.kpiLabel, styles.kpiLabelBlue]} numberOfLines={1}>{t('sellerUi.monthSales')}</Text>
        <Text style={[styles.kpiValue, styles.kpiValueBlue]} numberOfLines={1} adjustsFontSizeToFit>{month.isError ? '—' : month.data ? formatMoney(month.data.gross_sales, month.data.currency) : '…'}</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => router.push('/seller/orders')} style={({ pressed }) => [styles.kpi, pressed && styles.kpiPressed]}>
        <Text style={styles.kpiLabel} numberOfLines={1}>{t('sellerUi.ordersToPrepare')}</Text>
        <Text style={styles.kpiValue} numberOfLines={1}>{month.isError ? '—' : month.data ? String(month.data.pending_orders ?? 0) : '…'}</Text>
      </Pressable>
    </View>

    {/* ── "Publier un article": the white action card ── */}
    <QuickAction hero icon="add" title={t('sellerUi.publishItem')} desc={t('sellerUi.publishItemSub')} onPress={() => router.push('/seller/products/create')} colors={colors} styles={styles} />

    {/* ── Mes articles: latest items with their publication pill ── */}
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.h3, styles.flex1]}>{t('sellerUi.myItems')}</Text>
        <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push('/seller/products')}><Text style={styles.headerLink}>{t('sellerUi.manageAll')}</Text></Pressable>
      </View>
      {products.isError ? <View style={styles.emptyBlock}><Text style={styles.small}>{t('seller.productList.loadFailed')}</Text></View>
        : products.isLoading ? <View style={styles.emptyBlock}><Text style={styles.small}>{t('seller.productList.loading')}</Text></View>
        : latestProducts.length === 0 ? <View style={styles.emptyBlock}>
          <View style={styles.emptyBlockIcon}><Ionicons name="cube-outline" size={24} color={colors.cyan} /></View>
          <Text style={styles.emptyTitle}>{t('seller.productList.noProductsTitle')}</Text>
        </View>
        : <View style={styles.qaGrid}>
          {latestProducts.map((product) => {
            const published = product.publication_status === 'PUBLISHED'
            const draft = product.publication_status === 'DRAFT'
            return <Pressable key={product.id} accessibilityRole="button" onPress={() => router.push(`/seller/products/${product.id}`)} style={({ pressed }) => [styles.articleRow, pressed && styles.qaCardPressed]}>
              <ArticleThumb businessId={activeBusiness.id} productId={product.id} colors={colors} styles={styles} />
              <View style={styles.flex1}>
                <Text style={styles.qaTitle} numberOfLines={1}>{product.name}</Text>
                <Text style={styles.articlePrice}>{product.unit_price ? formatMoney(Number(product.unit_price), (product as { currency?: string }).currency) : '—'}</Text>
              </View>
              <Text style={[styles.pill, published ? styles.pillOnline : styles.pillDraft]} numberOfLines={1}>
                {published ? t('sellerUi.online') : draft ? t('sellerUi.draft') : t(`seller.publicationStatus.${product.publication_status}` as TranslationKey)}
              </Text>
            </Pressable>
          })}
        </View>}
    </View>

    {/* ── Metrics: same five cards, same order as web ── */}
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}><Text style={[styles.h3, styles.flex1]}>{t('seller.dashboard')}</Text></View>
      <View style={styles.metrics}>
        <Stat stat="shops" label={t('seller.shops')} value={unavailable.shops ? '—' : String(shopsCount)} link={t('seller.dashboard.manageShops')} onPress={() => router.push('/seller/shops')} colors={colors} styles={styles} />
        <Stat stat="products" label={t('seller.products')} value={unavailable.products ? '—' : String(productsCount)} sub={t('seller.dashboard.publishedCount', { count: publishedProducts })} link={t('common.viewAll')} onPress={() => router.push('/seller/products')} colors={colors} styles={styles} />
        <Stat stat="orders" label={t('seller.orders')} value={unavailable.orders ? '—' : String(ordersCount)} sub={formatMoney(totalRevenue)} link={t('seller.dashboard.viewOrders')} onPress={() => router.push('/seller/orders')} colors={colors} styles={styles} />
        <Stat stat="employees" label={t('seller.employees')} value={unavailable.employees ? '—' : String(employeesCount)} link={t('seller.dashboard.manageTeam')} onPress={() => router.push('/seller/employees')} colors={colors} styles={styles} />
        <Stat stat="growth" label={t('seller.dashboard.sellerLevel')} value={unavailable.growth ? '—' : sellerLevel} tier
          trust={`${t(TRUST_STATUS_KEYS[trustStatus] ?? 'seller.growth.trust.NORMAL')} (${sellerPoints} pts)`}
          link={t('seller.growth')} onPress={() => router.push('/seller/growth')} colors={colors} styles={styles} />
      </View>
    </View>

    {/* ── Recent Orders ── */}
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.flex1}>
          <Text style={styles.h3}>{t('seller.dashboard.recentOrders')}</Text>
          <Text style={styles.small}>{t('seller.dashboard.recentOrdersHint')}</Text>
        </View>
        <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push('/seller/orders')}><Text style={styles.headerLink}>{t('seller.dashboard.viewAllOrders')}</Text></Pressable>
      </View>
      {recentOrders.length === 0 ? <View style={styles.emptyBlock}>
        <View style={styles.emptyBlockIcon}><Ionicons name="receipt-outline" size={26} color={colors.cyan} /></View>
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
    <View style={styles.sectionCard}>
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

/** Icon tints on navy: the same hue per metric as web's `.stat-icon--*`
 *  rules, but on a navyLine tile so they read on the dark dashboard. */
function statTint(stat: StatKey, colors: Colors) {
  switch (stat) {
    case 'shops': return colors.cyan
    case 'products': return colors.warning
    case 'orders': return colors.success
    case 'employees': return colors.purple
    case 'growth': return colors.magenta
  }
}

function Stat({ stat, label, value, sub, trust, link, tier, featured, onPress, colors, styles }: { stat: StatKey; label: string; value: string; sub?: string; trust?: string; link: string; tier?: boolean; featured?: boolean; onPress: () => void; colors: Colors; styles: S }) {
  return <View style={[styles.statCard, featured && styles.statCardFeatured]}>
    <View style={styles.statHeader}>
      <Text numberOfLines={1} style={[styles.statLabel, featured && styles.statLabelFeatured]}>{label.toUpperCase()}</Text>
      <View style={[styles.statIcon, featured && styles.statIconFeatured]}><Ionicons name={STAT_ICONS[stat]} size={16} color={featured ? colors.onGold : statTint(stat, colors)} /></View>
    </View>
    <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, tier && styles.statValueTier, featured && styles.statValueFeatured]}>{value}</Text>
    <View style={[styles.statFooter, featured && styles.statFooterFeatured, !sub && !trust && styles.statFooterEnd]}>
      {sub ? <Text numberOfLines={1} style={[styles.small, featured && styles.smallFeatured]}>{sub}</Text> : null}
      {trust ? <View style={styles.trustPill}><Ionicons name="shield-checkmark-outline" size={13} color={colors.success} /><Text numberOfLines={1} style={styles.trustText}>{trust}</Text></View> : null}
      <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}><Text style={[styles.statLink, featured && styles.statLinkFeatured]}>{link} →</Text></Pressable>
    </View>
  </View>
}

function QuickAction({ icon, title, desc, hero, onPress, colors, styles }: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string; hero?: boolean; onPress: () => void; colors: Colors; styles: S }) {
  return <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [hero ? styles.heroCard : styles.qaCard, pressed && (hero ? styles.heroCardPressed : styles.qaCardPressed)]}>
    <View style={hero ? styles.heroIcon : styles.qaIcon}><Ionicons name={icon} size={hero ? 22 : 18} color={colors.onGreen} /></View>
    <View style={styles.flex1}>
      <Text style={hero ? styles.heroTitle : styles.qaTitle}>{title}</Text>
      <Text style={hero ? styles.heroSub : styles.small}>{desc}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={hero ? colors.green : colors.onNavyMuted} />
  </Pressable>
}

/** Rounded article thumbnail: the product's main photo (same query key the
 *  product detail screen uses, so the cache is shared), else a cube tile. */
function ArticleThumb({ businessId, productId, colors, styles }: { businessId: string; productId: string; colors: Colors; styles: S }) {
  const images = useQuery({ queryKey: ['seller', 'productImages', productId], queryFn: () => sellerApi.productImages(businessId, productId).catch(() => []) })
  const main = (images.data ?? []).find((img) => img.is_primary) ?? images.data?.[0]
  return <View style={styles.thumb}>
    {main ? <Image source={resolveMediaUrl(main.url)} style={styles.thumbImg} contentFit="cover" /> : <Ionicons name="cube-outline" size={22} color={colors.cyan} />}
  </View>
}

function Check({ done, title, sub, linkLabel, onLinkPress, colors, styles }: { done: boolean; title: string; sub?: string; linkLabel?: string; onLinkPress?: () => void; colors: Colors; styles: S }) {
  return <View style={styles.checkItem}>
    <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={done ? colors.success : colors.onNavyMuted} style={styles.checkIcon} />
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

/* Reference 6 "Espace vendeur": the whole dashboard sits on navy in BOTH
   themes — navySoft cards with navyLine borders, white/onNavyMuted text, cyan
   figures, one filled-blue featured stat and a white "publish" action card. */
const makeStyles = (colors: Colors) => StyleSheet.create({
  scene: { flex: 1, backgroundColor: colors.navy },
  page: { flexGrow: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xl, gap: 18, backgroundColor: colors.navy },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md, backgroundColor: colors.navy },
  center_: { textAlign: 'center' },
  flex1: { flex: 1 },
  title: { fontSize: 22, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3, color: colors.onNavy, textAlign: 'center' },
  h1: { fontSize: 21, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3, color: colors.onNavy, lineHeight: 26 },
  h3: { fontSize: 16, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.2, color: colors.onNavy, marginBottom: 2 },
  muted: { color: colors.onNavyMuted, fontSize: 14, lineHeight: 21 },
  small: { color: colors.onNavyMuted, fontSize: 12, lineHeight: 16 },
  pageHeader: { gap: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headTile: { width: 46, height: 46, borderRadius: radius.sm, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  headSub: { color: colors.onNavyMuted, fontSize: 12.5, marginTop: 2 },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headKicker: { ...kicker, fontSize: 10, color: colors.onNavyMuted, marginBottom: 1 },
  refreshBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.navySoft, borderWidth: 1, borderColor: colors.navyLine, alignItems: 'center', justifyContent: 'center' },
  refreshBtnBusy: { opacity: 0.55 },

  // "Ventes du mois" (filled blue) + "Commandes à préparer" (navySoft).
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpi: { flex: 1, minHeight: 92, justifyContent: 'space-between', padding: 14, borderRadius: radius.md, backgroundColor: colors.navySoft, borderWidth: 1, borderColor: colors.navyLine },
  kpiBlue: { backgroundColor: colors.green, borderColor: colors.green, ...shadow.raised },
  kpiPressed: { opacity: 0.85 },
  kpiLabel: { fontSize: 11.5, fontWeight: '600', color: colors.onNavyMuted },
  kpiLabelBlue: { color: colors.onGreen, opacity: 0.85 },
  kpiValue: { fontSize: 26, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.5, color: colors.cyan, marginTop: 10 },
  kpiValueBlue: { color: colors.onGreen },

  // "Mes articles" rows.
  articleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, backgroundColor: colors.navySoft, borderWidth: 1, borderColor: colors.navyLine, borderRadius: radius.md },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.navyLine, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  articlePrice: { fontSize: 13, fontWeight: '700', color: colors.cyan, marginTop: 2 },
  pill: { ...kicker, fontSize: 9.5, letterSpacing: 0.6, paddingVertical: 4, paddingHorizontal: 9, borderRadius: radius.pill, overflow: 'hidden' },
  pillOnline: { backgroundColor: colors.successSoft, color: colors.success },
  pillDraft: { backgroundColor: colors.navyLine, color: colors.onNavyMuted },

  partialWarning: { gap: 6, padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.warningSoft, alignItems: 'flex-start' },
  partialTitle: { fontWeight: '700', color: colors.ink },
  partialBody: { color: colors.ink, fontSize: 14 },

  // Two tiles per row.
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flexBasis: '46%', flexGrow: 1, backgroundColor: colors.navySoft, borderWidth: 1, borderColor: colors.navyLine, borderRadius: radius.md, padding: 14 },
  statCardFeatured: { backgroundColor: colors.green, borderColor: colors.green, ...shadow.raised },
  statHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 },
  statLabel: { ...kicker, flexShrink: 1, fontSize: 10, color: colors.onNavyMuted },
  statLabelFeatured: { color: colors.onGreen, opacity: 0.85 },
  statIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.navyLine, alignItems: 'center', justifyContent: 'center' },
  statIconFeatured: { backgroundColor: colors.gold },
  statValue: { fontSize: 26, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.5, color: colors.cyan, lineHeight: 31, marginBottom: 10 },
  statValueFeatured: { color: colors.onGreen },
  statValueTier: { fontSize: 19 },
  statFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.navyLine },
  statFooterFeatured: { borderTopColor: colors.gold },
  statFooterEnd: { justifyContent: 'flex-start' },
  smallFeatured: { color: colors.onGreen, opacity: 0.85 },
  statLink: { fontSize: 12, fontWeight: '700', color: colors.cyan },
  statLinkFeatured: { color: colors.onGreen },
  trustPill: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, backgroundColor: colors.successSoft, borderRadius: radius.pill, paddingVertical: 2, paddingHorizontal: 8 },
  trustText: { fontSize: 11.5, fontWeight: '700', color: colors.success, flexShrink: 1 },

  // White "publish an item" action card.
  heroCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  heroCardPressed: { opacity: 0.9 },
  heroIcon: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  heroSub: { fontSize: 12, color: colors.muted, marginTop: 1 },

  // Sections sit directly on navy: white bold header + cyan-blue link.
  sectionCard: { gap: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  headerLink: { fontSize: 12.5, fontWeight: '700', color: colors.cyan },
  emptyBlock: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16, gap: 4, backgroundColor: colors.navySoft, borderWidth: 1, borderColor: colors.navyLine, borderRadius: radius.md },
  emptyBlockIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.navyLine, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontWeight: '700', color: colors.onNavy, marginTop: 8 },

  // Recent orders table inside a navySoft card.
  tableScroll: { minWidth: '100%' },
  table: { flexGrow: 1, minWidth: 420, backgroundColor: colors.navySoft, borderWidth: 1, borderColor: colors.navyLine, borderRadius: radius.md, overflow: 'hidden' },
  tableHead: { flexDirection: 'row', backgroundColor: colors.navyLine },
  th: { fontSize: 10.5, fontWeight: '700', color: colors.onNavyMuted, letterSpacing: 0.8, paddingVertical: 9, paddingHorizontal: 10 },
  tableRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.navyLine },
  colOrder: { flex: 1.3, paddingVertical: 12, paddingHorizontal: 10 },
  colStatus: { flex: 1.2, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'flex-start' },
  colTotal: { flex: 1, paddingVertical: 12, paddingHorizontal: 10 },
  colDate: { flex: 1, paddingVertical: 12, paddingHorizontal: 10 },
  orderCode: { fontWeight: '700', color: colors.onNavy, fontSize: 13.5 },
  tdStrong: { fontWeight: '700', color: colors.cyan, fontSize: 14 },
  statusBadge: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, overflow: 'hidden', color: colors.onNavy, backgroundColor: colors.navyLine },

  // Quick actions: navySoft rows, blue icon tile, chevron.
  qaGrid: { gap: 8 },
  qaCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: colors.navySoft, borderWidth: 1, borderColor: colors.navyLine, borderRadius: radius.md },
  qaCardPressed: { borderColor: colors.green },
  qaIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  qaTitle: { fontSize: 14, fontWeight: '700', color: colors.onNavy },

  checkGrid: { gap: 8 },
  checkItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.navySoft, borderWidth: 1, borderColor: colors.navyLine },
  checkIcon: { marginTop: 1 },
  checkLink: { color: colors.cyan, fontWeight: '700', fontSize: 12, marginTop: 4 },

  // No-business / pick-a-business states, on navy as well.
  emptyCard: { backgroundColor: colors.navySoft, borderWidth: 1, borderColor: colors.navyLine, borderRadius: radius.lg, padding: 20, gap: 14, alignItems: 'stretch', marginVertical: spacing.md },
  emptyIconWrap: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', ...shadow.raised },
  emptyH2: { fontSize: 22, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3, color: colors.onNavy, textAlign: 'center' },
  stepsPreview: { borderTopWidth: 1, borderTopColor: colors.navyLine, paddingTop: 18, gap: 8 },
  stepsTitle: { ...kicker, color: colors.cyan, marginBottom: 2 },
  choiceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.navy, borderWidth: 1, borderColor: colors.navyLine },
  choiceBrand: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: colors.onGreen, fontWeight: '800' },
})
