import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { inventoryApi, productApi, shopApi } from '@/api/seller'
import { marketplaceApi } from '@/api/marketplace'
import type { CategorySummary, Product, Shop } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'

interface ShopProductRow {
  productId: string
  name: string
  sku: string
  unitPrice: number
  unit: string
  available: number
  variantCount: number
  categoryId: string | null
  publicationStatus?: string
}

export default function ShopProductsPage() {
  const { shopId = '' } = useParams()
  const navigate = useNavigate()
  const { activeBusiness } = useAuth()

  const [shop, setShop] = useState<Shop | null>(null)
  const [rows, setRows] = useState<ShopProductRow[]>([])
  const [chips, setChips] = useState<CategorySummary[]>([])
  const [activeChip, setActiveChip] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<ShopProductRow | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!activeBusiness || !shopId) return
    let mounted = true
    setLoading(true)
    setError('')
    async function load() {
      if (!activeBusiness) return
      const results = await Promise.allSettled([
        shopApi.get(shopId),
        inventoryApi.getShopInventory(shopId, { limit: 200 }),
        productApi.listByBusiness(activeBusiness.id),
        marketplaceApi.shopDetail(shopId),
      ])

      if (!mounted) return

      const shopRes = results[0]
      if (shopRes.status !== 'fulfilled') {
        setError(shopRes.reason instanceof Error ? shopRes.reason.message : 'Failed to load this Shop.')
        setLoading(false)
        return
      }
      setShop(shopRes.value)

      // Product metadata (category, publication status) keyed by id.
      const productMeta = new Map<string, Product>()
      if (results[2].status === 'fulfilled') {
        for (const p of results[2].value) productMeta.set(p.id, p)
      }

      // Group this Shop's inventory rows per Product.
      // NOTE: API returns {inventory:{...}, variant:{...}, product:{...}} per row.
      const grouped = new Map<string, ShopProductRow>()
      const inventory = results[1].status === 'fulfilled' ? results[1].value : []
      for (const raw of inventory as unknown[]) {
        const item = (raw && typeof raw === 'object' ? (raw as Record<string, any>) : {}) as Record<string, any>
        const inv = (item.inventory ?? item) as Record<string, any>
        const pid: string = inv.product_id
        if (!pid) continue
        const available = Number(inv.available ?? 0)
        const hasVariant = Boolean(item.variant_id ?? inv.variant_id)
        const existing = grouped.get(pid)
        if (existing) {
          existing.available += available
          existing.variantCount += hasVariant ? 1 : 0
        } else {
          const nestedProduct = (item.product ?? {}) as Partial<Product>
          const meta = productMeta.get(pid)
          grouped.set(pid, {
            productId: pid,
            name: meta?.name || nestedProduct.name || 'Unknown product',
            sku: meta?.sku || nestedProduct.sku || '',
            unitPrice: Number(meta?.unit_price ?? nestedProduct.unit_price ?? 0),
            unit: meta?.unit ?? nestedProduct.unit ?? 'PCS',
            available,
            variantCount: hasVariant ? 1 : 0,
            categoryId: meta?.category_id ?? null,
            publicationStatus: meta?.publication_status,
          })
        }
      }

      setRows(Array.from(grouped.values()))

      // Real category chips derived from what is published in this Shop.
      if (results[3].status === 'fulfilled') {
        setChips(results[3].value.categories ?? [])
      }

      setLoading(false)
    }

    load()
    return () => {
      mounted = false
    }
  }, [activeBusiness?.id, shopId, refreshKey])

  const visibleRows = useMemo(() => {
    let list = rows
    if (activeChip !== 'all') {
      list = list.filter((r) => r.categoryId === activeChip)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)
      )
    }
    return list
  }, [rows, activeChip, search])

  async function removeFromShop(row: ShopProductRow) {
    setRemoving(row.productId)
    try {
      await inventoryApi.removeProduct(shopId, row.productId)
      setConfirmRemove(null)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove the Product from this Shop.')
      setConfirmRemove(null)
    } finally {
      setRemoving(null)
    }
  }

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <h2>No Business Selected</h2>
        <p className="muted">Select a business to manage Products.</p>
      </div>
    )
  }

  return (
    <div className="shop-products-page">
      <div className="page-header">
        <div>
          <p className="small muted" style={{ margin: 0 }}>
            <Link to="/seller/products" className="section-link">Products</Link>
            {' / '}
            <Link to="/seller/products/select-shop" className="section-link">Choose Shop</Link>
          </p>
          <h1>{shop ? shop.name : 'Shop'}</h1>
          <p className="muted" style={{ margin: 0 }}>
            Products sold in this Shop{shop?.city ? ` · ${shop.city}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/shops/${shopId}`}>
            <Button variant="outline">View on Marketplace</Button>
          </Link>
          <Button onClick={() => navigate(`/seller/shops/${shopId}/products/new`)}>
            + Create Product
          </Button>
        </div>
      </div>

      {confirmRemove && (
        <div className="card" style={{ marginBottom: 24, borderColor: 'var(--color-danger)' }}>
          <h3>Remove {confirmRemove.name} from {shop?.name}?</h3>
          <p className="small muted">
            This Shop's stock for this Product ({confirmRemove.available} units) will be removed and the offer
            will disappear from Marketplace pages where this Shop sells it. The Product itself, other Shops'
            offers and all history remain untouched.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="danger"
              onClick={() => removeFromShop(confirmRemove)}
              disabled={removing === confirmRemove.productId}
            >
              {removing === confirmRemove.productId ? 'Removing…' : 'Remove from Shop'}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmRemove(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingBlock label="Loading Shop Products…" />
      ) : error ? (
        <ErrorBox error={error} />
      ) : (
        <>
          {(chips.length > 0 || rows.length > 0) && (
            <div className="chip-row" role="tablist" aria-label="Filter by category">
              <button
                type="button"
                className={`chip ${activeChip === 'all' ? 'chip-active' : ''}`}
                onClick={() => setActiveChip('all')}
              >
                All
              </button>
              {chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip ${activeChip === c.id ? 'chip-active' : ''}`}
                  onClick={() => setActiveChip(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {rows.length > 3 && (
            <input
              className="input"
              placeholder="Search in this Shop…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 320, marginBottom: 16 }}
            />
          )}

          {visibleRows.length === 0 ? (
            <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <h3>No Products here yet</h3>
              <p className="muted" style={{ margin: '8px 0 20px' }}>
                Products appear in this Shop once they have stock assigned to it.
              </p>
              <Button size="lg" onClick={() => navigate(`/seller/shops/${shopId}/products/new`)}>
                + Create Product
              </Button>
            </div>
          ) : (
            <div className="card">
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Stock in this Shop</th>
                      <th>Variants</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr key={row.productId}>
                        <td>
                          <strong>{row.name}</strong>
                          {row.sku && (
                            <span className="mono small muted" style={{ display: 'block' }}>
                              SKU: {row.sku}
                            </span>
                          )}
                        </td>
                        <td>
                          <strong style={{ color: row.available > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                            {row.available} available
                          </strong>
                        </td>
                        <td style={{ textAlign: 'center' }}>{row.variantCount || 1}</td>
                        <td>
                          <strong>{row.unitPrice ? `${row.unitPrice.toLocaleString()} FC` : '—'}</strong>
                        </td>
                        <td>
                          <span
                            className={`badge badge-${
                              row.publicationStatus === 'PUBLISHED'
                                ? 'success'
                                : row.publicationStatus === 'DRAFT'
                                  ? 'warning'
                                  : 'muted'
                            }`}
                          >
                            {row.publicationStatus ?? 'IN_STOCK'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Link to={`/seller/products/${row.productId}`}>
                              <Button variant="ghost" size="sm">Details</Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              style={{ color: 'var(--color-danger)' }}
                              onClick={() => setConfirmRemove(row)}
                            >
                              Remove from Shop
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
