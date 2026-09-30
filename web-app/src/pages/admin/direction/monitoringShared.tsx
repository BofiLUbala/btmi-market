import { useCallback, useEffect, useRef, useState } from 'react'
import { adminMonitoringApi, type MonitoringSummary } from '@/api/admin'
import { useT } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

/** How often the monitoring tabs reload while visible. */
export const MONITORING_REFRESH_MS = 10_000

export const ROLE_KEYS: Record<string, TranslationKey> = {
  admin: 'admin.monitoring.role.admin',
  buyer: 'admin.monitoring.role.buyer',
  seller: 'admin.monitoring.role.seller',
  employee: 'admin.monitoring.role.employee',
  courier: 'admin.monitoring.role.courier',
  unknown: 'admin.monitoring.role.unknown',
}

export const cell = { padding: '12px 16px' } as const
export const headRow = { backgroundColor: '#1e293b', color: '#94a3b8', borderBottom: '1px solid #334155' } as const
export const tableBox = { backgroundColor: '#0f172a', borderRadius: 12, border: '1px solid #1e293b', overflowX: 'auto' as const }

export function RoleBadge({ role }: { role: string }) {
  const t = useT()
  const colors: Record<string, string> = {
    admin: '#7c3aed', buyer: '#0369a1', seller: '#047857', employee: '#0f766e', courier: '#b45309', unknown: '#475569',
  }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, backgroundColor: colors[role] ?? '#334155', color: '#fff' }}>
      {ROLE_KEYS[role] ? t(ROLE_KEYS[role]) : role}
    </span>
  )
}

/** Short, human device label from a user agent. */
export function deviceLabel(ua: string): string {
  if (!ua) return '—'
  if (/okhttp|expo|reactnative|dalvik/i.test(ua)) return 'App Android'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : ''
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : ''
  const label = [browser, os].filter(Boolean).join(' · ')
  return label || ua.slice(0, 40)
}

/**
 * Runs load() now, every MONITORING_REFRESH_MS while the tab is visible, and
 * the moment the tab becomes visible again.
 */
export function useLiveReload(load: (silent: boolean) => Promise<void>, deps: unknown[]) {
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    void loadRef.current(false)
    const tick = () => { if (document.visibilityState === 'visible') void loadRef.current(true) }
    const timer = window.setInterval(tick, MONITORING_REFRESH_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export function useMonitoringSummary() {
  const [summary, setSummary] = useState<MonitoringSummary | null>(null)
  const reload = useCallback(async () => {
    try { setSummary(await adminMonitoringApi.summary()) } catch { /* the tables show the error */ }
  }, [])
  return { summary, reload }
}

export function SummaryCards({ summary }: { summary: MonitoringSummary | null }) {
  const t = useT()
  const s = summary?.summary
  const cards: Array<{ label: string; value: number | string; color: string }> = [
    { label: t('admin.monitoring.onlineNow', { minutes: summary?.online_window_minutes ?? 30 }), value: s?.online_now ?? '…', color: '#22c55e' },
    { label: t('admin.monitoring.activeAccounts'), value: s?.active_accounts ?? '…', color: '#38bdf8' },
    { label: t('admin.monitoring.failuresHour'), value: s?.failures_last_hour ?? '…', color: '#f97316' },
    { label: t('admin.monitoring.failures24h'), value: s?.failures_last_24h ?? '…', color: '#ef4444' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
      {cards.map((c) => (
        <div key={c.label} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{c.label}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.value}</div>
        </div>
      ))}
    </div>
  )
}

export function LiveToolbar({ role, onRole, roles, updatedAt, onRefresh, refreshing }: {
  role: string
  onRole: (role: string) => void
  roles: string[]
  updatedAt: Date | null
  onRefresh: () => void
  refreshing: boolean
}) {
  const t = useT()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <select
        aria-label={t('admin.monitoring.roleFilter')}
        value={role}
        onChange={(e) => onRole(e.target.value)}
        style={{ backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}
      >
        <option value="">{t('admin.monitoring.allRoles')}</option>
        {roles.map((r) => <option key={r} value={r}>{t(ROLE_KEYS[r])}</option>)}
      </select>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,.2)' }} />
        {updatedAt
          ? t('admin.monitoring.liveUpdated', { time: updatedAt.toLocaleTimeString('fr-FR') })
          : t('admin.monitoring.liveConnecting')}
      </span>
      <button className="admin-button" onClick={onRefresh} disabled={refreshing} style={{ marginLeft: 'auto' }}>
        {refreshing ? '…' : t('admin.direction.refreshState')}
      </button>
    </div>
  )
}
