import { useAuth } from '@/store/auth'
import { orderApi } from '@/api/seller'
import type { OrderStatus } from '@/api/types'
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

const NEXT_ACTIONS: Record<string, Array<{ label: string; status?: string; action?: 'accept' | 'reject' | 'prepare' }>> = {
  PENDING: [
    { label: 'Accept', action: 'accept' },
    { label: 'Reject', action: 'reject' },
  ],
  ACCEPTED: [{ label: 'Prepare', action: 'prepare' }],
  PREPARING: [
    { label: 'Ready for Pickup', status: 'READY_FOR_PICKUP' },
    { label: 'Mark Ready', status: 'READY' },
  ],
  READY: [{ label: 'Out for Delivery', status: 'OUT_FOR_DELIVERY' }],
}

export default function SellerOrdersPage() {
  const { activeBusiness } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [actingId, setActingId] = useState<string | null>(null)

  useEffect(() => {
    if (activeBusiness) {
      loadOrders()
    }
  }, [activeBusiness])

  async function loadOrders() {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const data = await orderApi.listByBusiness(activeBusiness.id, { limit: 20 })
      setOrders(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders')
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

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <div className="empty-icon" style={{ fontSize: 64 }}>🧾</div>
        <h2>No Business Selected</h2>
        <p className="muted">Select a business to view orders.</p>
      </div>
    )
  }

  return (
    <div className="seller-orders">
      <div className="page-header">
        <h1>Orders</h1>
      </div>

      {loading ? (
        <LoadingBlock label="Loading orders…" />
      ) : error ? (
        <ErrorBox error={error} />
      ) : orders.length === 0 ? (
        <Card>
          <div className="empty-state" style={{ padding: '48px 0', textAlign: 'center' }}>
            <div className="empty-icon" style={{ fontSize: 48 }}>🧾</div>
            <h3>No Orders Yet</h3>
            <p className="muted">Orders will appear here when customers place them.</p>
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
                  {orders.map((order) => {
                    const actions = NEXT_ACTIONS[order.status] || []
                    const isExpanded = expandedId === order.id
                    return (
                      <tr key={order.id}>
                        <td>{order.order_number || order.id.slice(0, 8)}</td>
                        <td><span className={`badge badge-${getStatusColor(order.status)}`}>{order.status}</span></td>
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
                                    return orderApi.sellerTransition(order.id, { status: a.status! as OrderStatus })
                                  })
                                }
                              >
                                {a.label}
                              </Button>
                            ))}
                            <Button variant="ghost" size="sm" onClick={() => setExpandedId(isExpanded ? null : order.id)}>
                              {isExpanded ? 'Hide' : 'View'}
                            </Button>
                          </div>
                          {isExpanded && (
                            <div className="small muted" style={{ marginTop: 8, textAlign: 'left' }}>
                              <div><strong>Delivery:</strong> {order.delivery_method || '—'}</div>
                              <div><strong>Base total:</strong> {(order.base_total ?? order.final_total).toLocaleString()} FC</div>
                              {order.notes && <div><strong>Notes:</strong> {order.notes}</div>}
                              <div><strong>Shop ID:</strong> {order.shop_id}</div>
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
