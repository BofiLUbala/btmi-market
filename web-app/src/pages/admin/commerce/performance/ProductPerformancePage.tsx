import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { adminCommerceApi, type AdminProductPerformance } from '@/api/admin'
import { adminLabel } from '@/lib/adminLabels'
import { formatMoney, dateLocale } from '@/lib/format'
import { useT } from '@/store/i18n'

const PAGE_SIZE = 20

const STOCK_COLOR: Record<string, string> = { IN_STOCK: '#34d399', LOW_STOCK: '#fbbf24', OUT_OF_STOCK: '#f87171' }

/** Sales per product, best sellers first (GET /admin/commerce/products/performance). */
export default function ProductPerformancePage() {
  const t = useT()
  const [rows, setRows] = useState<AdminProductPerformance[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminCommerceApi.getProductPerformance({ limit: PAGE_SIZE, offset })
      setRows(Array.isArray(res.performance) ? res.performance : [])
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.employees.checkFailed'))
    } finally {
      setLoading(false)
    }
  }, [offset, t])

  useEffect(() => { void load() }, [load])

  const pages = Math.ceil(total / PAGE_SIZE)
  const page = Math.floor(offset / PAGE_SIZE) + 1
  const measured = (v: number | null) => (v == null ? '—' : v.toLocaleString(dateLocale()))

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{t('admin.performance.productTitle')}</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{t('admin.performance.productSubtitle')}</p>
      </div>

      {error && <div className="admin-alert" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('common.loading')}</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('admin.performance.noProductData')}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {[t('admin.performance.colProduct'), t('admin.performance.colOrders'), t('admin.performance.colRevenue'), t('admin.performance.colRating'), t('admin.performance.colStock'), t('admin.performance.colViews'), t('admin.performance.colFavorites'), t('admin.performance.colAddToCart'), t('admin.performance.colConversion')].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.product_id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <Link to={`/admin/commerce/products/${p.product_id}`} style={{ color: '#f8fafc', fontWeight: 600, textDecoration: 'none' }}>{p.product_name}</Link>
                    {p.sku && <div style={{ color: '#64748b', fontSize: 11 }}>{p.sku}</div>}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#f8fafc', fontWeight: 600 }}>{p.orders}</td>
                  <td style={{ padding: '10px 12px', color: '#34d399', fontWeight: 700 }}>{formatMoney(p.sales_value)}</td>
                  <td style={{ padding: '10px 12px', color: '#fbbf24', fontWeight: 600 }}>{p.review_score ? `★ ${p.review_score.toFixed(1)}` : '—'}</td>
                  <td style={{ padding: '10px 12px', color: STOCK_COLOR[p.stock_state] ?? '#94a3b8', fontWeight: 600 }}>{adminLabel(p.stock_state)}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{measured(p.views)}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{measured(p.favorites)}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{measured(p.add_to_cart)}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{p.conversion_rate == null ? '—' : `${p.conversion_rate.toFixed(1)} %`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <button className="admin-button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>{t('common.previous')}</button>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>{t('admin.performance.productPager', { page, pages, total })}</span>
          <button className="admin-button" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>{t('common.next')}</button>
        </div>
      )}
    </div>
  )
}
