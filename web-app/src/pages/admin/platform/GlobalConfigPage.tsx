import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { adminPlatformApi, GlobalConfigItem } from '../../../api/admin'

const CATEGORY_COLORS: Record<string, string> = {
  COMMERCE: '#34d399',
  FINANCE: '#fbbf24',
  TECHNICAL: '#2dd4bf',
  GENERAL: '#60a5fa'
}

export default function GlobalConfigPage() {
  const [configs, setConfigs] = useState<GlobalConfigItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [pending, setPending] = useState<GlobalConfigItem | null>(null)
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminPlatformApi.listGlobalConfigs()
      setConfigs(res.configs || [])
    } catch (err: any) {
      setError(err?.message || 'Failed to load global configuration')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openEditModal = (cfg: GlobalConfigItem) => {
    setPending(cfg)
    setValue(cfg.value)
    setReason('')
  }

  const submitEdit = async () => {
    if (!pending || !reason) return
    try {
      await adminPlatformApi.updateGlobalConfig(pending.key, value, reason)
      setSuccessMsg(`"${pending.key}" updated successfully`)
      setPending(null)
      load()
    } catch (err) {
      alert((err as Error)?.message || 'Update failed')
    }
  }

  return (
    <div style={{ color: '#f8fafc' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>⚙️</span> Global Configuration
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
          Operational values shared by Web and Android. Every change is audited with the old value, new value, actor, and reason.
        </p>
        <div style={{ marginTop: 8 }}>
          <NavLink to="/admin/platform/feature-flags" style={{ color: '#a855f7', fontSize: 12, fontWeight: 600 }}>
            → Feature Flags
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
                <th style={{ padding: '12px 14px' }}>Value</th>
                <th style={{ padding: '12px 14px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.key} style={{ borderBottom: '1px solid #1e293b', fontSize: 13 }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700 }}>{c.key}</div>
                    <div style={{ fontSize: 11, color: '#64748b', maxWidth: 340 }}>{c.description}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: CATEGORY_COLORS[c.category] || '#94a3b8' }}>{c.category}</span>
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#60a5fa' }}>{c.value}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <button
                      disabled={!c.can_write}
                      onClick={() => openEditModal(c)}
                      style={{
                        padding: '6px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 700,
                        cursor: c.can_write ? 'pointer' : 'not-allowed',
                        backgroundColor: c.can_write ? '#2563eb' : '#1e293b',
                        color: c.can_write ? '#fff' : '#475569'
                      }}
                      title={c.can_write ? undefined : 'Your role cannot write this category'}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pending && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Edit {pending.key}</h3>
            <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Value ({pending.value_type})</label>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={{ width: '100%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }}
            />
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
                onClick={() => setPending(null)}
                style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #334155', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                disabled={!reason}
                onClick={submitEdit}
                style={{ padding: '8px 14px', borderRadius: 6, border: 'none', backgroundColor: reason ? '#2563eb' : '#1e293b', color: '#fff', cursor: reason ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
