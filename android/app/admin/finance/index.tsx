import { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { useAdminAuth } from '../../../src/store/adminAuth'
import { mobileAdminFinanceApi } from '../../../src/api/admin'

export default function MobileFinanceScreen() {
  const router = useRouter()
  const { hasRole } = useAdminAuth()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [pendingPayments, setPendingPayments] = useState<any[]>([])
  const [openCases, setOpenCases] = useState<any[]>([])
  const [riskAlerts, setRiskAlerts] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchFinanceData()
  }, [])

  const fetchFinanceData = async () => {
    setLoading(true)
    setError(null)
    try {
      const sum = await mobileAdminFinanceApi.getSummary()
      setSummary(sum)

      const payRes = await mobileAdminFinanceApi.listPayments({ payment_status: 'PENDING', limit: 5 })
      setPendingPayments(payRes.items || [])

      const caseRes = await mobileAdminFinanceApi.listCases({ status: 'OPEN', limit: 5 })
      setOpenCases(caseRes.items || [])

      const riskRes = await mobileAdminFinanceApi.listRiskEvents('OPEN')
      setRiskAlerts(riskRes.items || [])
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to Admin API')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  if (!hasRole(['FINANCE_SUPPORT_ADMIN', 'SUPER_ADMIN'])) {
    return (
      <View style={styles.deniedContainer}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>🛡️</Text>
        <Text style={styles.deniedTitle}>Access Prohibited</Text>
        <Text style={styles.deniedSub}>Your role is not authorized to access Finance / Support / Trust.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/admin')}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Return to Direction</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFinanceData() }} tintColor="#fbbf24" />}
    >
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>💰 Mobile Finance, Support & Trust</Text>
        <Text style={styles.bannerSub}>Payment double-confirmation, disputes triage, and risk indicators.</Text>
      </View>

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#fbbf24" style={{ marginVertical: 30 }} />
      ) : (
        <>
          {summary && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Financial & Trust Metrics</Text>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Verified Cash:</Text>
                <Text style={[styles.metricVal, { color: '#10b981' }]}>${summary.verified_cash?.toFixed(2)}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Unverified Cash:</Text>
                <Text style={[styles.metricVal, { color: '#f59e0b' }]}>${summary.unverified_cash?.toFixed(2)}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Open Support Cases:</Text>
                <Text style={[styles.metricVal, { color: '#ef4444' }]}>{summary.open_cases_count} Active</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Risk & Fraud Alerts:</Text>
                <Text style={[styles.metricVal, { color: '#f472b6' }]}>{summary.risk_alerts_count} Flagged</Text>
              </View>
            </View>
          )}

          {/* PENDING PAYMENTS SECTION */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pending Payments ({pendingPayments.length})</Text>
            {pendingPayments.length === 0 ? (
              <Text style={styles.emptyText}>No pending payment confirmations.</Text>
            ) : (
              pendingPayments.map((p) => (
                <View key={p.payment_id} style={styles.itemRow}>
                  <View>
                    <Text style={styles.itemTitle}>{p.order_number}</Text>
                    <Text style={styles.itemSub}>{p.buyer_name} • ${p.total_amount?.toFixed(2)}</Text>
                  </View>
                  <Text style={styles.chipPending}>{p.payment_status}</Text>
                </View>
              ))
            )}
          </View>

          {/* OPEN CASES SECTION */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Open Support & Disputes ({openCases.length})</Text>
            {openCases.length === 0 ? (
              <Text style={styles.emptyText}>No open dispute cases.</Text>
            ) : (
              openCases.map((c) => (
                <View key={c.id} style={styles.itemRow}>
                  <View>
                    <Text style={styles.itemTitle}>{c.case_number}: {c.title}</Text>
                    <Text style={styles.itemSub}>{c.case_type} • {c.priority}</Text>
                  </View>
                  <Text style={styles.chipCase}>{c.status}</Text>
                </View>
              ))
            )}
          </View>

          {/* RISK ALERTS SECTION */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Risk Alerts ({riskAlerts.length})</Text>
            {riskAlerts.length === 0 ? (
              <Text style={styles.emptyText}>No active risk events flagged.</Text>
            ) : (
              riskAlerts.map((r) => (
                <View key={r.id} style={styles.itemRow}>
                  <View>
                    <Text style={styles.itemTitle}>{r.event_type}</Text>
                    <Text style={styles.itemSub}>{r.target_name} ({r.severity})</Text>
                  </View>
                  <Text style={styles.chipRisk}>{r.status}</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
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
    color: '#fbbf24',
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
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#1e293b',
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  itemSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  chipPending: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fbbf24',
    backgroundColor: '#78350f',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  chipCase: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60a5fa',
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  chipRisk: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fca5a5',
    backgroundColor: '#7f1d1d',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emptyText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  errorCard: {
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
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
