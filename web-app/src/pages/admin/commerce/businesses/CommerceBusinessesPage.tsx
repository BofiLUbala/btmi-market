import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { adminCommerceApi, type AdminUserListItem } from '@/api/admin'
import { useT } from '@/store/i18n'
import { BoxIcon } from '@/components/ui/Icons'

export default function CommerceBusinessesPage() {
  const t = useT()
  const [owners, setOwners] = useState<AdminUserListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [limit] = useState(20)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminCommerceApi.listOperationalUsers({
        search: search || undefined,
        account_type: 'SELLER',
        limit,
        offset: page * limit,
      })
      // Filter or sort sellers who have at least one business registered
      setOwners(res.users ?? [])
      setTotal(res.total ?? 0)
    } catch (err) {
      console.error('Failed to load businesses', err)
    } finally {
      setLoading(false)
    }
  }, [search, page, limit])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🏢</span> {t('admin.commerce.businessesTitle') || 'Business Management'}
          </h2>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, margin: 0 }}>
            {t('admin.commerce.businessesSubtitle') || 'Supervise merchant business entities, parent organizations, and corporate accounts.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            to="/admin/commerce/shops"
            style={{
              backgroundColor: 'var(--admin-surface-2)',
              color: 'var(--admin-text)',
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
            🏪 {t('admin.commerce.shops') || 'View Shops'}
          </Link>
          <Link
            to="/admin/commerce/inventory"
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
            <BoxIcon style={{ width: 16, height: 16, marginRight: 6, verticalAlign: 'middle' }} /> {t('admin.commerce.inventory') || 'Inventory'}
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder={t('admin.users.searchPlaceholder') || 'Search business owner, phone, email...'}
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
          {total} {t('admin.commerce.businessEntities') || 'business entities monitored'}
        </span>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
        </div>
      ) : owners.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          {t('admin.users.noResults') || 'No businesses found.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-surface-2)' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.commerce.businessOwner') || 'Business / Owner'}</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.users.contactColumn') || 'Contact'}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.commerce.registeredShops') || 'Registered Shops'}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.orders.ordersColumn') || 'Orders Total'}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.users.statusColumn') || 'Account Status'}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.common.actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {owners.map((o) => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--admin-border-soft)' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--admin-text)' }}>
                      {o.first_name} {o.last_name} Enterprise
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
                      Owner: {o.first_name} {o.last_name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-faint)' }}>Account ID: {o.id.slice(0, 8)}...</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ color: 'var(--admin-text)' }}>{o.email}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{o.phone || '—'}</div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                    <span style={{
                      display: 'inline-block',
                      backgroundColor: 'var(--admin-surface-2)',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontWeight: 700,
                      color: o.shop_count > 0 ? 'var(--admin-primary)' : 'var(--admin-text-muted)'
                    }}>
                      {o.shop_count || 0}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px', fontWeight: 600 }}>
                    {o.order_count || 0}
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      backgroundColor: o.status === 'ACTIVE' ? 'var(--admin-success-soft)' : o.status === 'SUSPENDED' ? 'var(--admin-danger-soft)' : 'var(--admin-surface-2)',
                      color: o.status === 'ACTIVE' ? 'var(--admin-success)' : o.status === 'SUSPENDED' ? 'var(--admin-danger)' : 'var(--admin-text-muted)'
                    }}>
                      {o.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 14px' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <Link
                        to={`/admin/commerce/products?search=${encodeURIComponent(o.first_name)}`}
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
                        {t('admin.commerce.products') || 'Products'}
                      </Link>
                      <Link
                        to={`/admin/commerce/inventory?search=${encodeURIComponent(o.first_name)}`}
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
                        {t('admin.commerce.stock') || 'Stock'}
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
