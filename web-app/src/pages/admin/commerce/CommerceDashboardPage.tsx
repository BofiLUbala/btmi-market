import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminCommerceApi, type CommerceOverviewStats } from '@/api/admin'
import { useT } from '@/store/i18n'
import { BoxIcon } from '@/components/ui/Icons'

// Route is set when a real admin page exists for this domain; otherwise the
// card is shown but disabled instead of linking to a page that doesn't exist.
const DOMAIN_ROUTES: Record<number, string> = {
  9: '/admin/commerce/products',
  10: '/admin/commerce/categories',
  11: '/admin/commerce/categories',
  14: '/admin/commerce/inventory',
  15: '/admin/commerce/inventory/history',
  16: '/admin/commerce/inventory',
  17: '/admin/commerce/orders',
  18: '/admin/commerce/orders',
  19: '/admin/commerce/orders',
  20: '/admin/commerce/orders',
  21: '/admin/commerce/marketplace/visibility',
  22: '/admin/commerce/marketplace/visibility',
  23: '/admin/commerce/marketplace/search',
  24: '/admin/commerce/marketplace/ranking',
  25: '/admin/commerce/marketplace/quality',
  26: '/admin/commerce/marketplace/promotions',
  27: '/admin/commerce/performance/sellers',
  29: '/admin/commerce/performance/categories',
  30: '/admin/commerce/employees'
}

export default function CommerceDashboardPage() {
  const t = useT()
  const navigate = useNavigate()
  const [stats, setStats] = useState<CommerceOverviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminCommerceApi.getOverview()
      setStats(data)
    } catch (err) {
      console.error('Failed to load commerce overview:', err)
      setError(err instanceof Error ? err.message : t('admin.commerceDash.kpisLoadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  const domains = [
    { num: 9, name: t('admin.commerceDash.domain9Name'), desc: t('admin.commerceDash.domain9Desc') },
    { num: 10, name: t('admin.commerceDash.domain10Name'), desc: t('admin.commerceDash.domain10Desc') },
    { num: 11, name: t('admin.commerceDash.domain11Name'), desc: t('admin.commerceDash.domain11Desc') },
    { num: 12, name: t('admin.commerceDash.domain12Name'), desc: t('admin.commerceDash.domain12Desc') },
    { num: 13, name: t('admin.commerceDash.domain13Name'), desc: t('admin.commerceDash.domain13Desc') },
    { num: 14, name: t('admin.commerceDash.domain14Name'), desc: t('admin.commerceDash.domain14Desc') },
    { num: 15, name: t('admin.commerceDash.domain15Name'), desc: t('admin.commerceDash.domain15Desc') },
    { num: 16, name: t('admin.commerceDash.domain16Name'), desc: t('admin.commerceDash.domain16Desc') },
    { num: 17, name: t('admin.commerceDash.domain17Name'), desc: t('admin.commerceDash.domain17Desc') },
    { num: 18, name: t('admin.commerceDash.domain18Name'), desc: t('admin.commerceDash.domain18Desc') },
    { num: 19, name: t('admin.commerceDash.domain19Name'), desc: t('admin.commerceDash.domain19Desc') },
    { num: 20, name: t('admin.commerceDash.domain20Name'), desc: t('admin.commerceDash.domain20Desc') },
    { num: 21, name: t('admin.commerceDash.domain21Name'), desc: t('admin.commerceDash.domain21Desc') },
    { num: 22, name: t('admin.commerceDash.domain22Name'), desc: t('admin.commerceDash.domain22Desc') },
    { num: 23, name: t('admin.commerceDash.domain23Name'), desc: t('admin.commerceDash.domain23Desc') },
    { num: 24, name: t('admin.commerceDash.domain24Name'), desc: t('admin.commerceDash.domain24Desc') },
    { num: 25, name: t('admin.commerceDash.domain25Name'), desc: t('admin.commerceDash.domain25Desc') },
    { num: 26, name: t('admin.commerceDash.domain26Name'), desc: t('admin.commerceDash.domain26Desc') },
    { num: 27, name: t('admin.commerceDash.domain27Name'), desc: t('admin.commerceDash.domain27Desc') },
    { num: 28, name: t('admin.commerceDash.domain28Name'), desc: t('admin.commerceDash.domain28Desc') },
    { num: 29, name: t('admin.commerceDash.domain29Name'), desc: t('admin.commerceDash.domain29Desc') },
    { num: 30, name: t('admin.commerceDash.domain30Name'), desc: t('admin.commerceDash.domain30Desc') }
  ]

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <BoxIcon style={{ width: 24, height: 24, marginRight: 8 }} /> {t('admin.commerceDash.title')}
        </h1>
        <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, margin: 0 }}>
          {t('admin.commerceDash.subtitle')}
        </p>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: 'var(--admin-danger-soft)', border: '1px solid var(--admin-danger)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--admin-text)' }}>
          <span>⚠️ {error}</span>
          <button
            onClick={() => void loadOverview()}
            style={{ backgroundColor: 'var(--admin-surface-2)', color: 'var(--admin-text)', border: '1px solid var(--admin-border)', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
          >
            {t('admin.direction.retry')}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
        </div>
      ) : stats ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{t('admin.commerceDash.ordersToday')}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8' }}>{stats.orders_today}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{t('admin.commerceDash.totalOrders', { count: stats.total_orders })}</div>
          </div>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{t('admin.commerceDash.stuckOrders')}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: stats.stuck_orders > 0 ? '#ef4444' : '#10b981' }}>{stats.stuck_orders}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{t('admin.commerceDash.pendingOrders', { count: stats.pending_orders })}</div>
          </div>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{t('admin.commerceDash.catalog')}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc' }}>{stats.total_products}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{t('admin.commerceDash.publishedCount', { count: stats.published_products })}</div>
          </div>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{t('admin.commerceDash.stockAnomalies')}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: stats.stock_anomalies_count > 0 ? '#f59e0b' : '#10b981' }}>{stats.stock_anomalies_count}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{t('admin.commerceDash.outOfStockCount', { count: stats.out_of_stock_products })}</div>
          </div>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{t('admin.commerceDash.taxonomy')}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc' }}>{stats.total_categories}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{t('admin.commerceDash.subcategoriesCount', { count: stats.total_subcategories })}</div>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {domains.map((d) => {
          const route = DOMAIN_ROUTES[d.num]
          const isLive = Boolean(route)
          return (
            <div
              key={d.num}
              onClick={isLive ? () => navigate(route) : undefined}
              style={{
                backgroundColor: 'var(--admin-surface)',
                border: '1px solid var(--admin-border-soft)',
                borderRadius: 10,
                padding: 16,
                cursor: isLive ? 'pointer' : 'default',
                opacity: isLive ? 1 : 0.6
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--admin-success)', backgroundColor: 'var(--admin-success-soft)', padding: '2px 8px', borderRadius: 6 }}>
                  {t('admin.commerceDash.domainLabel', { num: d.num })}
                </span>
                {isLive ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>{t('admin.commerceDash.statusLive')}</span>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--admin-text-faint)' }}>{t('admin.commerceDash.statusNotBuilt')}</span>
                )}
              </div>
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px', color: 'var(--admin-text)' }}>{d.name}</h4>
              <p style={{ fontSize: 12, color: 'var(--admin-text-muted)', margin: 0, lineHeight: 1.4 }}>{d.desc}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
