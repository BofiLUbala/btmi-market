import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { ApiError, type OrderWithLines } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { StatusBadge } from '@/components/ui/Badges'
import { formatMoney, formatDateTime, initials, asArray } from '@/lib/format'
import { RequireAuth } from '@/components/auth/Guards'

function OrderInner() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<OrderWithLines | null>(null)
  const [eligibility, setEligibility] = useState<{ eligible: boolean; existing_review_id?: string } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewDone, setReviewDone] = useState(false)

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

  useEffect(() => {
    buyerApi
      .reviewEligibility(orderId)
      .then((r) => setEligibility(r))
      .catch(() => setEligibility(null))
  }, [orderId, reviewDone])

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

  async function submitReview() {
    setReviewError('')
    setBusy(true)
    try {
      if (eligibility?.existing_review_id) {
        await buyerApi.updateReview(eligibility.existing_review_id, rating, comment)
      } else {
        await buyerApi.createReview(orderId, rating, comment)
      }
      setReviewDone(true)
    } catch (e) {
      setReviewError(e instanceof ApiError ? e.message : 'Could not submit review')
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

      {error && <ErrorBox error={error} />}

      <div className="order-summary-grid" style={{ marginTop: 16 }}>
        <div className="card stack">
          <h2 style={{ fontSize: '1.1rem' }}>Items</h2>
          {data.lines.map((l) => (
            <div key={l.id} className="cart-line" style={{ borderBottom: '1px dashed var(--color-border)' }}>
              <div
                className="cart-line-thumb"
                style={{ background: `hsl(${l.product_id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 32%, 26%)` }}
              >
                {initials(l.variant_id)}
              </div>
              <div className="stack" style={{ gap: 0, flex: 1 }}>
                <div className="bold small">Product {l.product_id.slice(0, 8)}</div>
                <div className="small muted">
                  {l.quantity} × {formatMoney(l.final_unit_price || l.unit_price)}
                </div>
              </div>
              <div className="bold small">{formatMoney(l.quantity * (l.final_unit_price || l.unit_price))}</div>
            </div>
          ))}

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
            {!needsDelivery && (o.status === 'DELIVERED' || o.status === 'OUT_FOR_DELIVERY') && (
              <Button
                onClick={async () => {
                  await buyerApi.confirmReceived(orderId)
                  load()
                }}
              >
                Confirm received
              </Button>
            )}
            <Link to={`/orders/${orderId}/tracking`}>
              <Button variant="outline" block>
                View tracking
              </Button>
            </Link>
            {o.status === 'COMPLETED' && (
              <Link to={`/orders/${orderId}/review`}>
                <Button variant="accent" block>
                  {eligibility?.existing_review_id ? 'Edit review' : 'Leave a review'}
                </Button>
              </Link>
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

      {o.status === 'COMPLETED' && (
        <ReviewCard
          rating={rating}
          setRating={setRating}
          comment={comment}
          setComment={setComment}
          onSubmit={submitReview}
          busy={busy}
          error={reviewError}
          done={reviewDone}
        />
      )}
    </div>
  )
}

function ReviewCard({
  rating,
  setRating,
  comment,
  setComment,
  onSubmit,
  busy,
  error,
  done
}: {
  rating: number
  setRating: (n: number) => void
  comment: string
  setComment: (s: string) => void
  onSubmit: () => void
  busy: boolean
  error: string
  done: boolean
}) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>Your review</h2>
      {done ? (
        <p className="pd-discount">Thanks! Your review has been submitted.</p>
      ) : (
        <>
          {error && <ErrorBox error={error} />}
          <div className="review-stars-input" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)} aria-label={`${n} stars`}>
                ★
              </button>
            ))}
          </div>
          <textarea
            className="input"
            rows={3}
            style={{ marginTop: 8 }}
            placeholder="Tell others about this shop…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <Button style={{ marginTop: 8 }} loading={busy} onClick={onSubmit}>
            Submit review
          </Button>
        </>
      )}
    </div>
  )
}

export default function OrderDetailPage() {
  return (
    <RequireAuth>
      <OrderInner />
    </RequireAuth>
  )
}