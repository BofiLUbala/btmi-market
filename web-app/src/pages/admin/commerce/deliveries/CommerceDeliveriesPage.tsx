import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { adminCommerceApi, type AdminOrderItem } from '@/api/admin'
import { useT } from '@/store/i18n'
import { AdminStatusBadge as StatusBadge } from '@/components/admin/AdminStatusBadge'

export default function CommerceDeliveriesPage() {
  const t = useT()
  const [orders, setOrders] = useState<AdminOrderItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [deliveryFilter, setDeliveryFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [limit] = useState(20)

  const fetchDeliveries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminCommerceApi.listOrders({
        status: statusFilter || undefined,
        delivery_method: deliveryFilter || undefined,
        search: search || undefined,
        limit,
        offset: page * limit,
      })
      setOrders(res.orders ?? [])
      setTotal(res.total ?? 0)
    } catch (err) {
      console.error('Failed to load deliveries', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, deliveryFilter, search, page, limit])

  useEffect(() => {
    void fetchDeliveries()
  }, [fetchDeliveries])

  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🚚</span> {t('admin.commerce.deliveriesTitle') || 'Deliveries & Logistics'}
          </h2>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, margin: 0 }}>
            {t('admin.commerce.deliveriesSubtitle') || 'Monitor package logistics, fulfillment pipelines, and delivery progress across all shops.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            to="/admin/commerce/delivery-assignments"
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
            📋 {t('admin.commerce.dispatchQueue') || 'Dispatch Queue'}
          </Link>
          <Link
            to="/admin/commerce/couriers"
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
            🛵 {t('admin.commerce.couriers') || 'Couriers'}
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder={t('admin.orders.searchPlaceholder') || 'Search order #, customer, phone...'}
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
          <option value="">{t('admin.orders.filterAllStatus') || 'All Statuses'}</option>
          <option value="PROCESSING">{t('admin.orders.statusProcessing') || 'Processing'}</option>
          <option value="SHIPPED">{t('admin.orders.statusShipped') || 'Shipped / In Transit'}</option>
          <option value="DELIVERED">{t('admin.orders.statusDelivered') || 'Delivered'}</option>
          <option value="COMPLETED">{t('admin.orders.statusCompleted') || 'Completed'}</option>
          <option value="CANCELLED">{t('admin.orders.statusCancelled') || 'Cancelled'}</option>
        </select>
        <select
          value={deliveryFilter}
          onChange={(e) => { setDeliveryFilter(e.target.value); setPage(0) }}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--admin-border)',
            backgroundColor: 'var(--admin-surface)',
            color: 'var(--admin-text)',
            fontSize: 13,
            minWidth: 150
          }}
        >
          <option value="">{t('admin.orders.filterAllDelivery') || 'All Methods'}</option>
          <option value="SCHEDULED_DELIVERY">{t('admin.orders.deliveryScheduled') || 'Delivery (Courier)'}</option>
          <option value="PICKUP">{t('admin.orders.deliveryPickup') || 'Shop Pickup'}</option>
          <option value="DIGITAL">{t('admin.orders.deliveryDigital') || 'Digital'}</option>
        </select>
        <span style={{ color: 'var(--admin-text-muted)', fontSize: 12 }}>
          {total} {t('admin.orders.orderCount') || 'deliveries found'}
        </span>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
        </div>
      ) : orders.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          {t('admin.orders.noResults') || 'No delivery records found.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-surface-2)' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.orders.orderNumberColumn') || 'Order #'}</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.orders.shopColumn') || 'Origin Shop'}</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.orders.deliveryColumn') || 'Fulfillment Method'}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.orders.statusColumn') || 'Status'}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.orders.totalColumn') || 'Amount'}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.common.actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--admin-border-soft)' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <Link
                        to={`/admin/commerce/orders/${o.id}`}
                        style={{ fontWeight: 700, color: 'var(--admin-primary)', textDecoration: 'none' }}
                      >
                        #{o.order_number}
                      </Link>
                      <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>
                        {new Date(o.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{o.shop_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--admin-text-faint)' }}>{o.business_name}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{o.delivery_method === 'SCHEDULED_DELIVERY' ? '🚚' : o.delivery_method === 'PICKUP' ? '🏬' : '📲'}</span>
                        <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>
                          {o.delivery_method === 'SCHEDULED_DELIVERY' ? 'Courier Delivery' : o.delivery_method}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                      <StatusBadge status={o.status} />
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 700, color: 'var(--admin-text)' }}>
                      {(o.final_total || 0).toLocaleString()} XAF
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 14px' }}>
                      <Link
                        to={`/admin/commerce/orders/${o.id}`}
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
                        {t('admin.orders.details') || 'Inspect'}
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
