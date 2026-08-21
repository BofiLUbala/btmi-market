import { useAuth } from '@/store/auth'
import { employeeApi, shopApi } from '@/api/seller'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useEffect, useState } from 'react'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { Field } from '@/components/ui/Field'

interface Employee {
  id: string
  first_name: string
  middle_name: string
  last_name: string
  phone: string
  email: string
  job_title: string
  status: string
  linked_user_id?: string | null
}

interface ShopLite {
  id: string
  name: string
}

export default function SellerEmployeesPage() {
  const { activeBusiness, activeShop } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shops, setShops] = useState<ShopLite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    phone: '',
    email: '',
    job_title: '',
  })
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [assignedShopIds, setAssignedShopIds] = useState<string[]>([])
  const [inviteUrl, setInviteUrl] = useState<{ employeeId: string; url: string } | null>(null)
  const [actionError, setActionError] = useState('')
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (activeBusiness) {
      loadEmployees()
      loadShops()
    }
  }, [activeBusiness])

  async function loadEmployees() {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const data = await employeeApi.listByBusiness(activeBusiness.id)
      setEmployees(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees')
    } finally {
      setLoading(false)
    }
  }

  async function loadShops() {
    if (!activeBusiness) return
    try {
      const data = await shopApi.listByBusiness(activeBusiness.id)
      setShops(data.map((s) => ({ id: s.id, name: s.name })))
    } catch {
      // ignore
    }
  }

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault()
    if (!activeBusiness) return
    setError('')
    try {
      await employeeApi.create(activeBusiness.id, form)
      setShowCreate(false)
      setForm({ first_name: '', middle_name: '', last_name: '', phone: '', email: '', job_title: '' })
      loadEmployees()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create employee')
    }
  }

  async function toggleAssign(emp: Employee) {
    setActionError('')
    setInviteUrl(null)
    if (assigningId === emp.id) {
      setAssigningId(null)
      return
    }
    setAssigningId(emp.id)
    setActing(true)
    try {
      const assigned = await employeeApi.listShops(emp.id)
      setAssignedShopIds(assigned.map((s) => s.id))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load assignments')
    } finally {
      setActing(false)
    }
  }

  async function assign(empId: string, shopId: string) {
    setActing(true)
    setActionError('')
    try {
      await employeeApi.assignToShop(empId, { shop_id: shopId })
      setAssignedShopIds((prev) => [...prev, shopId])
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to assign shop')
    } finally {
      setActing(false)
    }
  }

  async function unassign(empId: string, shopId: string) {
    setActing(true)
    setActionError('')
    try {
      await employeeApi.removeFromShop(empId, shopId)
      setAssignedShopIds((prev) => prev.filter((id) => id !== shopId))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove assignment')
    } finally {
      setActing(false)
    }
  }

  async function invite(emp: Employee) {
    setActing(true)
    setActionError('')
    setInviteUrl(null)
    try {
      const res = await employeeApi.createInvitation(emp.id, { employee_id: emp.id })
      if (res.invitation_url) {
        setInviteUrl({ employeeId: emp.id, url: res.invitation_url })
      } else {
        setActionError('Invitation created but no URL was returned')
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create invitation')
    } finally {
      setActing(false)
    }
  }

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <div className="empty-icon" style={{ fontSize: 64 }}>👥</div>
        <h2>No Business Selected</h2>
        <p className="muted">Select a business to manage employees.</p>
      </div>
    )
  }

  return (
    <div className="seller-employees">
      <div className="page-header">
        <h1>Employees</h1>
        <Button onClick={() => setShowCreate(true)}>➕ Add Employee</Button>
      </div>

      {showCreate && (
        <Card style={{ marginBottom: 24 }}>
          <h2>Add Employee</h2>
          {error && <ErrorBox error={error} />}
          <form onSubmit={createEmployee}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <Field label="First Name" name="first_name" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              <Field label="Middle Name" name="middle_name" value={form.middle_name} onChange={(e) => setForm({ ...form, middle_name: e.target.value })} />
              <Field label="Last Name" name="last_name" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              <Field label="Phone" name="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+243 …" />
              <Field label="Email" name="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Field label="Job Title" name="job_title" required value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Button type="submit">Create Employee</Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <LoadingBlock label="Loading employees…" />
      ) : error ? (
        <ErrorBox error={error} />
      ) : employees.length === 0 ? (
        <Card>
          <div className="empty-state" style={{ padding: '48px 0', textAlign: 'center' }}>
            <div className="empty-icon" style={{ fontSize: 48 }}>👥</div>
            <h3>No Employees Yet</h3>
            <p className="muted">Add employees to help manage your business.</p>
            <Button onClick={() => setShowCreate(true)} size="lg">Add Employee</Button>
          </div>
        </Card>
      ) : (
        <>
          {actionError && <ErrorBox error={actionError} />}
          <Card>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>System Access</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <strong>{emp.first_name} {emp.last_name}</strong>
                        {emp.middle_name && <span className="muted small"> {emp.middle_name}</span>}
                      </td>
                      <td>{emp.job_title}</td>
                      <td className="small">
                        {emp.phone}<br />
                        {emp.email}
                      </td>
                      <td><span className={`badge badge-${emp.status === 'ACTIVE' ? 'success' : emp.status === 'INACTIVE' ? 'warning' : 'danger'}`}>{emp.status}</span></td>
                      <td>{emp.linked_user_id ? '✓ Enabled' : '○ Disabled'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Button variant="ghost" size="sm" onClick={() => toggleAssign(emp)}>
                            {assigningId === emp.id ? 'Hide Shops' : 'Assign Shops'}
                          </Button>
                          {!emp.linked_user_id && (
                            <Button variant="primary" size="sm" disabled={acting} onClick={() => invite(emp)}>
                              Invite Access
                            </Button>
                          )}
                        </div>
                        {assigningId === emp.id && (
                          <div style={{ marginTop: 8, textAlign: 'left' }}>
                            {shops.length === 0 ? (
                              <span className="muted small">No shops to assign. Create a shop first.</span>
                            ) : (
                              shops.map((shop) => {
                                const isAssigned = assignedShopIds.includes(shop.id)
                                return (
                                  <div key={shop.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                                    <span className="small">🏪 {shop.name}{shop.id === activeShop ? ' (current)' : ''}</span>
                                    {isAssigned ? (
                                      <Button variant="ghost" size="sm" disabled={acting} onClick={() => unassign(emp.id, shop.id)}>Remove</Button>
                                    ) : (
                                      <Button variant="outline" size="sm" disabled={acting} onClick={() => assign(emp.id, shop.id)}>Assign</Button>
                                    )}
                                  </div>
                                )
                              })
                            )}
                          </div>
                        )}
                        {inviteUrl?.employeeId === emp.id && (
                          <div style={{ marginTop: 8, textAlign: 'left' }}>
                            <span className="muted small">Invitation link (expires soon):</span>
                            <br />
                            <input
                              readOnly
                              value={inviteUrl.url}
                              onFocus={(e) => e.currentTarget.select()}
                              style={{ width: '100%', marginTop: 4 }}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
