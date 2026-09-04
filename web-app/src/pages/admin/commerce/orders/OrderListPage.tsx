import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { adminCommerceApi, type AdminOrderItem } from '@/api/admin'

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
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Order Management</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Search and manage cross-business orders, monitor fulfillment status.</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search order # or customer..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          style={{ flex: '1 1 200px', padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13 }} />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13, minWidth: 130 }}>
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PROCESSING">Processing</option>
          <option value="SHIPPED">Shipped</option>
          <option value="DELIVERED">Delivered</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="REFUNDED">Refunded</option>
        </select>
        <select value={deliveryMethod} onChange={(e) => { setDeliveryMethod(e.target.value); setPage(0) }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13, minWidth: 150 }}>
          <option value="">All Delivery</option>
          <option value="PICKUP">Pickup</option>
          <option value="SCHEDULED_DELIVERY">Scheduled</option>
          <option value="DIGITAL">Digital</option>
        </select>
        <input placeholder="Shop ID" value={shopId} onChange={(e) => { setShopId(e.target.value); setPage(0) }}
          style={{ width: 140, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13 }} />
        <span style={{ color: '#64748b', fontSize: 12 }}>{total} orders</span>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading...</div>
      ) : orders.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No orders found</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {['Order #', 'Customer', 'Shop', 'Business', 'Items', 'Total', 'Payment', 'Delivery', 'Status', 'Created'].map(h => (
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
                  <td style={{ padding: '10px 12px', color: '#f8fafc' }}>{o.customer_name}</td>
                  <td style={{ padding: '10px 12px', color: '#f8fafc', fontSize: 12 }}>{o.shop_name}</td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 12 }}>{o.business_name}</td>
                  <td style={{ padding: '10px 12px', color: '#f8fafc' }}>{o.item_count}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#f8fafc' }}>${o.total.toFixed(2)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <StatusBadge status={o.payment_status} />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, backgroundColor: '#1e293b', color: '#94a3b8' }}>
                      {o.delivery_method}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <StatusBadge status={o.fulfillment_status} />
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
          >Previous</button>
          <span style={{ padding: '6px 14px', color: '#94a3b8', fontSize: 12 }}>Page {Math.floor(page / limit) + 1} of {totalPages}</span>
          <button onClick={() => setPage(Math.min(total - limit, page + limit))} disabled={page + limit >= total}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#0f172a', color: page + limit >= total ? '#475569' : '#f8fafc', cursor: page + limit >= total ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}
          >Next</button>
        </div>
      )}
    </div>
  )
}
