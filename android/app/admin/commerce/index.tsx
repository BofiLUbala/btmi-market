import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useAdminAuth } from '../../../src/store/adminAuth'
import { useI18n, type TranslationKey } from '../../../src/store/i18n'

const NAV_ITEMS: { key: TranslationKey; icon: string; route: string }[] = [
  { key: 'admin.commerce.nav.productCatalog', icon: '📦', route: '/admin/commerce/products' },
  { key: 'admin.commerce.nav.categories', icon: '🏷️', route: '/admin/commerce/categories' },
  { key: 'admin.commerce.nav.inventoryControl', icon: '📊', route: '/admin/commerce/inventory' },
  { key: 'admin.commerce.nav.stockHistory', icon: '📋', route: '/admin/commerce/inventory/history' },
  { key: 'admin.commerce.nav.orders', icon: '🛒', route: '/admin/commerce/orders' },
  { key: 'admin.commerce.nav.marketplaceVisibility', icon: '👁️', route: '/admin/commerce/marketplace/visibility' },
  { key: 'admin.commerce.nav.searchAdmin', icon: '🔍', route: '/admin/commerce/marketplace/search' },
  { key: 'admin.commerce.nav.marketplaceRanking', icon: '🏆', route: '/admin/commerce/marketplace/ranking' },
  { key: 'admin.commerce.nav.productQuality', icon: '✅', route: '/admin/commerce/marketplace/quality' },
  { key: 'admin.commerce.nav.promotions', icon: '🎁', route: '/admin/commerce/marketplace/promotions' },
  { key: 'admin.commerce.nav.employees', icon: '👥', route: '/admin/commerce/employees' },
  { key: 'admin.commerce.nav.sellerPerformance', icon: '📈', route: '/admin/commerce/performance/sellers' },
  { key: 'admin.commerce.nav.categoryPerformance', icon: '📊', route: '/admin/commerce/performance/categories' },
  { key: 'admin.commerce.nav.shopPerformance', icon: '🏪', route: '/admin/commerce/performance/shops' },
]

export default function MobileCommerceScreen() {
  const router = useRouter()
  const { hasRole } = useAdminAuth()
  const { t } = useI18n()

  if (!hasRole(['COMMERCE_ADMIN', 'SUPER_ADMIN'])) {
    return (
      <View style={styles.deniedContainer}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>🛡️</Text>
        <Text style={styles.deniedTitle}>{t('admin.accessProhibited')}</Text>
        <Text style={styles.deniedSub}>{t('admin.commerce.accessDeniedBody')}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/admin')}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{t('admin.returnToDirection')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>{t('admin.commerce.header')}</Text>
        <Text style={styles.bannerSub}>{t('admin.commerce.sub')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('admin.commerce.monitorsTitle')}</Text>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>{t('admin.commerce.stuckOrders')}</Text>
          <Text style={[styles.metricVal, { color: '#10b981' }]}>{t('admin.commerce.stuckCount', { count: 0 })}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>{t('admin.commerce.fulfillmentSpeed')}</Text>
          <Text style={styles.metricVal}>{t('admin.commerce.normalSpeed')}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>{t('admin.commerce.negativeStock')}</Text>
          <Text style={[styles.metricVal, { color: '#10b981' }]}>{t('admin.commerce.noneDetected')}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('admin.commerce.controlPanels')}</Text>
        {NAV_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.navItem}
            onPress={() => router.push(item.route as any)}
          >
            <Text style={styles.navIcon}>{item.icon}</Text>
            <Text style={styles.navLabel}>{t(item.key)}</Text>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  banner: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#34d399',
    marginBottom: 4,
  },
  bannerSub: {
    fontSize: 12,
    color: '#94a3b8',
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: '#1e293b',
  },
  metricLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#1e293b',
  },
  navIcon: {
    fontSize: 18,
    marginRight: 12,
    width: 28,
  },
  navLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
  },
  navArrow: {
    fontSize: 20,
    color: '#64748b',
    fontWeight: '700',
  },
  deniedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#090d16',
  },
  deniedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ef4444',
    marginBottom: 8,
  },
  deniedSub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
  },
  backBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
})
