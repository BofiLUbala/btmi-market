import { useAuth } from '@/store/auth'
import { get } from '@/api/client'
import { Card, CardGrid } from '@/components/ui/Card'
import { useEffect, useState } from 'react'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'

interface EmployeeWorkspace {
  employee: {
    id: string
    business_id: string
    linked_user_id?: string | null
    first_name: string
    middle_name?: string
    last_name: string
    phone?: string
    email?: string
    job_title: string
    status: string
  }
  shops: Array<{ id: string; name: string; type?: string; city?: string }>
}

export default function EmployeeDashboardPage() {
  const { user } = useAuth()
  const [workspace, setWorkspace] = useState<EmployeeWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await get<EmployeeWorkspace>('/employees/me')
      setWorkspace(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingBlock label="Loading your workspace…" />
  if (error) return <ErrorBox error={error} />
  if (!workspace) return <ErrorBox error="No workspace data available" />

  const emp = workspace.employee

  return (
    <div className="employee-dashboard">
      <div className="page-header">
        <h1>Employee Dashboard</h1>
        <p className="muted">Welcome, {user?.first_name} {user?.last_name}</p>
      </div>

      <CardGrid>
        <Card>
          <h3>Your Profile</h3>
          <p><strong>{[emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ')}</strong></p>
          <p className="muted small">{emp.job_title}</p>
          <p className="muted small">{emp.phone || emp.email || ''}</p>
          <p>
            <span className={`badge badge-${emp.status === 'ACTIVE' ? 'success' : 'warning'}`}>{emp.status}</span>
          </p>
        </Card>

        <Card>
          <h3>System Access</h3>
          {emp.linked_user_id ? (
            <p><span className="badge badge-success">✓ Enabled</span> <span className="muted small">You can sign in to BTMI.</span></p>
          ) : (
            <p><span className="badge badge-warning">○ Disabled</span> <span className="muted small">Ask your manager for an invitation.</span></p>
          )}
        </Card>

        {(() => {
          const assignedShops = Array.isArray(workspace.shops) ? workspace.shops : []
          return (
            <Card>
              <h3>Assigned Shops ({assignedShops.length})</h3>
              {assignedShops.length === 0 ? (
                <p className="muted">No shops assigned yet.</p>
              ) : (
                <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                  {assignedShops.map((shop) => (
                    <li key={shop.id}>
                      🏪 {shop.name}
                      {shop.city && <span className="muted small"> · {shop.city}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })()}
      </CardGrid>
    </div>
  )
}
