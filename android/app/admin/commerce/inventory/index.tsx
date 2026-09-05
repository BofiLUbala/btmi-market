import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, TextInput, Switch } from 'react-native'
import { adminCommerceApi } from '../../../../src/api/admin'
import { useI18n } from '../../../../src/store/i18n'

export default function MobileInventoryScreen() {
  const { t } = useI18n()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [page, setPage] = useState(0)

  const fetchInventory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminCommerceApi.listInventory({
        search: search || undefined,
        low_stock_only: lowStockOnly || undefined,
        limit: 20,
        offset: page,
      })
      setItems(res.items)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [search, lowStockOnly, page])

  useEffect(() => { fetchInventory() }, [fetchInventory])

  const statusColor = (available: number, lowStock: boolean) => {
    if (available <= 0) return '#ef4444'
    if (lowStock) return '#fbbf24'
    return '#34d399'
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('admin.inventory.searchPlaceholder')}
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={(text) => { setSearch(text); setPage(0) }}
        />
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>{t('admin.inventory.lowStockOnly')}</Text>
          <Switch
            value={lowStockOnly}
            onValueChange={(val) => { setLowStockOnly(val); setPage(0) }}
            trackColor={{ false: '#1e293b', true: '#064e3b' }}
            thumbColor={lowStockOnly ? '#34d399' : '#64748b'}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><Text style={styles.loadingText}>{t('admin.inventory.loading')}</Text></View>
      ) : items.length === 0 ? (
        <View style={styles.center}><Text style={styles.emptyText}>{t('admin.inventory.empty')}</Text></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, idx) => `${item.shop_id}-${item.sku}-${idx}`}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.productName} numberOfLines={1}>{item.product_name || item.variant_name || item.sku}</Text>
                <View style={[styles.statusDot, { backgroundColor: statusColor(item.available, item.status === 'LOW_STOCK') }]} />
              </View>
              <Text style={styles.shopText}>{t('admin.inventory.shop', { shop: item.shop_id })}</Text>
              <View style={styles.row}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>{t('admin.inventory.onHand')}</Text>
                  <Text style={styles.statValue}>{item.quantity}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>{t('admin.inventory.reserved')}</Text>
                  <Text style={[styles.statValue, { color: '#fbbf24' }]}>{item.reserved_quantity}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>{t('admin.inventory.available')}</Text>
                  <Text style={[styles.statValue, { color: statusColor(item.available, item.status === 'LOW_STOCK') }]}>{item.available}</Text>
                </View>
              </View>
            </View>
          )}
          onEndReached={() => setPage(p => p + 20)}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16' },
  searchBar: { padding: 12, backgroundColor: '#0f172a', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  searchInput: { backgroundColor: '#1e293b', borderRadius: 8, padding: 10, color: '#f8fafc', fontSize: 14, marginBottom: 8 },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterLabel: { fontSize: 13, color: '#94a3b8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#64748b', fontSize: 14 },
  emptyText: { color: '#64748b', fontSize: 14 },
  card: { backgroundColor: '#0f172a', marginHorizontal: 12, marginTop: 12, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#1e293b' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  productName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#f8fafc', marginRight: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  shopText: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center' },
  statLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 },
  statValue: { fontSize: 16, fontWeight: '800', color: '#f8fafc' },
})
