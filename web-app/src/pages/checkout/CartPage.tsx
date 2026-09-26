import { useEffect, useState } from 'react'
import { useFeatureEnabled } from '@/lib/platformState'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { ApiError, type CartLineIssue, type CartPreview } from '@/api/types'
import { lineKey, useCart, type CartLine } from '@/store/cart'
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

/** Indexes the server's per-line problems by the line they belong to. */
function issuesByLine(issues: CartLineIssue[]): Map<string, CartLineIssue> {
  const map = new Map<string, CartLineIssue>()
  for (const issue of issues) {
    map.set(`${issue.product_id}::${issue.variant_id}::${issue.shop_id}`, issue)
  }
  return map
}

export default function CartPage() {
  const cart = useCart()
  // BUYER_POINTS_ENABLED off in the Control Center: hide redemption and drop
  // any selection, since the API would refuse the order.
  const pointsEnabled = useFeatureEnabled('BUYER_POINTS_ENABLED')
  useEffect(() => { if (!pointsEnabled && cart.usePoints) cart.setUsePoints(false) }, [pointsEnabled, cart.usePoints])
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isBuyNow = pathname === '/checkout/buy-now'
  const t = useT()
  const { user, buyerProfile, refreshUser } = useAuth()
  const [preview, setPreview] = useState<CartPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')
  const [profileBlocked, setProfileBlocked] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [recentlyRemoved, setRecentlyRemoved] = useState<CartLine | null>(null)

  // Amazon-style guard: browsing and the cart itself stay open to everyone,
  // but checkout is blocked until the buyer has a phone number on file so
  // sellers/delivery can actually reach them about the order.
  const profileIncomplete = Boolean(user && !profileSaved && (!buyerProfile || !buyerProfile.phone.trim()))

  // Authoritative totals come from the backend preview (logged-in only). The whole
  // cart is priced in one call, across every shop in it.
  useEffect(() => {
    if (!user || cart.lines.length === 0) {
      setPreview(null)
      return
    }
    let mounted = true
    setBusy(true)
    setError('')
    buyerApi
      .previewCart(cart.items, cart.usePoints)
      .then(
        (p) => {
          if (!mounted) return
          setPreview(p)
          setProfileBlocked(false)
          // Problems are shown against their own lines below, so the banner only
          // carries the headline.
          setError(p.issues.length > 0 ? t('cart.needsAttention') : '')
        },
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
  }, [user, cart.items, cart.usePoints])

  async function continueToCheckout() {
    if (!user) {
      navigate(loginWithReturnTo(isBuyNow ? '/checkout/buy-now' : '/cart'))
      return
    }
    if (profileIncomplete) {
      setProfileModalOpen(true)
      return
    }
    if (cart.lines.length === 0) return
    setPlacing(true)
    setError('')
    try {
      const idem = uuid()
      const result = await buyerApi.createCheckout(cart.items, cart.usePoints, idem)
      const [firstOrderId] = result.order_ids
      if (!firstOrderId) throw new Error('Checkout created without an order')
      cart.clear()
      // One checkout experience for the buyer even when it produced several
      // orders: delivery is chosen once and applied down the group.
      navigate('/checkout/delivery', {
        state: {
          orderId: firstOrderId,
          orderIds: result.order_ids,
          checkoutGroupId: result.checkout_group_id
        },
        replace: true
      })
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

  const lineIssues = issuesByLine(preview?.issues ?? [])
  const blockedByIssues = Boolean(preview && !preview.checkoutable)

  return (
    <div className="checkout-page fade-in">
      <CheckoutProgress current="Cart" />
      <header className="checkout-heading">
        <div>
          <h1>{t('cart.title')}</h1>
          <p>
            <strong>
              {cart.isMultiShop
                ? `${cart.shops.length} boutiques · une seule commande à payer`
                : t('cart.orderFrom', { shop: cart.shops[0]?.shopName ?? '' })}
            </strong>
          </p>
        </div>
        <span>{cart.totalQty} {cart.totalQty === 1 ? t('cart.item') : t('cart.items')}</span>
      </header>

      {error && (
        <div className="checkout-inline-error">
          <strong>{t('cart.needsAttention')}</strong>
          <span>{error}</span>
          {profileBlocked && <button onClick={() => setProfileModalOpen(true)}>{t('cart.completeProfile')}</button>}
        </div>
      )}
      {profileSaved && <div className="checkout-inline-success" role="status">Your buyer profile is complete. You can continue checkout.</div>}

      {recentlyRemoved && (
        <div
          role="status"
          className="fade-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            marginBottom: 16,
            borderRadius: 'var(--radius)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
            {t('cart.itemRemoved', { name: recentlyRemoved.name })}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--color-accent)', fontWeight: 700 }}
              onClick={() => {
                cart.add(recentlyRemoved)
                setRecentlyRemoved(null)
              }}
            >
              {t('common.undo')}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setRecentlyRemoved(null)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="checkout-layout">
        <div className="checkout-content">
        {/* One card per shop. Each becomes its own order, which is what the
            seller will see, so the split is shown here rather than sprung on
            the buyer at the end. */}
        {cart.shops.map((shop) => (
        <section className="checkout-card cart-products" key={shop.shopId}>
          <div className="checkout-card-head">
            <h2>{shop.shopName}</h2>
            <span>{shop.itemCount} {shop.itemCount === 1 ? t('cart.item') : t('cart.items')} · {formatMoney(shop.subtotal)}</span>
          </div>
          {cart.isMultiShop && (
            <p className="small muted" style={{ margin: '0 0 8px' }}>
              Commande séparée pour cette boutique, livrée et suivie séparément.
            </p>
          )}
          {shop.lines.map((l) => {
            const key = lineKey(l)
            const issue = lineIssues.get(key)
            return (
            <article key={key} className="cart-product-row">
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
                {/* The problem is shown on the line that has it. The rest of the
                    cart stays usable. */}
                {issue && (
                  <p role="alert" className="small" style={{ color: 'var(--color-danger, #c0392b)', marginTop: 6 }}>
                    {issue.message}
                    {issue.available > 0 && issue.code === 'INSUFFICIENT_STOCK' && (
                      <>
                        {' '}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => cart.setQuantity(key, issue.available)}
                        >
                          Réduire à {issue.available}
                        </button>
                      </>
                    )}
                  </p>
                )}
              </div>
              <div className="cart-product-controls">
                <label>{t('common.quantity')}</label>
                <div className="stepper" role="group" aria-label={t('cart.quantityFor', { name: l.name })}>
                  <button
                    onClick={() => cart.setQuantity(key, l.quantity - 1)}
                    disabled={l.quantity <= 1}
                    aria-label={t('cart.decreaseQuantity')}
                  >
                    −
                  </button>
                  <span className="stepper-qty" aria-live="polite">{l.quantity}</span>
                  <button onClick={() => cart.setQuantity(key, l.quantity + 1)} aria-label={t('cart.increaseQuantity')}>
                    +
                  </button>
                </div>
                <button
                  className="cart-remove"
                  onClick={() => {
                    setRecentlyRemoved({ ...l })
                    cart.remove(key)
                  }}
                >
                  {t('common.remove')}
                </button>
              </div>
              <div className="cart-product-total"><span>{t('common.subtotal')}</span><strong>{formatMoney(l.unitPrice * l.quantity)}</strong></div>
            </article>
            )
          })}
        </section>
        ))}

        {user && pointsEnabled && (
          <section className={`rewards-card ${cart.usePoints ? 'active' : ''}`}>
            <div><span className="eyebrow">{t('points.title')}</span><h2>{busy && !preview ? t('points.loading') : t('points.available', { count: (preview?.available_points ?? 0).toLocaleString() })}</h2><p>{(preview?.available_points ?? 0) > 0 ? t('points.applyToOrder') : t('points.earnByPurchase')}</p></div>
            <button type="button" role="switch" aria-label={t('points.useOnPurchase')} aria-checked={cart.usePoints} disabled={busy || !preview || preview.available_points <= 0} className={`toggle-switch ${cart.usePoints ? 'on' : ''}`} onClick={() => cart.setUsePoints(!cart.usePoints)}><span /></button>
            {cart.usePoints && preview && preview.points_discount_amount > 0 && <div className="rewards-result"><strong>{t('points.applied')}</strong><span>{t('points.youSave', { amount: formatMoney(preview.points_discount_amount, preview.currency) })}</span><span>{t('points.newTotal', { amount: formatMoney(preview.final_total, preview.currency) })}</span><button onClick={() => cart.setUsePoints(false)}>{t('points.remove')}</button></div>}
          </section>
        )}
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
                <div><span>{t('cart.itemsSubtotal')}</span><strong>{formatMoney(preview.subtotal, preview.currency)}</strong></div>
                {/* Each shop's share, so a multi-shop cart never shows one
                    ambiguous total. */}
                {cart.isMultiShop && preview.shops.map((shop) => (
                  <div key={shop.shop_id}><span className="muted">{shop.shop_name}</span><span>{formatMoney(shop.subtotal, preview.currency)}</span></div>
                ))}
                {preview.points_discount_amount > 0 && <div><span>{t('cart.pointsDiscount')}</span><strong className="discount">−{formatMoney(preview.points_discount_amount, preview.currency)}</strong></div>}
                <div><span>{t('product.delivery')}</span><strong>{t('cart.calculatedNext')}</strong></div>
                <div><span>Frais du mode de paiement</span><strong>{t('cart.calculatedNext')}</strong></div>
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
                disabled={blockedByIssues}
                onClick={continueToCheckout}
              >
                {profileIncomplete ? t('cart.completeProfile') : t('cart.continueToCheckout')}
              </Button>
              {blockedByIssues && (
                <p className="small muted" style={{ marginTop: 8 }}>
                  Corrigez les lignes signalées ci-dessus pour continuer.
                </p>
              )}
            </>
          ) : null}
          <Link to="/search" className="checkout-secondary">{t('cart.continueShopping')}</Link>
        </aside>
      </div>
      {user && <BuyerProfileModal open={profileModalOpen} profile={buyerProfile} user={user} onClose={() => setProfileModalOpen(false)} onSaved={async () => { await refreshUser(); setProfileSaved(true); setProfileBlocked(false); setError(''); setProfileModalOpen(false) }} />}
    </div>
  )
}
