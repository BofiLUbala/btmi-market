import { inventoryApi, productApi } from '@/api/seller'
import type { Product, PublicationStatus } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { useAuth } from '@/store/auth'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const FILTERS: Array<{ label: string; value: '' | PublicationStatus }> = [
  { label: 'All', value: '' },
  { label: 'Published', value: 'PUBLISHED' },
  { label: 'Drafts', value: 'DRAFT' },
]

export default function SellerProductsPage() {
  const { activeBusiness, activeShop } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<'' | PublicationStatus>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (activeBusiness) void loadProducts()
  }, [activeBusiness?.id, debouncedSearch, status])

  async function loadProducts() {
    if (!activeBusiness) return
    setLoading(true)
    setError('')
    try {
      const data = await productApi.listByBusiness(activeBusiness.id, {
        search: debouncedSearch || undefined,
        publication_status: status || undefined,
      })
      setProducts(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  async function sendToMarketplace(product: Product) {
    if (!activeBusiness) return
    if (!activeShop) {
      setError('Select a Shop in the top bar before sending this product to the marketplace.')
      return
    }
    setBusyId(product.id)
    setError('')
    try {
      const variants = await productApi.listVariants(activeBusiness.id, product.id)
      if (variants.length === 0) throw new Error('This product needs at least one variant before publication.')
      await Promise.all(
        variants.map((variant) => inventoryApi.addStock(activeShop, {
          variant_id: variant.id,
          quantity: 0,
          notes: 'Marketplace offer registration',
        }))
      )
      await productApi.update(activeBusiness.id, product.id, { publication_status: 'PUBLISHED', status: 'ACTIVE' })
      await loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send product to marketplace')
    } finally {
      setBusyId('')
    }
  }

  async function unpublishProduct(product: Product) {
    if (!activeBusiness) return
    setBusyId(product.id)
    setError('')
    try {
      await productApi.update(activeBusiness.id, product.id, { publication_status: 'DRAFT' })
      await loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unpublish product')
    } finally {
      setBusyId('')
    }
  }

  async function archiveProduct(product: Product) {
    if (!activeBusiness) return
    const confirmed = window.confirm(
      `Delete “${product.name}” from your active catalog? Its sales history will be preserved.`
    )
    if (!confirmed) return
    setBusyId(product.id)
    setError('')
    try {
      await productApi.update(activeBusiness.id, product.id, {
        status: 'INACTIVE',
        publication_status: 'ARCHIVED',
      })
      setProducts((current) => current.filter((item) => item.id !== product.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product')
    } finally {
      setBusyId('')
    }
  }

  if (!activeBusiness) {
    return (
      <div className="empty-state seller-products-empty">
        <div className="empty-icon">📦</div>
        <h2>No Business Selected</h2>
        <p className="muted">Select a business to manage products.</p>
      </div>
    )
  }

  return (
    <div className="seller-products">
      <div className="seller-products-head">
        <div>
          <h1>Products</h1>
          <p className="muted">Search, publish, edit or remove products from your catalog.</p>
        </div>
        <Link to="/seller/products/select-shop" className="btn btn-primary">+ Create Product</Link>
      </div>

      <div className="seller-product-toolbar" role="search">
        <input
          className="input seller-product-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by product name, SKU or description…"
          aria-label="Search products"
        />
        <div className="seller-product-filters" aria-label="Filter products by status">
          {FILTERS.map((filter) => (
            <button
              key={filter.label}
              type="button"
              className={`seller-product-filter${status === filter.value ? ' active' : ''}`}
              onClick={() => setStatus(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBox error={error} />}
      {loading ? (
        <LoadingBlock label="Loading products…" />
      ) : products.length === 0 ? (
        <Card>
          <div className="empty-state seller-products-empty">
            <div className="empty-icon">⌕</div>
            <h3>{search || status ? 'No matching products' : 'No Products Yet'}</h3>
            <p className="muted">{search || status ? 'Try another search or filter.' : 'Create your first product to start selling.'}</p>
          </div>
        </Card>
      ) : (
        <div className="seller-product-grid">
          {products.map((product) => {
            const available = product.available_quantity ?? product.total_quantity ?? 0
            const busy = busyId === product.id
            return (
              <article className="seller-product-card" key={product.id}>
                <div className="seller-product-card-top">
                  <span className="badge badge-outline">{product.category_name || 'General'}</span>
                  <span className={`badge badge-${product.publication_status === 'PUBLISHED' ? 'success' : 'warning'}`}>
                    {product.publication_status}
                  </span>
                </div>
                <div className="seller-product-card-main">
                  <h3 title={product.name}>{product.name}</h3>
                  <span className="mono small muted">{product.sku ? `SKU: ${product.sku}` : 'No SKU'}</span>
                </div>
                <div className="seller-product-card-stats">
                  <div><span>Price</span><strong>{product.unit_price ? `${Number(product.unit_price).toLocaleString()} FC` : '—'}</strong></div>
                  <div><span>Available</span><strong className={available > 0 ? 'success' : 'muted'}>{available}</strong></div>
                  <div><span>Variants</span><strong>{product.variant_count || 1}</strong></div>
                </div>
                <div className="seller-product-card-actions">
                  <Link to={`/seller/products/${product.id}`} className="btn btn-outline btn-sm">Edit</Link>
                  <Button variant="primary" size="sm" disabled={busy} onClick={() => sendToMarketplace(product)}>
                    {product.publication_status === 'PUBLISHED' ? 'Sync market' : 'Send to market'}
                  </Button>
                  {product.publication_status === 'PUBLISHED' && (
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => unpublishProduct(product)}>Unpublish</Button>
                  )}
                  <Button variant="danger" size="sm" disabled={busy} onClick={() => archiveProduct(product)}>
                    Delete
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
