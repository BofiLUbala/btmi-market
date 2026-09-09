import { useMemo, useState } from 'react'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { Button, Card, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'
import { canSell, canOnboardSeller, type Business, type Shop } from '../../src/types'

// This screen mirrors web-app/src/pages/seller/dashboard/SellerDashboardPage.tsx
// section-for-section (same 6 stat cards, Recent Orders, the same 6 Quick
// Actions, the same 5-item Setup Checklist) -- it is not an invented mobile
// layout. The web sidebar's full section list (Business/Shops/Employees/...)
// lives in SellerDrawer.tsx instead, since a phone can't keep a sidebar
// permanently on-screen; the business/shop switcher below stands in for the
// same switcher in web's top header.
export default function SellerHome() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const user = useAuth((s) => s.user)
  const sellerBusinesses = useAuth((s) => s.sellerBusinesses)
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const activeShop = useAuth((s) => s.activeShop)
  const setActiveBusiness = useAuth((s) => s.setActiveBusiness)
  const setActiveShop = useAuth((s) => s.setActiveShop)
  const [switcherOpen, setSwitcherOpen] = useState(false)

  const shops = useQuery({ queryKey: ['seller', 'shops', activeBusiness?.id], queryFn: () => sellerApi.shops(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  const products = useQuery({ queryKey: ['seller', 'products', activeBusiness?.id], queryFn: () => sellerApi.products(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  const orders = useQuery({ queryKey: ['seller', 'orders', activeBusiness?.id], queryFn: () => sellerApi.businessOrders(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  const employees = useQuery({ queryKey: ['seller', 'employees', activeBusiness?.id], queryFn: () => sellerApi.employees(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  const cashSummary = useQuery({ queryKey: ['seller', 'cashSummary', activeBusiness?.id], queryFn: () => sellerApi.businessCashSummary(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  const growth = useQuery({ queryKey: ['seller', 'growth', activeBusiness?.id], queryFn: () => sellerApi.growthLevel(activeBusiness!.id), enabled: Boolean(activeBusiness) })

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['seller', 'shops'] })
    void queryClient.invalidateQueries({ queryKey: ['seller', 'products'] })
    void queryClient.invalidateQueries({ queryKey: ['seller', 'orders'] })
    void queryClient.invalidateQueries({ queryKey: ['seller', 'employees'] })
    void queryClient.invalidateQueries({ queryKey: ['seller', 'cashSummary'] })
    void queryClient.invalidateQueries({ queryKey: ['seller', 'growth'] })
  }

  if (!user) return <View style={styles.center}><Text style={styles.title}>{t('seller.workspace')}</Text><Button title={t('seller.signInAsSeller')} onPress={() => router.push('/auth/login')} /></View>
  if (!canSell(user) && !canOnboardSeller(user)) return <View style={styles.center}><Text style={styles.title}>{t('seller.accessRequired')}</Text><Text style={styles.muted}>{t('seller.accessRequiredBody')}</Text><Button variant="outline" title={t('common.backToMarketplace')} onPress={() => router.replace('/(buyer)')} /></View>

  // ── 1. No business exists for this seller (mirrors web's welcome + steps) ──
  if (sellerBusinesses.length === 0) return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={t('seller.dashboard.welcomeTitle')} />
    <Text style={styles.muted}>{t('seller.dashboard.welcomeSubtitle')}</Text>
    <Button title={t('seller.startOnboarding')} onPress={() => router.push('/seller/onboarding')} />
    <SectionTitle title={t('seller.dashboard.howToStart')} />
    <Card>
      <Step n={1} title={t('seller.createBusiness')} desc={t('seller.dashboard.stepCreateBusinessDesc')} styles={styles} />
      <Step n={2} title={t('seller.dashboard.stepCreateShop')} desc={t('seller.dashboard.stepCreateShopDesc')} styles={styles} />
      <Step n={3} title={t('seller.dashboard.stepAddProducts')} desc={t('seller.dashboard.stepAddProductsDesc')} styles={styles} />
      <Step n={4} title={t('seller.dashboard.stepAddStock')} desc={t('seller.dashboard.stepAddStockDesc')} styles={styles} />
      <Step n={5} title={t('seller.dashboard.stepReceiveOrders')} desc={t('seller.dashboard.stepReceiveOrdersDesc')} styles={styles} />
    </Card>
    <Button variant="outline" title={t('common.backToMarketplace')} onPress={() => router.replace('/(buyer)')} />
  </ScrollView>

  // ── 2. Businesses exist, none currently active (mirrors web's selection grid) ──
  if (!activeBusiness) return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={t('seller.dashboard.selectBusiness')} />
    <Text style={styles.muted}>{t('seller.dashboard.selectBusinessHint')}</Text>
    {sellerBusinesses.map((business) => (
      <Card key={business.id} onPress={() => setActiveBusiness(business)}>
        <Text style={styles.switcherName}>{business.name}</Text>
        <Text style={styles.muted}>{t('seller.dashboard.registeredBusiness')}</Text>
      </Card>
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
  const currentShop = (shops.data ?? []).find((s) => s.id === activeShop) ?? shops.data?.[0]
  const loadingMetrics = shops.isLoading || products.isLoading || orders.isLoading

  return <>
  <ScrollView contentContainerStyle={styles.page}>
    <Pressable accessibilityRole="button" onPress={() => setSwitcherOpen(true)} style={styles.switcher}>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>{t('seller.currentBusiness')}</Text>
        <Text style={styles.switcherName}>{activeBusiness.name}</Text>
        <Text style={styles.switcherShop}>{currentShop ? currentShop.name : t('seller.allShops')}</Text>
      </View>
      <Text style={styles.switcherChevron}>⇅</Text>
    </Pressable>

    <View style={styles.headRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.h1}>{t('seller.dashboard')}</Text>
        <Text style={styles.muted}>{t('seller.dashboard.overviewFor', { name: activeBusiness.name })}</Text>
      </View>
    </View>
    <View style={styles.headActions}>
      <Button dense variant="outline" title={t('common.retry')} onPress={refreshAll} />
      <Button dense title={t('seller.dashboard.addProduct')} onPress={() => router.push('/seller/products/create')} />
    </View>

    {loadingMetrics && <Loading label={t('seller.dashboard.loadingMetrics')} />}

    {/* ── Metrics: same 6 cards as web, same order ── */}
    <View style={styles.grid}>
      <Stat label={t('seller.shops')} value={String(shopsCount)} footer={t('seller.dashboard.manageShops')} onPress={() => router.push('/seller/shops')} styles={styles} />
      <Stat label={t('seller.products')} value={String(productsCount)} sub={t('seller.dashboard.publishedCount', { count: publishedProducts })} footer={t('common.viewAll')} onPress={() => router.push('/seller/products')} styles={styles} />
    </View>
    <View style={styles.grid}>
      <Stat label={t('seller.orders')} value={String(ordersCount)} sub={`${totalRevenue.toLocaleString()} FC`} footer={t('seller.dashboard.viewOrders')} onPress={() => router.push('/seller/orders')} styles={styles} />
      <Stat label={t('seller.employees')} value={String(employeesCount)} footer={t('seller.dashboard.manageTeam')} onPress={() => router.push('/seller/employees')} styles={styles} />
    </View>
    <View style={styles.grid}>
      <Stat label={t('seller.dashboard.cashSales')} value={`${cashTotal.toLocaleString()} FC`} footer={t('seller.dashboard.cashSessions')} onPress={() => router.push('/seller/cash')} styles={styles} />
      <Stat label={t('seller.dashboard.sellerLevel')} value={sellerLevel} sub={`${t(`seller.growth.trust.${trustStatus}` as any)} (${sellerPoints} pts)`} footer={t('seller.growth')} onPress={() => router.push('/seller/growth')} styles={styles} />
    </View>

    {/* ── Recent Orders ── */}
    <SectionTitle title={t('seller.dashboard.recentOrders')} action={<Pressable accessibilityRole="button" onPress={() => router.push('/seller/orders')}><Text style={styles.link}>{t('seller.dashboard.viewAllOrders')}</Text></Pressable>} />
    <Text style={styles.muted}>{t('seller.dashboard.recentOrdersHint')}</Text>
    {recentOrders.length === 0 ? <Card><Text style={styles.muted}>{t('seller.dashboard.noOrdersYet')}</Text><Text style={styles.mutedSmall}>{t('seller.dashboard.noOrdersYetHint')}</Text></Card> : recentOrders.map((order) => (
      <Card key={order.id}>
        <View style={styles.row}>
          <Text style={styles.orderNumber}>{order.order_number || `#${order.id.slice(0, 8)}`}</Text>
          <Text style={styles.badge}>{order.status.replaceAll('_', ' ')}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.mutedSmall}>{order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}</Text>
          <Text style={styles.orderTotal}>{(order.final_total ?? 0).toLocaleString()} FC</Text>
        </View>
      </Card>
    ))}

    {/* ── Quick Actions: same 6 items as web, same order ── */}
    <SectionTitle title={t('seller.dashboard.quickActions')} />
    <Text style={styles.muted}>{t('seller.dashboard.quickActionsHint')}</Text>
    <View style={styles.actionsGrid}>
      <QuickAction title={t('seller.dashboard.addProduct')} desc={t('seller.dashboard.addProductDesc')} onPress={() => router.push('/seller/products/create')} styles={styles} />
      <QuickAction title={t('seller.dashboard.manageStock')} desc={t('seller.dashboard.manageStockDesc')} onPress={() => router.push('/seller/stock')} styles={styles} />
      <QuickAction title={t('seller.dashboard.processOrders')} desc={t('seller.dashboard.processOrdersDesc')} onPress={() => router.push('/seller/orders')} styles={styles} />
      <QuickAction title={t('seller.dashboard.manageShops')} desc={t('seller.dashboard.manageShopsDesc')} onPress={() => router.push('/seller/shops')} styles={styles} />
      <QuickAction title={t('seller.dashboard.teamAndStaff')} desc={t('seller.dashboard.teamAndStaffDesc')} onPress={() => router.push('/seller/employees')} styles={styles} />
      <QuickAction title={t('seller.dashboard.cashSessions')} desc={t('seller.dashboard.cashSessionsDesc')} onPress={() => router.push('/seller/cash')} styles={styles} />
    </View>

    {/* ── Setup Checklist: same 5 items as web, same order ── */}
    <SectionTitle title={t('seller.dashboard.setupChecklist')} />
    <Text style={styles.muted}>{t('seller.dashboard.setupChecklistHint')}</Text>
    <Card>
      <Check done title={t('seller.dashboard.checkBusinessRegistered')} sub={activeBusiness.name} styles={styles} />
      <Check done={shopsCount > 0} title={t('seller.dashboard.checkCreateShop')} sub={shopsCount > 0 ? t('seller.dashboard.shopsActiveCount', { count: shopsCount }) : undefined} linkLabel={shopsCount > 0 ? undefined : t('seller.dashboard.checkCreateShopLink')} onLinkPress={() => router.push('/seller/shops')} styles={styles} />
      <Check done={productsCount > 0} title={t('seller.dashboard.checkAddProducts')} sub={productsCount > 0 ? t('seller.dashboard.productsInCatalogCount', { count: productsCount }) : undefined} linkLabel={productsCount > 0 ? undefined : t('seller.dashboard.addProductLink')} onLinkPress={() => router.push('/seller/products/create')} styles={styles} />
      <Check done={publishedProducts > 0} title={t('seller.dashboard.checkPublishProducts')} sub={publishedProducts > 0 ? t('seller.dashboard.publishedMarketplaceCount', { count: publishedProducts }) : undefined} linkLabel={publishedProducts > 0 ? undefined : t('seller.dashboard.publishLink')} onLinkPress={() => router.push('/seller/products')} styles={styles} />
      <Check done={ordersCount > 0} title={t('seller.dashboard.checkReceiveFirstOrder')} sub={ordersCount > 0 ? t('seller.dashboard.ordersProcessedCount', { count: ordersCount }) : t('seller.dashboard.ordersAppearHint')} styles={styles} last />
    </Card>

    <Button variant="outline" title={t('common.backToMarketplace')} onPress={() => router.replace('/(buyer)')} />
  </ScrollView>

  {/* Plain conditional overlay instead of RN's <Modal>: on web, toggling a
   *  Modal's `visible` prop back to false reliably fails to hide the portal
   *  (confirmed live -- the onPress fires and state updates, but the modal
   *  stays on screen), so closing it that way is unusable both in this web
   *  preview and, since it's the same component, a real risk on-device too. */}
  {switcherOpen && <Pressable style={styles.modalBackdrop} onPress={() => setSwitcherOpen(false)}>
    <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
      <Text style={styles.modalTitle}>{t('seller.currentBusiness')}</Text>
      {sellerBusinesses.map((business: Business) => (
        <Pressable key={business.id} accessibilityRole="button" style={styles.modalRow} onPress={() => { setActiveBusiness(business); setSwitcherOpen(false) }}>
          <Text style={[styles.modalRowText, business.id === activeBusiness.id && styles.modalRowActive]}>{business.name}</Text>
          {business.id === activeBusiness.id && <Text style={styles.modalCheck}>✓</Text>}
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" onPress={() => { setSwitcherOpen(false); router.push('/seller/onboarding') }}><Text style={styles.modalAdd}>{t('seller.addNewBusiness')}</Text></Pressable>

      {(shops.data?.length ?? 0) > 0 && <>
        <Text style={[styles.modalTitle, { marginTop: spacing.md }]}>{t('seller.selectActiveShop')}</Text>
        {(shops.data as Shop[]).map((shop) => (
          <Pressable key={shop.id} accessibilityRole="button" style={styles.modalRow} onPress={() => { setActiveShop(shop.id); setSwitcherOpen(false) }}>
            <Text style={[styles.modalRowText, shop.id === activeShop && styles.modalRowActive]}>{shop.name}</Text>
            {shop.id === activeShop && <Text style={styles.modalCheck}>✓</Text>}
          </Pressable>
        ))}
      </>}
      <Button variant="outline" title={t('common.cancel')} onPress={() => setSwitcherOpen(false)} />
    </Pressable>
  </Pressable>}
  </>
}

type S = ReturnType<typeof makeStyles>

function Step({ n, title, desc, styles }: { n: number; title: string; desc: string; styles: S }) {
  return <View style={styles.stepRow}>
    <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
    <View style={{ flex: 1 }}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.mutedSmall}>{desc}</Text></View>
  </View>
}

function Stat({ label, value, sub, footer, onPress, styles }: { label: string; value: string; sub?: string; footer: string; onPress: () => void; styles: S }) {
  return <Card onPress={onPress}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.metric}>{value}</Text>
    {sub && <Text style={styles.mutedSmall}>{sub}</Text>}
    <Text style={styles.link}>{footer} ›</Text>
  </Card>
}

function QuickAction({ title, desc, onPress, styles }: { title: string; desc: string; onPress: () => void; styles: S }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.qaCard}>
    <Text style={styles.qaTitle}>{title}</Text>
    <Text style={styles.mutedSmall}>{desc}</Text>
  </Pressable>
}

function Check({ done, title, sub, linkLabel, onLinkPress, styles, last }: { done: boolean; title: string; sub?: string; linkLabel?: string; onLinkPress?: () => void; styles: S; last?: boolean }) {
  return <View style={[styles.checkRow, !last && styles.checkRowBorder]}>
    <Text style={[styles.checkMark, done && styles.checkMarkDone]}>{done ? '✓' : '○'}</Text>
    <View style={{ flex: 1 }}>
      <Text style={styles.checkTitle}>{title}</Text>
      {sub && <Text style={styles.mutedSmall}>{sub}</Text>}
      {linkLabel && <Pressable accessibilityRole="button" onPress={onLinkPress}><Text style={styles.link}>{linkLabel}</Text></Pressable>}
    </View>
  </View>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { fontSize: 25, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  h1: { fontSize: 24, fontWeight: '900', color: colors.ink },
  muted: { color: colors.muted },
  mutedSmall: { color: colors.muted, fontSize: 12 },
  switcher: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.greenSoft, borderRadius: radius.md, padding: spacing.md },
  eyebrow: { fontSize: 12, fontWeight: '900', color: colors.gold },
  switcherName: { fontSize: 20, fontWeight: '900', color: colors.ink },
  switcherShop: { color: colors.muted, fontWeight: '700' },
  switcherChevron: { fontSize: 22, color: colors.green },
  headRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headActions: { flexDirection: 'row', gap: spacing.sm },
  grid: { flexDirection: 'row', gap: spacing.sm },
  statLabel: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  metric: { fontSize: 24, fontWeight: '900', color: colors.green },
  link: { color: colors.green, fontWeight: '800', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderNumber: { fontWeight: '900', color: colors.ink },
  orderTotal: { fontWeight: '900', color: colors.ink },
  badge: { color: colors.green, fontWeight: '900', fontSize: 12, textTransform: 'capitalize' },
  stepRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: colors.onGreen, fontWeight: '900' },
  stepTitle: { fontWeight: '800', color: colors.ink },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  qaCard: { width: '48%', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, gap: 2 },
  qaTitle: { fontWeight: '800', color: colors.ink },
  checkRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm },
  checkRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  checkMark: { fontSize: 18, fontWeight: '900', color: colors.muted, width: 22 },
  checkMarkDone: { color: colors.success },
  checkTitle: { fontWeight: '800', color: colors.ink },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md, gap: spacing.xs, maxHeight: '80%' },
  modalTitle: { fontSize: 15, fontWeight: '900', color: colors.muted },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalRowText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  modalRowActive: { color: colors.green },
  modalCheck: { color: colors.green, fontWeight: '900' },
  modalAdd: { color: colors.gold, fontWeight: '800', paddingVertical: spacing.sm },
})
