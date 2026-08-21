import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { ApiError, type PointRedemptionPreviewResponse } from '@/api/types'
import { useCart } from '@/store/cart'
import { useAuth } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { formatMoney, initials, uuid } from '@/lib/format'

function previewErrorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Could not verify your cart with the server.'
  if (/STOCK|INVENTORY/i.test(e.code)) {
    return 'Stock changed for an item in your cart. Adjust quantities and try again.'
  }
  if (e.code === 'BUYER_PROFILE_NOT_FOUND') {
    return 'Finish setting up your buyer profile before placing an order.'
  }
  return e.message
}

export default function CartPage() {
  const cart = useCart()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [preview, setPreview] = useState<PointRedemptionPreviewResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')

  // Authoritative totals come from the backend preview (logged-in only).
  useEffect(() => {
    if (!user || cart.lines.length === 0 || !cart.shopId) {
      setPreview(null)
      return
    }
    let mounted = true
    setBusy(true)
    setError('')
    buyerApi
      .previewOrder(cart.shopId, cart.items, cart.usePoints)
      .then(
        (p) => mounted && setPreview(p),
        (e: unknown) => mounted && setError(previewErrorMessage(e))
      )
      .finally(() => mounted && setBusy(false))
    return () => {
      mounted = false
    }
  }, [user, cart.shopId, cart.items, cart.usePoints])

  async function continueToCheckout() {
    if (!cart.shopId) return
    setPlacing(true)
    setError('')
    try {
      const idem = uuid()
      const result = await buyerApi.createOrder(cart.shopId, cart.items, cart.usePoints, idem)
      const orderId = result.order?.id
      if (!orderId) throw new Error('Order created without an id')
      cart.clear()
      navigate('/checkout/delivery', { state: { orderId }, replace: true })
    } catch (e) {
      setError(previewErrorMessage(e))
    } finally {
      setPlacing(false)
    }
  }

  if (cart.lines.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '48px 0' }}>
        <div className="empty-icon">🛒</div>
        <h3>Your cart is empty</h3>
        <p className="muted mt-0">Browse the marketplace and add some products.</p>
        <Link to="/search">
          <Button>Browse products</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 12 }}>Your cart</h1>
      <p className="muted small">
        From <strong>{cart.shopName}</strong> — you can only order from one shop at a time.
      </p>

      {error && (
        <ErrorBox
          error={error}
          onRetry={
            /profile/i.test(error)
              ? () => navigate('/account/profile-setup')
              : undefined
          }
        />
      )}

      <div className="order-summary-grid">
        <div className="card">
          {cart.lines.map((l) => (
            <div key={l.variantId} className="cart-line">
              <div
                className="cart-line-thumb"
                aria-hidden
                style={{
                  background: `hsl(${l.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 32%, 26%)`
                }}
              >
                {l.image ? (
                  <img src={l.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  initials(l.name)
                )}
              </div>
              <div className="stack" style={{ gap: 2, flex: 1 }}>
                <div className="bold small">{l.name}</div>
                <div className="small muted">{l.variantName}</div>
                <div className="small muted">
                  {formatMoney(l.unitPrice)} × {l.quantity} ={' '}
                  <strong>{formatMoney(l.unitPrice * l.quantity)}</strong>
                </div>
                <div className="stepper" role="group" aria-label={`Quantity for ${l.name}`}>
                  <button
                    onClick={() => cart.setQuantity(l.variantId, l.quantity - 1)}
                    disabled={l.quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="stepper-qty" aria-live="polite">{l.quantity}</span>
                  <button onClick={() => cart.setQuantity(l.variantId, l.quantity + 1)} aria-label="Increase quantity">
                    +
                  </button>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => cart.remove(l.variantId)}
                aria-label={`Remove ${l.name}`}
              >
                ✕
              </button>
            </div>
          ))}
          {user && (
            <div className="row-between" style={{ marginTop: 12 }}>
              <label className="small bold" htmlFor="use-points">
                Redeem my points on this order
              </label>
              <input
                id="use-points"
                type="checkbox"
                checked={cart.usePoints}
                onChange={(e) => cart.setUsePoints(e.target.checked)}
              />
            </div>
          )}
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.15rem', marginBottom: 8 }}>Summary</h2>

          {/* Display-only subtotal from captured prices. */}
          <div className="total-row">
            <span>Items subtotal</span>
            <span>{formatMoney(cart.subtotal)}</span>
          </div>
          <p className="pay-note small">
            Final pricing (level discounts, points, delivery fee) is calculated by the server.
          </p>

          {!user ? (
            <>
              <p className="small muted" style={{ margin: '8px 0' }}>
                Create an account or sign in to place this order. Your cart is saved.
              </p>
              <Button size="lg" block onClick={() => navigate('/checkout/delivery')}>
                Sign in to check out
              </Button>
              <p className="small muted" style={{ marginTop: 8 }}>
                New here?{' '}
                <Link to="/register" className="section-link">
                  Create an account
                </Link>
              </p>
            </>
          ) : busy && !preview ? (
            <LoadingBlock label="Verifying prices and stock…" />
          ) : preview ? (
            <>
              <div className="total-row">
                <span>Subtotal</span>
                <span>{formatMoney(preview.base_total, preview.currency)}</span>
              </div>
              <div className="total-row">
                <span>Points used</span>
                <span>{preview.points_used}</span>
              </div>
              {preview.points_discount_amount > 0 && (
                <div className="total-row">
                  <span>Points discount</span>
                  <span className="pd-discount">
                    −{formatMoney(preview.points_discount_amount, preview.currency)}
                  </span>
                </div>
              )}
              <div className="total-row total">
                <span>Total due</span>
                <span>{formatMoney(preview.final_total, preview.currency)}</span>
              </div>
              <p className="pay-note">
                {preview.available_points} points available · max {preview.maximum_usable_points}{' '}
                redeemable ({preview.redeem_rate} point rate,{' '}
                {Math.round(preview.max_point_coverage * 100)}% coverage). Delivery is selected next.
              </p>
              <Button size="lg" block loading={placing} onClick={continueToCheckout}>
                Continue to delivery
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
