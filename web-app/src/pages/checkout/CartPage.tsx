import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { ApiError, type PointRedemptionPreviewResponse } from '@/api/types'
import { useCart } from '@/store/cart'
import { useAuth } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { LoadingBlock } from '@/components/ui/Feedback'
import { CheckoutProgress } from '@/components/checkout/CheckoutProgress'
import { formatMoney, initials, uuid } from '@/lib/format'
import { loginWithReturnTo } from '@/lib/returnTo'

function previewErrorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Could not verify your cart with the server.'
  if (/STOCK|INVENTORY/i.test(e.code)) {
    return 'Stock changed for an item in your cart. Adjust quantities and try again.'
  }
  if (e.code === 'BUYER_PROFILE_NOT_FOUND') {
    return 'Finish setting up your buyer profile before placing an order.'
  }
  if (/NO_POINT_ACCOUNT/i.test(`${e.code} ${e.message}`)) return ''
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
        (e: unknown) => {
          if (!mounted) return
          const message = previewErrorMessage(e)
          setError(message)
          if (!message && cart.usePoints) cart.setUsePoints(false)
        }
      )
      .finally(() => mounted && setBusy(false))
    return () => {
      mounted = false
    }
  }, [user, cart.shopId, cart.items, cart.usePoints])

  async function continueToCheckout() {
    if (!user) {
      navigate(loginWithReturnTo('/cart'))
      return
    }
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
      <div className="checkout-empty">
        <div className="checkout-empty-mark" aria-hidden>BTMI</div>
        <h1>Your cart is empty</h1>
        <p>Browse products and add items you want to buy.</p>
        <Link to="/search">
          <Button size="lg">Browse Marketplace</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="checkout-page fade-in">
      <CheckoutProgress current="Cart" />
      <header className="checkout-heading">
        <div><h1>Your Cart</h1><p>Order from <strong>{cart.shopName}</strong></p></div>
        <span>{cart.totalQty} {cart.totalQty === 1 ? 'item' : 'items'}</span>
      </header>

      {error && <div className="checkout-inline-error"><strong>Cart needs attention</strong><span>{error}</span>{/profile/i.test(error) && <button onClick={() => navigate('/account/profile-setup')}>Complete profile</button>}</div>}

      <div className="checkout-layout">
        <div className="checkout-content">
        <section className="checkout-card cart-products">
          <div className="checkout-card-head"><h2>Products</h2><span>{cart.shopName}</span></div>
          {cart.lines.map((l) => (
            <article key={l.variantId} className="cart-product-row">
              <div
                className="cart-product-image"
                style={{
                  background: `hsl(${l.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 32%, 26%)`
                }}
              >
                {l.image ? (
                  <img src={l.image} alt={l.name} />
                ) : (
                  <span>{initials(l.name)}</span>
                )}
              </div>
              <div className="cart-product-info">
                <h3>{l.name}</h3>
                <p>{l.variantName}</p>
                <small>Sold by {l.shopName}</small>
                <strong className="cart-unit-price">{formatMoney(l.unitPrice)}</strong>
              </div>
              <div className="cart-product-controls">
                <label>Quantity</label>
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
                <button className="cart-remove" onClick={() => cart.remove(l.variantId)}>Remove</button>
              </div>
              <div className="cart-product-total"><span>Subtotal</span><strong>{formatMoney(l.unitPrice * l.quantity)}</strong></div>
            </article>
          ))}
          {user && (
            <section className={`rewards-card ${cart.usePoints ? 'active' : ''}`}>
              <div><span className="eyebrow">BTMI POINTS</span><h2>{busy && !preview ? 'Loading your points…' : `${(preview?.available_points ?? 0).toLocaleString()} points available`}</h2><p>{(preview?.available_points ?? 0) > 0 ? 'Reduce your product total using your available rewards.' : 'Complete verified purchases to earn points.'}</p></div>
              <button type="button" role="switch" aria-label="Use points on this purchase" aria-checked={cart.usePoints} disabled={busy || !preview || preview.available_points <= 0} className={`toggle-switch ${cart.usePoints ? 'on' : ''}`} onClick={() => cart.setUsePoints(!cart.usePoints)}><span /></button>
              {cart.usePoints && preview && <div className="rewards-result"><strong>✓ Points applied</strong><span>You save {formatMoney(preview.points_discount_amount, preview.currency)}</span><span>New product total: {formatMoney(preview.final_total, preview.currency)}</span><button onClick={() => cart.setUsePoints(false)}>Remove points</button></div>}
            </section>
          )}
        </section>
        </div>

        <aside className="checkout-card checkout-summary">
          <span className="eyebrow">ORDER SUMMARY</span>

          {!user ? (
            <>
              <div className="summary-lines"><div><span>Items subtotal</span><strong>{formatMoney(cart.subtotal)}</strong></div><div><span>Delivery</span><strong>Calculated next</strong></div></div>
              <p className="small muted" style={{ margin: '8px 0' }}>
                Create an account or sign in to place this order. Your cart is saved.
              </p>
              <Button variant="accent" size="lg" block onClick={continueToCheckout}>
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
              <div className="summary-lines">
                <div><span>Items subtotal</span><strong>{formatMoney(preview.base_total, preview.currency)}</strong></div>
                {preview.points_discount_amount > 0 && <div><span>Points discount</span><strong className="discount">−{formatMoney(preview.points_discount_amount, preview.currency)}</strong></div>}
                <div><span>Delivery</span><strong>Calculated next</strong></div>
              </div>
              <div className="summary-total">
                <span>TOTAL PRODUCTS</span>
                <span>{formatMoney(preview.final_total, preview.currency)}</span>
                <small>Delivery is calculated in the next step.</small>
              </div>
              {busy && <p className="checkout-inline-status">Updating price and checking stock…</p>}
              <Button variant="accent" size="lg" block loading={placing} onClick={continueToCheckout}>
                Continue to checkout
              </Button>
            </>
          ) : null}
          <Link to="/search" className="checkout-secondary">Continue shopping</Link>
        </aside>
      </div>
    </div>
  )
}
