import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { ApiError, type BuyerPayment, type OrderLine, type OrderWithLines } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { StatusBadge } from '@/components/ui/Badges'
import { formatMoney, formatDateTime, initials, asArray } from '@/lib/format'
import { RequireAuth } from '@/components/auth/Guards'

function OrderInner() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<OrderWithLines | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [payment, setPayment] = useState<BuyerPayment | null>(null)
  const [paymentError, setPaymentError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    buyerApi
      .orderDetail(orderId)
      .then(
        (d) => {
          setData(
            d
              ? { ...d, lines: asArray(d.lines), history: asArray(d.history) }
              : d
          )
          setLoading(false)
        },
        (e: unknown) => {
          setError(e instanceof ApiError ? e.message : 'Could not load order')
          setLoading(false)
        }
      )
  }

  useEffect(load, [orderId])

  const loadPayment = async () => {
    try { setPayment(await buyerApi.getPayment(orderId)); setPaymentError('') }
    catch (e) { if (!(e instanceof ApiError && e.status === 404)) setPaymentError(e instanceof Error ? e.message : 'Payment confirmation failed.') }
  }
  useEffect(() => { void loadPayment() }, [orderId])

  async function ensurePayment() {
    setBusy(true); setPaymentError('')
    try { setPayment(await buyerApi.createPayment(orderId)) }
    catch (e) { setPaymentError(e instanceof Error ? e.message : 'Payment confirmation failed.') }
    finally { setBusy(false) }
  }

  async function confirmPaid() {
    if (!payment) return
    setBusy(true); setPaymentError('')
    try { setPayment(await buyerApi.buyerConfirmPayment(payment.id)) }
    catch (e) { setPaymentError(e instanceof Error ? e.message : 'Payment confirmation failed.') }
    finally { setBusy(false) }
  }

  async function cancel() {
    if (!confirm('Cancel this order?')) return
    setBusy(true)
    setError('')
    try {
      await buyerApi.cancelOrder(orderId)
      load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not cancel order')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingBlock label="Loading order…" />
  if (error || !data) return <ErrorBox error={error || 'Order not found'} onRetry={load} />

  const o = data.order
  const productsTotal = o.final_total + o.points_discount_amount
  const total = o.final_total + o.delivery_fee_final
  const needsDelivery = !o.delivery_method

  return (
    <div className="fade-in">
      <Link to="/orders" className="small section-link">← My orders</Link>

      <div className="row-between" style={{ marginTop: 8 }}>
        <h1 style={{ fontSize: '1.5rem' }}>
          Order {o.order_number || o.id.slice(0, 8).toUpperCase()}
        </h1>
        <StatusBadge status={o.status} />
      </div>
      <div className="small muted">{formatDateTime(o.created_at)}</div>
      <div className="small" style={{ marginTop: 6 }}><span className="muted">Shop:</span> <strong>{data.shop_name || 'Shop unavailable'}</strong></div>

      {error && <ErrorBox error={error} />}

      <div className="order-summary-grid" style={{ marginTop: 16 }}>
        <div className="card stack" id="purchased-products">
          <h2 style={{ fontSize: '1.1rem' }}>Items</h2>
          {data.lines.map(l => <PurchasedLine key={l.id} line={l} orderId={orderId} completed={o.status === 'COMPLETED'} />)}

          <div className="total-row">
            <span>Products subtotal</span>
            <span>{formatMoney(productsTotal)}</span>
          </div>
          {o.points_used > 0 && (
            <div className="total-row">
              <span>Points used ({o.points_used})</span>
              <span className="pd-discount">−{formatMoney(o.points_discount_amount)}</span>
            </div>
          )}
          <div className="total-row">
            <span>Products total</span>
            <span>{formatMoney(o.final_total)}</span>
          </div>
          <div className="total-row">
            <span>Delivery ({o.delivery_method || 'not selected'})</span>
            <span>
              {o.delivery_points_used > 0 ? (
                <>
                  <s className="muted">{formatMoney(o.delivery_fee_base)}</s> {formatMoney(o.delivery_fee_final)}
                </>
              ) : (
                formatMoney(o.delivery_fee_final)
              )}
            </span>
          </div>
          <div className="total-row total">
            <span>Total due</span>
            <span>{formatMoney(total)}</span>
          </div>

          {o.delivery_method && (
            <div className="card" style={{ background: 'var(--color-surface-2)', border: 'none' }}>
              <div className="bold small" style={{ marginBottom: 4 }}>Delivery details</div>
              <div className="info-row">
                <span className="k">Contact</span>
                <span className="v">{o.delivery_contact_name || '—'}</span>
              </div>
              <div className="info-row">
                <span className="k">Phone</span>
                <span className="v">{o.delivery_phone || '—'}</span>
              </div>
              <div className="info-row">
                <span className="k">Address</span>
                <span className="v">{o.delivery_address || '—'}</span>
              </div>
              {o.delivery_notes && (
                <div className="info-row">
                  <span className="k">Notes</span>
                  <span className="v">{o.delivery_notes}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card stack">
            <h2 style={{ fontSize: '1.1rem' }}>Payment</h2>
            {paymentError && <ErrorBox error={paymentError} />}
            {payment ? <>
              <div className="info-row"><span className="k">Method</span><span className="v">Cash</span></div>
              <div className="info-row"><span className="k">Amount due</span><span className="v bold">{formatMoney(payment.cash_due, payment.currency)}</span></div>
              <div className="info-row"><span className="k">Buyer confirmation</span><span className="v">{payment.buyer_confirmed ? '✓ Payment declared' : 'Not confirmed'}</span></div>
              <div className="info-row"><span className="k">Seller confirmation</span><span className="v">{payment.seller_confirmed ? '✓ Cash received' : 'Waiting for Seller'}</span></div>
              <div className="info-row"><span className="k">Payment status</span><span className="v"><StatusBadge status={payment.status} /></span></div>
              {!payment.buyer_confirmed && <Button loading={busy} onClick={confirmPaid}>I have paid</Button>}
              {payment.buyer_confirmed && !payment.seller_confirmed && <p className="small muted">Your declaration is saved. The Seller must confirm the cash receipt.</p>}
            </> : o.delivery_method ? <Button loading={busy} onClick={ensurePayment}>Prepare cash payment</Button> : <p className="small muted">Select delivery before preparing payment.</p>}
          </div>
          <div className="card stack">
            <h2 style={{ fontSize: '1.1rem' }}>Actions</h2>
            {o.status === 'PENDING' && (
              <>
                {needsDelivery && (
                  <Button onClick={() => navigate('/checkout/delivery', { state: { orderId } })}>
                    Select delivery
                  </Button>
                )}
                <Button variant="danger" onClick={cancel} loading={busy}>
                  Cancel order
                </Button>
              </>
            )}
            {!needsDelivery && (o.status === 'PENDING' || o.status === 'ACCEPTED' || o.status === 'PREPARING' || o.status === 'READY') && (
              <Link to={`/orders/${orderId}/tracking`}>
                <Button block>Track order</Button>
              </Link>
            )}
            {!needsDelivery && ((o.delivery_method === 'PICKUP' && o.status === 'READY_FOR_PICKUP') || (o.delivery_method !== 'PICKUP' && o.status === 'DELIVERED')) && (
              <Button
                onClick={async () => {
                  await buyerApi.confirmReceived(orderId)
                  load()
                }}
              >
                I received my order
              </Button>
            )}
            <Link to={`/orders/${orderId}/tracking`}>
              <Button variant="outline" block>
                View tracking
              </Button>
            </Link>
            {o.status === 'COMPLETED' && (
              <>
                <a href="#purchased-products"><Button variant="accent" block>Review purchased products</Button></a>
                <ServiceReviewAction orderId={orderId} />
              </>
            )}
          </div>

          {data.history && data.history.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>Status history</h2>
              <ul className="timeline">
                {[...data.history].reverse().map((h) => (
                  <li key={h.id} className="done">
                    <div className="t-status small">
                      <StatusBadge status={h.status} />
                    </div>
                    {h.notes && <div className="small muted">{h.notes}</div>}
                    <div className="t-time">{formatDateTime(h.created_at)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

function PurchasedLine({ line, orderId, completed }: { line: OrderLine; orderId: string; completed: boolean }) {
  const variantText = Object.values(line.variant_attributes ?? {}).filter(Boolean).join(' / ') || line.variant_name || line.variant_sku || 'Standard variant'
  const price = line.final_unit_price
  return <div className="cart-line" style={{ borderBottom: '1px dashed var(--color-border)' }}>
    <div className="cart-line-thumb">{line.image_url ? <img src={line.image_url} alt="" /> : initials(line.product_name || 'Product')}</div>
    <div className="stack" style={{ gap: 1, flex: 1 }}><div className="bold small">{line.product_name || `Product ${line.product_id.slice(0, 8)}`}</div><div className="small muted">{variantText}</div><div className="small muted">{line.quantity} × {formatMoney(price)}</div><ReviewAction orderId={orderId} lineId={line.id} completed={completed} /></div>
    <div className="bold small">{formatMoney(line.quantity * price)}</div>
  </div>
}

function ReviewAction({ orderId, lineId, completed }: { orderId: string; lineId: string; completed: boolean }) {
  const [eligibility, setEligibility] = useState<{ eligible: boolean; existing_review_id?: string } | null>(null)
  useEffect(() => { if (completed) buyerApi.reviewEligibility(orderId, lineId).then(setEligibility).catch(() => setEligibility(null)) }, [orderId, lineId, completed])
  if (!completed) return <span className="small muted">Review: not eligible yet</span>
  if (eligibility?.existing_review_id) return <Link className="section-link small" to={`/orders/${orderId}/review?line=${lineId}`}>✓ Reviewed · Edit</Link>
  if (eligibility?.eligible) return <Link className="section-link small" to={`/orders/${orderId}/review?line=${lineId}`}>★ Review Product</Link>
  return <span className="small muted">Review: not eligible yet</span>
}

function ServiceReviewAction({ orderId }: { orderId: string }) {
  const [eligibility, setEligibility] = useState<{ eligible: boolean; existing_review_id?: string } | null>(null)
  useEffect(() => { buyerApi.reviewEligibility(orderId).then(setEligibility).catch(() => setEligibility(null)) }, [orderId])
  if (eligibility?.existing_review_id) return <Button variant="outline" block disabled>✓ Delivery & service reviewed</Button>
  if (eligibility?.eligible) return <Link to={`/orders/${orderId}/review?type=service`}><Button variant="outline" block>Review delivery & shop service</Button></Link>
  return null
}

export default function OrderDetailPage() {
  return (
    <RequireAuth>
      <OrderInner />
    </RequireAuth>
  )
}
