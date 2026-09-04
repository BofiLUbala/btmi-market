import { useState, useEffect, useCallback } from 'react'
import { adminCommerceApi, type AdminEmployeeItem } from '@/api/admin'

const ROLE_COLORS: Record<string, { bg: string; fg: string }> = {
  SUPER_ADMIN: { bg: '#7f1d1d', fg: '#fca5a5' },
  DIRECTION_ADMIN: { bg: '#78350f', fg: '#fde68a' },
  COMMERCE_ADMIN: { bg: '#1e3a5f', fg: '#93c5fd' },
  FINANCE_SUPPORT_ADMIN: { bg: '#064e3b', fg: '#a7f3d0' },
  TECHNICAL_ADMIN: { bg: '#3b0764', fg: '#c4b5fd' },
}

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_COLORS[role] || { bg: '#334155', fg: '#f1f5f9' }
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, backgroundColor: c.bg, color: c.fg }}>{role}</span>
}

export default function EmployeeManagementPage() {
  const [employees, setEmployees] = useState<AdminEmployeeItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [limit] = useState(20)
  const [revokeModal, setRevokeModal] = useState<string | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [revoking, setRevoking] = useState(false)

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminCommerceApi.listEmployees({ limit, offset: page })
      setEmployees(res.employees)
      setTotal(res.total)
    } catch (err) {
      console.error('Failed to load employees', err)
    } finally {
      setLoading(false)
    }
  }, [page, limit])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  const totalPages = Math.ceil(total / limit)

  const handleRevoke = async (id: string) => {
    if (revokeReason.length < 5) return
    setRevoking(true)
    try {
      await adminCommerceApi.revokeEmployeeAccess(id, revokeReason)
      setRevokeModal(null)
      setRevokeReason('')
      fetchEmployees()
    } catch (err) {
      console.error(err)
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div>
      {revokeModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: '#fca5a5' }}>Revoke Employee Access</h3>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>This action is soft-reversible. Provide a reason:</p>
            <textarea
              placeholder="Reason (min 5 chars)..."
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => { setRevokeModal(null); setRevokeReason('') }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #334155', backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={() => handleRevoke(revokeModal)} disabled={revoking || revokeReason.length < 5}
                style={{ padding: '8px 16px', borderRadius: 6, border: 'none', backgroundColor: revokeReason.length >= 5 ? '#dc2626' : '#334155', color: '#fff', cursor: revokeReason.length >= 5 ? 'pointer' : 'default', fontSize: 13, fontWeight: 600 }}>
                {revoking ? 'Revoking...' : 'Revoke Access'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Employee Management</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Cross-business employee listing with role-based revocation.</p>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading...</div>
      ) : employees.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No employees found</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {['Employee', 'Email', 'Role', 'Shop', 'Business', 'Status', 'Hired', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} style={{ borderBottom: '1px solid #1e293b', opacity: emp.status === 'REVOKED' ? 0.5 : 1 }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ color: '#f8fafc', fontWeight: 600 }}>{emp.name}</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 12 }}>{emp.email}</td>
                  <td style={{ padding: '10px 12px' }}><RoleBadge role={emp.role} /></td>
                  <td style={{ padding: '10px 12px', color: '#f8fafc', fontSize: 12 }}>{emp.shop_name || '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 12 }}>{emp.business_name || '-'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                      backgroundColor: emp.status === 'ACTIVE' ? '#064e3b' : emp.status === 'REVOKED' ? '#7f1d1d' : '#78350f',
                      color: emp.status === 'ACTIVE' ? '#a7f3d0' : emp.status === 'REVOKED' ? '#fca5a5' : '#fde68a'
                    }}>{emp.status}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 11 }}>
                    {emp.hire_date ? new Date(emp.hire_date).toLocaleDateString() : '-'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {emp.status === 'ACTIVE' && (
                      <button onClick={() => setRevokeModal(emp.id)}
                        style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #dc2626', backgroundColor: 'transparent', color: '#dc2626', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button onClick={() => setPage(Math.max(0, page - limit))} disabled={page === 0}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#0f172a', color: page === 0 ? '#475569' : '#f8fafc', cursor: page === 0 ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}
          >Previous</button>
          <span style={{ padding: '6px 14px', color: '#94a3b8', fontSize: 12 }}>Page {Math.floor(page / limit) + 1} of {totalPages}</span>
          <button onClick={() => setPage(Math.min(total - limit, page + limit))} disabled={page + limit >= total}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#0f172a', color: page + limit >= total ? '#475569' : '#f8fafc', cursor: page + limit >= total ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}
          >Next</button>
        </div>
      )}
    </div>
  )
}
