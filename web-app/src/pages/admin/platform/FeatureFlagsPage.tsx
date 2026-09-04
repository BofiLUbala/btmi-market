import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { adminPlatformApi, FeatureFlag, HighRiskConfirmError } from '../../../api/admin'

const CATEGORY_COLORS: Record<string, string> = {
  COMMERCE: '#34d399',
  FINANCE: '#fbbf24',
  TECHNICAL: '#2dd4bf',
  GENERAL: '#60a5fa'
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [pendingFlag, setPendingFlag] = useState<FeatureFlag | null>(null)
  const [pendingEnabled, setPendingEnabled] = useState(false)
  const [reason, setReason] = useState('')
  const [confirmWarning, setConfirmWarning] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminPlatformApi.listFeatureFlags()
      setFlags(res.flags || [])
    } catch (err: any) {
      setError(err?.message || 'Failed to load feature flags')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openToggleModal = (flag: FeatureFlag) => {
    setPendingFlag(flag)
    setPendingEnabled(!flag.enabled)
    setReason('')
    setConfirmWarning(null)
  }

  const submitToggle = async (confirm = false) => {
    if (!pendingFlag || !reason) return
    try {
      await adminPlatformApi.updateFeatureFlag(pendingFlag.key, pendingEnabled, reason, confirm)
      setSuccessMsg(`"${pendingFlag.key}" ${pendingEnabled ? 'enabled' : 'disabled'} successfully`)
      setPendingFlag(null)
      setConfirmWarning(null)
      load()
    } catch (err) {
      if (err instanceof HighRiskConfirmError) {
        setConfirmWarning(err.impactWarning)
        return
      }
      alert((err as Error)?.message || 'Update failed')
    }
  }

  return (
    <div style={{ color: '#f8fafc' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>🚩</span> Feature Flags
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
          Backend-controlled feature flags shared by Web, Android, and every dashboard. Writes are limited to your role's category and are fully audited.
        </p>
        <div style={{ marginTop: 8 }}>
          <NavLink to="/admin/platform/config" style={{ color: '#a855f7', fontSize: 12, fontWeight: 600 }}>
            → Global Configuration
          </NavLink>
        </div>
      </div>

      {successMsg && (
        <div style={{ backgroundColor: '#064e3b', color: '#34d399', padding: '12px 16px', borderRadius: 8, marginBottom: 16, border: '1px solid #059669', display: 'flex', justifyContent: 'space-between' }}>
          <span>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}
      {error && (
        <div style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '12px 16px', borderRadius: 8, marginBottom: 16, border: '1px solid #dc2626' }}>
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <div style={{ fontSize: 24, marginBottom: 10 }}>⏳</div>
          Fetching live backend data...
        </div>
      )}

      {!loading && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', textAlign: 'left', fontSize: 12, color: '#94a3b8' }}>
                <th style={{ padding: '12px 14px' }}>Key</th>
                <th style={{ padding: '12px 14px' }}>Category</th>
                <th style={{ padding: '12px 14px' }}>Scope</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
                <th style={{ padding: '12px 14px' }}>Risk</th>
                <th style={{ padding: '12px 14px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.key} style={{ borderBottom: '1px solid #1e293b', fontSize: 13 }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700 }}>{f.key}</div>
                    <div style={{ fontSize: 11, color: '#64748b', maxWidth: 320 }}>{f.description}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: CATEGORY_COLORS[f.category] || '#94a3b8' }}>{f.category}</span>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#94a3b8' }}>{f.scope}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                      backgroundColor: f.enabled ? '#064e3b' : '#3f1d1d',
                      color: f.enabled ? '#34d399' : '#f87171'
                    }}>
                      {f.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {f.is_high_risk ? <span style={{ color: '#f87171', fontSize: 11, fontWeight: 700 }}>HIGH RISK</span> : <span style={{ color: '#64748b', fontSize: 11 }}>standard</span>}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button
                      disabled={!f.can_write}
                      onClick={() => openToggleModal(f)}
                      style={{
                        padding: '6px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 700,
                        cursor: f.can_write ? 'pointer' : 'not-allowed',
                        backgroundColor: f.can_write ? (f.enabled ? '#7f1d1d' : '#065f46') : '#1e293b',
                        color: f.can_write ? '#fff' : '#475569'
                      }}
                      title={f.can_write ? undefined : 'Your role cannot write this category'}
                    >
                      {f.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingFlag && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>
              {pendingEnabled ? 'Enable' : 'Disable'} {pendingFlag.key}
            </h3>
            {confirmWarning && (
              <div style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '10px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                ⚠️ {confirmWarning}
              </div>
            )}
            <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Reason (required)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              style={{ width: '100%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 16, boxSizing: 'border-box' }}
              placeholder="Why is this change being made?"
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setPendingFlag(null); setConfirmWarning(null) }}
                style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #334155', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                disabled={!reason}
                onClick={() => submitToggle(!!confirmWarning)}
                style={{ padding: '8px 14px', borderRadius: 6, border: 'none', backgroundColor: reason ? '#2563eb' : '#1e293b', color: '#fff', cursor: reason ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}
              >
                {confirmWarning ? 'Confirm anyway' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
