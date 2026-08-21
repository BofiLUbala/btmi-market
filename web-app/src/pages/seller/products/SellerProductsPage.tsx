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
      setProducts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products')
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

  return (
    <div className="seller-products">
      <div className="page-header">
        <h1>Products</h1>
        <Link to="/seller/products/new">
          <Button>➕ Create Product</Button>
        </Link>
      </div>

      {loading ? (
        <LoadingBlock label="Loading products…" />
      ) : error ? (
        <ErrorBox error={error} />
      ) : products.length === 0 ? (
        <Card>
          <div className="empty-state" style={{ padding: '48px 0', textAlign: 'center' }}>
            <div className="empty-icon" style={{ fontSize: 48 }}>📦</div>
            <h3>No Products Yet</h3>
            <p className="muted">Create your first product to start selling.</p>
            <Link to="/seller/products/new">
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
                  <th>SKU</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                      <br />
                      <span className="muted small">{(product.description || '').slice(0, 60)}{product.description && product.description.length > 60 ? '...' : ''}</span>
                    </td>
                    <td className="mono">{product.sku}</td>
                    <td><span className={`badge badge-${product.publication_status === 'PUBLISHED' ? 'success' : product.publication_status === 'DRAFT' ? 'warning' : 'muted'}`}>{product.publication_status}</span></td>
                    <td className="small">{new Date(product.created_at).toLocaleDateString()}</td>
                    <td>
                      <Link to={`/seller/products/${product.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </td>
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