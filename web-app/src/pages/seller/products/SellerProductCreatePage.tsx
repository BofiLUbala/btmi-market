import { useAuth } from '@/store/auth'
import { productApi } from '@/api/seller'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'

export default function SellerProductCreatePage() {
  const { activeBusiness } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    sku: '',
    description: '',
    unit_price: '',
    cost_price: '',
    unit: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <div className="empty-icon" style={{ fontSize: 64 }}>📦</div>
        <h2>No Business Selected</h2>
        <p className="muted">Select a business to create products.</p>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!activeBusiness) return
    setBusy(true)
    setError('')
    try {
      const product = await productApi.create(activeBusiness.id, {
        name: form.name,
        sku: form.sku || undefined,
        description: form.description || undefined,
        unit_price: form.unit_price ? parseFloat(form.unit_price) : undefined,
        cost_price: form.cost_price ? parseFloat(form.cost_price) : undefined,
        unit: form.unit || undefined,
      })
      navigate(`/seller/products/${product.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product')
      setBusy(false)
    }
  }

  return (
    <div className="seller-product-create">
      <div className="page-header">
        <h1>Create Product</h1>
        <Link to="/seller/products">
          <Button variant="ghost">← Back to Products</Button>
        </Link>
      </div>

      <Card>
        {error && <ErrorBox error={error} />}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <Field label="Product Name" name="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Field label="SKU" name="sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <Field label="Unit (e.g. piece, kg)" name="unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <Field label="Sale Price (FC)" name="unit_price" type="number" min="0" step="any" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
            <Field label="Cost Price (FC)" name="cost_price" type="number" min="0" step="any" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
          </div>
          <div style={{ marginTop: 16 }}>
            <Field label="Description" name="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ marginTop: 16 }}>
            <Button type="submit" loading={busy}>Create Product</Button>
          </div>
          <p className="muted small" style={{ marginTop: 12 }}>
            After creating the product you can add variants and stock from its detail page.
          </p>
        </form>
      </Card>
    </div>
  )
}
