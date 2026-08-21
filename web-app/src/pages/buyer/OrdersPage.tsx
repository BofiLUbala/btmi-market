import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import type { BuyerOrder } from '@/api/types'
import { EmptyState, ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { StatusBadge } from '@/components/ui/Badges'
import { formatMoney, formatDateTime, asArray } from '@/lib/format'
import { RequireAuth } from '@/components/auth/Guards'

function OrdersInner() {
  const [orders, setOrders] = useState<BuyerOrder[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    buyerApi.orders().then(
      (o) => {
        setOrders(asArray(o))
        setLoading(false)
      },
      (e: unknown) => {
        setError(e instanceof Error ? e.message : 'Could not load orders')
        setLoading(false)
      }
    )
  }, [])

  if (loading) return <LoadingBlock label="Loading your orders…" />
  if (error) return <ErrorBox error={error} onRetry={() => window.location.reload()} />

  if (orders.length === 0) {
    return (
      <EmptyState
        icon="📦"
        title="No orders yet"
        description="When you place an order it will appear here with live tracking."
        action={
          <Link to="/search" className="btn btn-primary">
            Browse products
          </Link>
        }
      />
    )
  }

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 12 }}>My orders</h1>
      <div className="stack">
        {orders.map((o) => {
          const total = o.final_total + o.delivery_fee_final
          return (
            <Link key={o.id} to={`/orders/${o.id}`} className="card card-hover">
              <div className="row-between">
                <div className="stack" style={{ gap: 2 }}>
                  <div className="bold">
                    {o.order_number || o.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div className="small muted">{formatDateTime(o.created_at)}</div>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <div className="row-between" style={{ marginTop: 8 }}>
                <div className="small muted">
                  {o.total_items} item{o.total_items === 1 ? '' : 's'}
                  {o.delivery_method ? ` · ${o.delivery_method.replace(/_/g, ' ').toLowerCase()}` : ''}
                </div>
                <div className="bold">{formatMoney(total)}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersInner />
    </RequireAuth>
  )
}