import { useState } from 'react'
import { adminDirectionApi, adminMonitoringApi, type ActiveSession, type SignedOutAccount } from '@/api/admin'
import { useT } from '@/store/i18n'
import { dateLocale } from '@/lib/format'
import { LivePresencePanel } from './LivePresencePanel'
import { LiveToolbar, RoleBadge, SummaryCards, cell, deviceLabel, headRow, tableBox, useLiveReload, useMonitoringSummary } from './monitoringShared'

const ROLES = ['buyer', 'seller', 'employee', 'courier']

function ago(date: string, t: ReturnType<typeof useT>): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60_000))
  if (minutes < 1) return t('time.justNow')
  if (minutes < 60) return t('time.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return t('admin.monitoring.hoursAgo', { count: hours })
  return t('admin.monitoring.daysAgo', { count: Math.floor(hours / 24) })
}

/**
 * Accounts signed in right now (a live refresh token), refreshed live. Signing
 * one out revokes every session of that account through the audited
 * force-logout, so it needs a written reason.
 */
export default function ActiveSessionsTab() {
  const t = useT()
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [signedOut, setSignedOut] = useState<SignedOutAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [role, setRole] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [kicking, setKicking] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { summary, reload: reloadSummary } = useMonitoringSummary()
  const onlineMs = (summary?.online_window_minutes ?? 30) * 60_000

  async function load(silent: boolean) {
    if (silent) setRefreshing(true); else setLoading(true)
    try {
      const [rows, gone] = await Promise.all([adminMonitoringApi.sessions({ role }), adminMonitoringApi.signedOut({ role }), reloadSummary()])
      setSessions(Array.isArray(rows) ? rows : [])
      setSignedOut(Array.isArray(gone) ? gone : [])
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

  async function signOut(s: ActiveSession) {
    if (reason.trim().length < 5) {
      setError(t('admin.direction.reasonRequired'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await adminDirectionApi.forceLogoutUser(s.user_id, reason.trim())
      setNotice(t('admin.monitoring.signedOut', { email: s.email }))
      setKicking(null)
      setReason('')
      await load(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.direction.actionFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <LivePresencePanel />
      <h2 style={{ fontSize: 18, margin: '0 0 12px', color: '#fff' }}>{t('admin.presence.sessionsTitle')}</h2>
      <SummaryCards summary={summary} />
      <LiveToolbar role={role} onRole={setRole} roles={ROLES} updatedAt={updatedAt} onRefresh={() => void load(true)} refreshing={refreshing} />
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
        {t('admin.monitoring.sessionsHint', { minutes: summary?.online_window_minutes ?? 30 })}
      </p>
      {error && (
        <div role="alert" style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d', color: '#fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>{error}</div>
      )}
      {notice && (
        <div role="status" style={{ backgroundColor: '#052e16', border: '1px solid #14532d', color: '#bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>{notice}</div>
      )}
      <div style={tableBox}>
        <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={headRow}>
              <th style={cell}>{t('admin.monitoring.thAccount')}</th>
              <th style={cell}>{t('admin.monitoring.thRole')}</th>
              <th style={cell}>{t('admin.monitoring.thStatus')}</th>
              <th style={cell}>{t('admin.monitoring.thLastActive')}</th>
              <th style={cell}>{t('admin.monitoring.thDevice')}</th>
              <th style={cell}>{t('admin.monitoring.thIp')}</th>
              <th style={{ ...cell, textAlign: 'right' }}>{t('admin.direction.thInspection')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>{t('common.loading')}</td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>{t('admin.monitoring.noSessions')}</td></tr>
            ) : sessions.map((s) => {
              const online = Date.now() - new Date(s.last_active_at).getTime() < onlineMs
              return (
                <tr key={s.user_id} style={{ borderBottom: '1px solid #1e293b', verticalAlign: 'top' }}>
                  <td style={cell}>
                    <div style={{ fontWeight: 700, color: '#fff' }}>{s.name || s.email}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{s.email}</div>
                  </td>
                  <td style={cell}><RoleBadge role={s.role} /></td>
                  <td style={cell}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: online ? '#86efac' : '#94a3b8' }}>
                      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: online ? '#22c55e' : '#475569' }} />
                      {online ? t('admin.monitoring.online') : t('admin.monitoring.idle')}
                    </span>
                    {s.devices > 1 && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{t('admin.monitoring.devices', { count: s.devices })}</div>}
                  </td>
                  <td style={{ ...cell, fontSize: 12, color: '#cbd5e1', whiteSpace: 'nowrap' }} title={new Date(s.last_active_at).toLocaleString(dateLocale())}>{ago(s.last_active_at, t)}</td>
                  <td style={{ ...cell, fontSize: 12, color: '#94a3b8' }} title={s.user_agent}>{deviceLabel(s.user_agent)}</td>
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: 12, color: '#cbd5e1' }}>{s.ip_address || '—'}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>
                    {kicking === s.user_id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                        <input
                          autoFocus
                          aria-label={t('admin.monitoring.reasonLabel')}
                          placeholder={t('admin.monitoring.reasonLabel')}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          style={{ width: 220, backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
                        />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="admin-button" onClick={() => { setKicking(null); setReason('') }} disabled={submitting}>{t('common.cancel')}</button>
                          <button className="admin-button" onClick={() => void signOut(s)} disabled={submitting} style={{ backgroundColor: '#b91c1c', borderColor: '#b91c1c', color: '#fff' }}>
                            {submitting ? '…' : t('admin.monitoring.confirmSignOut')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button className="admin-button" onClick={() => { setKicking(s.user_id); setReason(''); setNotice(null) }}>
                        {t('admin.monitoring.signOut')}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Who was signed out, why, and whether they came back on their own. */}
      <h3 style={{ fontSize: 15, margin: '24px 0 6px', color: '#fff' }}>{t('admin.monitoring.signedOutTitle')}</h3>
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>{t('admin.monitoring.signedOutHint')}</p>
      <div style={tableBox} data-testid="signed-out-accounts">
        <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={headRow}>
              <th style={cell}>{t('admin.monitoring.thAccount')}</th>
              <th style={cell}>{t('admin.monitoring.thRole')}</th>
              <th style={cell}>{t('admin.monitoring.thSignedOutAt')}</th>
              <th style={cell}>{t('admin.monitoring.thReason')}</th>
              <th style={cell}>{t('admin.monitoring.thReconnection')}</th>
            </tr>
          </thead>
          <tbody>
            {signedOut.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>{t('admin.monitoring.noSignedOut')}</td></tr>
            ) : signedOut.map((a) => {
              const suspended = a.account_status !== '' && a.account_status.toUpperCase() !== 'ACTIVE'
              return (
                <tr key={a.user_id} style={{ borderBottom: '1px solid #1e293b', verticalAlign: 'top' }}>
                  <td style={cell}>
                    <div style={{ fontWeight: 700, color: '#fff' }}>{a.name || a.email}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{a.email}</div>
                  </td>
                  <td style={cell}><RoleBadge role={a.role} /></td>
                  <td style={{ ...cell, fontSize: 12, color: '#cbd5e1', whiteSpace: 'nowrap' }} title={new Date(a.signed_out_at).toLocaleString(dateLocale())}>{ago(a.signed_out_at, t)}</td>
                  <td style={{ ...cell, fontSize: 12, color: '#cbd5e1' }}>{a.reason || '—'}</td>
                  <td style={{ ...cell, fontSize: 12 }}>
                    {suspended
                      ? <span style={{ color: '#fca5a5' }}>{t('admin.monitoring.accountSuspended')}</span>
                      : a.reconnected_at
                        ? <span style={{ color: '#86efac' }}>● {t('admin.monitoring.reconnected', { time: ago(a.reconnected_at, t) })}</span>
                        : <span style={{ color: '#94a3b8' }}>○ {t('admin.monitoring.notReconnected')}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
