import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { marketplaceApi } from '@/api/marketplace'
import { ApiError, type BuyerPayment, type CheckoutQuote, type DeliverySelectResponse, type OrderWithLines, type PaymentProviderCode, type PublicProductDetail } from '@/api/types'
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
 * The buyer's first decision is WHEN they pay, not which operator they use.
 *
 * Presenting every method flat - cash, mobile now, mobile at delivery - asked the
 * buyer to compare two unrelated things at once: the moment money leaves them,
 * and the rail it travels on. So this screen asks the timing question first, then
 * the channel, then the operator. Finance still decides which methods exist; this
 * only arranges what the server quoted.
 */
type Timing = 'NOW' | 'DELIVERY'

const TIMING_CHOICES: { timing: Timing; title: string; hint: string }[] = [
  {
    timing: 'NOW',
    title: 'Payer maintenant',
    hint: 'Paiement mobile immédiat, confirmé par l’opérateur avant la livraison.'
  },
  {
    timing: 'DELIVERY',
    title: 'Payer à la livraison',
    hint: 'Rien n’est prélevé maintenant. Le montant est dû à la remise de la commande.'
  }
]

const METHOD_HINT: Record<string, string> = {
  CASH_ON_DELIVERY: 'Espèces remises au Livreur, qui confirme la réception sur place.',
  MOBILE_AT_DELIVERY: 'Paiement mobile effectué à la remise, confirmé par l’opérateur.',
  MOBILE_PAY_NOW: 'Paiement mobile immédiat. Aucun paiement ne sera demandé à la livraison.'
}

/** The label a method carries in the grouped UI, where its timing is already known. */
const METHOD_TITLE: Record<string, string> = {
  CASH_ON_DELIVERY: 'Espèces',
  MOBILE_AT_DELIVERY: 'Paiement mobile à la livraison',
  MOBILE_PAY_NOW: 'Paiement mobile'
}

function isMobile(code: string) {
  return code === 'MOBILE_PAY_NOW' || code === 'MOBILE_AT_DELIVERY'
}

function checkoutErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback
  const messages: Record<string, string> = {
    PAYMENT_PROVIDER_REQUIRED: 'Veuillez sélectionner un opérateur Mobile Money.',
    PAYMENT_PROVIDER_NOT_CONFIGURED: 'Le paiement mobile est temporairement indisponible.',
    PAYMENT_PROVIDER_UNKNOWN: 'Opérateur Mobile Money non reconnu. Veuillez en choisir un autre.',
    PAYMENT_PROVIDER_UNAVAILABLE: 'Cet opérateur Mobile Money est indisponible. Veuillez en choisir un autre.',
    PAYMENT_METHOD_UNAVAILABLE: 'Ce mode de paiement est indisponible. Veuillez en choisir un autre.',
    DELIVERY_NOT_SELECTED: 'Veuillez sélectionner une livraison avant de passer la commande.',
    DELIVERY_DETAILS_INCOMPLETE: 'Veuillez renseigner une adresse de livraison valide.',
    PAYER_PHONE_REQUIRED: 'Veuillez saisir le numéro Mobile Money qui sera débité.',
    PAYMENT_ALREADY_SELECTED: 'Un autre mode de paiement est déjà associé à cette commande.',
    PAYMENT_ALREADY_CREATED: 'Un paiement est déjà associé à cette commande.',
    PAYMENT_ALREADY_SETTLED: 'Cette commande a déjà été réglée.',
    PAYMENT_IN_PROGRESS: 'Un traitement de paiement est déjà en cours.',
    PAYMENT_STATE_CHANGED: 'Le statut de la commande a évolué. Veuillez rafraîchir la page.',
    PAYMENT_NOT_FOUND: 'Impossible de retrouver le paiement associé.',
    PAYMENT_NOT_CONFIGURED: 'Le mode de paiement sélectionné n’est pas configuré.',
    PAYMENT_CLOSED: 'Ce paiement n’est plus accessible.',
    AMOUNT_MISMATCH: 'Le montant de la commande a changé, veuillez réessayer.',
    INVALID_STATE: 'L’état de la commande ne permet pas cette action. Veuillez rafraîchir la page.',
    INVALID_STATE_TRANSITION: 'L’état de la commande ne permet pas cette action. Veuillez rafraîchir la page.',
    ORDER_NOT_FOUND: 'Impossible de retrouver la commande.',
    ORDER_CANCELLED: 'Cette commande a été annulée.',
    ORDER_COMPLETED: 'Cette commande est déjà terminée.',
    CHECKOUT_GROUP_NOT_FOUND: 'Session de commande introuvable. Veuillez reprendre depuis le panier.'
  }
  const code = error.code ?? ''
  const msg = error.message ?? ''
  return messages[code] ?? messages[msg] ?? (msg && msg !== code ? msg : fallback)
}

function validationMessage(input: {
  orderIds: string[]
  orders: OrderWithLines[]
  timing: Timing | ''
  paymentMethod: string
  needsProvider: boolean
  provider: PaymentProviderCode | ''
  needsPhoneNow: boolean
  payerPhone: string
  quoteReady: boolean
}) {
  if (input.orderIds.length === 0 || input.orders.length === 0 || input.orders.some(order => order.lines.length === 0)) {
    return 'Votre panier ne contient aucun article à commander.'
  }
  if (input.orders.some(({ order }) => order.delivery_method !== 'PICKUP' && (
    !order.delivery_contact_name?.trim() || !order.delivery_phone?.trim() || !order.delivery_address?.trim()
  ))) {
    return 'Veuillez renseigner une adresse de livraison valide.'
  }
  if (!input.timing) return 'Veuillez sélectionner quand vous souhaitez payer.'
  if (!input.paymentMethod) return 'Veuillez sélectionner un mode de paiement.'
  if (input.needsProvider && !input.provider) return 'Veuillez sélectionner un opérateur Mobile Money.'
  if (input.needsPhoneNow && input.payerPhone.trim().length < 9) {
    return 'Veuillez saisir le numéro Mobile Money qui sera débité.'
  }
  if (!input.quoteReady) return 'Le montant final est en cours de calcul. Veuillez réessayer.'
  return ''
}

function aggregateQuotes(quotes: CheckoutQuote[]): CheckoutQuote | null {
  if (quotes.length === 0) return null
  const first = quotes[0]
  return {
    ...first,
    order_id: first.order_id,
    currency: first.currency,
    subtotal: quotes.reduce((total, quote) => total + quote.subtotal, 0),
    discount: quotes.reduce((total, quote) => total + quote.discount, 0),
    points_discount: quotes.reduce((total, quote) => total + quote.points_discount, 0),
    delivery_fee: quotes.reduce((total, quote) => total + quote.delivery_fee, 0),
    payment_markup: quotes.reduce((total, quote) => total + quote.payment_markup, 0),
    final_total: quotes.reduce((total, quote) => total + quote.final_total, 0)
  }
}

function PaymentInner() {
  const navigate = useNavigate()
  const location = useLocation()
  const t = useT()
  const state = location.state as
    | { orderId: string; orderIds?: string[]; checkoutGroupId?: string; summary?: DeliverySelectResponse }
    | null
  const orderId = state?.orderId
  const summary = state?.summary
  // A multi-shop checkout produced one order per shop. The buyer makes one
  // payment decision; it is recorded against each order, so each shop's payment
  // keeps its own amount and Finance never has to split an ambiguous total.
  const orderIds = state?.orderIds?.length ? state.orderIds : orderId ? [orderId] : []

  const methodLabel = (m: string) => (METHOD_LABEL[m] ? t(METHOD_LABEL[m]) : m.replace(/_/g, ' '))

  const [payment, setPayment] = useState<BuyerPayment | null>(null)
  const [quotes, setQuotes] = useState<CheckoutQuote[]>([])
  const [timing, setTiming] = useState<Timing | ''>('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [provider, setProvider] = useState<PaymentProviderCode | ''>('')
  const [payerPhone, setPayerPhone] = useState('')
  const [orders, setOrders] = useState<OrderWithLines[]>([])
  const [products, setProducts] = useState<Record<string, PublicProductDetail>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [quoting, setQuoting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [initiating, setInitiating] = useState(false)
  const [instructions, setInstructions] = useState('')
  const quote = useMemo(() => aggregateQuotes(quotes), [quotes])
  const order = orders[0] ?? null
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
    // Nothing is preselected: the buyer picks the timing themselves, which is the
    // whole point of asking that question first.
    Promise.all([
      Promise.all(orderIds.map(id => buyerApi.checkoutQuote(id))),
      Promise.all(orderIds.map(id => buyerApi.orderDetail(id)))
    ]).then(
      ([loadedQuotes, loadedOrders]) => { if (mounted) { setQuotes(loadedQuotes); setOrders(loadedOrders) } },
      (e: unknown) => mounted && setError(checkoutErrorMessage(e, t('payment.couldNotPrepare')))
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
    Promise.all(orderIds.map(id => buyerApi.checkoutQuote(id, paymentMethod))).then(
      loadedQuotes => { if (mounted) { setQuotes(loadedQuotes); setError('') } },
      (e: unknown) => { if (mounted) setError(checkoutErrorMessage(e, t('payment.couldNotPrepare'))) }
    ).finally(() => { if (mounted) setQuoting(false) })
    return () => { mounted = false }
  }, [orderId, paymentMethod, loading])

  useEffect(() => {
    if (orders.length === 0) return
    const ids = [...new Set(orders.flatMap(current => current.lines.map(line => line.product_id)))]
    Promise.allSettled(ids.map(id => marketplaceApi.productDetail(id))).then(results => {
      const next: Record<string, PublicProductDetail> = {}
      results.forEach((result, index) => { if (result.status === 'fulfilled') next[ids[index]] = result.value })
      setProducts(next)
    })
  }, [orders])

  function chooseTiming(next: Timing) {
    setTiming(next)
    setProvider('')
    setInstructions('')
    const available = (quote?.payment_methods ?? []).filter(method => method.timing === next)
    // Only one method under a timing means there is nothing to choose: select it
    // and let the buyer get on with the operator step.
    setPaymentMethod(available.length === 1 ? available[0].code : '')
  }

  const needsProvider = isMobile(paymentMethod)
  // Pay-now charges the handset right here, so the number is required before the
  // order is placed. Pay-at-delivery asks for it at the door instead.
  const needsPhoneNow = paymentMethod === 'MOBILE_PAY_NOW'
  const phoneReady = !needsPhoneNow || payerPhone.trim().length >= 9
  const quoteReady = Boolean(quote?.selected_payment_method === paymentMethod) && !quoting
  const validationError = validationMessage({
    orderIds, orders, timing, paymentMethod, needsProvider, provider,
    needsPhoneNow, payerPhone, quoteReady
  })
  const readyToPlace = validationError === ''

  /**
   * Places the order with the chosen method, operator and - for pay-now - handset.
   *
   * It records how the buyer intends to pay, nothing more. Every method starts
   * DUE: cash is settled by the courier at the door and mobile money by its
   * operator, so confirming this screen can never make an order paid.
   */
  async function placeOrder() {
    if (confirming || initiating) return
    if (!orderId) {
      setError('Impossible de retrouver la commande. Veuillez reprendre le panier.')
      return
    }
    if (validationError) {
      setError(validationError)
      return
    }
    setConfirming(true)
    setError('')
    try {
      // One decision, recorded against every order this checkout produced.
      const payments = await Promise.all(
        orderIds.map(id =>
          buyerApi.createPayment(id, paymentMethod, provider || undefined, payerPhone.trim() || undefined)
        )
      )
      const created = payments.find(p => p.order_id === orderId) ?? payments[0]
      setPayment(created)

      if (paymentMethod === 'MOBILE_PAY_NOW') {
        // Stay here: the buyer still has to approve the operator's prompt, and
        // the order is not paid until the operator says so.
        await startMobilePayment()
        return
      }
      navigate(`/orders/${orderId}/success`, { state: { payment: created, orderIds }, replace: true })
    } catch (e) {
      setError(checkoutErrorMessage(e, t('payment.couldNotConfirm')))
      setConfirming(false)
    }
  }

  /** Asks the operator to charge the buyer. Only its callback can settle it. */
  async function startMobilePayment() {
    if (!orderId) return
    setInitiating(true)
    try {
      const results = await Promise.all(
        orderIds.map(id => buyerApi.initiatePayment(id, payerPhone.trim() || undefined))
      )
      setInstructions(results[0]?.instructions || 'Validez la demande sur votre téléphone.')
      const refreshed = await buyerApi.getPayment(orderId)
      setPayment(refreshed)
    } catch (e) {
      setError(checkoutErrorMessage(e, 'Le paiement n’a pas pu être lancé.'))
    } finally {
      setInitiating(false)
      setConfirming(false)
    }
  }

  // While a pay-now charge is with the operator, poll for its outcome so the
  // screen moves to "paid" by itself once the operator's confirmation lands -
  // the buyer is approving a prompt on their phone, not watching this tab.
  const pendingPaymentId = payment && payment.payment_method === 'MOBILE_PAY_NOW' && !['PAID', 'VERIFIED', 'FAILED'].includes(payment.status)
    ? payment.id
    : ''
  useEffect(() => {
    if (!pendingPaymentId || !orderId) return
    let stopped = false
    const timer = window.setInterval(async () => {
      try {
        const refreshed = await buyerApi.getPayment(orderId)
        if (stopped) return
        setPayment(refreshed)
        if (['PAID', 'VERIFIED'].includes(refreshed.status)) {
          window.clearInterval(timer)
          navigate(`/orders/${orderId}/success`, { state: { payment: refreshed, orderIds }, replace: true })
        }
      } catch { /* keep polling; a transient error is not an outcome */ }
    }, 5_000)
    return () => { stopped = true; window.clearInterval(timer) }
  }, [pendingPaymentId, orderId])

  if (loading) return <LoadingBlock label={t('payment.preparing')} />
  if (!quote)
    return <ErrorBox error={error || t('payment.noPayment')} onRetry={() => window.location.reload()} />

  const methodsForTiming = timing ? quote.payment_methods.filter(method => method.timing === timing) : []
  const providers = quote.providers ?? []

  // Once a pay-now payment has been started, the screen becomes the status of
  // that attempt rather than a form: there is nothing left to choose.
  const awaitingProvider = Boolean(payment && payment.payment_method === 'MOBILE_PAY_NOW' && !['PAID', 'VERIFIED'].includes(payment.status))

  return (
    <div className="checkout-page fade-in">
      <CheckoutProgress current="Review" />
      <header className="checkout-heading"><div><h1>{t('payment.title')}</h1><p>{t('payment.subtitle')}</p></div></header>

      {error && <ErrorBox error={error} />}

      <div className="checkout-layout">
        <div className="checkout-content stack">
          <section className="checkout-card">
            <div className="checkout-card-head"><h2>Mode de paiement</h2><span>Configuré par Finance</span></div>

            {/* Step 1 — when. */}
            <div className="stack" style={{ marginTop: 12 }}>
              {TIMING_CHOICES.map(choice => {
                const available = quote.payment_methods.some(method => method.timing === choice.timing)
                if (!available) return null
                return (
                  <label
                    className={`delivery-option payment-method-option ${timing === choice.timing ? 'selected' : ''}`}
                    key={choice.timing}
                  >
                    <input
                      type="radio"
                      name="payment_timing"
                      value={choice.timing}
                      checked={timing === choice.timing}
                      disabled={Boolean(payment)}
                      onChange={() => chooseTiming(choice.timing)}
                    />
                    <span>
                      <strong>{choice.title}</strong><br />
                      <small className="muted">{choice.hint}</small>
                    </span>
                  </label>
                )
              })}
            </div>

            {/* Step 2 — how, within that timing. Pay-now has a single mobile
                group; pay-at-delivery has cash and mobile. */}
            {timing && methodsForTiming.length > 0 && (
              <div className="stack" style={{ marginTop: 16 }}>
                <strong>{timing === 'NOW' ? 'Paiement mobile' : 'Comment payer à la livraison ?'}</strong>
                {methodsForTiming.map(method => (
                  <label
                    className={`delivery-option payment-method-option ${paymentMethod === method.code ? 'selected' : ''}`}
                    key={method.code}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value={method.code}
                      checked={paymentMethod === method.code}
                      disabled={Boolean(payment)}
                      onChange={() => { setPaymentMethod(method.code); setProvider('') }}
                    />
                    <span>
                      <strong>{METHOD_TITLE[method.code] ?? method.label}</strong><br />
                      <small className="muted">{METHOD_HINT[method.code] ?? ''}</small>
                    </span>
                    <span className="payment-method-markup">
                      {method.markup_amount > 0 ? `+ ${formatMoney(method.markup_amount, quote.currency)}` : 'Sans frais'}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {/* Step 3 — which operator. Same list and same integration for both
                mobile methods; only the moment of the charge differs. */}
            {needsProvider && (
              <div className="stack" style={{ marginTop: 16 }}>
                <strong>Choisissez votre opérateur</strong>
                {providers.length === 0 && (
                  <p className="small muted">Aucun opérateur mobile n’est disponible actuellement.</p>
                )}
                {providers.map(option => (
                  <label
                    className={`delivery-option payment-method-option ${provider === option.code ? 'selected' : ''}`}
                    key={option.code}
                  >
                    <input
                      type="radio"
                      name="payment_provider"
                      value={option.code}
                      checked={provider === option.code}
                      disabled={Boolean(payment)}
                      onChange={() => setProvider(option.code)}
                    />
                    <span><strong>{option.label}</strong></span>
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* The mobile payment checkout: operator, handset, and exactly what is
              about to be charged. */}
          {needsProvider && provider && (
            <section className="checkout-card">
              <div className="checkout-card-head">
                <h2>Paiement mobile</h2>
                <span>{providers.find(p => p.code === provider)?.label ?? provider}</span>
              </div>
              <div className="summary-lines">
                <div><span>Opérateur</span><strong>{providers.find(p => p.code === provider)?.label ?? provider}</strong></div>
                <div><span>Montant de la commande</span><strong>{formatMoney(quote.subtotal, quote.currency)}</strong></div>
                <div><span>Livraison</span><strong>{formatMoney(quote.delivery_fee, quote.currency)}</strong></div>
                {quote.points_discount > 0 && <div><span>Remise points</span><strong className="discount">−{formatMoney(quote.points_discount, quote.currency)}</strong></div>}
                <div><span>Frais du mode de paiement</span><strong>{formatMoney(quote.payment_markup, quote.currency)}</strong></div>
                <div><span>Montant final</span><strong>{formatMoney(quote.final_total, quote.currency)}</strong></div>
              </div>

              <label className="field" style={{ marginTop: 12, display: 'block' }}>
                <span>Téléphone {needsPhoneNow ? '' : '(optionnel — demandé à la livraison)'}</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={payerPhone}
                  disabled={Boolean(payment)}
                  placeholder="+243 ..."
                  onChange={(e) => setPayerPhone(e.target.value)}
                />
              </label>
              {needsPhoneNow && !phoneReady && payerPhone.trim().length > 0 && (
                <p className="small muted">Entrez le numéro qui sera débité.</p>
              )}

              {paymentMethod === 'MOBILE_AT_DELIVERY' && (
                <p className="small muted" style={{ marginTop: 8 }}>
                  Rien n’est prélevé maintenant. Le Livreur sera présent, vous vérifierez le produit,
                  puis vous lancerez le paiement. La commande n’est payée qu’une fois l’opérateur confirmé.
                </p>
              )}
            </section>
          )}

          {/* Status of a started pay-now charge. PROCESSING is the honest state:
              the operator has been asked, the buyer has not yet paid. */}
          {awaitingProvider && (
            <section className="checkout-card" role="status">
              <div className="checkout-card-head"><h2>Paiement en attente</h2><span>{payment?.status}</span></div>
              <p>{instructions || 'Validez la demande de paiement sur votre téléphone.'}</p>
              <div className="summary-lines">
                <div><span>Référence</span><strong>{payment?.internal_reference || '—'}</strong></div>
                <div><span>Montant</span><strong>{formatMoney(payment?.final_total ?? 0, payment?.currency)}</strong></div>
              </div>
              <p className="small muted">
                La commande ne sera marquée payée qu’après confirmation de l’opérateur.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Button
                  variant="outline"
                  loading={initiating}
                  onClick={async () => {
                    if (!orderId) return
                    const refreshed = await buyerApi.getPayment(orderId)
                    setPayment(refreshed)
                    if (['PAID', 'VERIFIED'].includes(refreshed.status)) {
                      navigate(`/orders/${orderId}/success`, { state: { payment: refreshed, orderIds }, replace: true })
                    }
                  }}
                >
                  Actualiser le statut
                </Button>
                <Button variant="ghost" onClick={() => navigate(`/orders/${orderId}`)}>Voir la commande</Button>
              </div>
            </section>
          )}

          <section className="checkout-card"><div className="checkout-card-head"><h2>{t('cart.products')}</h2><span>{orders.reduce((total, current) => total + current.order.total_items, 0)} {orders.reduce((total, current) => total + current.order.total_items, 0) === 1 ? t('cart.item') : t('cart.items')}</span></div>
          {orders.flatMap(current => current.lines.map(line => { const product = products[line.product_id]; const variant = product?.variants?.find(item => item.id === line.variant_id); const unitPrice = line.final_unit_price || line.unit_price; return <div className="review-order-line" key={line.id}><div><strong>{product?.name || line.product_name || t('product.fallback', { id: line.product_id.slice(0, 8) })}</strong><span>{variant?.name || line.variant_name || variant?.sku || line.variant_sku || line.variant_id.slice(0, 8)} · {t('payment.quantity', { count: line.quantity })}</span><span>Boutique : {current.shop_name || '—'} · Prix unitaire : {formatMoney(unitPrice, current.order.currency || 'USD')}</span></div><strong>{formatMoney(unitPrice * line.quantity, current.order.currency || 'USD')}</strong></div> }))}
          {orderIds.length > 1 && (
            <p className="small muted" style={{ marginTop: 8 }}>
              Ce paiement couvre {orderIds.length} commandes, une par boutique. Chaque boutique
              conserve son propre montant.
            </p>
          )}
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
        <div className="summary-lines" style={{ marginTop: 12 }}>
          <div><span>Mode de paiement</span><strong>{selectedMethod ? (METHOD_TITLE[selectedMethod.code] ?? selectedMethod.label) : '—'}</strong></div>
          <div><span>Opérateur</span><strong>{needsProvider ? (providers.find(item => item.code === provider)?.label ?? '—') : 'Non applicable'}</strong></div>
          <div><span>Devise</span><strong>{quote.currency}</strong></div>
        </div>
        <div className="pay-note">
          {!timing
            ? 'Choisissez d’abord quand vous souhaitez payer.'
            : selectedMethod?.timing === 'NOW'
            ? 'Vous validerez la demande chez votre opérateur. La commande est payée une fois que l’opérateur le confirme.'
            : 'Aucun montant n’est prélevé maintenant : ce total est dû à la livraison.'}
        </div>
        {validationError && <p className="checkout-inline-error" role="alert" style={{ marginTop: 12 }}>{validationError}</p>}
        <Button
          variant="accent"
          size="lg"
          block
          onClick={placeOrder}
          loading={confirming || initiating}
          disabled={!readyToPlace || Boolean(payment) || confirming || initiating}
        >
          {confirming || initiating
            ? 'Création de la commande...'
            : payment
            ? t('payment.orderConfirmed')
            : paymentMethod === 'MOBILE_PAY_NOW'
            ? 'Payer maintenant'
            : t('payment.placeOrder')}
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
