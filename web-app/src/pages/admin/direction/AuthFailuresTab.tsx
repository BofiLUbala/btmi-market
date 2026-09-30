import { useState } from 'react'
import { adminMonitoringApi, type AuthFailure } from '@/api/admin'
import { useT } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'
import { LiveToolbar, RoleBadge, SummaryCards, cell, deviceLabel, headRow, tableBox, useLiveReload, useMonitoringSummary } from './monitoringShared'

const ERROR_KEYS: Record<string, TranslationKey> = {
  WRONG_PASSWORD: 'admin.monitoring.error.WRONG_PASSWORD',
  UNKNOWN_ACCOUNT: 'admin.monitoring.error.UNKNOWN_ACCOUNT',
  INVALID_CREDENTIALS: 'admin.monitoring.error.INVALID_CREDENTIALS',
  ACCOUNT_SUSPENDED: 'admin.monitoring.error.ACCOUNT_SUSPENDED',
  ADMIN_ACCOUNT_SUSPENDED: 'admin.monitoring.error.ACCOUNT_SUSPENDED',
  ACCOUNT_NOT_ACTIVATED: 'admin.monitoring.error.ACCOUNT_NOT_ACTIVATED',
}

const ROLES = ['buyer', 'seller', 'employee', 'courier', 'admin', 'unknown']

/** Refused sign-ins on every portal, newest first, refreshed live. */
export default function AuthFailuresTab() {
  const t = useT()
  const [failures, setFailures] = useState<AuthFailure[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const { summary, reload: reloadSummary } = useMonitoringSummary()

  async function load(silent: boolean) {
    if (silent) setRefreshing(true); else setLoading(true)
    try {
      const [rows] = await Promise.all([adminMonitoringApi.authFailures({ role, limit: 200 }), reloadSummary()])
      setFailures(Array.isArray(rows) ? rows : [])
      setError(null)
      setUpdatedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.monitoring.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }
  useLiveReload(load, [role])

  return (
    <div>
      <SummaryCards summary={summary} />
      <LiveToolbar role={role} onRole={setRole} roles={ROLES} updatedAt={updatedAt} onRefresh={() => void load(true)} refreshing={refreshing} />
      {error && (
        <div role="alert" style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d', color: '#fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>{error}</div>
      )}
      <div style={tableBox}>
        <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={headRow}>
              <th style={cell}>{t('admin.monitoring.thTime')}</th>
              <th style={cell}>{t('admin.monitoring.thEmail')}</th>
              <th style={cell}>{t('admin.monitoring.thRole')}</th>
              <th style={cell}>{t('admin.monitoring.thReason')}</th>
              <th style={cell}>{t('admin.monitoring.thIp')}</th>
              <th style={cell}>{t('admin.monitoring.thDevice')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>{t('common.loading')}</td></tr>
            ) : failures.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>{t('admin.monitoring.noFailures', { days: summary?.retention_days ?? 30 })}</td></tr>
            ) : failures.map((f) => (
              <tr key={f.id} style={{ borderBottom: '1px solid #1e293b' }}>
                <td style={{ ...cell, fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>{new Date(f.created_at).toLocaleString('fr-FR')}</td>
                <td style={{ ...cell, color: '#fff', fontFamily: 'monospace', fontSize: 12 }}>{f.email}</td>
                <td style={cell}><RoleBadge role={f.role} /></td>
                <td style={cell}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, backgroundColor: '#7f1d1d', color: '#fff' }}>
                    {ERROR_KEYS[f.error_code] ? t(ERROR_KEYS[f.error_code]) : f.error_code}
                  </span>
                </td>
                <td style={{ ...cell, fontFamily: 'monospace', fontSize: 12, color: '#cbd5e1' }}>{f.ip_address || '—'}</td>
                <td style={{ ...cell, fontSize: 12, color: '#94a3b8' }} title={f.user_agent}>{deviceLabel(f.user_agent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
