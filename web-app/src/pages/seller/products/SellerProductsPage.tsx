import { useAuth } from '@/store/auth'
import { productApi } from '@/api/seller'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'

interface Product {
  id: string
  name: string
  description: string
  sku: string
  category_id?: string | null
  subcategory_id?: string | null
  publication_status: string
  created_at: string
}

export default function SellerProductsPage() {
  const { activeBusiness } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (activeBusiness) {
      loadProducts()
    }
  }, [activeBusiness])

  async function loadProducts() {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const data = await productApi.listByBusiness(activeBusiness.id)
      setProducts(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <div className="empty-icon" style={{ fontSize: 64 }}>📦</div>
        <h2>No Business Selected</h2>
        <p className="muted">Select a business to manage products.</p>
      </div>
    )
  }

  const productList = Array.isArray(products) ? products : []

  return (
    <div className="seller-products">
      <div className="page-header">
        <div>
          <h1>Products</h1>
          <p className="muted" style={{ margin: 0 }}>
            Products are created inside a Shop. Choose a Shop to add or manage its Products.
          </p>
        </div>
        <Link to="/seller/products/select-shop">
          <Button>+ Create Product</Button>
        </Link>
      </div>

      {loading ? (
        <LoadingBlock label="Loading products…" />
      ) : error ? (
        <ErrorBox error={error} />
      ) : productList.length === 0 ? (
        <Card>
          <div className="empty-state" style={{ padding: '48px 0', textAlign: 'center' }}>
            <div className="empty-icon" style={{ fontSize: 48 }}>📦</div>
            <h3>No Products Yet</h3>
            <p className="muted">Choose one of your Shops to create your first Product.</p>
            <Link to="/seller/products/select-shop">
              <Button size="lg">Create Product</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Variants</th>
                  <th>Stock</th>
                  <th>Sale Price</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {productList.map((product: any) => {
                  const avail = product.available_quantity ?? (product.total_quantity ?? 0)
                  const reserved = product.reserved_quantity ?? 0
                  const total = product.total_quantity ?? avail
                  return (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.name}</strong>
                        {product.sku && (
                          <span className="mono small muted" style={{ display: 'block' }}>
                            SKU: {product.sku}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-outline">
                          {product.category_name || 'General'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <strong>{product.variant_count || 1}</strong>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong style={{ color: avail > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                            {avail} available
                          </strong>
                          {reserved > 0 && (
                            <span className="small muted">
                              ({total} total · {reserved} reserved)
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <strong>{product.unit_price ? `${Number(product.unit_price).toLocaleString()} FC` : '—'}</strong>
                        {product.unit && <span className="muted small"> / {product.unit}</span>}
                      </td>
                      <td>
                        <span className={`badge badge-${product.publication_status === 'PUBLISHED' ? 'success' : product.publication_status === 'DRAFT' ? 'warning' : 'muted'}`}>
                          {product.publication_status}
                        </span>
                      </td>
                      <td className="small">{new Date(product.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Link to={`/seller/products/${product.id}`}>
                            <Button variant="ghost" size="sm">Details</Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}