import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAdminAuth } from '../../src/store/adminAuth'
import {
  mobileAdminDirectionApi,
  type DirectionOverviewStats,
  type AdminUserListItem,
  type AdminAuditLog,
} from '../../src/api/admin'

export default function MobileDirectionScreen() {
  const router = useRouter()
  const { admin, role, logout, canAccessDashboard, bootstrap } = useAdminAuth()

  const [stats, setStats] = useState<DirectionOverviewStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Quick User Lookup
  const [userQuery, setUserQuery] = useState('')
  const [searchResults, setSearchResults] = useState<AdminUserListItem[]>([])
  const [searching, setSearching] = useState(false)

  // Action Sheet Modal
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [actionSubmitting, setActionSubmitting] = useState(false)

  // Audit Logs
  const [recentLogs, setRecentLogs] = useState<AdminAuditLog[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [overviewData, auditData] = await Promise.all([
        mobileAdminDirectionApi.getOverview(),
        mobileAdminDirectionApi.listAuditLogs(10),
      ])
      setStats(overviewData)
      setRecentLogs(auditData.logs)
    } catch (err) {
      console.error('Failed to load mobile direction data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void bootstrap().then(() => {
      if (!admin) {
        router.replace('/admin/login')
      } else {
        void loadData()
      }
    })
  }, [admin, bootstrap, loadData, router])

  const handleSearchUser = async () => {
    if (!userQuery.trim()) return
    setSearching(true)
    try {
      const res = await mobileAdminDirectionApi.listUsers({ search: userQuery.trim(), limit: 5 })
      setSearchResults(res.users)
    } catch (err) {
      Alert.alert('Search Failed', 'Could not query users')
    } finally {
      setSearching(false)
    }
  }

  const handleToggleUserStatus = async () => {
    if (!selectedUser) return
    if (!actionReason.trim() || actionReason.trim().length < 5) {
      Alert.alert('Required', 'A justification reason of at least 5 characters is required for auditing.')
      return
    }

    setActionSubmitting(true)
    try {
      if (selectedUser.status === 'ACTIVE') {
        await mobileAdminDirectionApi.suspendUser(selectedUser.id, actionReason.trim())
        Alert.alert('Success', `User ${selectedUser.email} has been SUSPENDED.`)
      } else {
        await mobileAdminDirectionApi.reactivateUser(selectedUser.id, actionReason.trim())
        Alert.alert('Success', `User ${selectedUser.email} has been REACTIVATED.`)
      }
      setSelectedUser(null)
      setActionReason('')
      setUserQuery('')
      setSearchResults([])
      void loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed'
      Alert.alert('Error', msg)
    } finally {
      setActionSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.replace('/admin/login')
  }

  if (!admin) {
    return (
      <View style={[styles.centered, { backgroundColor: '#090d16' }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ color: '#94a3b8', marginTop: 12 }}>Checking Administrator Privileges...</Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#090d16' }}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>TBK CONTROL</Text>
          <View style={styles.roleRow}>
            <Text style={styles.adminName}>{admin.first_name} {admin.last_name}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{role}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* 4 Dashboard Quick-Switcher Pills (Role-Guarded) */}
      <View style={styles.pillRow}>
        {canAccessDashboard('direction') && (
          <TouchableOpacity style={[styles.pill, styles.pillActive]}>
            <Text style={[styles.pillText, styles.pillTextActive]}>🧭 Direction</Text>
          </TouchableOpacity>
        )}
        {canAccessDashboard('commerce') && (
          <TouchableOpacity
            style={styles.pill}
            onPress={() => router.push('/admin/commerce')}
          >
            <Text style={styles.pillText}>📦 Commerce</Text>
          </TouchableOpacity>
        )}
        {canAccessDashboard('finance') && (
          <TouchableOpacity
            style={styles.pill}
            onPress={() => router.push('/admin/finance')}
          >
            <Text style={styles.pillText}>💰 Finance</Text>
          </TouchableOpacity>
        )}
        {canAccessDashboard('technical') && (
          <TouchableOpacity
            style={styles.pill}
            onPress={() => router.push('/admin/technical')}
          >
            <Text style={styles.pillText}>🛡️ Technical</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.pill} onPress={() => router.push('/admin/advanced')}>
          <Text style={styles.pillText}>⚙️ Advanced</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Live Platform Health Indicator */}
        <View style={styles.healthCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.onlineDot} />
            <Text style={styles.healthTitle}>Platform Health: {stats?.platform_health || 'HEALTHY'}</Text>
          </View>
          <Text style={styles.healthSub}>Live PostgreSQL • Redis Cache • Asynq Workers Active</Text>
        </View>

        {/* Rapid KPI Cards */}
        {loading ? (
          <ActivityIndicator color="#3b82f6" style={{ marginVertical: 20 }} />
        ) : stats ? (
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Accounts</Text>
              <Text style={styles.kpiValue}>{stats.total_users}</Text>
              <Text style={styles.kpiMeta}>{stats.total_buyers} Buyers • {stats.total_sellers} Sellers</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Orders Today</Text>
              <Text style={[styles.kpiValue, { color: '#38bdf8' }]}>{stats.orders_today}</Text>
              <Text style={styles.kpiMeta}>Lifetime: {stats.total_orders}</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Active Shops</Text>
              <Text style={[styles.kpiValue, { color: '#10b981' }]}>{stats.active_shops}</Text>
              <Text style={styles.kpiMeta}>Total Outlets: {stats.total_shops}</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Open Disputes</Text>
              <Text style={[styles.kpiValue, { color: stats.open_disputes > 0 ? '#ef4444' : '#10b981' }]}>
                {stats.open_disputes}
              </Text>
              <Text style={styles.kpiMeta}>Requiring Mediation</Text>
            </View>
          </View>
        ) : null}

        {/* Quick User Lookup Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🔍 Rapid User Triage</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search user email or phone..."
              placeholderTextColor="#64748b"
              value={userQuery}
              onChangeText={setUserQuery}
              onSubmitEditing={handleSearchUser}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearchUser} disabled={searching}>
              {searching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>Find</Text>}
            </TouchableOpacity>
          </View>

          {searchResults.map((u) => (
            <View key={u.id} style={styles.userResultRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{u.first_name} {u.last_name}</Text>
                <Text style={styles.userMeta}>{u.email} • {u.account_type}</Text>
                <View style={styles.statusPill}>
                  <Text style={[styles.statusText, { color: u.status === 'ACTIVE' ? '#10b981' : '#ef4444' }]}>
                    {u.status}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: u.status === 'ACTIVE' ? '#7f1d1d' : '#064e3b' }]}
                onPress={() => setSelectedUser(u)}
              >
                <Text style={styles.actionBtnText}>{u.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Recent Audit Log Stream */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>📜 Immutable Audit Feed</Text>
          {recentLogs.slice(0, 5).map((l) => (
            <View key={l.id} style={styles.auditRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.auditAction}>{l.action}</Text>
                <Text style={styles.auditReason}>{l.reason}</Text>
                <Text style={styles.auditMeta}>{l.actor_admin_name || 'Admin'} • {new Date(l.created_at).toLocaleTimeString()}</Text>
              </View>
              <View style={styles.targetBadge}>
                <Text style={styles.targetText}>{l.target_type}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* User Action Modal */}
      {selectedUser && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {selectedUser.status === 'ACTIVE' ? 'Suspend Account' : 'Reactivate Account'}
              </Text>
              <Text style={styles.modalSub}>
                Target: {selectedUser.first_name} {selectedUser.last_name} ({selectedUser.email})
              </Text>

              <Text style={styles.modalLabel}>Audit Justification (Mandatory):</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Reason for changing status..."
                placeholderTextColor="#64748b"
                value={actionReason}
                onChangeText={setActionReason}
                multiline
                numberOfLines={3}
              />

              <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => {
                    setSelectedUser(null)
                    setActionReason('')
                  }}
                  disabled={actionSubmitting}
                >
                  <Text style={{ color: '#cbd5e1', fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalConfirm,
                    { backgroundColor: selectedUser.status === 'ACTIVE' ? '#dc2626' : '#16a34a' },
                  ]}
                  onPress={handleToggleUserStatus}
                  disabled={actionSubmitting}
                >
                  {actionSubmitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Confirm Action</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  adminName: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
  roleBadge: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#bfdbfe',
  },
  signOutBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  signOutText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  pillRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  pillActive: {
    backgroundColor: '#2563eb',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  healthCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
    marginBottom: 14,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  healthTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10b981',
  },
  healthSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 12,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginVertical: 4,
  },
  kpiMeta: {
    fontSize: 10,
    color: '#64748b',
  },
  sectionCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  userResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#1e293b',
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  userMeta: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusPill: {
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: '#1e293b',
  },
  auditAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f8fafc',
  },
  auditReason: {
    fontSize: 11,
    color: '#cbd5e1',
    marginTop: 2,
  },
  auditMeta: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  targetBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  targetText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 14,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 10,
    color: '#ffffff',
    fontSize: 13,
    textAlignVertical: 'top',
  },
  modalCancel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modalConfirm: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
})
