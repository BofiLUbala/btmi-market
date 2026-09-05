import { useState, useEffect, useCallback } from 'react'
import { adminCommerceApi, type AdminPromotionVisibility } from '@/api/admin'
import { useT } from '@/store/i18n'

export default function PromotionVisibilityPage() {
  const t = useT()
  const [promotions, setPromotions] = useState<AdminPromotionVisibility[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [limit] = useState(20)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminCommerceApi.listPromotionVisibility({ limit, offset: page })
      setPromotions(res.promotions)
      setTotal(res.total)
    } catch (err) {
      console.error('Failed to load promotions', err)
    } finally {
      setLoading(false)
    }
  }, [page, limit])

  useEffect(() => { fetchData() }, [fetchData])

  const totalPages = Math.ceil(total / limit)

  const statusColor = (active: boolean) => active
    ? { bg: '#064e3b', fg: '#a7f3d0' }
    : { bg: '#7f1d1d', fg: '#fca5a5' }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{t('admin.promotions.title')}</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{t('admin.promotions.subtitle')}</p>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('common.loading')}</div>
      ) : promotions.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('admin.promotions.noPromotions')}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {[
                  t('admin.promotions.colProduct'),
                  t('admin.promotions.colShop'),
                  t('admin.promotions.colDiscount'),
                  t('admin.promotions.colPrices'),
                  t('admin.promotions.colBadge'),
                  t('admin.promotions.colVisibility'),
                  t('admin.promotions.colStart'),
                  t('admin.promotions.colEnd'),
                  t('common.status'),
                ].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {promotions.map((p) => {
                const vc = statusColor(p.is_active)
                return (
                  <tr key={p.product_id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '10px 12px', color: '#f8fafc', fontWeight: 600 }}>{p.product_name}</td>
                    <td style={{ padding: '10px 12px', color: '#f8fafc', fontSize: 12 }}>{p.shop_name || t('admin.promotions.allShops')}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, backgroundColor: '#1e293b', color: '#93c5fd' }}>
                        {p.discount_type === 'PERCENTAGE' ? `${p.discount_value}% OFF` : `$${p.discount_value.toFixed(2)} OFF`}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#f8fafc', fontWeight: 600 }}>
                      <span style={{ color: '#34d399' }}>${p.sale_price.toFixed(2)}</span>
                      <span style={{ color: '#64748b', fontSize: 11, textDecoration: 'line-through', marginLeft: 6 }}>${p.regular_price.toFixed(2)}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        backgroundColor: p.off_badge ? '#1e3a5f' : '#1e293b',
                        color: p.off_badge ? '#60a5fa' : '#64748b'
                      }}>
                        {p.off_badge ? t('admin.promotions.badgeYes') : t('admin.common.none')}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, backgroundColor: vc.bg, color: vc.fg }}>
                        {p.is_active ? t('admin.promotions.active') : t('admin.promotions.inactive')}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>
                      {p.start_date ? new Date(p.start_date).toLocaleDateString() : t('admin.promotions.immediate')}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>
                      {p.end_date ? new Date(p.end_date).toLocaleDateString() : t('admin.promotions.ongoing')}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        backgroundColor: p.status === 'ACTIVE' ? '#064e3b' : p.status === 'SCHEDULED' ? '#1e3a5f' : '#334155',
                        color: p.status === 'ACTIVE' ? '#a7f3d0' : p.status === 'SCHEDULED' ? '#93c5fd' : '#94a3b8'
                      }}>{p.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button onClick={() => setPage(Math.max(0, page - limit))} disabled={page === 0}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#0f172a', color: page === 0 ? '#475569' : '#f8fafc', cursor: page === 0 ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}
          >{t('common.previous')}</button>
          <span style={{ padding: '6px 14px', color: '#94a3b8', fontSize: 12 }}>{t('admin.common.pageOf', { page: Math.floor(page / limit) + 1, total: totalPages })}</span>
          <button onClick={() => setPage(Math.min(total - limit, page + limit))} disabled={page + limit >= total}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#0f172a', color: page + limit >= total ? '#475569' : '#f8fafc', cursor: page + limit >= total ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}
          >{t('common.next')}</button>
        </div>
      )}
    </div>
  )
}
