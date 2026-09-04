import { useState, useEffect } from 'react'
import { adminCommerceApi, type AdminCategoryPerformance } from '@/api/admin'

export default function CategoryPerformancePage() {
  const [performance, setPerformance] = useState<AdminCategoryPerformance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    adminCommerceApi.getCategoryPerformance()
      .then(setPerformance)
      .catch(() => setPerformance([]))
      .finally(() => setLoading(false))
  }, [])

  const scoreColor = (score: number) => {
    if (score >= 80) return '#34d399'
    if (score >= 60) return '#fbbf24'
    if (score >= 40) return '#f97316'
    return '#ef4444'
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Category Performance</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Cross-business category health and discovery analytics.</p>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading...</div>
      ) : performance.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No category performance data available</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {['Category', 'Slug', 'Products', 'Subcategories', 'Discovery Score', 'Sort Order', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {performance.map(cat => (
                <tr key={cat.category_id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '10px 12px', color: '#f8fafc', fontWeight: 600 }}>{cat.name}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12 }}>{cat.slug}</td>
                  <td style={{ padding: '10px 12px', color: '#f8fafc' }}>{cat.product_count}</td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{cat.subcategory_count}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60, height: 6, borderRadius: 3, backgroundColor: '#1e293b', overflow: 'hidden' }}>
                        <div style={{ width: `${cat.discovery_score}%`, height: '100%', backgroundColor: scoreColor(cat.discovery_score), borderRadius: 3 }} />
                      </div>
                      <span style={{ fontWeight: 700, color: scoreColor(cat.discovery_score), fontSize: 12 }}>{cat.discovery_score.toFixed(0)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{cat.sort_order}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                      backgroundColor: cat.status === 'ACTIVE' ? '#064e3b' : '#7f1d1d',
                      color: cat.status === 'ACTIVE' ? '#a7f3d0' : '#fca5a5'
                    }}>{cat.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
