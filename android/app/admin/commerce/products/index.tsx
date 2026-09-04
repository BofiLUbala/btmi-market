import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput } from 'react-native'
import { useRouter } from 'expo-router'
import { adminCommerceApi } from '../../../../src/api/admin'

export default function MobileProductsScreen() {
  const router = useRouter()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminCommerceApi.listProducts({ search: search || undefined, limit: 20, offset: page })
      setProducts(res.products)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const statusColor = (status: string) => {
    if (status === 'PUBLISHED' || status === 'ACTIVE') return '#34d399'
    if (status === 'DRAFT') return '#fbbf24'
    return '#94a3b8'
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={(text) => { setSearch(text); setPage(0) }}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No products found</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/admin/commerce/products/${item.id}` as any)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                <View style={[styles.badge, { backgroundColor: statusColor(item.publication_status) + '20' }]}>
                  <Text style={[styles.badgeText, { color: statusColor(item.publication_status) }]}>{item.publication_status}</Text>
                </View>
              </View>
              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>{item.business_name}</Text>
                <Text style={styles.metaText}>${item.effective_price.toFixed(2)}</Text>
              </View>
              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>Stock: {item.total_available}</Text>
                <Text style={styles.metaText}>Variants: {item.variant_count}</Text>
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
  searchInput: { backgroundColor: '#1e293b', borderRadius: 8, padding: 10, color: '#f8fafc', fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#64748b', fontSize: 14 },
  emptyText: { color: '#64748b', fontSize: 14 },
  card: { backgroundColor: '#0f172a', marginHorizontal: 12, marginTop: 12, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#1e293b' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#f8fafc', marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  metaText: { fontSize: 12, color: '#94a3b8' },
})
