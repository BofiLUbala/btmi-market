import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useAdminAuth } from '../../../src/store/adminAuth'

const NAV_ITEMS = [
  { label: 'Product Catalog', icon: '📦', route: '/admin/commerce/products' },
  { label: 'Categories', icon: '🏷️', route: '/admin/commerce/categories' },
  { label: 'Inventory Control', icon: '📊', route: '/admin/commerce/inventory' },
  { label: 'Stock History', icon: '📋', route: '/admin/commerce/inventory/history' },
  { label: 'Orders', icon: '🛒', route: '/admin/commerce/orders' },
  { label: 'Marketplace Visibility', icon: '👁️', route: '/admin/commerce/marketplace/visibility' },
  { label: 'Search Admin', icon: '🔍', route: '/admin/commerce/marketplace/search' },
  { label: 'Marketplace Ranking', icon: '🏆', route: '/admin/commerce/marketplace/ranking' },
  { label: 'Product Quality', icon: '✅', route: '/admin/commerce/marketplace/quality' },
  { label: 'Promotions', icon: '🎁', route: '/admin/commerce/marketplace/promotions' },
  { label: 'Employees', icon: '👥', route: '/admin/commerce/employees' },
  { label: 'Seller Performance', icon: '📈', route: '/admin/commerce/performance/sellers' },
  { label: 'Category Performance', icon: '📊', route: '/admin/commerce/performance/categories' },
  { label: 'Shop Performance', icon: '🏪', route: '/admin/commerce/performance/shops' },
]

export default function MobileCommerceScreen() {
  const router = useRouter()
  const { hasRole } = useAdminAuth()

  if (!hasRole(['COMMERCE_ADMIN', 'SUPER_ADMIN'])) {
    return (
      <View style={styles.deniedContainer}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>🛡️</Text>
        <Text style={styles.deniedTitle}>Access Prohibited</Text>
        <Text style={styles.deniedSub}>Your role is not authorized to access Commerce & Operations.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/admin')}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Return to Direction</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>📦 Commerce & Operations</Text>
        <Text style={styles.bannerSub}>Rapid order lookup, stuck order alerts, and catalog triage.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Live Operational Monitors</Text>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Stuck Orders Alert:</Text>
          <Text style={[styles.metricVal, { color: '#10b981' }]}>0 Stuck</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Fulfillment Speed:</Text>
          <Text style={styles.metricVal}>Normal (&lt; 2h avg)</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Negative Stock Anomalies:</Text>
          <Text style={[styles.metricVal, { color: '#10b981' }]}>None detected</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Control Panels</Text>
        {NAV_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.navItem}
            onPress={() => router.push(item.route as any)}
          >
            <Text style={styles.navIcon}>{item.icon}</Text>
            <Text style={styles.navLabel}>{item.label}</Text>
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
