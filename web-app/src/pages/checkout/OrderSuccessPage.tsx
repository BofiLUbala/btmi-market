import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import type { BuyerPayment, OrderWithLines } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { LoadingBlock, ErrorBox } from '@/components/ui/Feedback'
import { formatMoney } from '@/lib/format'
import { useT } from '@/store/i18n'
import { RequireAuth } from '@/components/auth/Guards'
import { CheckoutProgress } from '@/components/checkout/CheckoutProgress'
import { CheckIcon, ClockIcon, InfoIcon, PinIcon } from '@/components/ui/Icons'

const PROVIDER_NAMES: Record<string, string> = {
  MPESA: 'M-Pesa',
  AIRTEL_MONEY: 'Airtel Money',
  ORANGE_MONEY: 'Orange Money'
}

function SuccessInner() {
  const { orderId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const t = useT()

  const statePayload = location.state as {
    payment?: BuyerPayment
    orderIds?: string[]
    checkoutGroupId?: string
    error?: string
  } | null

  const [order, setOrder] = useState<OrderWithLines | null>(null)
  const [payment, setPayment] = useState<BuyerPayment | null>(statePayload?.payment ?? null)
  const [groupOrders, setGroupOrders] = useState<OrderWithLines[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingPayment, setRefreshingPayment] = useState(false)
  const [error, setError] = useState(statePayload?.error ?? '')

  // Load primary order + payment + group orders
  const loadData = useCallback(async () => {
    if (!orderId) return
    setError('')
    try {
      const [ord, pay] = await Promise.all([
        buyerApi.orderDetail(orderId),
        buyerApi.getPayment(orderId).catch(() => null)
      ])
      setOrder(ord)
      if (pay) setPayment(pay)

      // Check for multi-shop checkout group orders
      const groupId = ord.order.checkout_group_id || statePayload?.checkoutGroupId
      if (groupId) {
        try {
          const allOrders = await buyerApi.orders()
          const siblings = allOrders.filter(o => o.checkout_group_id === groupId)
          if (siblings.length > 1) {
            const siblingDetails = await Promise.all(
              siblings.map(s => buyerApi.orderDetail(s.id).catch(() => null))
            )
            setGroupOrders(siblingDetails.filter((o): o is OrderWithLines => o !== null))
          }
        } catch {
          /* optional multi-shop fallback */
        }
      }
    } catch (e) {
      setError(t('checkoutOrderSuccessPage.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [orderId, statePayload?.checkoutGroupId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Polling for MOBILE_PAY_NOW while payment is PROCESSING or PENDING
  const isPayNowProcessing = Boolean(
    payment &&
    payment.payment_method === 'MOBILE_PAY_NOW' &&
    ['PROCESSING', 'PENDING'].includes(payment.status)
  )

  const refreshPaymentStatus = async () => {
    if (!orderId) return
    setRefreshingPayment(true)
    try {
      const refreshed = await buyerApi.getPayment(orderId)
      setPayment(refreshed)
      if (['PAID', 'VERIFIED'].includes(refreshed.status)) {
        setError('')
      }
    } catch {
      /* ignore transient refresh error */
    } finally {
      setRefreshingPayment(false)
    }
  }

  useEffect(() => {
    if (!isPayNowProcessing || !orderId) return
    let stopped = false
    const timer = window.setInterval(async () => {
      try {
        const refreshed = await buyerApi.getPayment(orderId)
        if (stopped) return
        setPayment(refreshed)
        if (['PAID', 'VERIFIED'].includes(refreshed.status)) {
          window.clearInterval(timer)
        }
      } catch {
        /* poll silently */
      }
    }, 5_000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [isPayNowProcessing, orderId])

  if (!orderId) {
    navigate('/cart', { replace: true })
    return null
  }

  if (loading) return <LoadingBlock label={t('payment.confirmingOrder')} />
  if (!order) return <ErrorBox error={error || t('checkoutOrderSuccessPage.notFound')} onRetry={loadData} />

  const isMultiShop = groupOrders.length > 1
  const displayOrders = isMultiShop ? groupOrders : [order]

  // Totals calculations
  const currency = payment?.currency || order.order.currency || 'USD'
  const finalTotal = isMultiShop
    ? groupOrders.reduce((sum, item) => sum + item.order.final_total + item.order.delivery_fee_final, 0)
    : (payment?.final_total ?? order.order.final_total + order.order.delivery_fee_final)

  const providerName = payment?.provider
    ? PROVIDER_NAMES[payment.provider] || payment.provider
    : ''

  const isPaid = payment ? ['PAID', 'VERIFIED'].includes(payment.status) : false
  const isCash = payment?.payment_method === 'CASH_ON_DELIVERY' || (!payment && order.order.payment_method === 'CASH_ON_DELIVERY')
  const isMobileDelivery = payment?.payment_method === 'MOBILE_AT_DELIVERY'

  // Headline & Subtitle per state
  let statusHeadline = t('checkoutOrderSuccessPage.headlineConfirmed')
  let statusSubtext = t('checkoutOrderSuccessPage.subtextConfirmed')

  if (payment?.payment_method === 'MOBILE_PAY_NOW') {
    if (isPaid) {
      statusHeadline = t('checkoutOrderSuccessPage.headlinePaid')
      statusSubtext = t('checkoutOrderSuccessPage.subtextPaid', { provider: providerName || 'Mobile Money' })
    } else if (isPayNowProcessing) {
      statusHeadline = t('checkoutOrderSuccessPage.headlineProcessing')
      statusSubtext = t('checkoutOrderSuccessPage.subtextProcessing')
    } else if (payment.status === 'FAILED') {
      statusHeadline = t('checkoutOrderSuccessPage.headlineFailed')
      statusSubtext = t('checkoutOrderSuccessPage.subtextFailed')
    }
  } else if (isCash) {
    statusHeadline = t('checkoutOrderSuccessPage.headlineCash')
    statusSubtext = t('checkoutOrderSuccessPage.subtextCash')
  } else if (isMobileDelivery) {
    statusHeadline = t('checkoutOrderSuccessPage.headlineMobileDelivery')
    statusSubtext = t('checkoutOrderSuccessPage.subtextMobileDelivery', { provider: providerName || 'Mobile Money' })
  }

  const deliveryAddress = [
    order.order.delivery_building_number,
    order.order.delivery_street,
    order.order.delivery_commune,
    order.order.delivery_city,
    order.order.delivery_province
  ].filter(Boolean).join(', ')

  return (
    <div className="checkout-page fade-in" style={{ maxWidth: 1140, margin: '0 auto', width: '100%' }}>
      {/* STEP 4 CHECKOUT PROGRESS */}
      <CheckoutProgress current="Order" />

      {error && <ErrorBox error={error} />}

      <div className="checkout-layout">
        <div className="checkout-content stack">
          {/* STEP 4 MAIN STATUS CARD */}
          <section className="checkout-card" style={{ padding: '28px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div className="checkout-success-mark" style={{ width: 56, height: 56, fontSize: '1.6rem', flexShrink: 0 }}>
                {isPayNowProcessing ? <ClockIcon className="empty-svg" /> : isPaid || isCash || isMobileDelivery ? <CheckIcon className="empty-svg" /> : <InfoIcon className="empty-svg" />}
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.4rem' }}>{statusHeadline}</h1>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.92rem' }}>{statusSubtext}</p>
              </div>
            </div>

            {/* Mobile Pay Now Processing Banner & Controls */}
            {isPayNowProcessing && (
              <div className="stack" style={{ marginTop: 16, padding: 16, borderRadius: 12, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                <div className="summary-lines">
                  <div><span>{t('checkoutOrderSuccessPage.operator')}</span><strong>{providerName || 'Mobile Money'}</strong></div>
                  <div><span>{t('checkoutOrderSuccessPage.reference')}</span><strong>{payment?.internal_reference || '—'}</strong></div>
                  <div><span>{t('checkoutOrderSuccessPage.amountToApprove')}</span><strong>{formatMoney(payment?.final_total ?? finalTotal, currency)}</strong></div>
                  <div><span>{t('checkoutOrderSuccessPage.paymentStatus')}</span><strong style={{ color: 'var(--color-warning)' }}>{t('checkoutOrderSuccessPage.paymentInProgress')}</strong></div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <Button
                    variant="accent"
                    loading={refreshingPayment}
                    onClick={() => void refreshPaymentStatus()}
                  >
                    {t('checkoutOrderSuccessPage.refreshStatus')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/checkout/payment`, { state: { orderId, orderIds: statePayload?.orderIds }, replace: true })}
                  >
                    {t('checkoutOrderSuccessPage.changeMethod')}
                  </Button>
                </div>
              </div>
            )}

            {/* Mobile Pay Now Paid Details */}
            {isPaid && payment?.payment_method === 'MOBILE_PAY_NOW' && (
              <div className="summary-lines" style={{ marginTop: 16, padding: 14, borderRadius: 10, background: 'var(--color-surface-2)' }}>
                <div><span>{t('checkoutOrderSuccessPage.operator')}</span><strong>{providerName}</strong></div>
                <div><span>{t('checkoutOrderSuccessPage.transactionReference')}</span><strong>{payment?.internal_reference || '—'}</strong></div>
                <div><span>{t('checkoutOrderSuccessPage.amountPaid')}</span><strong>{formatMoney(payment?.final_total ?? finalTotal, currency)}</strong></div>
                <div><span>{t('checkoutOrderSuccessPage.confirmation')}</span><strong style={{ color: 'var(--color-success)' }}>✓ {t('checkoutOrderSuccessPage.paidAndVerified')}</strong></div>
              </div>
            )}
          </section>

          {/* MULTI-SHOP BREAKDOWN OR SINGLE ORDER BREAKDOWN */}
          <section className="checkout-card">
            <div className="checkout-card-head">
              <h2>{isMultiShop ? t('checkoutOrderSuccessPage.groupTitle') : t('checkoutOrderSuccessPage.orderNumber', { number: order.order.order_number || order.order.id.slice(0, 8) })}</h2>
              <span>{isMultiShop ? t('checkoutOrderSuccessPage.shopOrdersCount', { count: displayOrders.length }) : order.shop_name || t('checkoutOrderSuccessPage.shop')}</span>
            </div>

            {displayOrders.map((ordDetail, idx) => (
              <div key={ordDetail.order.id} style={{ marginTop: idx > 0 ? 20 : 12, paddingTop: idx > 0 ? 16 : 0, borderTop: idx > 0 ? '1px dashed var(--color-border)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <strong>{t('checkoutOrderSuccessPage.orderFromShop', { number: ordDetail.order.order_number || ordDetail.order.id.slice(0, 8), shop: ordDetail.shop_name || t('checkoutOrderSuccessPage.shop') })}</strong>
                  {/* One shop: the order is the whole payment, so show what the buyer pays,
                      payment fee included - the same figure as the final total. */}
                  <span className="small muted">{formatMoney(isMultiShop ? ordDetail.order.final_total + ordDetail.order.delivery_fee_final : finalTotal, ordDetail.order.currency || 'USD')}</span>
                </div>
                {ordDetail.lines.map(line => (
                  <div className="review-order-line" key={line.id}>
                    <div>
                      <strong>{line.product_name || t('checkoutOrderSuccessPage.productNumber', { id: line.product_id.slice(0, 8) })}</strong>
                      <span>{t('checkoutOrderSuccessPage.variantQty', { variant: line.variant_name || line.variant_sku || t('checkoutOrderSuccessPage.standard'), quantity: line.quantity })}</span>
                      <span>{t('checkoutOrderSuccessPage.unitPrice', { price: formatMoney(line.final_unit_price || line.unit_price, ordDetail.order.currency || 'USD') })}</span>
                    </div>
                    <strong>{formatMoney((line.final_unit_price || line.unit_price) * line.quantity, ordDetail.order.currency || 'USD')}</strong>
                  </div>
                ))}
              </div>
            ))}
          </section>

          {/* DELIVERY RECAP */}
          <section className="checkout-card">
            <div className="checkout-card-head">
              <h2>{t('checkoutOrderSuccessPage.deliveryAddress')}</h2>
              <span>{order.order.delivery_method === 'PICKUP' ? t('checkoutOrderSuccessPage.pickup') : t('checkoutOrderSuccessPage.homeDelivery')}</span>
            </div>
            {deliveryAddress ? (
              <p style={{ margin: '10px 0 0', fontSize: '0.95rem', lineHeight: 1.5 }}>
                <PinIcon className="inline-icon" /> {deliveryAddress}
                {order.order.delivery_landmark && (
                  <span className="muted" style={{ display: 'block', marginTop: 4 }}>
                    {t('checkoutOrderSuccessPage.instructions', { text: order.order.delivery_landmark })}
                  </span>
                )}
              </p>
            ) : (
              <p className="muted" style={{ marginTop: 8 }}>{t('checkoutOrderSuccessPage.deliveryChosenEarlier')}</p>
            )}
          </section>
        </div>

        {/* STICKY FINAL SUMMARY */}
        <aside className="checkout-card checkout-summary">
          <span className="eyebrow">{t('checkoutOrderSuccessPage.finalSummary')}</span>

          <div className="summary-lines">
            <div>
              <span>{t('checkoutOrderSuccessPage.productsSubtotal')}</span>
              <strong>{formatMoney(displayOrders.reduce((sum, o) => sum + o.order.base_total, 0), currency)}</strong>
            </div>
            {displayOrders.some(o => o.order.points_discount_amount > 0) && (
              <div>
                <span>{t('checkoutOrderSuccessPage.pointsDiscount')}</span>
                <strong className="discount">−{formatMoney(displayOrders.reduce((sum, o) => sum + o.order.points_discount_amount, 0), currency)}</strong>
              </div>
            )}
            <div>
              <span>{t('checkoutOrderSuccessPage.deliveryFee')}</span>
              <strong>{formatMoney(displayOrders.reduce((sum, o) => sum + o.order.delivery_fee_final, 0), currency)}</strong>
            </div>
            {payment?.payment_markup ? (
              <div>
                <span>{t('checkoutOrderSuccessPage.paymentFee')}</span>
                <strong>{formatMoney(payment.payment_markup, currency)}</strong>
              </div>
            ) : null}
          </div>

          <div className="summary-total">
            <span>{t('checkoutOrderSuccessPage.grandTotal')}</span>
            <strong>{formatMoney(finalTotal, currency)}</strong>
            <small>{t('checkoutOrderSuccessPage.paymentRecorded')}</small>
          </div>

          <div className="summary-lines" style={{ marginTop: 14 }}>
            <div>
              <span>{t('checkoutOrderSuccessPage.method')}</span>
              <strong>{isCash ? t('checkoutOrderSuccessPage.methodCash') : isMobileDelivery ? t('checkoutOrderSuccessPage.methodMobileDelivery') : t('checkoutOrderSuccessPage.methodMobile')}</strong>
            </div>
            {providerName && (
              <div><span>{t('checkoutOrderSuccessPage.operator')}</span><strong>{providerName}</strong></div>
            )}
            <div>
              <span>{t('common.status')}</span>
              <strong style={{ color: isPaid ? 'var(--color-success)' : isPayNowProcessing ? 'var(--color-warning)' : 'var(--color-text)' }}>
                {isPaid ? t('checkoutOrderSuccessPage.statusPaid') : isPayNowProcessing ? t('checkoutOrderSuccessPage.statusInProgress') : t('checkoutOrderSuccessPage.statusToPay')}
              </strong>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            <Link to={`/orders/${orderId}/tracking`} style={{ width: '100%' }}>
              <Button variant="accent" block>{t('checkoutOrderSuccessPage.trackDelivery')}</Button>
            </Link>
            <Link to="/orders" style={{ width: '100%' }}>
              <Button variant="outline" block>{t('account.myOrders')}</Button>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default function OrderSuccessPage() {
  return (
    <RequireAuth>
      <SuccessInner />
    </RequireAuth>
  )
}
