import { useAuth } from '@/store/auth'
import { productApi, inventoryApi } from '@/api/seller'
import type { Product, ProductVariant } from '@/api/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

export default function SellerProductDetailPage() {
  const { activeBusiness, activeShop } = useAuth()
  const { productId } = useParams<{ productId: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showVariantForm, setShowVariantForm] = useState(false)
  const [variantForm, setVariantForm] = useState({ name: '', sku: '', sale_price: '', purchase_price: '' })
  const [stockByVariant, setStockByVariant] = useState<Record<string, string>>({})
  const [stockMsg, setStockMsg] = useState('')

  useEffect(() => {
    if (activeBusiness && productId) {
      load()
    }
  }, [activeBusiness, productId])

  async function load() {
    if (!activeBusiness || !productId) return
    setLoading(true)
    setError('')
    try {
      const p = await productApi.get(activeBusiness.id, productId)
      setProduct(p)
      const v = await productApi.listVariants(activeBusiness.id, productId)
      setVariants(v)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product')
    } finally {
      setLoading(false)
    }
  }

  async function togglePublish() {
    if (!activeBusiness || !product) return
    setBusy(true)
    setActionError('')
    try {
      const next = product.publication_status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
      const updated = await productApi.update(activeBusiness.id, product.id, { publication_status: next })
      setProduct(updated)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update publication status')
    } finally {
      setBusy(false)
    }
  }

  async function createVariant(e: React.FormEvent) {
    e.preventDefault()
    if (!activeBusiness || !productId) return
    setBusy(true)
    setActionError('')
    try {
      await productApi.createVariant(activeBusiness.id, productId, {
        name: variantForm.name || undefined,
        sku: variantForm.sku || undefined,
        sale_price: parseFloat(variantForm.sale_price),
        purchase_price: variantForm.purchase_price ? parseFloat(variantForm.purchase_price) : undefined,
      })
      setVariantForm({ name: '', sku: '', sale_price: '', purchase_price: '' })
      setShowVariantForm(false)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create variant')
    } finally {
      setBusy(false)
    }
  }

  async function addStock(variantId: string) {
    if (!activeShop) {
      setActionError('Select a shop in the header first')
      return
    }
    const qty = parseInt(stockByVariant[variantId], 10)
    if (isNaN(qty) || qty <= 0) {
      setActionError('Enter a valid stock quantity')
      return
    }
    setBusy(true)
    setActionError('')
    try {
      await inventoryApi.addStock(activeShop, { variant_id: variantId, quantity: qty, notes: 'Initial stock' })
      setStockByVariant((prev) => ({ ...prev, [variantId]: '' }))
      setStockMsg(`Added ${qty} units to ${activeShop.slice(0, 8)}…`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add stock')
    } finally {
      setBusy(false)
    }
  }

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <div className="empty-icon" style={{ fontSize: 64 }}>📦</div>
        <h2>No Business Selected</h2>
      </div>
    )
  }

  if (loading) return <LoadingBlock label="Loading product…" />
  if (error) return <ErrorBox error={error} />
  if (!product) return <ErrorBox error="Product not found" />

  return (
    <div className="seller-product-detail">
      <div className="page-header">
        <h1>{product.name}</h1>
        <Link to="/seller/products">
          <Button variant="ghost">← Back to Products</Button>
        </Link>
      </div>

      {actionError && <ErrorBox error={actionError} />}
      {stockMsg && <p className="success small">{stockMsg}</p>}

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span className={`badge badge-${product.publication_status === 'PUBLISHED' ? 'success' : product.publication_status === 'DRAFT' ? 'warning' : 'muted'}`}>
              {product.publication_status}
            </span>
            {product.sku && <span className="muted small" style={{ marginLeft: 8 }}>SKU: {product.sku}</span>}
          </div>
          <Button variant={product.publication_status === 'PUBLISHED' ? 'outline' : 'primary'} onClick={togglePublish} disabled={busy}>
            {product.publication_status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
          </Button>
        </div>
        {product.description && <p className="muted" style={{ marginTop: 12 }}>{product.description}</p>}
      </Card>

      <Card style={{ marginTop: 16 }}>
        <div className="card-header">
          <h3>Variants ({variants.length})</h3>
          <Button size="sm" onClick={() => setShowVariantForm(!showVariantForm)}>
            {showVariantForm ? 'Cancel' : '➕ Add Variant'}
          </Button>
        </div>

        {showVariantForm && (
          <form onSubmit={createVariant} style={{ margin: '16px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <Field label="Variant Name" name="vname" value={variantForm.name} onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })} placeholder="e.g. Red / XL" />
              <Field label="SKU" name="vsku" value={variantForm.sku} onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })} />
              <Field label="Sale Price (FC)" name="vsale" required type="number" min="0" step="any" value={variantForm.sale_price} onChange={(e) => setVariantForm({ ...variantForm, sale_price: e.target.value })} />
              <Field label="Purchase Price (FC)" name="vpurchase" type="number" min="0" step="any" value={variantForm.purchase_price} onChange={(e) => setVariantForm({ ...variantForm, purchase_price: e.target.value })} />
            </div>
            <Button type="submit" style={{ marginTop: 12 }} loading={busy}>Create Variant</Button>
          </form>
        )}

        {variants.length === 0 ? (
          <p className="muted small" style={{ padding: 8 }}>No variants yet. Add at least one variant, then stock it.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>SKU</th>
                  <th>Sale Price</th>
                  <th>Status</th>
                  <th>Add Stock{!activeShop && <span className="muted"> (select shop)</span>}</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id}>
                    <td>{v.name || v.id.slice(0, 8)}</td>
                    <td className="mono small">{v.sku || '—'}</td>
                    <td>{Number(v.sale_price).toLocaleString()} FC</td>
                    <td><span className={`badge badge-${v.status === 'ACTIVE' ? 'success' : 'muted'}`}>{v.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={stockByVariant[v.id] ?? ''}
                          onChange={(e) => setStockByVariant((prev) => ({ ...prev, [v.id]: e.target.value }))}
                          style={{ width: 80 }}
                        />
                        <Button size="sm" disabled={busy} onClick={() => addStock(v.id)}>Add</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
