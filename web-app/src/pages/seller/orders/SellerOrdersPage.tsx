import { useAuth } from '@/store/auth'
import { orderApi, shopApi } from '@/api/seller'
import type { BuyerPayment, OrderStatus, OrderWithLines, Shop } from '@/api/types'
import { Card } from '@/components/ui/Card'
import { useEffect, useState } from 'react'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'

interface Order {
  id: string
  order_number?: string
  status: string
  final_total: number
  base_total?: number
  created_at: string
  shop_id: string
  delivery_method?: string
  notes?: string
}

type SellerAction = { label: string; status?: OrderStatus; action?: 'accept' | 'reject' | 'prepare' }

function nextActions(order: Order): SellerAction[] {
  if (order.status === 'PENDING') return [{ label: 'Accept Order', action: 'accept' }, { label: 'Reject', action: 'reject' }]
  if (order.status === 'ACCEPTED') return [{ label: 'Start Preparing', action: 'prepare' }]
  if (order.status === 'PREPARING') {
    return order.delivery_method === 'PICKUP'
      ? [{ label: 'Ready for Pickup', status: 'READY_FOR_PICKUP' }]
      : [{ label: 'Mark Ready', status: 'READY' }]
  }
  if (order.status === 'READY' && order.delivery_method === 'SHOP_DELIVERY') return [{ label: 'Dispatch Order', status: 'OUT_FOR_DELIVERY' }]
  if (order.status === 'READY' && order.delivery_method === 'PARTNER') return [{ label: 'Hand to Delivery Partner', status: 'HANDED_TO_PARTNER' }]
  if (order.status === 'OUT_FOR_DELIVERY' || order.status === 'HANDED_TO_PARTNER') return [{ label: 'Mark Delivered', status: 'DELIVERED' }]
  return []
}

export default function SellerOrdersPage() {
  const { activeBusiness } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [actingId, setActingId] = useState<string | null>(null)
  const [payments, setPayments] = useState<Record<string, BuyerPayment | null>>({})
  const [details, setDetails] = useState<Record<string, OrderWithLines>>({})
  const [shops, setShops] = useState<Shop[]>([])
  const [shopFilter, setShopFilter] = useState('ALL')

  useEffect(() => {
    if (activeBusiness) {
      setShopFilter('ALL')
      void loadOrders()
      void shopApi.listByBusiness(activeBusiness.id).then(setShops).catch(() => setShops([]))
    }
  }, [activeBusiness])

  async function loadOrders() {
    if (!activeBusiness) return
    setLoading(true)
    setError('')
    try {
      const data = await orderApi.listByBusiness(activeBusiness.id, { limit: 20 })
      setOrders(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  async function runAction(order: Order, fn: () => Promise<unknown>) {
    setActingId(order.id)
    setActionError('')
    try {
      await fn()
      await loadOrders()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActingId(null)
    }
  }

  async function toggleDetails(order: Order) {
    if (expandedId === order.id) { setExpandedId(null); return }
    setExpandedId(order.id); setActionError('')
    try {
      const [detail, payment] = await Promise.all([
        orderApi.get(order.id),
        orderApi.getOrderPayment(order.id).catch((err) => {
          if (err instanceof Error && /PAYMENT_NOT_FOUND/i.test(err.message)) return null
          throw err
        })
      ])
      setDetails(prev => ({ ...prev, [order.id]: detail }))
      setPayments(prev => ({ ...prev, [order.id]: payment }))
    }
    catch (err) {
      if (!(err instanceof Error && /PAYMENT_NOT_FOUND/i.test(err.message))) setActionError(err instanceof Error ? err.message : 'Could not load payment')
      setPayments(prev => ({ ...prev, [order.id]: null }))
    }
  }

  async function confirmCash(order: Order, payment: BuyerPayment) {
    await runAction(order, async () => {
      const updated = await orderApi.sellerConfirmPayment(payment.id) as BuyerPayment
      setPayments(prev => ({ ...prev, [order.id]: updated }))
    })
  }

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <div className="empty-icon" style={{ fontSize: 64 }}>🧾</div>
        <h2>No Business Selected</h2>
        <p className="muted">Select a business to view orders.</p>
      </div>
    )
  }

  const orderList = Array.isArray(orders) ? orders : []
  const visibleOrders = shopFilter === 'ALL' ? orderList : orderList.filter((order) => order.shop_id === shopFilter)
  const shopNames = new Map(shops.map((shop) => [shop.id, shop.name]))

  return (
    <div className="seller-orders">
      <div className="page-header">
        <h1>Orders</h1>
      </div>

      <div className="row-between seller-order-filters">
        <div><strong>{visibleOrders.length} order{visibleOrders.length === 1 ? '' : 's'}</strong><div className="small muted">Across the selected Business</div></div>
        <label className="small"><span className="muted">Shop </span><select className="select" value={shopFilter} onChange={(event) => setShopFilter(event.target.value)}><option value="ALL">All Shops</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label>
      </div>

      {loading ? (
        <LoadingBlock label="Loading orders…" />
      ) : error ? (
        <ErrorBox error={`Unable to load orders: ${error}`} onRetry={() => void loadOrders()} />
      ) : visibleOrders.length === 0 ? (
        <Card>
          <div className="empty-state" style={{ padding: '48px 0', textAlign: 'center' }}>
            <div className="empty-icon" style={{ fontSize: 48 }}>🧾</div>
            <h3>{shopFilter === 'ALL' ? 'No Orders Yet' : 'No orders for this Shop'}</h3>
            <p className="muted">{shopFilter === 'ALL' ? 'Orders will appear here when customers place them.' : 'Choose All Shops to see every Order in this Business.'}</p>
          </div>
        </Card>
      ) : (
        <>
          {actionError && <ErrorBox error={actionError} />}
          <Card>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Status</th>
                    <th>Total (FC)</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((order) => {
                    const actions = nextActions(order)
                    const isExpanded = expandedId === order.id
                    const payment = payments[order.id]
                    const detail = details[order.id]
                    return (
                      <tr key={order.id}>
                        <td>{order.order_number || order.id.slice(0, 8)}</td>
                        <td><div><strong>{shopNames.get(order.shop_id) || detail?.shop_name || 'Unknown Shop'}</strong></div><span className={`badge badge-${getStatusColor(order.status)}`}>{order.status}</span></td>
                        <td>{order.final_total?.toLocaleString() || '0'}</td>
                        <td>{new Date(order.created_at).toLocaleDateString()}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {actions.map((a) => (
                              <Button
                                key={a.label}
                                variant={a.action === 'reject' ? 'ghost' : 'outline'}
                                size="sm"
                                disabled={actingId === order.id}
                                onClick={() =>
                                  runAction(order, () => {
                                    if (a.action === 'accept') return orderApi.accept(order.id)
                                    if (a.action === 'reject') return orderApi.reject(order.id)
                                    if (a.action === 'prepare') return orderApi.prepare(order.id)
                                    return orderApi.sellerTransition(order.id, { status: a.status! })
                                  })
                                }
                              >
                                {a.label}
                              </Button>
                            ))}
                            <Button variant="ghost" size="sm" onClick={() => void toggleDetails(order)}>
                              {isExpanded ? 'Hide' : 'View'}
                            </Button>
                          </div>
                          {isExpanded && (
                            <div className="small muted" style={{ marginTop: 8, textAlign: 'left' }}>
                              <div><strong>Delivery:</strong> {order.delivery_method || '—'}</div>
                              <div><strong>Base total:</strong> {(order.base_total ?? order.final_total).toLocaleString()} FC</div>
                              {order.notes && <div><strong>Notes:</strong> {order.notes}</div>}
                              <div><strong>Shop ID:</strong> {order.shop_id}</div>
                              {detail?.lines?.length ? <div className="seller-order-lines"><strong>Products</strong>{detail.lines.map((line) => <div key={line.id}>{line.product_name || line.product_id}{line.variant_name ? ` · ${line.variant_name}` : ''} · Qty {line.quantity} · {(line.final_unit_price || line.unit_price).toLocaleString()} FC</div>)}</div> : <div>Loading product details…</div>}
                              <div className="seller-payment-box">
                                <strong>Cash payment</strong>
                                {payment ? <>
                                  <div>Amount due: <strong>{payment.cash_due.toLocaleString()} FC</strong></div>
                                  <div>Buyer: {payment.buyer_confirmed ? '✓ Payment declared' : 'Not confirmed'}</div>
                                  <div>Seller: {payment.seller_confirmed ? '✓ Cash received' : 'Not confirmed'}</div>
                                  <div>Status: <strong>{payment.status}</strong></div>
                                  {!payment.seller_confirmed && <Button size="sm" disabled={actingId === order.id} onClick={() => void confirmCash(order, payment)}>Confirm Cash Received</Button>}
                                </> : <div>No cash payment created yet.</div>}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'success'
    case 'PENDING': return 'warning'
    case 'ACCEPTED':
    case 'PREPARING':
    case 'READY': return 'info'
    case 'OUT_FOR_DELIVERY':
    case 'DELIVERED': return 'primary'
    case 'CANCELLED':
    case 'REJECTED': return 'danger'
    default: return 'muted'
  }
}
