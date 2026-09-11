import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { adminCommerceApi, type AdminCourierListItem } from '@/api/admin'
import { useT } from '@/store/i18n'

export default function CommerceCouriersPage() {
  const t = useT()
  const [couriers, setCouriers] = useState<AdminCourierListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [limit] = useState(20)

  const fetchCouriers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminCommerceApi.listCouriers({
        limit,
        offset: page * limit,
      })
      setCouriers(res.couriers ?? [])
      setTotal(res.total ?? 0)
    } catch (err) {
      console.error('Failed to load couriers', err)
    } finally {
      setLoading(false)
    }
  }, [page, limit])

  useEffect(() => {
    void fetchCouriers()
  }, [fetchCouriers])

  const handleSuspend = async (courierId: string) => {
    const reason = prompt(t('admin.commerce.suspendReason') || 'Enter suspension reason:')
    if (!reason) return
    try {
      await adminCommerceApi.suspendCourier(courierId, reason)
      fetchCouriers()
    } catch (err) {
      console.error('Failed to suspend courier', err)
    }
  }

  const handleReactivate = async (courierId: string) => {
    try {
      await adminCommerceApi.reactivateCourier(courierId)
      fetchCouriers()
    } catch (err) {
      console.error('Failed to reactivate courier', err)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🛵</span> {t('admin.commerce.couriersTitle') || 'Couriers & Drivers'}
          </h2>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, margin: 0 }}>
            {t('admin.commerce.couriersSubtitle') || 'Manage delivery fleet, field couriers, active routes, and fulfillment availability.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            to="/admin/commerce/couriers/invite"
            style={{
              backgroundColor: 'var(--admin-primary)',
              color: '#ffffff',
              border: 'none',
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
            ✉ {t('admin.commerce.inviteCourier') || 'Invite Courier'}
          </Link>
          <Link
            to="/admin/commerce/delivery-assignments"
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
            📋 {t('admin.commerce.assignOrders') || 'Assign Orders'}
          </Link>
          <Link
            to="/admin/commerce/deliveries"
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
            🚚 {t('admin.commerce.deliveries') || 'All Deliveries'}
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
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
          <option value="">{t('admin.commerce.allStatuses') || 'All Statuses'}</option>
          <option value="ACTIVE">{t('admin.commerce.statusActive') || 'Active'}</option>
          <option value="PENDING">{t('admin.commerce.statusPending') || 'Pending Activation'}</option>
          <option value="SUSPENDED">{t('admin.commerce.statusSuspended') || 'Suspended'}</option>
          <option value="DISABLED">{t('admin.commerce.statusDisabled') || 'Disabled'}</option>
        </select>
        <span style={{ color: 'var(--admin-text-muted)', fontSize: 12 }}>
          {total} {t('admin.commerce.courierCount') || 'couriers registered'}
        </span>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
        </div>
      ) : couriers.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          {t('admin.commerce.noCouriersFound') || 'No courier staff found.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-surface-2)' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.commerce.courierName') || 'Courier Name'}</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.commerce.contactColumn') || 'Contact'}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.commerce.transportType') || 'Transport'}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.commerce.availability') || 'Availability'}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.commerce.totalDeliveries') || 'Deliveries'}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.commerce.status') || 'Status'}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.common.actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {couriers.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--admin-border-soft)' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--admin-text)' }}>
                      {c.first_name} {c.last_name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-faint)' }}>ID: {c.id.slice(0, 8)}...</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ color: 'var(--admin-text)' }}>{c.email}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{c.phone || '—'}</div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      backgroundColor: 'var(--admin-surface-2)',
                      color: 'var(--admin-text)'
                    }}>
                      {c.transport_type || 'N/A'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      backgroundColor: c.availability === 'AVAILABLE' ? 'var(--admin-success-soft)' : c.availability === 'BUSY' ? 'var(--admin-warning-soft)' : 'var(--admin-surface-2)',
                      color: c.availability === 'AVAILABLE' ? 'var(--admin-success)' : c.availability === 'BUSY' ? 'var(--admin-warning)' : 'var(--admin-text-muted)'
                    }}>
                      {c.availability || 'N/A'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--admin-text)' }}>
                      {c.total_deliveries} / {c.successful_deliveries}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      backgroundColor: c.status === 'ACTIVE' ? 'var(--admin-success-soft)' : c.status === 'SUSPENDED' ? 'var(--admin-danger-soft)' : 'var(--admin-surface-2)',
                      color: c.status === 'ACTIVE' ? 'var(--admin-success)' : c.status === 'SUSPENDED' ? 'var(--admin-danger)' : 'var(--admin-text-muted)'
                    }}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <Link
                        to={`/admin/commerce/delivery-assignments?courier_id=${c.id}`}
                        style={{
                          fontSize: 12,
                          color: 'var(--admin-primary)',
                          textDecoration: 'none',
                          fontWeight: 600,
                          backgroundColor: 'var(--admin-surface-2)',
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--admin-border-soft)'
                        }}
                      >
                        {t('admin.commerce.assignOrder') || 'Assign Order'}
                      </Link>
                      {c.status === 'ACTIVE' ? (
                        <button
                          onClick={() => handleSuspend(c.id)}
                          style={{
                            fontSize: 12,
                            color: 'var(--admin-danger)',
                            backgroundColor: 'var(--admin-danger-soft)',
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--admin-danger-soft)',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {t('admin.commerce.suspend') || 'Suspend'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(c.id)}
                          style={{
                            fontSize: 12,
                            color: 'var(--admin-success)',
                            backgroundColor: 'var(--admin-success-soft)',
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--admin-success-soft)',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {t('admin.commerce.reactivate') || 'Reactivate'}
                        </button>
                      )}
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
