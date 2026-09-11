import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { adminCommerceApi, type AdminShopPerformance } from '@/api/admin'
import { useT } from '@/store/i18n'
import { BarChartIcon } from '@/components/ui/Icons'

export default function CommerceShopsPage() {
  const t = useT()
  const [shops, setShops] = useState<AdminShopPerformance[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [limit] = useState(20)

  const fetchShops = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminCommerceApi.getShopPerformance({
        limit,
        offset: page * limit,
      })
      const list = Array.isArray(res.performance) ? res.performance : []
      if (search) {
        const filtered = list.filter(s =>
          s.shop_name.toLowerCase().includes(search.toLowerCase()) ||
          s.business_name.toLowerCase().includes(search.toLowerCase())
        )
        setShops(filtered)
        setTotal(filtered.length)
      } else {
        setShops(list)
        setTotal(res.total || list.length)
      }
    } catch (err) {
      console.error('Failed to load shop performance / shops', err)
    } finally {
      setLoading(false)
    }
  }, [search, page, limit])

  useEffect(() => {
    void fetchShops()
  }, [fetchShops])

  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🏪</span> {t('admin.commerce.shopsTitle') || 'Shop Management'}
          </h2>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, margin: 0 }}>
            {t('admin.commerce.shopsSubtitle') || 'Inspect individual storefronts, track operational metrics, and review fulfillment performance.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            to="/admin/commerce/performance/shops"
            style={{
              backgroundColor: 'var(--admin-surface-2)',
              color: 'var(--admin-primary)',
              border: '1px solid var(--admin-border)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <BarChartIcon style={{ width: 16, height: 16, marginRight: 6, verticalAlign: 'middle' }} /> {t('admin.commerce.shopPerformanceAnalytics') || 'Shop Performance'}
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          aria-label={t('admin.commerce.searchShopPlaceholder') || 'Search shop name, business name...'}
          placeholder={t('admin.commerce.searchShopPlaceholder') || 'Search shop name, business name...'}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          style={{
            flex: '1 1 260px',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--admin-border)',
            backgroundColor: 'var(--admin-surface)',
            color: 'var(--admin-text)',
            fontSize: 13
          }}
        />
        <span style={{ color: 'var(--admin-text-muted)', fontSize: 12 }}>
          {total} {t('admin.commerce.shopsTracked') || 'storefronts monitored'}
        </span>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
        </div>
      ) : shops.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          {t('admin.commerce.noShopsFound') || 'No active shops found.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-surface-2)' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.performance.shopColumn') || 'Shop'}</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.performance.businessColumn') || 'Business'}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.performance.ordersReceivedColumn') || 'Orders'}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.commerce.completedOrders') || 'Completed'}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.commerce.avgFulfillmentTime') || 'Fulfillment'}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.performance.reviewScoreColumn') || 'Rating'}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.common.actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((s) => (
                <tr key={s.shop_id} style={{ borderBottom: '1px solid var(--admin-border-soft)' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--admin-text)' }}>{s.shop_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-faint)' }}>ID: {s.shop_id.slice(0, 8)}...</div>
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--admin-text)' }}>
                    {s.business_name}
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px', fontWeight: 600 }}>
                    {s.orders || 0}
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                    <span style={{
                      fontWeight: 700,
                      color: 'var(--admin-success)'
                    }}>
                      {s.completed_orders || 0}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)' }}>
                    {Math.round(s.avg_fulfillment_time_hours || 0)} hrs
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px', fontWeight: 700, color: '#f59e0b' }}>
                    ★ {(s.review_score || 0).toFixed(1)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 14px' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <Link
                        to={`/admin/commerce/inventory?shop_id=${s.shop_id}`}
                        style={{
                          fontSize: 12,
                          color: 'var(--admin-text)',
                          textDecoration: 'none',
                          fontWeight: 600,
                          backgroundColor: 'var(--admin-surface-2)',
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--admin-border-soft)'
                        }}
                      >
                        {t('admin.commerce.stock') || 'Stock'}
                      </Link>
                      <Link
                        to={`/admin/commerce/orders?shop_id=${s.shop_id}`}
                        style={{
                          fontSize: 12,
                          color: 'var(--admin-primary)',
                          textDecoration: 'none',
                          fontWeight: 600,
                          backgroundColor: 'var(--admin-surface-2)',
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--admin-border-soft)'
                        }}
                      >
                        {t('admin.commerce.orders') || 'Orders'}
                      </Link>
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
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--admin-border)',
              backgroundColor: 'var(--admin-surface)',
              color: 'var(--admin-text)',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
              opacity: page === 0 ? 0.5 : 1
            }}
          >
            {t('common.previous') || 'Previous'}
          </button>
          <span style={{ padding: '6px 12px', color: 'var(--admin-text-muted)', fontSize: 13 }}>
            {page + 1} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--admin-border)',
              backgroundColor: 'var(--admin-surface)',
              color: 'var(--admin-text)',
              cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
              opacity: page >= totalPages - 1 ? 0.5 : 1
            }}
          >
            {t('common.next') || 'Next'}
          </button>
        </div>
      )}
    </div>
  )
}
