import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { ApiError, type BuyerPayment, type OrderLine, type OrderWithLines } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { StatusBadge } from '@/components/ui/Badges'
import { formatMoney, formatDateTime, initials, asArray } from '@/lib/format'
import { isTerminalOrderStatus } from '@/lib/orderStatus'
import {
  paymentStatusKey,
  paymentMethodKey,
  isPaymentConfirmed,
  isPaymentCancelled,
  isPaymentFailed,
  isPaymentPending
} from '@/lib/paymentStatus'
import { RequireAuth } from '@/components/auth/Guards'
import { OrderChatFeed } from '@/components/communication/OrderChatFeed'
import { useI18n } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

const POLL_INTERVAL = 30_000 // 30 seconds

const ORDER_STAGES = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RECEIVED', 'COMPLETED']
const CASH = 'CASH'
const MOBILE_ON_DELIVERY = 'MOBILE_ON_DELIVERY'

function timeAgo(date: Date, t: (key: TranslationKey, vars?: Record<string, string | number>) => string): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 5) return t('time.justNow')
  if (seconds < 60) return t('time.secondsAgo', { count: seconds })
  const minutes = Math.floor(seconds / 60)
  return t('time.minutesAgo', { count: minutes })
}

interface TimelineStep {
  key: string
  labelKey: TranslationKey
  done: (o: OrderWithLines['order'], payment: BuyerPayment | null) => boolean
}

const TIMELINE_STEPS: TimelineStep[] = [
  {
    key: 'cart',
    labelKey: 'nav.cart',
    done: () => true
  },
  {
    key: 'checkout',
    labelKey: 'orders.checkoutStarted',
    done: () => true
  },
  {
    key: 'address',
    labelKey: 'orders.addressConfirmed',
    done: (o) => !!o.delivery_method
  },
  {
    key: 'method',
    labelKey: 'orders.paymentMethodChosen',
    done: (_, p) => !!p
  },
  {
    key: 'created',
    labelKey: 'orders.orderCreated',
    done: () => true
  },
  {
    key: 'payment',
    labelKey: 'orders.paymentStep',
    done: (_, p) => isPaymentConfirmed(p)
  },
  {
    key: 'preparing',
    labelKey: 'orders.sellerPreparing',
    done: (o) => ORDER_STAGES.indexOf(o.status) >= ORDER_STAGES.indexOf('ACCEPTED')
  },
  {
    key: 'delivery',
    labelKey: 'orders.inDelivery',
    done: (o) => ORDER_STAGES.indexOf(o.status) >= ORDER_STAGES.indexOf('OUT_FOR_DELIVERY')
  },
  {
    key: 'arrived',
    labelKey: 'orders.arrived',
    done: (o) => ORDER_STAGES.indexOf(o.status) >= ORDER_STAGES.indexOf('DELIVERED')
  },
  {
    key: 'received',
    labelKey: 'orders.received',
    done: (o) => ORDER_STAGES.indexOf(o.status) >= ORDER_STAGES.indexOf('RECEIVED')
  }
]

function OrderTimeline({ o, payment }: { o: OrderWithLines['order']; payment: BuyerPayment | null }) {
  const { t } = useI18n()
  const steps = TIMELINE_STEPS.map((step) => step.done(o, payment))
  const currentIndex = steps.findIndex((done) => !done)
  return (
    <div className="card">
      <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>{t('orders.lifecycle')}</h2>
      <ul className="timeline" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {TIMELINE_STEPS.map((step, i) => {
          const done = steps[i]
          const active = i === currentIndex
          return (
            <li key={step.key} className={done ? 'done' : active ? 'current' : ''} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0' }}>
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  flexShrink: 0,
                  border: '2px solid var(--color-border)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  color: done || active ? 'var(--color-accent)' : 'var(--color-muted)'
                }}
              >
                {done ? '✓' : ''}
              </span>
              <span>
                {t(step.labelKey)}
                {step.key === 'payment' && (
                  <span className="muted small" style={{ marginLeft: 8 }}>
                    {t(paymentStatusKey(payment) as TranslationKey)}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
        {t('tracking.note')}
      </p>
    </div>
  )
}

function PaymentDetailCard({ o, payment }: { o: OrderWithLines['order']; payment: BuyerPayment | null }) {
  const { t } = useI18n()
  if (!payment) return null
  const markup = payment.products_final_total + payment.delivery_fee_final - payment.cash_due
  const refundStatus = (payment as BuyerPayment & { refund_status?: string | null }).refund_status
  return (
    <div className="card stack">
      <h2 style={{ fontSize: '1.1rem' }}>{t('orders.paymentDetail')}</h2>
      <div className="info-row"><span className="k">{t('orders.orderNumber', { number: o.order_number || o.id.slice(0, 8).toUpperCase() })}</span><span className="v">{formatDateTime(o.created_at)}</span></div>
      <div className="info-row"><span className="k">{t('orders.paymentMethod')}</span><span className="v">{t(paymentMethodKey(payment.payment_method))}</span></div>
      <div className="info-row"><span className="k">{t('orders.amountDue')}</span><span className="v bold">{formatMoney(payment.cash_due, payment.currency)}</span></div>
      <div className="info-row"><span className="k">{t('orders.paymentMarkup')}</span><span className="v">{formatMoney(Math.max(markup, 0), payment.currency)}</span></div>
      <div className="info-row"><span className="k">{t('orders.totalDue')}</span><span className="v bold">{formatMoney(payment.cash_due, payment.currency)}</span></div>
      <div className="info-row"><span className="k">{t('orders.paymentStatus')}</span><span className="v">{t(paymentStatusKey(payment) as TranslationKey)}</span></div>
      <div className="info-row"><span className="k">{t('orders.createdAtLabel')}</span><span className="v">{formatDateTime(payment.created_at)}</span></div>
      <div className="info-row"><span className="k">{t('orders.reference')}</span><span className="v small">{payment.id.slice(0, 8).toUpperCase()}</span></div>
      <div className="info-row"><span className="k">{t('orders.lastUpdate')}</span><span className="v">{formatDateTime(payment.updated_at)}</span></div>
      {refundStatus && (
        <div className="info-row">
          <span className="k">{t('orders.paymentStatus')}</span>
          <span className="v">
            {refundStatus === 'IN_PROGRESS' ? t('orders.refundInProgress') : refundStatus === 'REFUNDED' ? t('orders.refunded') : refundStatus === 'FAILED' ? t('orders.refundFailed') : refundStatus}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * "Pay now" for the mobile-money methods. The server decides whether this is
 * offerable (payment.payable) - notably, pay-on-delivery only becomes payable
 * once the courier is actually on the way - and a real provider settles it via
 * its webhook. Nothing here can mark the order paid.
 */
function PayNowCard({ orderId, payment, onDone }: { orderId: string; payment: BuyerPayment | null; onDone: () => void }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [instructions, setInstructions] = useState('')

  if (!payment || payment.payment_method === 'CASH_ON_DELIVERY') return null
  if (payment.payable_reason === 'ALREADY_PAID' || payment.payable_reason === 'PAYMENT_CLOSED') return null

  const waiting = payment.payable_reason === 'AWAITING_DELIVERY_STAGE'
  const noProvider = payment.payable_reason === 'PAYMENT_PROVIDER_NOT_CONFIGURED'

  async function payNow() {
    setBusy(true); setError(''); setInstructions('')
    try {
      const started = await buyerApi.initiatePayment(orderId)
      if (started.redirect_url) { window.location.href = started.redirect_url; return }
      setInstructions(started.instructions || t('orders.payNowStarted'))
      onDone()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('orders.payNowFailed'))
    } finally { setBusy(false) }
  }

  return (
    <div className="card stack">
      <h2 style={{ fontSize: '1.1rem' }}>{t('orders.payNowTitle')}</h2>
      <div className="info-row">
        <span className="k">{t('orders.totalDue')}</span>
        <span className="v bold">{formatMoney(payment.final_total, payment.currency)}</span>
      </div>
      {error && <ErrorBox error={error} />}
      {instructions && <p className="small">{instructions}</p>}
      {waiting && <p className="small muted">{t('orders.payNowWaitingDelivery')}</p>}
      {noProvider && <p className="small muted">{t('orders.payNowNoProvider')}</p>}
      <Button size="lg" block loading={busy} disabled={!payment.payable} onClick={payNow}>
        {t('orders.payNowAction')}
      </Button>
    </div>
  )
}

function PaymentAttempts({ o, payment }: { o: OrderWithLines['order']; payment: BuyerPayment | null }) {
  const { t } = useI18n()
  const attempts: Array<{ label: string; at: string; ok: boolean; stepKey: TranslationKey }> = []
  const method = payment?.payment_method || 'CASH'
  const methodLabel = method === CASH ? t('orders.attemptCash') : t('orders.attemptMobile')
  if (payment) {
    attempts.push({
      label: t('orders.orderCreated'),
      at: formatDateTime(o.created_at),
      ok: true,
      stepKey: 'orders.orderCreated'
    })
    attempts.push({
      label: methodLabel,
      at: formatDateTime(payment.created_at),
      ok: !isPaymentCancelled(payment) && !isPaymentFailed(payment) && !isPaymentConfirmed(payment),
      stepKey: 'orders.createdAtLabel'
    })
  }
  if (payment?.buyer_confirmed_at) {
    attempts.push({
      label: `${t('orders.attemptDeclared')} · ${methodLabel}`,
      at: formatDateTime(payment.buyer_confirmed_at),
      ok: true,
      stepKey: 'orders.attemptDeclared'
    })
  }
  if (payment?.seller_confirmed_at) {
    attempts.push({
      label: `${t('orders.attemptConfirmed')} · ${methodLabel}`,
      at: formatDateTime(payment.seller_confirmed_at),
      ok: true,
      stepKey: 'orders.attemptConfirmed'
    })
  }
  if (payment?.verified_at) {
    attempts.push({
      label: `${t('orders.attemptConfirmed')} · ${methodLabel}`,
      at: formatDateTime(payment.verified_at),
      ok: true,
      stepKey: 'orders.attemptConfirmed'
    })
  }
  if (attempts.length === 0) return null
  return (
    <div className="card">
      <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>{t('orders.attempts')}</h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="stack">
        {attempts.map((a, i) => (
          <li key={i} className="small" style={{ display: 'flex', gap: 8, justifyContent: 'space-between', borderBottom: '1px dashed var(--color-border)', paddingBottom: 4 }}>
            <span>
              {a.ok ? '✓' : '✕'} {a.label}
            </span>
            <span className="muted">{a.at}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function OrderInner() {
  const { orderId = '' } = useParams()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [data, setData] = useState<OrderWithLines | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [payment, setPayment] = useState<BuyerPayment | null>(null)
  const [paymentError, setPaymentError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [statusFlash, setStatusFlash] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const prevStatusRef = useRef<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [, setTick] = useState(0)

  const load = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError('') }
    if (silent) setRefreshing(true)
    try {
      const [d, p] = await Promise.all([
        buyerApi.orderDetail(orderId),
        buyerApi.getPayment(orderId).catch(() => null),
      ])
      const normalized = d ? { ...d, lines: asArray(d.lines), history: asArray(d.history) } : d
      if (normalized && prevStatusRef.current && prevStatusRef.current !== normalized.order.status) {
        setStatusFlash(true)
        setTimeout(() => setStatusFlash(false), 1500)
      }
      if (normalized) prevStatusRef.current = normalized.order.status
      setData(normalized)
      setPayment(p)
      setLastUpdated(new Date())
      if (!silent) setLoading(false)
    } catch (e) {
      if (!silent) {
        setError(e instanceof ApiError ? e.message : t('orders.loadFailed'))
        setLoading(false)
      }
    } finally {
      setRefreshing(false)
    }
  }, [orderId])

  // Initial load
  useEffect(() => { void load() }, [load])

  // Auto-polling with tab visibility — stops once the Order reaches a final state
  const terminal = isTerminalOrderStatus(data?.order.status)
  useEffect(() => {
    function startPolling() {
      stopPolling()
      intervalRef.current = setInterval(() => void load(true), POLL_INTERVAL)
    }
    function stopPolling() {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        void load(true)
        if (!isTerminalOrderStatus(data?.order.status)) startPolling()
      } else {
        stopPolling()
      }
    }
    if (!terminal) startPolling()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load, terminal])

  // Tick for timeAgo
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  // After any payment/order mutation, refetch everything so the UI never relies on a frontend-only "paid" flag.
  async function refreshAll() {
    await load()
  }

  async function ensurePayment() {
    setBusy(true); setPaymentError('')
    try {
      const p = await buyerApi.createPayment(orderId)
      setPayment(p)
      await refreshAll()
    } catch (e) { setPaymentError(e instanceof Error ? e.message : t('orders.paymentConfirmFailed')) }
    finally { setBusy(false) }
  }

  async function confirmPaid() {
    if (!payment) return
    setBusy(true); setPaymentError('')
    try {
      setPayment(await buyerApi.buyerConfirmPayment(payment.id))
      await refreshAll()
    } catch (e) { setPaymentError(e instanceof Error ? e.message : t('orders.paymentConfirmFailed')) }
    finally { setBusy(false) }
  }

  async function cancel() {
    if (!confirm(t('orders.cancelConfirm'))) return
    setBusy(true)
    setError('')
    try {
      await buyerApi.cancelOrder(orderId)
      await refreshAll()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('orders.cancelFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingBlock label={t('orders.loading')} />
  if (error || !data) return <ErrorBox error={error || t('orders.notFound')} onRetry={() => void load()} />

  const o = data.order
  const productsTotal = o.final_total + o.points_discount_amount
  const total = o.final_total + o.delivery_fee_final
  const needsDelivery = !o.delivery_method
  const method = payment?.payment_method || CASH
  const payBtnVisible =
    !!payment &&
    !isPaymentConfirmed(payment) &&
    !isPaymentCancelled(payment) &&
    !isPaymentFailed(payment) &&
    method === CASH
  const mobilePayReady =
    !!payment &&
    method === MOBILE_ON_DELIVERY &&
    !isPaymentConfirmed(payment) &&
    (o.status === 'DELIVERED' || o.status === 'RECEIVED')

  return (
    <div className="fade-in">
      <Link to="/orders" className="small section-link">← {t('account.myOrders')}</Link>

      {/* Live sync bar */}
      <div className="live-bar">
        <span className="live-label"><span className="live-dot" /> {t('orders.live')}</span>
        <span>{lastUpdated ? t('orders.updated', { time: timeAgo(lastUpdated, t) }) : t('common.loading')}</span>
        <button className="refresh-btn" onClick={() => void load()} disabled={refreshing}>
          {refreshing ? '⟳' : t('orders.refresh')}
        </button>
      </div>

      <div className={`row-between${statusFlash ? ' status-updated' : ''}`} style={{ marginTop: 8 }}>
        <h1 style={{ fontSize: '1.5rem' }}>
          {t('orders.orderNumber', { number: o.order_number || o.id.slice(0, 8).toUpperCase() })}
        </h1>
        <StatusBadge status={o.status} />
      </div>
      <div className="small muted">{formatDateTime(o.created_at)}</div>
      <div className="small" style={{ marginTop: 6 }}><span className="muted">{t('orders.shop')}:</span> <strong>{data.shop_name || t('orders.shopUnavailable')}</strong></div>

      {error && <ErrorBox error={error} />}

      {/* Lifecycle timeline (Req #39 + #51) */}
      <OrderTimeline o={o} payment={payment} />

      <div className="order-summary-grid" style={{ marginTop: 16 }}>
        <div className="card stack" id="purchased-products">
          <h2 style={{ fontSize: '1.1rem' }}>{t('orders.items')}</h2>
          {data.lines.map(l => <PurchasedLine key={l.id} line={l} orderId={orderId} completed={o.status === 'COMPLETED'} />)}

          <div className="total-row">
            <span>{t('orders.productsSubtotal')}</span>
            <span>{formatMoney(productsTotal)}</span>
          </div>
          {o.points_used > 0 && (
            <div className="total-row">
              <span>{t('orders.pointsUsed', { count: o.points_used })}</span>
              <span className="pd-discount">−{formatMoney(o.points_discount_amount)}</span>
            </div>
          )}
          <div className="total-row">
            <span>{t('orders.productsTotal')}</span>
            <span>{formatMoney(o.final_total)}</span>
          </div>
          <div className="total-row">
            <span>{t('orders.delivery', { method: o.delivery_method || t('orders.notSelected') })}</span>
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
            <span>{t('orders.totalDue')}</span>
            <span>{formatMoney(total)}</span>
          </div>

          {o.delivery_method && (
            <div className="card" style={{ background: 'var(--color-surface-2)', border: 'none' }}>
              <div className="bold small" style={{ marginBottom: 4 }}>{t('delivery.details')}</div>
              <div className="info-row">
                <span className="k">{t('orders.contact')}</span>
                <span className="v">{o.delivery_contact_name || '—'}</span>
              </div>
              <div className="info-row">
                <span className="k">{t('common.phone')}</span>
                <span className="v">{o.delivery_phone || '—'}</span>
              </div>
              <div className="info-row">
                <span className="k">{t('common.address')}</span>
                <span className="v">{o.delivery_address || '—'}</span>
              </div>
              {o.delivery_notes && (
                <div className="info-row">
                  <span className="k">{t('delivery.notes')}</span>
                  <span className="v">{o.delivery_notes}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card stack">
            <h2 style={{ fontSize: '1.1rem' }}>{t('orders.payment')}</h2>
            {paymentError && <ErrorBox error={paymentError} />}
            {payment ? <>
              <div className="info-row"><span className="k">{t('orders.paymentMethod')}</span><span className="v">{t(paymentMethodKey(payment.payment_method))}</span></div>
              {/* Payment breakdown (Req #40) */}
              <div className="total-row"><span>{t('orders.productsAmount')}</span><span>{formatMoney(payment.products_final_total, payment.currency)}</span></div>
              <div className="total-row"><span>{t('orders.deliveryFee')}</span><span>{formatMoney(payment.delivery_fee_final, payment.currency)}</span></div>
              <div className="total-row"><span>{t('orders.paymentMarkup')}</span><span>{formatMoney(Math.max(payment.cash_due - payment.products_final_total - payment.delivery_fee_final, 0), payment.currency)}</span></div>
              <div className="total-row"><span>{t('orders.pointsDiscount')}</span><span className="pd-discount">−{formatMoney(payment.products_points_discount + payment.delivery_points_discount, payment.currency)}</span></div>
              <div className="total-row total"><span>{t('orders.finalTotal')}</span><span>{formatMoney(payment.cash_due, payment.currency)}</span></div>
              <div className="info-row"><span className="k">{t('orders.amountDue')}</span><span className="v bold">{formatMoney(payment.cash_due, payment.currency)}</span></div>
              <div className="info-row"><span className="k">{t('orders.paymentStatus')}</span><span className="v">{t(paymentStatusKey(payment) as TranslationKey)}</span></div>
              <div className="info-row"><span className="k">{t('orders.buyerConfirmation')}</span><span className="v">{payment.buyer_confirmed ? `✓ ${t('orders.paymentDeclared')}` : t('orders.notConfirmed')}</span></div>
              <div className="info-row"><span className="k">{t('orders.sellerConfirmation')}</span><span className="v">{payment.seller_confirmed ? `✓ ${t('orders.cashReceived')}` : t('orders.waitingForSeller')}</span></div>

              {/* Payment action rules (Req #52) */}
              {payBtnVisible && (
                <Button loading={busy} onClick={confirmPaid}>{t('orders.iHavePaid')}</Button>
              )}
              {payment.buyer_confirmed && !payment.seller_confirmed && <p className="small muted">{t('orders.declarationSaved')}</p>}
              {method === CASH && !payment.buyer_confirmed && isPaymentPending(payment) && (
                <p className="small muted">{t('orders.payAtDelivery')}</p>
              )}
              {payment && isPaymentConfirmed(payment) && <p className="small muted">✓ {t('orders.paymentConfirmed')}</p>}
              {(method === 'PAY_NOW' || method === 'MOBILE_PAY') && !isPaymentConfirmed(payment) && !isPaymentCancelled(payment) && !isPaymentFailed(payment) && (
                <Button loading={busy} onClick={confirmPaid}>{t('orders.continuePayment')}</Button>
              )}
              {isPaymentFailed(payment) && (
                <Button loading={busy} onClick={refreshAll}>{t('orders.retryPayment')}</Button>
              )}
              {mobilePayReady && (
                <Button loading={busy} onClick={confirmPaid}>{t('orders.payNow')}</Button>
              )}
              {method === MOBILE_ON_DELIVERY && !mobilePayReady && !isPaymentConfirmed(payment) && (
                <p className="small muted">{t('orders.mobileToPayAtDelivery')}</p>
              )}
            </> : o.delivery_method ? <Button loading={busy} onClick={ensurePayment}>{t('orders.prepareCashPayment')}</Button> : <p className="small muted">{t('orders.selectDeliveryFirst')}</p>}
          </div>

          <PayNowCard orderId={o.id} payment={payment} onDone={() => load(true)} />
          <PaymentDetailCard o={o} payment={payment} />
          <PaymentAttempts o={o} payment={payment} />

          <div className="card stack">
            <h2 style={{ fontSize: '1.1rem' }}>{t('orders.actions')}</h2>
            {o.status === 'PENDING' && (
              <>
                {needsDelivery && (
                  <Button onClick={() => navigate('/checkout/delivery', { state: { orderId } })}>
                    {t('orders.continueCheckout')}
                  </Button>
                )}
                <Button variant="danger" onClick={cancel} loading={busy}>
                  {t('orders.cancelOrder')}
                </Button>
              </>
            )}
            {!needsDelivery && (o.status === 'PENDING' || o.status === 'ACCEPTED' || o.status === 'PREPARING' || o.status === 'READY') && (
              <Link to={`/orders/${orderId}/tracking`}>
                <Button block>{t('orders.trackOrder')}</Button>
              </Link>
            )}
            {!needsDelivery && ((o.delivery_method === 'PICKUP' && o.status === 'READY_FOR_PICKUP') || (o.delivery_method !== 'PICKUP' && o.status === 'DELIVERED')) && (
              <Button
                onClick={async () => {
                  await buyerApi.confirmReceived(orderId)
                  await refreshAll()
                }}
              >
                {t('orders.iReceivedOrder')}
              </Button>
            )}
            <Link to={`/orders/${orderId}/tracking`}>
              <Button variant="outline" block>
                {t('orders.viewTracking')}
              </Button>
            </Link>
            <Button variant="outline" block onClick={() => setShowChat(true)}>
              💬 {t('communication.contactSeller')}
            </Button>
            {o.status === 'COMPLETED' && (
              <>
                <a href="#purchased-products"><Button variant="accent" block>{t('orders.reviewPurchasedProducts')}</Button></a>
                <ServiceReviewAction orderId={orderId} />
              </>
            )}
          </div>

          {data.history && data.history.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>{t('orders.statusHistory')}</h2>
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

      {showChat && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowChat(false)
          }}
        >
          <div style={{ width: '100%', maxWidth: 640, maxHeight: '85vh', height: 600 }}>
            <OrderChatFeed
              orderId={orderId}
              role="BUYER"
              onClose={() => setShowChat(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function PurchasedLine({ line, orderId, completed }: { line: OrderLine; orderId: string; completed: boolean }) {
  const { t } = useI18n()
  const variantText = Object.values(line.variant_attributes ?? {}).filter(Boolean).join(' / ') || line.variant_name || line.variant_sku || t('orders.standardVariant')
  const price = line.final_unit_price
  return <div className="cart-line" style={{ borderBottom: '1px dashed var(--color-border)' }}>
    <div className="cart-line-thumb">{line.image_url ? <img src={line.image_url} alt="" /> : initials(line.product_name || t('orders.product'))}</div>
    <div className="stack" style={{ gap: 1, flex: 1 }}><div className="bold small">{line.product_name || t('orders.productWithId', { id: line.product_id.slice(0, 8) })}</div><div className="small muted">{variantText}</div><div className="small muted">{line.quantity} × {formatMoney(price)}</div><ReviewAction orderId={orderId} lineId={line.id} completed={completed} /></div>
    <div className="bold small">{formatMoney(line.quantity * price)}</div>
  </div>
}

function ReviewAction({ orderId, lineId, completed }: { orderId: string; lineId: string; completed: boolean }) {
  const { t } = useI18n()
  const [eligibility, setEligibility] = useState<{ eligible: boolean; existing_review_id?: string } | null>(null)
  useEffect(() => { if (completed) buyerApi.reviewEligibility(orderId, lineId).then(setEligibility).catch(() => setEligibility(null)) }, [orderId, lineId, completed])
  if (!completed) return <span className="small muted">{t('reviews.notEligibleYet')}</span>
  if (eligibility?.existing_review_id) return <Link className="section-link small" to={`/orders/${orderId}/review?line=${lineId}`}>✓ {t('reviews.reviewedEdit')}</Link>
  if (eligibility?.eligible) return <Link className="section-link small" to={`/orders/${orderId}/review?line=${lineId}`}>★ {t('reviews.reviewProductLink')}</Link>
  return <span className="small muted">{t('reviews.notEligibleYet')}</span>
}

function ServiceReviewAction({ orderId }: { orderId: string }) {
  const { t } = useI18n()
  const [eligibility, setEligibility] = useState<{ eligible: boolean; existing_review_id?: string } | null>(null)
  useEffect(() => { buyerApi.reviewEligibility(orderId).then(setEligibility).catch(() => setEligibility(null)) }, [orderId])
  if (eligibility?.existing_review_id) return <Button variant="outline" block disabled>✓ {t('reviews.deliveryServiceReviewed')}</Button>
  if (eligibility?.eligible) return <Link to={`/orders/${orderId}/review?type=service`}><Button variant="outline" block>{t('reviews.reviewDeliveryService')}</Button></Link>
  return null
}

export default function OrderDetailPage() {
  return (
    <RequireAuth>
      <OrderInner />
    </RequireAuth>
  )
}