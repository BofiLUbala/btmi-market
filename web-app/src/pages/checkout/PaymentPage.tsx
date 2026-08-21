import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { ApiError, type BuyerPayment, type DeliverySelectResponse } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { formatMoney } from '@/lib/format'
import { RequireAuth } from '@/components/auth/Guards'

function PaymentInner() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as
    | { orderId: string; summary?: DeliverySelectResponse }
    | null
  const orderId = state?.orderId
  const summary = state?.summary

  const [payment, setPayment] = useState<BuyerPayment | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!orderId) {
      navigate('/cart', { replace: true })
      return
    }
    let mounted = true
    buyerApi
      .createPayment(orderId)
      .then(
        (p) => mounted && setPayment(p),
        (e: unknown) =>
          mounted && setError(e instanceof ApiError ? e.message : 'Could not create payment')
      )
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [orderId, navigate])

  async function confirmCash() {
    if (!payment) return
    setConfirming(true)
    setError('')
    try {
      const updated = await buyerApi.buyerConfirmPayment(payment.id)
      setPayment(updated)
      navigate(`/orders/${orderId}/success`, {
        state: { payment: updated },
        replace: true
      })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not confirm payment')
      setConfirming(false)
    }
  }

  if (loading) return <LoadingBlock label="Preparing payment…" />
  if (!payment)
    return <ErrorBox error={error || 'No payment available'} onRetry={() => window.location.reload()} />

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 12 }}>Payment</h1>
      <p className="muted small">Cash only — hand over the amount when you receive your order.</p>

      {error && <ErrorBox error={error} />}

      {summary && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="total-row">
            <span>Products</span>
            <span>{formatMoney(summary.products_final_total)}</span>
          </div>
          <div className="total-row">
            <span>Delivery ({summary.delivery.method})</span>
            <span>
              {summary.delivery.points_used > 0 ? (
                <>
                  <s className="muted">{formatMoney(summary.delivery.fee_base)}</s>{' '}
                  {formatMoney(summary.delivery.fee_final)}
                </>
              ) : (
                formatMoney(summary.delivery.fee_final)
              )}
            </span>
          </div>
        </div>
      )}

      <div className="pay-big">
        <div className="small muted">Cash to pay on delivery / pickup</div>
        <div className="amount">{formatMoney(payment.cash_due, payment.currency)}</div>
        <div className="pay-note">
          {payment.products_points_used > 0 && `Products: ${payment.products_points_used} pts`}
          {payment.delivery_points_used > 0 &&
            `${payment.products_points_used > 0 ? ' · ' : ''}Delivery: ${payment.delivery_points_used} pts`}
          {payment.buyer_confirmed ? ' · Already confirmed' : ''}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <Button size="lg" block onClick={confirmCash} loading={confirming} disabled={payment.buyer_confirmed}>
          {payment.buyer_confirmed ? 'Payment confirmed' : "Confirm — I'll pay in cash"}
        </Button>
      </div>
    </div>
  )
}

export default function PaymentPage() {
  return (
    <RequireAuth>
      <PaymentInner />
    </RequireAuth>
  )
}