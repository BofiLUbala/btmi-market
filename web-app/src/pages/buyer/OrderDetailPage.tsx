import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { ApiError, type BuyerPayment, type OrderLine, type OrderWithLines } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { StatusBadge } from '@/components/ui/Badges'
import { formatMoney, formatDateTime, initials, asArray } from '@/lib/format'
import { isTerminalOrderStatus } from '@/lib/orderStatus'
import { RequireAuth } from '@/components/auth/Guards'
import { useI18n } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

const POLL_INTERVAL = 30_000 // 30 seconds

function timeAgo(date: Date, t: (key: TranslationKey, vars?: Record<string, string | number>) => string): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 5) return t('time.justNow')
  if (seconds < 60) return t('time.secondsAgo', { count: seconds })
  const minutes = Math.floor(seconds / 60)
  return t('time.minutesAgo', { count: minutes })
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

  async function ensurePayment() {
    setBusy(true); setPaymentError('')
    try { setPayment(await buyerApi.createPayment(orderId)) }
    catch (e) { setPaymentError(e instanceof Error ? e.message : t('orders.paymentConfirmFailed')) }
    finally { setBusy(false) }
  }

  async function confirmPaid() {
    if (!payment) return
    setBusy(true); setPaymentError('')
    try { setPayment(await buyerApi.buyerConfirmPayment(payment.id)) }
    catch (e) { setPaymentError(e instanceof Error ? e.message : t('orders.paymentConfirmFailed')) }
    finally { setBusy(false) }
  }

  async function cancel() {
    if (!confirm(t('orders.cancelConfirm'))) return
    setBusy(true)
    setError('')
    try {
      await buyerApi.cancelOrder(orderId)
      void load()
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
              <div className="info-row"><span className="k">{t('orders.paymentMethod')}</span><span className="v">{t('orders.cash')}</span></div>
              <div className="info-row"><span className="k">{t('orders.amountDue')}</span><span className="v bold">{formatMoney(payment.cash_due, payment.currency)}</span></div>
              <div className="info-row"><span className="k">{t('orders.buyerConfirmation')}</span><span className="v">{payment.buyer_confirmed ? `✓ ${t('orders.paymentDeclared')}` : t('orders.notConfirmed')}</span></div>
              <div className="info-row"><span className="k">{t('orders.sellerConfirmation')}</span><span className="v">{payment.seller_confirmed ? `✓ ${t('orders.cashReceived')}` : t('orders.waitingForSeller')}</span></div>
              <div className="info-row"><span className="k">{t('orders.paymentStatus')}</span><span className="v"><StatusBadge status={payment.status} /></span></div>
              {!payment.buyer_confirmed && <Button loading={busy} onClick={confirmPaid}>{t('orders.iHavePaid')}</Button>}
              {payment.buyer_confirmed && !payment.seller_confirmed && <p className="small muted">{t('orders.declarationSaved')}</p>}
            </> : o.delivery_method ? <Button loading={busy} onClick={ensurePayment}>{t('orders.prepareCashPayment')}</Button> : <p className="small muted">{t('orders.selectDeliveryFirst')}</p>}
          </div>
          <div className="card stack">
            <h2 style={{ fontSize: '1.1rem' }}>{t('orders.actions')}</h2>
            {o.status === 'PENDING' && (
              <>
                {needsDelivery && (
                  <Button onClick={() => navigate('/checkout/delivery', { state: { orderId } })}>
                    {t('orders.selectDelivery')}
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
                  void load()
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
