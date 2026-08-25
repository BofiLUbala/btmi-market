import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import type { BuyerPayment, OrderLine, OrderWithLines } from '@/api/types'
import { EmptyState, ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { StatusBadge } from '@/components/ui/Badges'
import { formatMoney, formatDateTime, initials, asArray } from '@/lib/format'
import { RequireAuth } from '@/components/auth/Guards'

interface OrderHistoryItem { detail: OrderWithLines; payment: BuyerPayment | null }

function variantLabel(line: OrderLine) {
  const attributes = Object.values(line.variant_attributes ?? {}).filter(Boolean)
  return attributes.join(' / ') || line.variant_name || line.variant_sku || 'Standard variant'
}

function OrdersInner() {
  const [items, setItems] = useState<OrderHistoryItem[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const orders = asArray(await buyerApi.orders())
        const details = await Promise.all(orders.map(async (order) => {
          const [detail, payment] = await Promise.all([
            buyerApi.orderDetail(order.id),
            buyerApi.getPayment(order.id).catch(() => null),
          ])
          return { detail, payment }
        }))
        if (active) setItems(details)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not load orders')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  if (loading) return <LoadingBlock label="Loading your orders…" />
  if (error) return <ErrorBox error={error} onRetry={() => window.location.reload()} />
  if (items.length === 0) return <EmptyState icon="📦" title="You have no orders yet" description="Your purchases will appear here after checkout." action={<Link to="/" className="btn btn-primary">Browse Marketplace</Link>} />

  return <div className="fade-in">
    <div className="page-header"><div><div className="eyebrow">YOUR ACCOUNT</div><h1>My Orders</h1><p className="muted">Products, payment and live fulfillment status for every Shop.</p></div></div>
    <div className="stack buyer-order-list">
      {items.map(({ detail, payment }) => {
        const order = detail.order
        const total = order.final_total + order.delivery_fee_final
        return <article key={order.id} className="card buyer-order-card">
          <div className="row-between buyer-order-head"><div><div className="eyebrow">ORDER</div><h2>{order.order_number || order.id.slice(0, 8).toUpperCase()}</h2><div className="small muted">{formatDateTime(order.created_at)}</div></div><StatusBadge status={order.status} /></div>
          <div className="buyer-order-shop"><span className="muted small">Shop</span><strong>{detail.shop_name || 'Shop unavailable'}</strong></div>
          <div className="stack buyer-order-lines">
            {detail.lines.map((line) => {
              const price = line.final_unit_price
              return <div className="cart-line" key={line.id}>
                <div className="cart-line-thumb">{line.image_url ? <img src={line.image_url} alt="" /> : initials(line.product_name || 'Product')}</div>
                <div className="stack" style={{ gap: 2, flex: 1 }}><strong>{line.product_name || `Product ${line.product_id.slice(0, 8)}`}</strong><span className="small muted">Variant: {variantLabel(line)}</span><span className="small muted">Quantity: {line.quantity} · Unit price: {formatMoney(price)}</span></div>
                <strong>{formatMoney(line.quantity * price)}</strong>
              </div>
            })}
          </div>
          <div className="buyer-order-footer">
            <div className="small"><span className="muted">Payment</span><br /><strong>{payment ? payment.status : 'Not prepared'}</strong>{payment?.buyer_confirmed ? ' · Buyer confirmed' : ''}{payment?.seller_confirmed ? ' · Seller confirmed' : ''}</div>
            <div className="small"><span className="muted">Delivery</span><br /><strong>{order.delivery_method ? order.delivery_method.replace(/_/g, ' ') : 'Not selected'}</strong></div>
            <div><span className="muted small">Total</span><br /><strong>{formatMoney(total)}</strong></div>
            <Link to={`/orders/${order.id}`} className="btn btn-primary">View Order</Link>
          </div>
        </article>
      })}
    </div>
  </div>
}

export default function OrdersPage() { return <RequireAuth><OrdersInner /></RequireAuth> }
