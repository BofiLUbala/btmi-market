import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet } from 'react-native'
import { adminCommerceApi } from '../../../../src/api/admin'

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: '#fca5a5',
  DIRECTION_ADMIN: '#fde68a',
  COMMERCE_ADMIN: '#93c5fd',
  FINANCE_SUPPORT_ADMIN: '#a7f3d0',
  TECHNICAL_ADMIN: '#c4b5fd',
}

export default function MobileEmployeesScreen() {
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminCommerceApi.listEmployees({ limit: 20, offset: page })
      setEmployees(res.employees)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}><Text style={styles.loadingText}>Loading...</Text></View>
      ) : employees.length === 0 ? (
        <View style={styles.center}><Text style={styles.emptyText}>No employees found</Text></View>
      ) : (
        <FlatList
          data={employees}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.card, item.status === 'REVOKED' && styles.cardRevoked]}>
              <View style={styles.cardHeader}>
                <Text style={styles.name}>{item.name}</Text>
                <View style={[styles.roleBadge, { backgroundColor: (ROLE_COLORS[item.role] || '#94a3b8') + '20' }]}>
                  <Text style={[styles.roleText, { color: ROLE_COLORS[item.role] || '#94a3b8' }]}>{item.role}</Text>
                </View>
              </View>
              <Text style={styles.email}>{item.email}</Text>
              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>Shop: {item.shop_name || 'N/A'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: item.status === 'ACTIVE' ? '#064e3b' : '#7f1d1d' }]}>
                  <Text style={[styles.statusText, { color: item.status === 'ACTIVE' ? '#a7f3d0' : '#fca5a5' }]}>{item.status}</Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#64748b', fontSize: 14 },
  emptyText: { color: '#64748b', fontSize: 14 },
  card: { backgroundColor: '#0f172a', marginHorizontal: 12, marginTop: 12, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#1e293b' },
  cardRevoked: { opacity: 0.5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  name: { flex: 1, fontSize: 15, fontWeight: '700', color: '#f8fafc', marginRight: 8 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleText: { fontSize: 10, fontWeight: '700' },
  email: { fontSize: 12, color: '#94a3b8', marginBottom: 8 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { fontSize: 12, color: '#94a3b8' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700' },
})
