import { useAuth } from '@/store/auth'
import { shopApi } from '@/api/seller'
import { Button } from '@/components/ui/Button'
import { Card, CardGrid } from '@/components/ui/Card'
import { useEffect, useState } from 'react'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { Field } from '@/components/ui/Field'

interface Shop {
  id: string
  name: string
  type: string
  city: string
  address: string
  phone: string
  status: string
}

export default function SellerShopsPage() {
  const { activeBusiness, activeShop, setActiveShop } = useAuth()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '',
    type: 'PHYSICAL',
    city: '',
    address: '',
    phone: '',
  })

  useEffect(() => {
    if (activeBusiness) {
      loadShops()
    }
  }, [activeBusiness])

  async function loadShops() {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const data = await shopApi.listByBusiness(activeBusiness.id)
      setShops(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shops')
    } finally {
      setLoading(false)
    }
  }

  async function createShop(e: React.FormEvent) {
    e.preventDefault()
    if (!activeBusiness) return
    setError('')
    try {
      await shopApi.create(activeBusiness.id, form)
      setShowCreate(false)
      setForm({ name: '', type: 'PHYSICAL', city: '', address: '', phone: '' })
      loadShops()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create shop')
    }
  }

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <div className="empty-icon" style={{ fontSize: 64 }}>🏪</div>
        <h2>No Business Selected</h2>
        <p className="muted">Select a business to manage shops.</p>
      </div>
    )
  }

  return (
    <div className="seller-shops">
      <div className="page-header">
        <h1>Shops</h1>
        <Button onClick={() => setShowCreate(true)}>➕ Create Shop</Button>
      </div>

      {showCreate && (
        <Card style={{ marginBottom: 24 }}>
          <h2>Create New Shop</h2>
          {error && <ErrorBox error={error} />}
          <form onSubmit={createShop}>
            <Field label="Shop Name" name="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Field label="Type" name="type" required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} as="select" options={[
              { value: 'PHYSICAL', label: 'Retail Store' },
              { value: 'ONLINE', label: 'Online Only' },
            ]} />
            <Field label="City" name="city" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Field label="Address" name="address" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
            <Field label="Phone" name="phone" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+243 …" />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Button type="submit">Create Shop</Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <LoadingBlock label="Loading shops…" />
      ) : error ? (
        <ErrorBox error={error} />
      ) : shops.length === 0 ? (
        <Card>
          <div className="empty-state" style={{ padding: '48px 0', textAlign: 'center' }}>
            <div className="empty-icon" style={{ fontSize: 48 }}>🏪</div>
            <h3>No Shops Yet</h3>
            <p className="muted">Create your first shop to start selling.</p>
            <Button onClick={() => setShowCreate(true)} size="lg">Create Shop</Button>
          </div>
        </Card>
      ) : (
        <CardGrid>
          {shops.map((shop) => (
            <Card key={shop.id} className={shop.id === activeShop ? 'active' : ''} onClick={() => setActiveShop(shop.id)} style={{ cursor: 'pointer' }}>
              <div className="shop-card-header">
                <span className="shop-icon">🏪</span>
                <div>
                  <h3>{shop.name}</h3>
                  <span className={`badge badge-${shop.status === 'ACTIVE' ? 'success' : 'muted'}`}>{shop.status}</span>
                </div>
              </div>
              <p className="muted small">{shop.type} • {shop.city}</p>
              <p className="muted small">{shop.address}</p>
              <p className="muted small">{shop.phone}</p>
              {shop.id === activeShop && <div className="active-badge">✓ Active Shop</div>}
            </Card>
          ))}
        </CardGrid>
      )}
    </div>
  )
}