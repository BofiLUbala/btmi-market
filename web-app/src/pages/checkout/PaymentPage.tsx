import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { marketplaceApi } from '@/api/marketplace'
import { ApiError, type BuyerPayment, type CheckoutQuote, type DeliverySelectResponse, type OrderWithLines, type PublicProductDetail } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { formatMoney } from '@/lib/format'
import { RequireAuth } from '@/components/auth/Guards'
import { CheckoutProgress } from '@/components/checkout/CheckoutProgress'
import { useT } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

const METHOD_LABEL: Record<string, TranslationKey> = {
  PICKUP: 'delivery.pickup',
  SHOP_DELIVERY: 'delivery.shopDelivery',
  PARTNER: 'delivery.partner'
}

/**
 * The buyer's real choice is WHEN they pay, so the methods are presented under that
 * heading rather than as one flat list. Finance decides which methods exist and are
 * enabled; this only groups what the server quoted.
 */
const PAYMENT_GROUPS = [
  {
    timing: 'NOW' as const,
    title: 'Payer maintenant',
    hint: 'Paiement en ligne, confirmé par l’opérateur avant la livraison.'
  },
  {
    timing: 'DELIVERY' as const,
    title: 'Payer à la livraison',
    hint: 'Rien n’est prélevé maintenant. Le montant est dû à la remise de la commande.'
  }
]

const METHOD_HINT: Record<string, string> = {
  CASH_ON_DELIVERY: 'Espèces remises au Livreur, qui confirme la réception sur place.',
  MOBILE_AT_DELIVERY: 'Paiement mobile effectué à la remise, confirmé par l’opérateur.',
  MOBILE_PAY_NOW: 'Paiement mobile immédiat. Aucun paiement ne sera demandé à la livraison.'
}

function PaymentInner() {
  const navigate = useNavigate()
  const location = useLocation()
  const t = useT()
  const state = location.state as
    | { orderId: string; summary?: DeliverySelectResponse }
    | null
  const orderId = state?.orderId
  const summary = state?.summary

  const methodLabel = (m: string) => (METHOD_LABEL[m] ? t(METHOD_LABEL[m]) : m.replace(/_/g, ' '))


  const [payment, setPayment] = useState<BuyerPayment | null>(null)
  const [quote, setQuote] = useState<CheckoutQuote | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [order, setOrder] = useState<OrderWithLines | null>(null)
  const [products, setProducts] = useState<Record<string, PublicProductDetail>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [quoting, setQuoting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const selectedMethod = quote?.payment_methods.find(method => method.code === paymentMethod)

  // Read the address back from the order, so the recap survives a reload and a
  // later visit - the router state only exists on the first hop from Delivery.
  const deliveryProvince = order?.order.delivery_province || summary?.delivery.province || ''
  const deliveryCity = order?.order.delivery_city || summary?.delivery.city || ''
  const deliveryCommune = order?.order.delivery_commune || summary?.delivery.commune || ''
  const deliveryStreet = order?.order.delivery_street || summary?.delivery.street || ''
  const deliveryBuildingNumber = order?.order.delivery_building_number || summary?.delivery.building_number || ''
  const deliveryLandmark = order?.order.delivery_landmark || summary?.delivery.landmark || ''

  useEffect(() => {
    if (!orderId) {
      navigate('/cart', { replace: true })
      return
    }
    let mounted = true
    Promise.all([buyerApi.checkoutQuote(orderId), buyerApi.orderDetail(orderId)]).then(
      ([q, o]) => { if (mounted) { setQuote(q); setPaymentMethod(q.payment_methods[0]?.code || ''); setOrder(o) } },
      (e: unknown) => mounted && setError(e instanceof ApiError ? e.message : t('payment.couldNotPrepare'))
    ).finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [orderId, navigate])

  // Every method change is re-priced by the server, so the total on screen is
  // always the one the backend would charge - never a client-side sum.
  useEffect(() => {
    if (!orderId || !paymentMethod || loading) return
    let mounted = true
    setQuoting(true)
    buyerApi.checkoutQuote(orderId, paymentMethod).then(
      q => { if (mounted) { setQuote(q); setError('') } },
      (e: unknown) => { if (mounted) setError(e instanceof ApiError ? e.message : t('payment.couldNotPrepare')) }
    ).finally(() => { if (mounted) setQuoting(false) })
    return () => { mounted = false }
  }, [orderId, paymentMethod, loading])

  useEffect(() => {
    if (!order) return
    const ids = [...new Set(order.lines.map(line => line.product_id))]
    Promise.allSettled(ids.map(id => marketplaceApi.productDetail(id))).then(results => {
      const next: Record<string, PublicProductDetail> = {}
      results.forEach((result, index) => { if (result.status === 'fulfilled') next[ids[index]] = result.value })
      setProducts(next)
    })
  }, [order])

  /**
   * Places the order with the chosen method. It records how the buyer intends to pay -
   * nothing more. Every method starts DUE: cash is settled by the courier at the door,
   * and mobile money by its operator, so confirming this screen can never make an order
   * paid.
   */
  async function placeOrder() {
    if (!orderId || !paymentMethod) return
    setConfirming(true)
    setError('')
    try {
      const created = payment || await buyerApi.createPayment(orderId, paymentMethod)
      setPayment(created)
      navigate(`/orders/${orderId}/success`, { state: { payment: created }, replace: true })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('payment.couldNotConfirm'))
      setConfirming(false)
    }
  }

  if (loading) return <LoadingBlock label={t('payment.preparing')} />
  if (!quote)
    return <ErrorBox error={error || t('payment.noPayment')} onRetry={() => window.location.reload()} />

  return (
    <div className="checkout-page fade-in">
      <CheckoutProgress current="Review" />
      <header className="checkout-heading"><div><h1>{t('payment.title')}</h1><p>{t('payment.subtitle')}</p></div></header>

      {error && <ErrorBox error={error} />}

      <div className="checkout-layout">
        <div className="checkout-content stack">
          <section className="checkout-card">
            <div className="checkout-card-head"><h2>Mode de paiement</h2><span>Configuré par Finance</span></div>
            {PAYMENT_GROUPS.map(group => {
              const methods = quote.payment_methods.filter(method => method.timing === group.timing)
              if (methods.length === 0) return null
              return (
                <div className="stack" key={group.timing} style={{ marginTop: 12 }}>
                  <div>
                    <strong>{group.title}</strong>
                    <div><small className="muted">{group.hint}</small></div>
                  </div>
                  {methods.map(method => (
                    <label className={`delivery-option payment-method-option ${paymentMethod === method.code ? 'selected' : ''}`} key={method.code}>
                      <input type="radio" name="payment_method" value={method.code} checked={paymentMethod === method.code} onChange={() => setPaymentMethod(method.code)} />
                      <span>
                        <strong>{method.label}</strong><br/>
                        <small className="muted">{METHOD_HINT[method.code] ?? group.hint}</small>
                      </span>
                      <span className="payment-method-markup">
                        {method.markup_amount > 0 ? `+ ${formatMoney(method.markup_amount, quote.currency)}` : 'Sans frais'}
                      </span>
                    </label>
                  ))}
                </div>
              )
            })}
          </section>
          <section className="checkout-card"><div className="checkout-card-head"><h2>{t('cart.products')}</h2><span>{order?.order.total_items ?? 0} {order?.order.total_items === 1 ? t('cart.item') : t('cart.items')}</span></div>
          {order?.lines.map(line => { const product = products[line.product_id]; const variant = product?.variants?.find(item => item.id === line.variant_id); return <div className="review-order-line" key={line.id}><div><strong>{product?.name ?? t('product.fallback', { id: line.product_id.slice(0, 8) })}</strong><span>{variant?.name || variant?.sku || line.variant_id.slice(0, 8)} · {t('payment.quantity', { count: line.quantity })}</span></div><strong>{formatMoney((line.final_unit_price || line.unit_price) * line.quantity)}</strong></div> })}
          </section>
      {summary && (
        <section className="checkout-card">
          <div className="checkout-card-head"><h2>{t('product.delivery')}</h2><span>{methodLabel(summary.delivery.method)}</span></div>
          <div className="total-row">
            <span>{t('cart.products')}</span>
            <span>{formatMoney(summary.products_final_total)}</span>
          </div>
          {deliveryCommune && (
            <dl className="address-summary">
              <div><dt>Province</dt><dd>{deliveryProvince}</dd></div>
              <div><dt>Ville</dt><dd>{deliveryCity}</dd></div>
              <div><dt>Commune</dt><dd>{deliveryCommune}</dd></div>
              <div><dt>Adresse</dt><dd>{deliveryStreet}</dd></div>
              <div><dt>Numéro</dt><dd>{deliveryBuildingNumber}</dd></div>
              {deliveryLandmark && <div><dt>Instructions</dt><dd>{deliveryLandmark}</dd></div>}
            </dl>
          )}
          <div className="total-row">
            <span>{t('product.delivery')} ({methodLabel(summary.delivery.method)})</span>
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
        </section>
      )}
        </div>

      <aside className="checkout-card checkout-summary">
        <span className="eyebrow">{t('payment.finalSummary')}</span>
        <div className="summary-lines">
          <div><span>{t('cart.products')}</span><strong>{formatMoney(quote.subtotal, quote.currency)}</strong></div>
          <div><span>{t('payment.productPoints')}</span><strong className="discount">−{formatMoney(quote.points_discount, quote.currency)}</strong></div>
          <div><span>{t('product.delivery')}</span><strong>{formatMoney(quote.delivery_fee, quote.currency)}</strong></div>
          <div>
            <span>Frais du mode de paiement{selectedMethod?.markup_type === 'PERCENTAGE' ? ` (${selectedMethod.markup_value}%)` : ''}</span>
            <strong>{formatMoney(quote.payment_markup, quote.currency)}</strong>
          </div>
        </div>
        <div className="summary-total"><span>Total</span><strong>{formatMoney(quote.final_total, quote.currency)}</strong><small>{quoting ? 'Recalcul du total…' : 'Le montant final est calculé par le serveur.'}</small></div>
        <div className="pay-note">
          {selectedMethod?.timing === 'NOW'
            ? 'Vous serez redirigé vers votre opérateur. La commande est payée une fois que l’opérateur le confirme.'
            : 'Aucun montant n’est prélevé maintenant : ce total est dû à la livraison.'}
        </div>
        <Button variant="accent" size="lg" block onClick={placeOrder} loading={confirming} disabled={!paymentMethod || quoting || Boolean(payment)}>
          {payment ? t('payment.orderConfirmed') : t('payment.placeOrder')}
        </Button>
      </aside>
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
