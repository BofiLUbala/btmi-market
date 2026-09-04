import { useState, useEffect, useCallback } from 'react'
import { adminCommerceApi, type AdminShopPerformance } from '@/api/admin'

export default function ShopPerformancePage() {
  const [performance, setPerformance] = useState<AdminShopPerformance[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [limit] = useState(20)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminCommerceApi.getShopPerformance({ limit, offset: page })
      setPerformance(res.performance)
      setTotal(res.total)
    } catch (err) {
      console.error('Failed to load shop performance', err)
    } finally {
      setLoading(false)
    }
  }, [page, limit])

  useEffect(() => { fetchData() }, [fetchData])

  const totalPages = Math.ceil(total / limit)

  const scoreColor = (score: number) => {
    if (score >= 80) return '#34d399'
    if (score >= 60) return '#fbbf24'
    if (score >= 40) return '#f97316'
    return '#ef4444'
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Shop Performance</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Cross-business shop performance, revenue, and fulfillment metrics.</p>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading...</div>
      ) : performance.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No shop performance data available</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {['Shop', 'Business', 'Orders', 'Revenue', 'Avg Order', 'Fulfillment', 'Return Rate', 'Products', 'Health'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {performance.map(s => (
                <tr key={s.shop_id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '10px 12px', color: '#f8fafc', fontWeight: 600 }}>{s.shop_name}</td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 12 }}>{s.business_name}</td>
                  <td style={{ padding: '10px 12px', color: '#f8fafc' }}>{s.total_orders}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#f8fafc' }}>${s.total_revenue?.toFixed(2) ?? '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#f8fafc' }}>${s.avg_order_value?.toFixed(2) ?? '-'}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: s.fulfillment_rate >= 90 ? '#34d399' : '#fbbf24' }}>
                    {s.fulfillment_rate?.toFixed(1) ?? '-'}%
                  </td>
                  <td style={{ padding: '10px 12px', color: s.return_rate > 5 ? '#ef4444' : '#34d399' }}>{s.return_rate?.toFixed(1) ?? '-'}%</td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{s.total_products}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60, height: 6, borderRadius: 3, backgroundColor: '#1e293b', overflow: 'hidden' }}>
                        <div style={{ width: `${s.health_score}%`, height: '100%', backgroundColor: scoreColor(s.health_score), borderRadius: 3 }} />
                      </div>
                      <span style={{ fontWeight: 700, color: scoreColor(s.health_score), fontSize: 12 }}>{s.health_score?.toFixed(0) ?? '-'}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button onClick={() => setPage(Math.max(0, page - limit))} disabled={page === 0}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#0f172a', color: page === 0 ? '#475569' : '#f8fafc', cursor: page === 0 ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}
          >Previous</button>
          <span style={{ padding: '6px 14px', color: '#94a3b8', fontSize: 12 }}>Page {Math.floor(page / limit) + 1} of {totalPages}</span>
          <button onClick={() => setPage(Math.min(total - limit, page + limit))} disabled={page + limit >= total}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#0f172a', color: page + limit >= total ? '#475569' : '#f8fafc', cursor: page + limit >= total ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}
          >Next</button>
        </div>
      )}
    </div>
  )
}
