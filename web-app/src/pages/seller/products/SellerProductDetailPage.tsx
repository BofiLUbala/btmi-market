import { useAuth } from '@/store/auth'
import { productApi, inventoryApi, shopApi } from '@/api/seller'
import type { Product, ProductVariant, Shop, InventoryItem } from '@/api/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { PlusIcon } from '@/components/ui/Icons'
import { useEffect, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'

export default function SellerProductDetailPage() {
  const { activeBusiness, activeShop } = useAuth()
  const { productId } = useParams<{ productId: string }>()
  const [searchParams] = useSearchParams()
  const scopedShopId = searchParams.get('shop') || ''
  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [variantInventories, setVariantInventories] = useState<Record<string, InventoryItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)

  // Add Variant Modal/Form state
  const [showVariantForm, setShowVariantForm] = useState(false)
  const [variantForm, setVariantForm] = useState({
    name: '',
    sku: '',
    sale_price: '',
    purchase_price: '',
    initial_stock: '0',
    shop_id: '',
  })

  // Quick stock addition per variant
  const [stockByVariant, setStockByVariant] = useState<Record<string, string>>({})
  const [targetShopByVariant, setTargetShopByVariant] = useState<Record<string, string>>({})
  const [stockMsg, setStockMsg] = useState('')

  useEffect(() => {
    if (activeBusiness && productId) {
      load()
    }
  }, [activeBusiness?.id, productId, scopedShopId])

  async function load() {
    if (!activeBusiness || !productId) return
    setLoading(true)
    setError('')
    try {
      const [p, vList, sList] = await Promise.all([
        productApi.get(activeBusiness.id, productId),
        productApi.listVariants(activeBusiness.id, productId),
        shopApi.listByBusiness(activeBusiness.id),
      ])
      setProduct(p)
      const safeVariants = Array.isArray(vList) ? vList : []
      const safeShops = Array.isArray(sList) ? sList : []
      setVariants(safeVariants)
      setShops(safeShops)

      // Fetch inventories for each variant
      const invMap: Record<string, InventoryItem[]> = {}
      await Promise.all(
        safeVariants.map(async (v) => {
          try {
            const inv = await productApi.getVariantInventory(v.id)
            invMap[v.id] = (Array.isArray(inv) ? inv : []).filter(item => !scopedShopId || item.shop_id === scopedShopId)
          } catch {
            invMap[v.id] = []
          }
        })
      )
      setVariantInventories(invMap)

      // Set default target shops
      const defaultShop = scopedShopId || activeShop || (safeShops.length > 0 ? safeShops[0].id : '')
      setVariantForm((prev) => ({ ...prev, shop_id: defaultShop }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product details.')
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
      const newVar = await productApi.createVariant(activeBusiness.id, productId, {
        name: variantForm.name.trim() || undefined,
        sku: variantForm.sku.trim() || undefined,
        sale_price: parseFloat(variantForm.sale_price),
        purchase_price: variantForm.purchase_price ? parseFloat(variantForm.purchase_price) : undefined,
      })

      const initStock = parseInt(variantForm.initial_stock, 10)
      const shopId = scopedShopId || variantForm.shop_id || activeShop || (shops.length > 0 ? shops[0].id : '')
      if (initStock > 0 && shopId) {
        await inventoryApi.addStock(shopId, {
          variant_id: newVar.id,
          quantity: initStock,
          notes: 'Initial variant stock',
        })
      }

      setVariantForm({
        name: '',
        sku: '',
        sale_price: '',
        purchase_price: '',
        initial_stock: '0',
        shop_id: activeShop || (shops.length > 0 ? shops[0].id : ''),
      })
      setShowVariantForm(false)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create variant')
    } finally {
      setBusy(false)
    }
  }

  async function addStock(variantId: string) {
    const shopId = scopedShopId || targetShopByVariant[variantId] || activeShop || (shops.length > 0 ? shops[0].id : '')
    if (!shopId) {
      setActionError('Please select a shop location to add stock.')
      return
    }
    const qty = parseInt(stockByVariant[variantId], 10)
    if (isNaN(qty) || qty <= 0) {
      setActionError('Enter a valid stock quantity (1 or greater).')
      return
    }
    setBusy(true)
    setActionError('')
    try {
      await inventoryApi.addStock(shopId, { variant_id: variantId, quantity: qty, notes: 'Restock from product detail' })
      setStockByVariant((prev) => ({ ...prev, [variantId]: '' }))
      const shopObj = shops.find((s) => s.id === shopId)
      setStockMsg(`Added ${qty} units to ${shopObj ? shopObj.name : 'shop'} successfully.`)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add stock.')
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

  if (loading) return <LoadingBlock label="Loading product details…" />
  if (error) return <ErrorBox error={error} />
  if (!product) return <ErrorBox error="Product not found" />

  // Calculate physical total, reserved, and available stock across all variants and shops
  let totalProductAvailable = 0
  let totalProductQuantity = 0
  let totalProductReserved = 0
  Object.values(variantInventories).forEach((invList) => {
    invList.forEach((inv) => {
      const q = inv.quantity || 0
      const r = inv.reserved_quantity || 0
      totalProductQuantity += q
      totalProductReserved += r
      totalProductAvailable += Math.max(0, q - r)
    })
  })

  return (
    <div className="seller-product-detail">
      <div className="page-header">
        <div>
          <h1>{product.name}</h1>
          <p className="muted">Catalog item & real-time variant inventory{scopedShopId ? ` · ${shops.find(s => s.id === scopedShopId)?.name ?? 'Selected Shop'} only` : ''}</p>
        </div>
        <Link to={scopedShopId ? `/seller/shops/${scopedShopId}/products` : '/seller/products'}>
          <Button variant="ghost">← Back to Products</Button>
        </Link>
      </div>

      {actionError && <ErrorBox error={actionError} />}
      {stockMsg && (
        <div style={{ padding: '10px 16px', background: 'rgba(15,61,46,0.08)', borderRadius: 8, color: 'var(--color-primary)', fontWeight: 600, marginBottom: 16 }}>
          ✓ {stockMsg}
        </div>
      )}

      {/* ── Product Overview Card ── */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className={`badge badge-${product.publication_status === 'PUBLISHED' ? 'success' : 'warning'}`}>
                {product.publication_status}
              </span>
              {product.sku && <span className="mono small muted">SKU: {product.sku}</span>}
              <span className="small muted">· Base Price: <strong>{Number(product.unit_price || 0).toLocaleString()} FC</strong></span>
              <span className="small muted">· Unit: <strong>{product.unit || 'PCS'}</strong></span>
            </div>
            {product.description && <p className="muted" style={{ margin: '8px 0 0' }}>{product.description}</p>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <span className="small muted" style={{ display: 'block' }}>Inventory Status</span>
              <strong style={{ fontSize: '1.25rem', color: totalProductAvailable > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                {totalProductAvailable} units available
              </strong>
              {totalProductReserved > 0 && (
                <span className="small muted" style={{ display: 'block' }}>
                  ({totalProductQuantity} total · {totalProductReserved} reserved)
                </span>
              )}
            </div>

            <Button
              variant={product.publication_status === 'PUBLISHED' ? 'outline' : 'primary'}
              onClick={togglePublish}
              disabled={busy}
            >
              {product.publication_status === 'PUBLISHED' ? 'Unpublish' : 'Publish to Marketplace'}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Variants & Stock Card ── */}
      <Card style={{ marginTop: 24 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>Variants & Inventory ({variants.length})</h3>
            <p className="muted small" style={{ margin: '2px 0 0' }}>Real inventory quantities per variant and shop.</p>
          </div>
          <Button size="sm" onClick={() => setShowVariantForm(!showVariantForm)}>
            {showVariantForm ? 'Cancel' : <><PlusIcon /> Add Variant</>}
          </Button>
        </div>

        {showVariantForm && (
          <form onSubmit={createVariant} style={{ margin: '16px 0', padding: 16, background: 'var(--color-surface-2)', borderRadius: 'var(--radius)' }}>
            <h4 style={{ margin: '0 0 12px' }}>New Variant</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Field
                label="Variant Name *"
                name="vname"
                required
                value={variantForm.name}
                onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
                placeholder="e.g. Red / XL"
              />
              <Field
                label="SKU"
                name="vsku"
                value={variantForm.sku}
                onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })}
                placeholder="Optional SKU"
              />
              <Field
                label="Sale Price (FC) *"
                name="vsale"
                required
                type="number"
                min="1"
                step="any"
                value={variantForm.sale_price}
                onChange={(e) => setVariantForm({ ...variantForm, sale_price: e.target.value })}
                placeholder={String(product.unit_price || '')}
              />
              <Field
                label="Initial Stock Quantity"
                name="vstock"
                type="number"
                min="0"
                step="1"
                value={variantForm.initial_stock}
                onChange={(e) => setVariantForm({ ...variantForm, initial_stock: e.target.value })}
                placeholder="0"
              />
              {!scopedShopId && shops.length > 1 && (
                <Field
                  label="Stock Location"
                  name="vshop"
                  as="select"
                  value={variantForm.shop_id}
                  onChange={(e) => setVariantForm({ ...variantForm, shop_id: e.target.value })}
                  options={shops.map((s) => ({ value: s.id, label: `${s.name} (${s.city || ''})` }))}
                />
              )}
            </div>
            <div style={{ marginTop: 12 }}>
              <Button type="submit" loading={busy}>Save Variant</Button>
            </div>
          </form>
        )}

        {variants.length === 0 ? (
          <p className="muted small" style={{ padding: 16, textAlign: 'center' }}>No variants found.</p>
        ) : (
          <div className="table-responsive" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>SKU</th>
                  <th>Sale Price</th>
                  <th>Available Stock</th>
                  <th>Stock By Shop</th>
                  <th style={{ minWidth: 220 }}>Add Stock</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => {
                  const invList = variantInventories[v.id] || []
                  const variantAvailable = invList.reduce((sum, i) => sum + Math.max(0, i.quantity - (i.reserved_quantity || 0)), 0)
                  const variantTotal = invList.reduce((sum, i) => sum + (i.quantity || 0), 0)
                  const variantReserved = invList.reduce((sum, i) => sum + (i.reserved_quantity || 0), 0)
                  const targetShop = scopedShopId || targetShopByVariant[v.id] || activeShop || (shops.length > 0 ? shops[0].id : '')

                  return (
                    <tr key={v.id}>
                      <td>
                        <strong>{v.name || 'Default Variant'}</strong>
                        <br />
                        <span className={`badge badge-${v.status === 'ACTIVE' ? 'success' : 'muted'}`} style={{ fontSize: '0.7rem' }}>
                          {v.status}
                        </span>
                      </td>
                      <td className="mono small">{v.sku || '—'}</td>
                      <td><strong>{Number(v.sale_price || 0).toLocaleString()} FC</strong></td>
                      <td>
                        <div>
                          <span style={{ fontWeight: 700, color: variantAvailable > 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}>
                            {variantAvailable} available
                          </span>
                          {variantReserved > 0 && (
                            <span className="small muted" style={{ display: 'block' }}>
                              ({variantTotal} total · {variantReserved} reserved)
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {invList.length === 0 ? (
                          <span className="small muted">0 in all shops</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {invList.map((inv) => {
                              const sObj = shops.find((s) => s.id === inv.shop_id)
                              const avail = Math.max(0, inv.quantity - (inv.reserved_quantity || 0))
                              const res = inv.reserved_quantity || 0
                              return (
                                <span key={inv.id} className="small muted">
                                  🏪 {sObj ? sObj.name : 'Shop'}: <strong>{avail} avail</strong>
                                  {res > 0 && ` (${inv.quantity} total · ${res} res)`}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {!scopedShopId && shops.length > 1 && (
                            <select
                              className="input input-sm"
                              value={targetShop}
                              onChange={(e) => setTargetShopByVariant((prev) => ({ ...prev, [v.id]: e.target.value }))}
                              style={{ width: 110, fontSize: '0.8rem' }}
                            >
                              {shops.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          )}
                          <input
                            className="input input-sm"
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={stockByVariant[v.id] ?? ''}
                            onChange={(e) => setStockByVariant((prev) => ({ ...prev, [v.id]: e.target.value }))}
                            style={{ width: 65 }}
                          />
                          <Button size="sm" disabled={busy} onClick={() => addStock(v.id)}>
                            + Add
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
