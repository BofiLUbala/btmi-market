import { useAuth } from '@/store/auth'
import { get } from '@/api/client'
import { Card, CardGrid } from '@/components/ui/Card'
import { useEffect, useState } from 'react'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

const EMPLOYEE_STATUS_KEYS: Record<string, TranslationKey> = {
  ACTIVE: 'employee.status.ACTIVE',
  INACTIVE: 'employee.status.INACTIVE',
  TERMINATED: 'employee.status.TERMINATED',
}

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
  const t = useT()
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
      setError(err instanceof Error ? err.message : t('employee.dashboard.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingBlock label={t('employee.dashboard.loading')} />
  if (error) return <ErrorBox error={error} />
  if (!workspace) return <ErrorBox error={t('employee.dashboard.noData')} />

  const emp = workspace.employee

  return (
    <div className="employee-dashboard">
      <div className="page-header">
        <h1>{t('employee.dashboard.title')}</h1>
        <p className="muted">{t('employee.dashboard.welcome', { firstName: user?.first_name ?? '', lastName: user?.last_name ?? '' })}</p>
      </div>

      <CardGrid>
        <Card>
          <h3>{t('employee.dashboard.yourProfile')}</h3>
          <p><strong>{[emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ')}</strong></p>
          <p className="muted small">{emp.job_title}</p>
          <p className="muted small">{emp.phone || emp.email || ''}</p>
          <p>
            <span className={`badge badge-${emp.status === 'ACTIVE' ? 'success' : 'warning'}`}>{t(EMPLOYEE_STATUS_KEYS[emp.status] ?? 'employee.status.ACTIVE')}</span>
          </p>
        </Card>

        <Card>
          <h3>{t('employee.dashboard.systemAccess')}</h3>
          {emp.linked_user_id ? (
            <p><span className="badge badge-success">{t('employee.access.enabled')}</span> <span className="muted small">{t('employee.access.signInNote')}</span></p>
          ) : (
            <p><span className="badge badge-warning">{t('employee.access.disabled')}</span> <span className="muted small">{t('employee.access.invitationNote')}</span></p>
          )}
        </Card>

        {(() => {
          const assignedShops = Array.isArray(workspace.shops) ? workspace.shops : []
          return (
            <Card>
              <h3>{t('employee.dashboard.assignedShops', { count: assignedShops.length })}</h3>
              {assignedShops.length === 0 ? (
                <p className="muted">{t('employee.dashboard.noShopsAssigned')}</p>
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
