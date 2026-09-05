import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { ApiError, type PointRedemptionPreviewResponse } from '@/api/types'
import { useCart } from '@/store/cart'
import { useAuth } from '@/store/auth'
import { useT } from '@/store/i18n'
import { Button } from '@/components/ui/Button'
import { LoadingBlock } from '@/components/ui/Feedback'
import { CheckoutProgress } from '@/components/checkout/CheckoutProgress'
import { BuyerProfileModal } from '@/components/checkout/BuyerProfileModal'
import { formatMoney, initials, uuid } from '@/lib/format'
import { loginWithReturnTo } from '@/lib/returnTo'

type T = ReturnType<typeof useT>

type PreviewErrorResult = { message: string; kind: 'profile' | 'other' | 'none' }

function previewErrorMessage(t: T, e: unknown): PreviewErrorResult {
  if (!(e instanceof ApiError)) return { message: t('cart.cannotVerify'), kind: 'other' }
  if (/STOCK|INVENTORY/i.test(e.code)) {
    return { message: t('cart.stockChanged'), kind: 'other' }
  }
  if (e.code === 'BUYER_PROFILE_NOT_FOUND') {
    return { message: t('cart.profileNotSetUp'), kind: 'profile' }
  }
  if (e.code === 'BUYER_PROFILE_INCOMPLETE') {
    return { message: t('cart.profileIncomplete'), kind: 'profile' }
  }
  if (/NO_POINT_ACCOUNT/i.test(`${e.code} ${e.message}`)) return { message: '', kind: 'none' }
  return { message: e.message, kind: 'other' }
}

export default function CartPage() {
  const cart = useCart()
  const navigate = useNavigate()
  const t = useT()
  const { user, buyerProfile, refreshUser } = useAuth()
  const [preview, setPreview] = useState<PointRedemptionPreviewResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')
  const [profileBlocked, setProfileBlocked] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Amazon-style guard: browsing and the cart itself stay open to everyone,
  // but checkout is blocked until the buyer has a phone number on file so
  // sellers/delivery can actually reach them about the order.
  const profileIncomplete = Boolean(user && !profileSaved && (!buyerProfile || !buyerProfile.phone.trim()))
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
          const { message, kind } = previewErrorMessage(t, e)
          setError(message)
          setProfileBlocked(kind === 'profile')
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
    if (profileIncomplete) {
      setProfileModalOpen(true)
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
      const { message, kind } = previewErrorMessage(t, e)
      setError(message)
      setProfileBlocked(kind === 'profile')
    } finally {
      setPlacing(false)
    }
  }

  if (cart.lines.length === 0) {
    return (
      <div className="checkout-empty">
        <div className="checkout-empty-mark" aria-hidden>TBK</div>
        <h1>{t('cart.empty.title')}</h1>
        <p>{t('cart.empty.description')}</p>
        <Link to="/search">
          <Button size="lg">{t('cart.empty.browse')}</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="checkout-page fade-in">
      <CheckoutProgress current="Cart" />
      <header className="checkout-heading">
        <div><h1>{t('cart.title')}</h1><p><strong>{t('cart.orderFrom', { shop: cart.shopName ?? '' })}</strong></p></div>
        <span>{cart.totalQty} {cart.totalQty === 1 ? t('cart.item') : t('cart.items')}</span>
      </header>

      {error && <div className="checkout-inline-error"><strong>{t('cart.needsAttention')}</strong><span>{error}</span>{profileBlocked && <button onClick={() => setProfileModalOpen(true)}>{t('cart.completeProfile')}</button>}</div>}
      {profileSaved && <div className="checkout-inline-success" role="status">Your buyer profile is complete. You can continue checkout.</div>}

      <div className="checkout-layout">
        <div className="checkout-content">
        <section className="checkout-card cart-products">
          <div className="checkout-card-head"><h2>{t('cart.products')}</h2><span>{cart.shopName}</span></div>
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
                <small>{t('product.soldBy')} {l.shopName}</small>
                <strong className="cart-unit-price">{formatMoney(l.unitPrice)}</strong>
              </div>
              <div className="cart-product-controls">
                <label>{t('common.quantity')}</label>
                <div className="stepper" role="group" aria-label={t('cart.quantityFor', { name: l.name })}>
                  <button
                    onClick={() => cart.setQuantity(l.variantId, l.quantity - 1)}
                    disabled={l.quantity <= 1}
                    aria-label={t('cart.decreaseQuantity')}
                  >
                    −
                  </button>
                  <span className="stepper-qty" aria-live="polite">{l.quantity}</span>
                  <button onClick={() => cart.setQuantity(l.variantId, l.quantity + 1)} aria-label={t('cart.increaseQuantity')}>
                    +
                  </button>
                </div>
                <button className="cart-remove" onClick={() => cart.remove(l.variantId)}>{t('common.remove')}</button>
              </div>
              <div className="cart-product-total"><span>{t('common.subtotal')}</span><strong>{formatMoney(l.unitPrice * l.quantity)}</strong></div>
            </article>
          ))}
          {user && (
            <section className={`rewards-card ${cart.usePoints ? 'active' : ''}`}>
              <div><span className="eyebrow">{t('points.title')}</span><h2>{busy && !preview ? t('points.loading') : t('points.available', { count: (preview?.available_points ?? 0).toLocaleString() })}</h2><p>{(preview?.available_points ?? 0) > 0 ? t('points.applyToOrder') : t('points.earnByPurchase')}</p></div>
              <button type="button" role="switch" aria-label={t('points.useOnPurchase')} aria-checked={cart.usePoints} disabled={busy || !preview || preview.available_points <= 0} className={`toggle-switch ${cart.usePoints ? 'on' : ''}`} onClick={() => cart.setUsePoints(!cart.usePoints)}><span /></button>
              {cart.usePoints && preview && <div className="rewards-result"><strong>{t('points.applied')}</strong><span>{t('points.youSave', { amount: formatMoney(preview.points_discount_amount, preview.currency) })}</span><span>{t('points.newTotal', { amount: formatMoney(preview.final_total, preview.currency) })}</span><button onClick={() => cart.setUsePoints(false)}>{t('points.remove')}</button></div>}
            </section>
          )}
        </section>
        </div>

        <aside className="checkout-card checkout-summary">
          <span className="eyebrow">{t('cart.orderSummary')}</span>

          {!user ? (
            <>
              <div className="summary-lines"><div><span>{t('cart.itemsSubtotal')}</span><strong>{formatMoney(cart.subtotal)}</strong></div><div><span>{t('product.delivery')}</span><strong>{t('cart.calculatedNext')}</strong></div></div>
              <p className="small muted" style={{ margin: '8px 0' }}>
                {t('cart.signInNote')}
              </p>
              <Button variant="accent" size="lg" block onClick={continueToCheckout}>
                {t('cart.signInToCheckout')}
              </Button>
              <p className="small muted" style={{ marginTop: 8 }}>
                {t('cart.newHere')}{' '}
                <Link to="/register" className="section-link">
                  {t('cart.createAccount')}
                </Link>
              </p>
            </>
          ) : busy && !preview ? (
            <LoadingBlock label={t('cart.verifying')} />
          ) : preview ? (
            <>
              <div className="summary-lines">
                <div><span>{t('cart.itemsSubtotal')}</span><strong>{formatMoney(preview.base_total, preview.currency)}</strong></div>
                {preview.points_discount_amount > 0 && <div><span>{t('cart.pointsDiscount')}</span><strong className="discount">−{formatMoney(preview.points_discount_amount, preview.currency)}</strong></div>}
                <div><span>{t('product.delivery')}</span><strong>{t('cart.calculatedNext')}</strong></div>
              </div>
              <div className="summary-total">
                <span>{t('cart.totalProducts')}</span>
                <span>{formatMoney(preview.final_total, preview.currency)}</span>
                <small>{t('cart.deliveryNextStep')}</small>
              </div>
              {busy && <p className="checkout-inline-status">{t('cart.updating')}</p>}
              {profileIncomplete && (
                <div className="checkout-inline-error" style={{ marginBottom: 12 }}>
                  <strong>{t('cart.addPhoneTitle')}</strong>
                  <span>{t('cart.addPhoneDescription')}</span>
                </div>
              )}
              <Button
                variant="accent"
                size="lg"
                block
                loading={placing}
                onClick={continueToCheckout}
              >
                {profileIncomplete ? t('cart.completeProfile') : t('cart.continueToCheckout')}
              </Button>
            </>
          ) : null}
          <Link to="/search" className="checkout-secondary">{t('cart.continueShopping')}</Link>
        </aside>
      </div>
      {user && <BuyerProfileModal open={profileModalOpen} profile={buyerProfile} user={user} onClose={() => setProfileModalOpen(false)} onSaved={async () => { await refreshUser(); setProfileSaved(true); setProfileBlocked(false); setError(''); setProfileModalOpen(false) }} />}
    </div>
  )
}
