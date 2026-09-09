import { useMemo, useState } from 'react'
import { router } from 'expo-router'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { Button, Card, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'
import { canSell, canOnboardSeller, type Business, type Shop } from '../../src/types'

const SECTIONS: { key: TranslationKey; path: string }[] = [
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

export default function SellerHome() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
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
  const inventory = useQuery({ queryKey: ['seller', 'inventory', activeShop], queryFn: () => sellerApi.shopInventory(activeShop!), enabled: Boolean(activeShop) })

  if (!user) return <View style={styles.center}><Text style={styles.title}>{t('seller.workspace')}</Text><Button title={t('seller.signInAsSeller')} onPress={() => router.push('/auth/login')} /></View>
  if (!canSell(user) && !canOnboardSeller(user)) return <View style={styles.center}><Text style={styles.title}>{t('seller.accessRequired')}</Text><Text style={styles.muted}>{t('seller.accessRequiredBody')}</Text><Button variant="outline" title={t('common.backToMarketplace')} onPress={() => router.replace('/(buyer)')} /></View>
  if (sellerBusinesses.length === 0) return <View style={styles.center}><Text style={styles.title}>{t('seller.createBusiness')}</Text><Text style={styles.muted}>{t('seller.onboardingBody')}</Text><Button title={t('seller.startOnboarding')} onPress={() => router.push('/seller/onboarding')} /><Button variant="outline" title={t('common.backToMarketplace')} onPress={() => router.replace('/(buyer)')} /></View>
  if (!activeBusiness) return <Loading label={t('seller.loadingBusinesses')} />
  if (shops.isLoading) return <Loading label={t('seller.loadingBusinesses')} />
  if ((shops.data?.length ?? 0) === 0) return <View style={styles.center}><Text style={styles.title}>{t('seller.finishSetupTitle')}</Text><Text style={styles.muted}>{t('seller.finishSetupBody', { name: activeBusiness.name })}</Text><Button title={t('seller.finishSetup')} onPress={() => router.push('/seller/onboarding')} /><Button variant="outline" title={t('common.backToMarketplace')} onPress={() => router.replace('/(buyer)')} /></View>

  const pendingOrders = (orders.data ?? []).filter((o) => o.status === 'PENDING').length
  const lowStock = (inventory.data ?? []).filter((i) => i.inventory.available <= 5).length
  const currentShop = (shops.data ?? []).find((s) => s.id === activeShop) ?? shops.data?.[0]

  return <ScrollView contentContainerStyle={styles.page}>
    <Pressable accessibilityRole="button" onPress={() => setSwitcherOpen(true)} style={styles.switcher}>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>{t('seller.currentBusiness')}</Text>
        <Text style={styles.switcherName}>{activeBusiness.name}</Text>
        <Text style={styles.switcherShop}>{currentShop ? currentShop.name : t('seller.allShops')}</Text>
      </View>
      <Text style={styles.switcherChevron}>⇅</Text>
    </Pressable>

    <View style={styles.grid}>
      <Card><Text style={styles.metric}>{shops.data?.length ?? 0}</Text><Text style={styles.label}>{t('seller.shops')}</Text></Card>
      <Card><Text style={styles.metric}>{products.data?.length ?? 0}</Text><Text style={styles.label}>{t('seller.products')}</Text></Card>
    </View>
    <View style={styles.grid}>
      <Card><Text style={styles.metric}>{pendingOrders}</Text><Text style={styles.label}>{t('seller.ordersToProcess')}</Text></Card>
      <Card><Text style={styles.metric}>{lowStock}</Text><Text style={styles.label}>{t('seller.stockAlerts')}</Text></Card>
    </View>

    <SectionTitle title={t('seller.quickActions')} />
    <Card>
      {SECTIONS.map((section) => (
        <Pressable key={section.path} accessibilityRole="button" onPress={() => router.push(section.path as any)}>
          <Text style={styles.action}>{t(section.key)}  ›</Text>
        </Pressable>
      ))}
    </Card>
    <Card>
      {PINNED.map((section) => (
        <Pressable key={section.path} accessibilityRole="button" onPress={() => router.push(section.path as any)}>
          <Text style={styles.action}>{t(section.key)}  ›</Text>
        </Pressable>
      ))}
    </Card>
    <Button variant="outline" title={t('common.backToMarketplace')} onPress={() => router.replace('/(buyer)')} />

    <Modal visible={switcherOpen} transparent animationType="fade" onRequestClose={() => setSwitcherOpen(false)}>
      <Pressable style={styles.modalBackdrop} onPress={() => setSwitcherOpen(false)}>
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
      </Pressable>
    </Modal>
  </ScrollView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { fontSize: 25, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  muted: { color: colors.muted },
  switcher: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.greenSoft, borderRadius: radius.md, padding: spacing.md },
  eyebrow: { fontSize: 12, fontWeight: '900', color: colors.gold },
  switcherName: { fontSize: 20, fontWeight: '900', color: colors.ink },
  switcherShop: { color: colors.muted, fontWeight: '700' },
  switcherChevron: { fontSize: 22, color: colors.green },
  grid: { flexDirection: 'row', gap: spacing.sm },
  metric: { fontSize: 26, fontWeight: '900', color: colors.green },
  label: { color: colors.muted },
  action: { fontSize: 17, fontWeight: '800', color: colors.ink, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md, gap: spacing.xs, maxHeight: '80%' },
  modalTitle: { fontSize: 15, fontWeight: '900', color: colors.muted },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalRowText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  modalRowActive: { color: colors.green },
  modalCheck: { color: colors.green, fontWeight: '900' },
  modalAdd: { color: colors.gold, fontWeight: '800', paddingVertical: spacing.sm },
})
