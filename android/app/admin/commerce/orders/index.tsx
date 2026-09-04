import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput } from 'react-native'
import { useRouter } from 'expo-router'
import { adminCommerceApi } from '../../../../src/api/admin'

export default function MobileOrdersScreen() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminCommerceApi.listOrders({
        search: search || undefined,
        status: statusFilter || undefined,
        limit: 20,
        offset: page,
      })
      setOrders(res.orders)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, page])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const statusColor = (status: string) => {
    if (status === 'COMPLETED' || status === 'DELIVERED') return '#34d399'
    if (status === 'PENDING') return '#fbbf24'
    if (status === 'CANCELLED') return '#ef4444'
    if (status === 'SHIPPED') return '#60a5fa'
    return '#94a3b8'
  }

  const STATUS_OPTIONS = ['', 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED']

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search order # or customer..."
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={(text) => { setSearch(text); setPage(0) }}
        />
        <FlatList
          horizontal
          data={STATUS_OPTIONS}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          style={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterBtn, statusFilter === item && styles.filterBtnActive]}
              onPress={() => { setStatusFilter(item); setPage(0) }}
            >
              <Text style={[styles.filterBtnText, statusFilter === item && styles.filterBtnTextActive]}>
                {item || 'All'}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No orders found</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/admin/commerce/orders/${item.id}` as any)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.orderNum}>#{item.order_number}</Text>
                <View style={[styles.badge, { backgroundColor: statusColor(item.fulfillment_status) + '20' }]}>
                  <Text style={[styles.badgeText, { color: statusColor(item.fulfillment_status) }]}>{item.fulfillment_status}</Text>
                </View>
              </View>
              <Text style={styles.customer}>{item.customer_name}</Text>
              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>{item.shop_name}</Text>
                <Text style={styles.price}>${item.total.toFixed(2)}</Text>
              </View>
              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>Items: {item.item_count}</Text>
                <Text style={styles.metaText}>{item.delivery_method}</Text>
              </View>
            </TouchableOpacity>
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
  filterList: { maxHeight: 36 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#1e293b', marginRight: 8 },
  filterBtnActive: { backgroundColor: '#10b981' },
  filterBtnText: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },
  filterBtnTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#64748b', fontSize: 14 },
  emptyText: { color: '#64748b', fontSize: 14 },
  card: { backgroundColor: '#0f172a', marginHorizontal: 12, marginTop: 12, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#1e293b' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderNum: { fontSize: 15, fontWeight: '800', color: '#60a5fa' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  customer: { fontSize: 13, color: '#f8fafc', marginBottom: 6 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  metaText: { fontSize: 12, color: '#94a3b8' },
  price: { fontSize: 14, fontWeight: '700', color: '#f8fafc' },
})
