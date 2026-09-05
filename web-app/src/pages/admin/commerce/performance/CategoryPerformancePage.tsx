import { useState, useEffect } from 'react'
import { adminCommerceApi, type AdminCategoryPerformance } from '@/api/admin'
import { useT } from '@/store/i18n'

export default function CategoryPerformancePage() {
  const t = useT()
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
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{t('admin.performance.categoryTitle')}</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{t('admin.performance.categorySubtitle')}</p>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('common.loading')}</div>
      ) : performance.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('admin.performance.noCategoryData')}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {[t('admin.performance.categoryColumn'), t('admin.performance.productsPubTotalColumn'), t('admin.performance.activeSellersColumn'), t('admin.performance.ordersColumn'), t('admin.performance.salesValueColumn'), t('admin.performance.availabilityScoreColumn'), t('admin.performance.conversionRateColumn')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {performance.map(cat => (
                <tr key={cat.category_id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '10px 12px', color: '#f8fafc', fontWeight: 600 }}>{cat.category_name}</td>
                  <td style={{ padding: '10px 12px', color: '#f8fafc' }}>
                    <span style={{ color: '#34d399', fontWeight: 600 }}>{cat.published_products}</span>
                    <span style={{ color: '#64748b', margin: '0 4px' }}>/</span>
                    <span style={{ color: '#94a3b8' }}>{cat.product_count}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#f8fafc' }}>{cat.active_sellers}</td>
                  <td style={{ padding: '10px 12px', color: '#f8fafc', fontWeight: 600 }}>{cat.orders}</td>
                  <td style={{ padding: '10px 12px', color: '#34d399', fontWeight: 700 }}>${cat.sales_value?.toFixed(2) ?? '0.00'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60, height: 6, borderRadius: 3, backgroundColor: '#1e293b', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, Math.max(0, cat.availability_score))}%`, height: '100%', backgroundColor: scoreColor(cat.availability_score), borderRadius: 3 }} />
                      </div>
                      <span style={{ fontWeight: 700, color: scoreColor(cat.availability_score), fontSize: 12 }}>{cat.availability_score?.toFixed(0) ?? '0'}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                    {cat.conversion_rate != null ? `${cat.conversion_rate.toFixed(1)}%` : '-'}
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
