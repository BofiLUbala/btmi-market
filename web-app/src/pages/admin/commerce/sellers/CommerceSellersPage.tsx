import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { adminCommerceApi, type AdminSellerPerformance, type AdminUserListItem } from '@/api/admin'
import { useT } from '@/store/i18n'
import { BarChartIcon } from '@/components/ui/Icons'

export default function CommerceSellersPage() {
  const t = useT()
  const [sellers, setSellers] = useState<AdminUserListItem[]>([])
  const [performance, setPerformance] = useState<Record<string, AdminSellerPerformance>>({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [limit] = useState(20)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, perfRes] = await Promise.all([
        adminCommerceApi.listOperationalUsers({
          search: search || undefined,
          account_type: 'SELLER',
          status: statusFilter || undefined,
          limit,
          offset: page * limit,
        }),
        adminCommerceApi.getSellerPerformance({ limit: 100, offset: 0 }).catch(() => ({ performance: [] })),
      ])

      setSellers(usersRes.users ?? [])
      setTotal(usersRes.total ?? 0)

      const perfMap: Record<string, AdminSellerPerformance> = {}
      if (Array.isArray(perfRes.performance)) {
        for (const p of perfRes.performance) {
          perfMap[p.seller_id] = p
        }
      }
      setPerformance(perfMap)
    } catch (err) {
      console.error('Failed to load sellers', err)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, page, limit])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>💼</span> {t('admin.commerce.sellersTitle') || 'Seller Operations'}
          </h2>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, margin: 0 }}>
            {t('admin.commerce.sellersSubtitle') || 'Supervise marketplace sellers, verify shop operations, and track fulfillment reliability.'}
          </p>
        </div>
        <Link
          to="/admin/commerce/performance/sellers"
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
          <BarChartIcon style={{ width: 16, height: 16, marginRight: 6, verticalAlign: 'middle' }} /> {t('admin.commerce.viewSellerPerformance') || 'Performance Analytics'}
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          aria-label={t('admin.users.searchPlaceholder') || 'Search seller name, email, phone...'}
          placeholder={t('admin.users.searchPlaceholder') || 'Search seller name, email, phone...'}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          style={{
            flex: '1 1 240px',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--admin-border)',
            backgroundColor: 'var(--admin-surface)',
            color: 'var(--admin-text)',
            fontSize: 13
          }}
        />
        <select
          aria-label={t('admin.users.filterAllStatus') || 'Filter by status'}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--admin-border)',
            backgroundColor: 'var(--admin-surface)',
            color: 'var(--admin-text)',
            fontSize: 13,
            minWidth: 140
          }}
        >
          <option value="">{t('admin.users.filterAllStatus') || 'All Statuses'}</option>
          <option value="ACTIVE">{t('admin.users.statusActive') || 'Active'}</option>
          <option value="SUSPENDED">{t('admin.users.statusSuspended') || 'Suspended'}</option>
          <option value="PENDING">{t('admin.users.statusPending') || 'Pending'}</option>
        </select>
        <span style={{ color: 'var(--admin-text-muted)', fontSize: 12 }}>
          {total} {t('admin.commerce.sellersCount') || 'sellers registered'}
        </span>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
        </div>
      ) : sellers.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          {t('admin.users.noResults') || 'No sellers found matching criteria.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-surface-2)' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.users.nameColumn') || 'Seller Name'}</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.users.contactColumn') || 'Contact'}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.commerce.businesses') || 'Businesses'}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.commerce.shops') || 'Shops'}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.orders.ordersColumn') || 'Orders'}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.performance.completionRateColumn') || 'Fulfillment'}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.users.statusColumn') || 'Status'}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.common.actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((s) => {
                const perf = performance[s.id]
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--admin-border-soft)' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--admin-text)' }}>
                        {s.first_name} {s.last_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--admin-text-faint)' }}>ID: {s.id.slice(0, 8)}...</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ color: 'var(--admin-text)' }}>{s.email}</div>
                      <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{s.phone || '—'}</div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 14px', fontWeight: 600 }}>
                      <span style={{ backgroundColor: 'var(--admin-surface-2)', padding: '2px 8px', borderRadius: 6 }}>
                        {s.business_count || 0}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 14px', fontWeight: 600 }}>
                      <span style={{ backgroundColor: 'var(--admin-surface-2)', padding: '2px 8px', borderRadius: 6 }}>
                        {s.shop_count || 0}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 14px', fontWeight: 600 }}>
                      {s.order_count || 0}
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                      {perf ? (
                        <span style={{
                          fontWeight: 700,
                          color: perf.completion_rate >= 80 ? 'var(--admin-success)' : perf.completion_rate >= 50 ? '#f59e0b' : 'var(--admin-danger)'
                        }}>
                          {Math.round(perf.completion_rate)}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--admin-text-faint)', fontSize: 11 }}>N/A</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        backgroundColor: s.status === 'ACTIVE' ? 'var(--admin-success-soft)' : s.status === 'SUSPENDED' ? 'var(--admin-danger-soft)' : 'var(--admin-surface-2)',
                        color: s.status === 'ACTIVE' ? 'var(--admin-success)' : s.status === 'SUSPENDED' ? 'var(--admin-danger)' : 'var(--admin-text-muted)'
                      }}>
                        {s.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 14px' }}>
                      <Link
                        to={`/admin/commerce/orders?search=${encodeURIComponent(s.email)}`}
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
                        {t('admin.commerce.viewOrders') || 'Orders'}
                      </Link>
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
