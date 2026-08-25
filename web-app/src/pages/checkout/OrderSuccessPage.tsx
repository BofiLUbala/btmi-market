import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import type { BuyerPayment, OrderWithLines } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { LoadingBlock } from '@/components/ui/Feedback'
import { formatMoney } from '@/lib/format'
import { RequireAuth } from '@/components/auth/Guards'
import { CheckoutProgress } from '@/components/checkout/CheckoutProgress'

function SuccessInner() {
  const { orderId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const payment = (location.state as { payment?: BuyerPayment } | null)?.payment
  const [order, setOrder] = useState<OrderWithLines | null>(null)

  useEffect(() => {
    buyerApi.orderDetail(orderId).then(
      (o) => setOrder(o),
      () => setOrder(null)
    )
  }, [orderId])

  if (!orderId) {
    navigate('/orders', { replace: true })
    return null
  }

  if (!order) return <LoadingBlock label="Confirming your order…" />

  const amount = payment?.cash_due ?? order.order.final_total + order.order.delivery_fee_final

  return (
    <div className="checkout-page fade-in">
      <CheckoutProgress current="Order" />
      <div className="card stack" style={{ textAlign: 'center', alignItems: 'center', padding: '40px 24px' }}>
        <div className="checkout-success-mark" aria-hidden>✓</div>
        <h1>Order confirmed!</h1>
        <p className="muted">
          Order <strong>{order.order.order_number || order.order.id.slice(0, 8)}</strong> has been placed.
          The shop has been notified.
        </p>
        <div className="pay-big" style={{ width: '100%', maxWidth: 380 }}>
          <div className="small muted">Amount to pay in cash</div>
          <div className="amount">{formatMoney(amount, payment?.currency ?? 'FC')}</div>
          <div className="pay-note">Keep an eye on your tracking for updates.</div>
        </div>
        <div className="row-between" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to={`/orders/${orderId}/tracking`}>
            <Button>Track order</Button>
          </Link>
          <Link to="/orders">
            <Button variant="outline">My orders</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function OrderSuccessPage() {
  return (
    <RequireAuth>
      <SuccessInner />
    </RequireAuth>
  )
}
