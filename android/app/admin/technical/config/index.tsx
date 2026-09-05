import { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Switch, TextInput, Modal } from 'react-native'
import { useRouter } from 'expo-router'
import { useAdminAuth } from '../../../../src/store/adminAuth'
import { mobileAdminPlatformApi, FeatureFlag, GlobalConfigItem } from '../../../../src/api/admin'
import { useI18n } from '../../../../src/store/i18n'

export default function MobilePlatformConfigScreen() {
  const router = useRouter()
  const { hasRole } = useAdminAuth()
  const { t } = useI18n()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [configs, setConfigs] = useState<GlobalConfigItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const [pendingFlag, setPendingFlag] = useState<FeatureFlag | null>(null)
  const [reason, setReason] = useState('')

  const load = async () => {
    setError(null)
    try {
      const [flagsRes, configRes] = await Promise.all([
        mobileAdminPlatformApi.listFeatureFlags(),
        mobileAdminPlatformApi.listGlobalConfigs(),
      ])
      setFlags(flagsRes.flags || [])
      setConfigs(configRes.configs || [])
    } catch (err: any) {
      setError(err?.message || t('admin.config.connectFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (!hasRole(['SUPER_ADMIN', 'DIRECTION_ADMIN', 'COMMERCE_ADMIN', 'FINANCE_SUPPORT_ADMIN', 'TECHNICAL_ADMIN'])) {
    return (
      <View style={styles.deniedContainer}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>🛡️</Text>
        <Text style={styles.deniedTitle}>{t('admin.accessProhibited')}</Text>
        <Text style={styles.deniedSub}>{t('admin.config.accessDeniedBody')}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/admin')}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{t('admin.returnToDirection')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const submitToggle = async () => {
    if (!pendingFlag || !reason) return
    try {
      await mobileAdminPlatformApi.toggleLowRiskFlag(pendingFlag.key, !pendingFlag.enabled, reason)
      setPendingFlag(null)
      setReason('')
      load()
    } catch (err: any) {
      alert(err?.message || t('admin.config.updateFailed'))
    }
  }

  const lowRiskFlags = flags.filter((f) => !f.is_high_risk)
  const highRiskFlags = flags.filter((f) => f.is_high_risk)

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
    >
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>{t('admin.config.header')}</Text>
        <Text style={styles.bannerSub}>{t('admin.config.sub')}</Text>
      </View>

      {loading && (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator color="#a855f7" />
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={{ color: '#fca5a5', fontSize: 13 }}>⚠️ {error}</Text>
        </View>
      )}

      {!loading && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('admin.config.lowRisk')}</Text>
            {lowRiskFlags.map((f) => (
              <View key={f.key} style={styles.flagRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.flagKey}>{f.key}</Text>
                  <Text style={styles.flagCategory}>{f.category} · {f.scope}</Text>
                </View>
                <Switch
                  value={f.enabled}
                  disabled={!f.can_write}
                  onValueChange={() => setPendingFlag(f)}
                  trackColor={{ false: '#334155', true: '#059669' }}
                />
              </View>
            ))}
            {lowRiskFlags.length === 0 && <Text style={styles.emptyText}>{t('admin.config.noLowRisk')}</Text>}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('admin.config.highRisk')}</Text>
            {highRiskFlags.map((f) => (
              <View key={f.key} style={styles.flagRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.flagKey}>{f.key}</Text>
                  <Text style={styles.flagCategory}>{f.category} · {f.scope}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: f.enabled ? '#064e3b' : '#3f1d1d' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: f.enabled ? '#34d399' : '#f87171' }}>
                    {f.enabled ? t('admin.config.enabled') : t('admin.config.disabled')}
                  </Text>
                </View>
              </View>
            ))}
            {highRiskFlags.length === 0 && <Text style={styles.emptyText}>{t('admin.config.noHighRisk')}</Text>}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('admin.config.globalConfig')}</Text>
            {configs.map((c) => (
              <View key={c.key} style={styles.flagRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.flagKey}>{c.key}</Text>
                  <Text style={styles.flagCategory}>{c.category}</Text>
                </View>
                <Text style={styles.configValue}>{c.value}</Text>
              </View>
            ))}
            {configs.length === 0 && <Text style={styles.emptyText}>{t('admin.config.noConfig')}</Text>}
          </View>
        </>
      )}

      <Modal visible={!!pendingFlag} transparent animationType="fade" onRequestClose={() => setPendingFlag(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pendingFlag && (pendingFlag.enabled ? t('admin.config.disable') : t('admin.config.enable'))} {pendingFlag?.key}
            </Text>
            <Text style={styles.modalLabel}>{t('admin.config.reasonRequired')}</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={t('admin.config.reasonPlaceholder')}
              placeholderTextColor="#64748b"
              multiline
              style={styles.textInput}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <TouchableOpacity onPress={() => { setPendingFlag(null); setReason('') }} style={styles.modalCancelBtn}>
                <Text style={{ color: '#94a3b8' }}>{t('admin.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitToggle} disabled={!reason} style={[styles.modalSubmitBtn, { opacity: reason ? 1 : 0.5 }]}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{t('admin.config.submit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16' },
  banner: { backgroundColor: '#0f172a', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1e293b', marginBottom: 14 },
  bannerTitle: { fontSize: 16, fontWeight: '800', color: '#c084fc', marginBottom: 4 },
  bannerSub: { fontSize: 12, color: '#94a3b8' },
  card: { backgroundColor: '#0f172a', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1e293b', marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#ffffff', marginBottom: 12 },
  flagRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderColor: '#1e293b' },
  flagKey: { fontSize: 13, color: '#f8fafc', fontWeight: '700' },
  flagCategory: { fontSize: 11, color: '#64748b', marginTop: 2 },
  configValue: { fontSize: 14, color: '#60a5fa', fontWeight: '700' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  emptyText: { fontSize: 12, color: '#64748b', paddingVertical: 10 },
  errorBox: { backgroundColor: '#3f1d1d', borderRadius: 8, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#7f1d1d' },
  deniedContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#090d16' },
  deniedTitle: { fontSize: 18, fontWeight: '800', color: '#ef4444', marginBottom: 8 },
  deniedSub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginBottom: 20 },
  backBtn: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#0f172a', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#1e293b' },
  modalTitle: { fontSize: 15, fontWeight: '800', color: '#f8fafc', marginBottom: 12 },
  modalLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 6 },
  textInput: { backgroundColor: '#1e293b', borderRadius: 8, borderWidth: 1, borderColor: '#334155', padding: 10, color: '#f8fafc', fontSize: 13, minHeight: 60, textAlignVertical: 'top' },
  modalCancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#334155' },
  modalSubmitBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, backgroundColor: '#2563eb' },
})
