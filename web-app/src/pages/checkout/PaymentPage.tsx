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
import { translate, useT } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'
import { WarningIcon } from '@/components/ui/Icons'
import { useOrderEvents } from '@/lib/orderEvents'

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

const TIMING_CHOICES: { timing: Timing; title: TranslationKey; hint: TranslationKey }[] = [
  {
    timing: 'NOW',
    title: 'checkoutPaymentPage.timingNowTitle' as TranslationKey,
    hint: 'checkoutPaymentPage.timingNowHint' as TranslationKey
  },
  {
    timing: 'DELIVERY',
    title: 'checkoutPaymentPage.timingDeliveryTitle' as TranslationKey,
    hint: 'checkoutPaymentPage.timingDeliveryHint' as TranslationKey
  }
]

const METHOD_HINT: Record<string, TranslationKey> = {
  CASH_ON_DELIVERY: 'checkoutPaymentPage.hintCash' as TranslationKey,
  MOBILE_AT_DELIVERY: 'checkoutPaymentPage.hintMobileAtDelivery' as TranslationKey,
  MOBILE_PAY_NOW: 'checkoutPaymentPage.hintMobilePayNow' as TranslationKey
}

/** The label a method carries in the grouped UI, where its timing is already known. */
const METHOD_TITLE: Record<string, TranslationKey> = {
  CASH_ON_DELIVERY: 'checkoutPaymentPage.titleCash' as TranslationKey,
  MOBILE_AT_DELIVERY: 'checkoutPaymentPage.titleMobileAtDelivery' as TranslationKey,
  MOBILE_PAY_NOW: 'checkoutPaymentPage.titleMobilePayNow' as TranslationKey
}

function isMobile(code: string) {
  return code === 'MOBILE_PAY_NOW' || code === 'MOBILE_AT_DELIVERY'
}

function checkoutErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback
  const messages: Record<string, TranslationKey> = {
    PAYMENT_PROVIDER_REQUIRED: 'checkoutPaymentPage.errProviderRequired' as TranslationKey,
    PAYMENT_PROVIDER_NOT_CONFIGURED: 'checkoutPaymentPage.errProviderNotConfigured' as TranslationKey,
    PAYMENT_PROVIDER_UNKNOWN: 'checkoutPaymentPage.errProviderUnknown' as TranslationKey,
    PAYMENT_PROVIDER_UNAVAILABLE: 'checkoutPaymentPage.errProviderUnavailable' as TranslationKey,
    PAYMENT_METHOD_UNAVAILABLE: 'checkoutPaymentPage.errMethodUnavailable' as TranslationKey,
    DELIVERY_NOT_SELECTED: 'checkoutPaymentPage.errDeliveryNotSelected' as TranslationKey,
    DELIVERY_DETAILS_INCOMPLETE: 'checkoutPaymentPage.errDeliveryIncomplete' as TranslationKey,
    PAYER_PHONE_REQUIRED: 'checkoutPaymentPage.errPayerPhoneRequired' as TranslationKey,
    PAYMENT_ALREADY_SELECTED: 'checkoutPaymentPage.errAlreadySelected' as TranslationKey,
    PAYMENT_ALREADY_CREATED: 'checkoutPaymentPage.errAlreadyCreated' as TranslationKey,
    PAYMENT_ALREADY_SETTLED: 'checkoutPaymentPage.errAlreadySettled' as TranslationKey,
    PAYMENT_IN_PROGRESS: 'checkoutPaymentPage.errInProgress' as TranslationKey,
    PAYMENT_STATE_CHANGED: 'checkoutPaymentPage.errStateChanged' as TranslationKey,
    PAYMENT_NOT_FOUND: 'checkoutPaymentPage.errPaymentNotFound' as TranslationKey,
    PAYMENT_NOT_CONFIGURED: 'checkoutPaymentPage.errPaymentNotConfigured' as TranslationKey,
    PAYMENT_CLOSED: 'checkoutPaymentPage.errPaymentClosed' as TranslationKey,
    AMOUNT_MISMATCH: 'checkoutPaymentPage.errAmountMismatch' as TranslationKey,
    INVALID_STATE: 'checkoutPaymentPage.errInvalidState' as TranslationKey,
    INVALID_STATE_TRANSITION: 'checkoutPaymentPage.errInvalidState' as TranslationKey,
    ORDER_NOT_FOUND: 'checkoutPaymentPage.errOrderNotFound' as TranslationKey,
    ORDER_CANCELLED: 'checkoutPaymentPage.errOrderCancelled' as TranslationKey,
    ORDER_COMPLETED: 'checkoutPaymentPage.errOrderCompleted' as TranslationKey,
    CHECKOUT_GROUP_NOT_FOUND: 'checkoutPaymentPage.errCheckoutGroupNotFound' as TranslationKey
  }
  const code = error.code ?? ''
  const msg = error.message ?? ''
  const key = messages[code] ?? messages[msg]
  return key ? translate(key) : (msg && msg !== code ? msg : fallback)
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
    return translate('checkoutPaymentPage.valEmptyCart')
  }
  if (input.orders.some(({ order }) => order.delivery_method !== 'PICKUP' && (
    !order.delivery_contact_name?.trim() || !order.delivery_phone?.trim() || !order.delivery_address?.trim()
  ))) {
    return translate('checkoutPaymentPage.errDeliveryIncomplete')
  }
  if (!input.timing) return translate('checkoutPaymentPage.valTiming')
  if (!input.paymentMethod) return translate('checkoutPaymentPage.valMethod')
  if (input.needsProvider && !input.provider) return translate('checkoutPaymentPage.errProviderRequired')
  if (input.needsPhoneNow && input.payerPhone.trim().length < 9) {
    return translate('checkoutPaymentPage.errPayerPhoneRequired')
  }
  if (!input.quoteReady) return translate('checkoutPaymentPage.valQuoteNotReady')
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
  const [quoteChangedAlert, setQuoteChangedAlert] = useState('')

  const quote = useMemo(() => aggregateQuotes(quotes), [quotes])
  const order = orders[0] ?? null
  const selectedMethod = quote?.payment_methods.find(method => method.code === paymentMethod)

  // Track quote total changes for stale quote protection
  const lastTotal = quote?.final_total

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
    Promise.all([
      Promise.all(orderIds.map(id => buyerApi.checkoutQuote(id))),
      Promise.all(orderIds.map(id => buyerApi.orderDetail(id)))
    ]).then(
      ([loadedQuotes, loadedOrders]) => {
        if (mounted) {
          setQuotes(loadedQuotes)
          setOrders(loadedOrders)
        }
      },
      (e: unknown) => mounted && setError(checkoutErrorMessage(e, t('payment.couldNotPrepare')))
    ).finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [orderId, navigate])

  // Re-quote when method changes
  useEffect(() => {
    if (!orderId || !paymentMethod || loading) return
    let mounted = true
    setQuoting(true)
    Promise.all(orderIds.map(id => buyerApi.checkoutQuote(id, paymentMethod))).then(
      loadedQuotes => {
        if (mounted) {
          const newAgg = aggregateQuotes(loadedQuotes)
          if (lastTotal != null && newAgg?.final_total !== lastTotal) {
            setQuoteChangedAlert(t('checkoutPaymentPage.alertAmountUpdated'))
          }
          setQuotes(loadedQuotes)
          setError('')
        }
      },
      (e: unknown) => { if (mounted) setError(checkoutErrorMessage(e, t('payment.couldNotPrepare'))) }
    ).finally(() => { if (mounted) setQuoting(false) })
    return () => { mounted = false }
  }, [orderId, paymentMethod, loading])

  // Finance can change the TBK tariff while the buyer is here: the server
  // reprices unpaid orders and pushes the change, so the quote follows live.
  useOrderEvents((event) => {
    if (event.kind === 'order' && event.order_id && !orderIds.includes(event.order_id)) return
    if (loading || confirming || initiating) return
    Promise.all([
      Promise.all(orderIds.map(id => buyerApi.checkoutQuote(id, paymentMethod || undefined))),
      Promise.all(orderIds.map(id => buyerApi.orderDetail(id)))
    ]).then(([loadedQuotes, loadedOrders]) => {
      const next = aggregateQuotes(loadedQuotes)
      if (quote && next && next.delivery_fee !== quote.delivery_fee) {
        setQuoteChangedAlert(t('checkoutPaymentPage.alertDeliveryFeeUpdated', { amount: formatMoney(next.delivery_fee, next.currency) }))
      }
      setQuotes(loadedQuotes)
      setOrders(loadedOrders)
    }).catch(() => undefined)
  })

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
    setQuoteChangedAlert('')
    const available = (quote?.payment_methods ?? []).filter(method => method.timing === next)
    setPaymentMethod(available.length === 1 ? available[0].code : '')
  }

  const needsProvider = isMobile(paymentMethod)
  const needsPhoneNow = paymentMethod === 'MOBILE_PAY_NOW'
  const phoneReady = !needsPhoneNow || payerPhone.trim().length >= 9
  const quoteReady = Boolean(quote?.selected_payment_method === paymentMethod) && !quoting
  const validationError = validationMessage({
    orderIds, orders, timing, paymentMethod, needsProvider, provider,
    needsPhoneNow, payerPhone, quoteReady
  })
  const readyToPlace = validationError === ''

  async function placeOrder() {
    if (confirming || initiating) return
    if (!orderId) {
      setError(t('checkoutPaymentPage.orderMissing'))
      return
    }
    if (validationError) {
      setError(validationError)
      return
    }
    setConfirming(true)
    setError('')
    setQuoteChangedAlert('')
    try {
      const payments = await Promise.all(
        orderIds.map(id =>
          buyerApi.createPayment(id, paymentMethod, provider || undefined, payerPhone.trim() || undefined)
        )
      )
      const created = payments.find(p => p.order_id === orderId) ?? payments[0]
      setPayment(created)

      if (paymentMethod === 'MOBILE_PAY_NOW') {
        setInitiating(true)
        try {
          await Promise.all(
            orderIds.map(id => buyerApi.initiatePayment(id, payerPhone.trim() || undefined))
          )
          const refreshed = await buyerApi.getPayment(orderId)
          navigate(`/orders/${orderId}/success`, { state: { payment: refreshed, orderIds, checkoutGroupId: state?.checkoutGroupId }, replace: true })
        } catch (initErr) {
          // If initiate fails, still navigate to Step 4 so buyer can view order and retry status
          const refreshed = await buyerApi.getPayment(orderId).catch(() => created)
          navigate(`/orders/${orderId}/success`, { state: { payment: refreshed, orderIds, checkoutGroupId: state?.checkoutGroupId, error: checkoutErrorMessage(initErr, t('checkoutPaymentPage.initiateFailed')) }, replace: true })
        } finally {
          setInitiating(false)
          setConfirming(false)
        }
        return
      }

      // For CASH_ON_DELIVERY and MOBILE_AT_DELIVERY, navigate immediately to Step 4 Order Success
      navigate(`/orders/${orderId}/success`, { state: { payment: created, orderIds, checkoutGroupId: state?.checkoutGroupId }, replace: true })
    } catch (e) {
      setError(checkoutErrorMessage(e, t('payment.couldNotConfirm')))
      setConfirming(false)
    }
  }

  if (loading) return <LoadingBlock label={t('payment.preparing')} />
  if (!quote)
    return <ErrorBox error={error || t('payment.noPayment')} onRetry={() => window.location.reload()} />

  const methodsForTiming = timing ? quote.payment_methods.filter(method => method.timing === timing) : []
  const providers = quote.providers ?? []

  // Dynamic button label according to server & client state
  let ctaLabel = t('checkoutPaymentPage.ctaConfirm')
  if (confirming || initiating) {
    ctaLabel = t('checkoutPaymentPage.ctaCreating')
  } else if (payment) {
    if (['PAID', 'VERIFIED'].includes(payment.status)) {
      ctaLabel = t('checkoutPaymentPage.ctaViewOrder')
    } else if (['PROCESSING', 'PENDING'].includes(payment.status) && payment.payment_method === 'MOBILE_PAY_NOW') {
      ctaLabel = t('checkoutPaymentPage.ctaProcessing')
    } else {
      ctaLabel = t('checkoutPaymentPage.ctaConfirmed')
    }
  } else if (paymentMethod === 'MOBILE_PAY_NOW') {
    ctaLabel = t('checkoutPaymentPage.timingNowTitle')
  }

  return (
    <div className="checkout-page fade-in">
      <CheckoutProgress current="Review" />
      <header className="checkout-heading">
        <div>
          <h1>{t('payment.title')}</h1>
          <p>{t('payment.subtitle')}</p>
        </div>
      </header>

      {error && <ErrorBox error={error} />}
      {quoteChangedAlert && (
        <div className="checkout-inline-error" role="alert">
          <span><WarningIcon className="inline-icon" /> {quoteChangedAlert}</span>
        </div>
      )}

      <div className="checkout-layout">
        <div className="checkout-content stack">
          {/* SINGLE UNIFIED PAYMENT CARD */}
          <section className="checkout-card">
            <div className="checkout-card-head">
              <h2>{t('checkoutPaymentPage.methodHeading')}</h2>
              <span>{t('checkoutPaymentPage.secureSelection')}</span>
            </div>

            {/* Step 1 — Timing */}
            <div className="stack" style={{ marginTop: 16 }}>
              <strong>1. {t('checkoutPaymentPage.stepWhen')}</strong>
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
                      <strong>{t(choice.title)}</strong><br />
                      <small className="muted">{t(choice.hint)}</small>
                    </span>
                  </label>
                )
              })}
            </div>

            {/* Step 2 — Method */}
            {timing && methodsForTiming.length > 0 && (
              <div className="stack" style={{ marginTop: 20 }}>
                <strong>2. {timing === 'NOW' ? t('checkoutPaymentPage.stepMethodNow') : t('checkoutPaymentPage.stepMethodDelivery')}</strong>
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
                      onChange={() => { setPaymentMethod(method.code); setProvider(''); setQuoteChangedAlert('') }}
                    />
                    <span>
                      <strong>{METHOD_TITLE[method.code] ? t(METHOD_TITLE[method.code]) : method.label}</strong><br />
                      <small className="muted">{METHOD_HINT[method.code] ? t(METHOD_HINT[method.code]) : ''}</small>
                    </span>
                    <span className="payment-method-markup">
                      {method.markup_amount > 0 ? `+ ${formatMoney(method.markup_amount, quote.currency)}` : t('checkoutPaymentPage.noFee')}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {/* Step 3 — Operator */}
            {needsProvider && (
              <div className="stack" style={{ marginTop: 20 }}>
                <strong>3. {t('checkoutPaymentPage.stepOperator')}</strong>
                {providers.length === 0 && (
                  <p className="small muted">{t('checkoutPaymentPage.noOperators')}</p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  {providers.map(option => (
                    <label
                      className={`delivery-option payment-method-option ${provider === option.code ? 'selected' : ''}`}
                      key={option.code}
                      style={{ padding: 12, textAlign: 'center' }}
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
              </div>
            )}

            {/* Step 4 — Handset Phone (if needed) */}
            {needsProvider && provider && (
              <div className="stack" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
                <strong>4. {t('checkoutPaymentPage.stepPhone')}</strong>
                <label className="field" style={{ display: 'block' }}>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    {needsPhoneNow ? t('checkoutPaymentPage.phoneNowLabel') : t('checkoutPaymentPage.phoneDeliveryLabel')}
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={payerPhone}
                    disabled={Boolean(payment)}
                    placeholder="+243 ..."
                    onChange={(e) => setPayerPhone(e.target.value)}
                    style={{ width: '100%', marginTop: 6 }}
                  />
                </label>
                {needsPhoneNow && !phoneReady && (
                  <p className="small muted" style={{ color: 'var(--color-warning)' }}>
                    {t('checkoutPaymentPage.phoneTooShort')}
                  </p>
                )}
                {paymentMethod === 'MOBILE_AT_DELIVERY' && (
                  <p className="small muted" style={{ marginTop: 6 }}>
                    {t('checkoutPaymentPage.mobileAtDeliveryNote')}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* PRODUCTS LIST RECAP */}
          <section className="checkout-card">
            <div className="checkout-card-head">
              <h2>{t('cart.products')}</h2>
              <span>
                {orders.reduce((total, current) => total + current.order.total_items, 0)}{' '}
                {orders.reduce((total, current) => total + current.order.total_items, 0) === 1 ? t('cart.item') : t('cart.items')}
              </span>
            </div>
            {orders.flatMap(current =>
              current.lines.map(line => {
                const product = products[line.product_id]
                const variant = product?.variants?.find(item => item.id === line.variant_id)
                const unitPrice = line.final_unit_price || line.unit_price
                return (
                  <div className="review-order-line" key={line.id}>
                    <div>
                      <strong>{product?.name || line.product_name || t('product.fallback', { id: line.product_id.slice(0, 8) })}</strong>
                      <span>{variant?.name || line.variant_name || variant?.sku || line.variant_sku || line.variant_id.slice(0, 8)} · {t('payment.quantity', { count: line.quantity })}</span>
                      <span>{t('checkoutPaymentPage.shopAndUnitPrice', { shop: current.shop_name || '—', price: formatMoney(unitPrice, current.order.currency || 'USD') })}</span>
                    </div>
                    <strong>{formatMoney(unitPrice * line.quantity, current.order.currency || 'USD')}</strong>
                  </div>
                )
              })
            )}
            {orderIds.length > 1 && (
              <p className="small muted" style={{ marginTop: 10 }}>
                {t('checkoutPaymentPage.coversOrders', { count: orderIds.length })}
              </p>
            )}
          </section>

          {/* DELIVERY ADDRESS RECAP */}
          {summary && (
            <section className="checkout-card">
              <div className="checkout-card-head">
                <h2>{t('product.delivery')}</h2>
                <span>{methodLabel(summary.delivery.method)}</span>
              </div>
              {deliveryCommune && (
                <dl className="address-summary">
                  <div><dt>{t('checkoutPaymentPage.province')}</dt><dd>{deliveryProvince}</dd></div>
                  <div><dt>{t('checkoutPaymentPage.city')}</dt><dd>{deliveryCity}</dd></div>
                  <div><dt>{t('checkoutPaymentPage.commune')}</dt><dd>{deliveryCommune}</dd></div>
                  <div><dt>{t('checkoutPaymentPage.address')}</dt><dd>{deliveryStreet}</dd></div>
                  <div><dt>{t('checkoutPaymentPage.number')}</dt><dd>{deliveryBuildingNumber}</dd></div>
                  {deliveryLandmark && <div><dt>{t('checkoutPaymentPage.instructions')}</dt><dd>{deliveryLandmark}</dd></div>}
                </dl>
              )}
              <div className="total-row" style={{ marginTop: 10 }}>
                <span>{t('checkoutPaymentPage.deliveryFee')}</span>
                <span>{formatMoney(summary.delivery.fee_final)}</span>
              </div>
            </section>
          )}
        </div>

        {/* STICKY SUMMARY COLUMN */}
        <aside className="checkout-card checkout-summary">
          <span className="eyebrow">{t('payment.finalSummary')}</span>
          <div className="summary-lines">
            <div><span>{t('cart.products')}</span><strong>{formatMoney(quote.subtotal, quote.currency)}</strong></div>
            {quote.points_discount > 0 && (
              <div><span>{t('payment.productPoints')}</span><strong className="discount">−{formatMoney(quote.points_discount, quote.currency)}</strong></div>
            )}
            <div><span>{t('product.delivery')}</span><strong>{formatMoney(quote.delivery_fee, quote.currency)}</strong></div>
            <div>
              <span>{t('checkoutPaymentPage.paymentMethodFee')}</span>
              <strong>{formatMoney(quote.payment_markup, quote.currency)}</strong>
            </div>
          </div>

          <div className="summary-total">
            <span>{t('checkoutPaymentPage.finalTotal')}</span>
            <strong>{formatMoney(quote.final_total, quote.currency)}</strong>
            <small>{quoting ? t('checkoutPaymentPage.recalculating') : t('checkoutPaymentPage.serverTotal')}</small>
          </div>

          <div className="summary-lines" style={{ marginTop: 12 }}>
            <div><span>{t('checkoutPaymentPage.timing')}</span><strong>{timing === 'NOW' ? t('checkoutPaymentPage.timingNow') : timing === 'DELIVERY' ? t('checkoutPaymentPage.timingDelivery') : '—'}</strong></div>
            <div><span>{t('checkoutPaymentPage.method')}</span><strong>{selectedMethod ? (METHOD_TITLE[selectedMethod.code] ? t(METHOD_TITLE[selectedMethod.code]) : selectedMethod.label) : '—'}</strong></div>
            <div><span>{t('checkoutPaymentPage.operator')}</span><strong>{needsProvider ? (providers.find(item => item.code === provider)?.label ?? '—') : t('checkoutPaymentPage.notApplicable')}</strong></div>
          </div>

          <div className="pay-note">
            {!timing
              ? t('checkoutPaymentPage.noteChooseTiming')
              : selectedMethod?.timing === 'NOW'
              ? t('checkoutPaymentPage.noteNow')
              : t('checkoutPaymentPage.noteDelivery')}
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
            {ctaLabel}
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
