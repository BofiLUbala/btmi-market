import { useAuth } from '@/store/auth'
import { customerApi } from '@/api/seller'
import { Card } from '@/components/ui/Card'
import { useEffect, useState } from 'react'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'

interface Customer {
  id: string
  first_name: string
  last_name: string
  phone?: string | null
  email?: string | null
  status: string
  total_orders: number
  total_spent: number
  created_at: string
}

export default function SellerCustomersPage() {
  const { activeBusiness } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
  })

  useEffect(() => {
    if (activeBusiness) {
      loadCustomers()
    }
  }, [activeBusiness])

  async function loadCustomers() {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const res = await customerApi.listByBusiness(activeBusiness.id) as unknown as any
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
      setCustomers(list.map((s: any) => ({
        ...(s.customer || s),
        id: s.customer?.id || s.id,
        first_name: s.customer?.first_name || s.first_name || '',
        last_name: s.customer?.last_name || s.last_name || '',
        phone: s.customer?.phone || s.phone,
        email: s.customer?.email || s.email,
        status: s.customer?.status || s.status || 'ACTIVE',
        total_orders: s.total_orders ?? 0,
        total_spent: s.total_purchased ?? s.total_spent ?? 0,
        created_at: s.customer?.created_at || s.created_at,
      })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault()
    if (!activeBusiness) return
    setError('')
    try {
      await customerApi.create(activeBusiness.id, form)
      setShowCreate(false)
      setForm({ first_name: '', last_name: '', phone: '', email: '' })
      loadCustomers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create customer')
    }
  }

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <div className="empty-icon" style={{ fontSize: 64 }}>👤</div>
        <h2>No Business Selected</h2>
        <p className="muted">Select a business to manage customers.</p>
      </div>
    )
  }

  const customerList = Array.isArray(customers) ? customers : []

  return (
    <div className="seller-customers">
      <div className="page-header">
        <h1>Customers</h1>
        <Button onClick={() => setShowCreate(true)}>➕ Add Customer</Button>
      </div>

      {showCreate && (
        <Card style={{ marginBottom: 24 }}>
          <h2>Add New Customer</h2>
          {error && <ErrorBox error={error} />}
          <form onSubmit={createCustomer}>
            <Field label="First Name" name="first_name" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <Field label="Last Name" name="last_name" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            <Field label="Phone" name="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+243 …" />
            <Field label="Email" name="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Button type="submit">Create Customer</Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <LoadingBlock label="Loading customers…" />
      ) : error ? (
        <ErrorBox error={error} />
      ) : customerList.length === 0 ? (
        <Card>
          <div className="empty-state" style={{ padding: '48px 0', textAlign: 'center' }}>
            <div className="empty-icon" style={{ fontSize: 48 }}>👤</div>
            <h3>No Customers Yet</h3>
            <p className="muted">Add customers to track their orders and preferences.</p>
            <Button onClick={() => setShowCreate(true)} size="lg">Add Customer</Button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Orders</th>
                  <th>Total Spent (FC)</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <strong>{customer.first_name} {customer.last_name}</strong>
                    </td>
                    <td className="small">
                      {customer.phone || '—'}
                      {customer.email && <br />}
                      {customer.email}
                    </td>
                    <td>{customer.total_orders}</td>
                    <td>{customer.total_spent.toLocaleString()}</td>
                    <td className="small">{new Date(customer.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}