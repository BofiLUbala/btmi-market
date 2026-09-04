import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { adminCommerceApi, type AdminProductListItem } from '@/api/admin'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PUBLISHED: { bg: '#064e3b', text: '#a7f3d0' },
  DRAFT: { bg: '#78350f', text: '#fde68a' },
  ARCHIVED: { bg: '#334155', text: '#94a3b8' },
  ACTIVE: { bg: '#064e3b', text: '#a7f3d0' },
  LOW_STOCK: { bg: '#78350f', text: '#fde68a' },
  OUT_OF_STOCK: { bg: '#7f1d1d', text: '#fca5a5' },
  IN_STOCK: { bg: '#064e3b', text: '#a7f3d0' },
}

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] || { bg: '#334155', text: '#f1f5f9' }
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      backgroundColor: colors.bg, color: colors.text, display: 'inline-block',
      letterSpacing: '0.03em'
    }}>{status}</span>
  )
}

export default function CommerceProductsPage() {
  const [products, setProducts] = useState<AdminProductListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [publicationStatus, setPublicationStatus] = useState('')
  const [stockStatus, setStockStatus] = useState('')
  const [page, setPage] = useState(0)
  const [limit] = useState(20)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminCommerceApi.listProducts({
        search: search || undefined,
        publication_status: publicationStatus || undefined,
        stock_status: stockStatus || undefined,
        limit,
        offset: page
      })
      setProducts(res.products)
      setTotal(res.total)
    } catch (err) {
      console.error('Failed to load products', err)
    } finally {
      setLoading(false)
    }
  }, [search, publicationStatus, stockStatus, page, limit])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Product Catalog Control</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Cross-business search, flag, unpublish, and archive products.</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search by name or SKU..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          style={{
            flex: '1 1 240px', padding: '8px 12px', borderRadius: 8, border: '1px solid #334155',
            backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13, outline: 'none'
          }}
        />
        <select
          value={publicationStatus}
          onChange={(e) => { setPublicationStatus(e.target.value); setPage(0) }}
          style={{
            padding: '8px 12px', borderRadius: 8, border: '1px solid #334155',
            backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13, minWidth: 140
          }}
        >
          <option value="">All Status</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          value={stockStatus}
          onChange={(e) => { setStockStatus(e.target.value); setPage(0) }}
          style={{
            padding: '8px 12px', borderRadius: 8, border: '1px solid #334155',
            backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13, minWidth: 140
          }}
        >
          <option value="">All Stock</option>
          <option value="IN_STOCK">In Stock</option>
          <option value="LOW_STOCK">Low Stock</option>
          <option value="OUT_OF_STOCK">Out of Stock</option>
        </select>
        <span style={{ color: '#64748b', fontSize: 12 }}>{total} products</span>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading...</div>
      ) : products.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No products found</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {['Product', 'Business', 'Category', 'Status', 'Price', 'Stock', 'Variants', 'Images', 'Updated'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {p.primary_image ? (
                        <img src={p.primary_image} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#64748b' }}>📦</div>
                      )}
                      <div>
                        <Link to={`/admin/commerce/products/${p.id}`} style={{ color: '#f8fafc', fontWeight: 600, textDecoration: 'none' }}>{p.name}</Link>
                        <div style={{ color: '#64748b', fontSize: 11 }}>SKU: {p.sku || 'N/A'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>{p.business_name}</td>
                  <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>
                    {p.category_name || '-'}
                    {p.subcategory_name ? <span style={{ color: '#64748b' }}> / {p.subcategory_name}</span> : ''}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
                      <StatusBadge status={p.publication_status} />
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ color: '#f8fafc', fontWeight: 600 }}>${p.effective_price.toFixed(2)}</div>
                    {p.discount_active && <div style={{ color: '#64748b', fontSize: 11, textDecoration: 'line-through' }}>${p.unit_price.toFixed(2)}</div>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <StatusBadge status={p.total_available > 0 ? (p.total_available <= 5 ? 'LOW_STOCK' : 'IN_STOCK') : 'OUT_OF_STOCK'} />
                    <div style={{ color: '#64748b', fontSize: 11 }}>{p.total_available} units</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>{p.variant_count}</td>
                  <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>{p.image_count}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {new Date(p.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button
            onClick={() => setPage(Math.max(0, page - limit))}
            disabled={page === 0}
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #334155',
              backgroundColor: '#0f172a', color: page === 0 ? '#475569' : '#f8fafc',
              cursor: page === 0 ? 'default' : 'pointer', fontSize: 12, fontWeight: 600
            }}
          >Previous</button>
          <span style={{ padding: '6px 14px', color: '#94a3b8', fontSize: 12 }}>
            Page {Math.floor(page / limit) + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(total - limit, page + limit))}
            disabled={page + limit >= total}
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #334155',
              backgroundColor: '#0f172a', color: page + limit >= total ? '#475569' : '#f8fafc',
              cursor: page + limit >= total ? 'default' : 'pointer', fontSize: 12, fontWeight: 600
            }}
          >Next</button>
        </div>
      )}
    </div>
  )
}
