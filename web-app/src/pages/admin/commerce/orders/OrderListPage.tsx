import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { adminCommerceApi, type AdminOrderItem } from '@/api/admin'
import { useT } from '@/store/i18n'

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: '#78350f', fg: '#fde68a' },
  CONFIRMED: { bg: '#1e3a5f', fg: '#93c5fd' },
  PROCESSING: { bg: '#1e3a5f', fg: '#93c5fd' },
  SHIPPED: { bg: '#064e3b', fg: '#a7f3d0' },
  DELIVERED: { bg: '#064e3b', fg: '#a7f3d0' },
  COMPLETED: { bg: '#064e3b', fg: '#a7f3d0' },
  CANCELLED: { bg: '#7f1d1d', fg: '#fca5a5' },
  REFUNDED: { bg: '#78350f', fg: '#fde68a' },
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || { bg: '#334155', fg: '#f1f5f9' }
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, backgroundColor: c.bg, color: c.fg }}>{status}</span>
}

export default function OrderListPage() {
  const t = useT()
  const [orders, setOrders] = useState<AdminOrderItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState('')
  const [shopId, setShopId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [limit] = useState(20)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminCommerceApi.listOrders({
        status: statusFilter || undefined,
        delivery_method: deliveryMethod || undefined,
        shop_id: shopId || undefined,
        search: search || undefined,
        limit,
        offset: page,
      })
      setOrders(res.orders)
      setTotal(res.total)
    } catch (err) {
      console.error('Failed to load orders', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, deliveryMethod, shopId, search, page, limit])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{t('admin.orders.listTitle')}</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{t('admin.orders.listSubtitle')}</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder={t('admin.orders.searchPlaceholder')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          style={{ flex: '1 1 200px', padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13 }} />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13, minWidth: 130 }}>
          <option value="">{t('admin.orders.filterAllStatus')}</option>
          <option value="PENDING">{t('admin.orders.statusPending')}</option>
          <option value="CONFIRMED">{t('admin.orders.statusConfirmed')}</option>
          <option value="PROCESSING">{t('admin.orders.statusProcessing')}</option>
          <option value="SHIPPED">{t('admin.orders.statusShipped')}</option>
          <option value="DELIVERED">{t('admin.orders.statusDelivered')}</option>
          <option value="COMPLETED">{t('admin.orders.statusCompleted')}</option>
          <option value="CANCELLED">{t('admin.orders.statusCancelled')}</option>
          <option value="REFUNDED">{t('admin.orders.statusRefunded')}</option>
        </select>
        <select value={deliveryMethod} onChange={(e) => { setDeliveryMethod(e.target.value); setPage(0) }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13, minWidth: 150 }}>
          <option value="">{t('admin.orders.filterAllDelivery')}</option>
          <option value="PICKUP">{t('admin.orders.deliveryPickup')}</option>
          <option value="SCHEDULED_DELIVERY">{t('admin.orders.deliveryScheduled')}</option>
          <option value="DIGITAL">{t('admin.orders.deliveryDigital')}</option>
        </select>
        <input placeholder={t('admin.common.shopIdPlaceholder')} value={shopId} onChange={(e) => { setShopId(e.target.value); setPage(0) }}
          style={{ width: 140, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13 }} />
        <span style={{ color: '#64748b', fontSize: 12 }}>{t('admin.orders.orderCount', { count: total })}</span>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('common.loading')}</div>
      ) : orders.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('admin.orders.noResults')}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {[t('admin.orders.colOrderNumber'), t('admin.orders.colCustomer'), t('admin.common.shopColumn'), t('admin.orders.colBusiness'), t('admin.orders.colItems'), t('common.total'), t('admin.orders.colPayment'), t('admin.orders.colDelivery'), t('common.status'), t('admin.common.created')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <Link to={`/admin/commerce/orders/${o.id}`} style={{ color: '#60a5fa', fontWeight: 700, textDecoration: 'none', fontSize: 12 }}>
                      {o.order_number}
                    </Link>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#f8fafc' }}>{o.buyer_name || t('admin.common.notAvailable')}</td>
                  <td style={{ padding: '10px 12px', color: '#f8fafc', fontSize: 12 }}>{o.shop_name}</td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 12 }}>{o.business_name}</td>
                  <td style={{ padding: '10px 12px', color: '#f8fafc' }}>{o.total_items}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#f8fafc' }}>${o.final_total.toFixed(2)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <StatusBadge status={o.payment_status} />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, backgroundColor: '#1e293b', color: '#94a3b8' }}>
                      {o.delivery_method || t('admin.common.notAvailable')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <StatusBadge status={o.status} />
                  </td>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {new Date(o.created_at).toLocaleDateString()}
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
