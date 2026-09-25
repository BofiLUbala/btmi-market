import { useCallback, useEffect, useRef, useState } from 'react'
import { useOrderEvents } from '@/lib/orderEvents'
import { Link, useParams } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import type { TrackingResponse, DeliveryPackageQR, HandoverState } from '@/api/types'
import { BuyerHandoverPanel } from '@/components/checkout/BuyerHandoverPanel'
import { QRPanel } from '@/components/qr/QRPanel'
import { StatusBadge } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { formatDateTime, asArray } from '@/lib/format'
import { isTerminalOrderStatus } from '@/lib/orderStatus'
import { courierReached, getDeliverySteps, getTrackingDisplayStatus, ORDER_LIFECYCLE_STEPS, type CourierStep } from '@/lib/orderWorkflow'
import { RequireAuth } from '@/components/auth/Guards'
import { DeliveryPlanCard } from '@/components/checkout/DeliveryPlanCard'
import { useI18n } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

const POLL_INTERVAL = 4_000 // 4 seconds for live tracking auto-sync (3-5s range)

function actorLabel(actor: string | undefined, t: (key: TranslationKey, vars?: Record<string, string | number>) => string) {
  if (actor === 'SELLER') return t('tracking.byShop')
  if (actor === 'BUYER') return t('tracking.byBuyer')
  if (actor === 'SYSTEM') return t('tracking.bySystem')
  return ''
}

const isTbk = (method?: string) => (method || '').startsWith('TBK')
const AT_DOOR = ['COURIER_ARRIVED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION', 'RECEIVED']
// The history records order statuses only: a courier step is dated by the order
// transition that happens at the same moment.
const HISTORY_ALIASES: Record<string, string> = { PICKED_UP: 'OUT_FOR_DELIVERY', DELIVERY_SCAN_SUCCESS: 'DELIVERED' }

/**
 * Every step of a TBK delivery, each one done from a stored fact: the seller's
 * steps from the order status, the courier's from delivery_status, the parcel
 * check and the payment from the handover itself. Nothing is inferred from
 * position, so a step never shows done before it happened.
 */
function tbkSteps(d: TrackingResponse, handover: HandoverState | null) {
  const stage = ORDER_LIFECYCLE_STEPS.indexOf(d.current_status as (typeof ORDER_LIFECYCLE_STEPS)[number])
  const orderReached = (s: (typeof ORDER_LIFECYCLE_STEPS)[number]) => stage >= ORDER_LIFECYCLE_STEPS.indexOf(s)
  const reached = (s: CourierStep) => courierReached({ ...d, status: d.current_status }, s)
  const paid = ['PAID', 'VERIFIED'].includes(d.payment_status) || !!handover?.payment_verified
  return [
    { status: 'PENDING', done: true },
    { status: 'ACCEPTED', done: orderReached('ACCEPTED') },
    { status: 'PREPARING', done: orderReached('PREPARING') },
    { status: 'READY', done: orderReached('READY') },
    { status: 'COURIER_ASSIGNED', done: reached('COURIER_ASSIGNED') },
    { status: 'COURIER_ACCEPTED', done: reached('COURIER_ACCEPTED') },
    { status: 'PICKED_UP', done: reached('PICKED_UP') },
    { status: 'IN_TRANSIT', done: reached('IN_TRANSIT') },
    { status: 'COURIER_ARRIVED', done: reached('COURIER_ARRIVED') },
    { status: 'PRODUCT_VERIFIED', done: !!handover?.all_products_verified || orderReached('DELIVERED') },
    { status: 'PAYMENT_VERIFIED', done: paid },
    { status: 'DELIVERY_SCAN_SUCCESS', done: reached('DELIVERY_SCAN_SUCCESS') },
    { status: 'RECEIVED', done: orderReached('RECEIVED') },
    { status: 'COMPLETED', done: orderReached('COMPLETED') },
  ]
}

function timeAgo(date: Date, t: (key: TranslationKey, vars?: Record<string, string | number>) => string): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 5) return t('time.justNow')
  if (seconds < 60) return t('time.secondsAgo', { count: seconds })
  const minutes = Math.floor(seconds / 60)
  return t('time.minutesAgo', { count: minutes })
}

function TrackInner() {
  const { orderId = '' } = useParams()
  const { t } = useI18n()
  const [data, setData] = useState<TrackingResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [deliveryQR, setDeliveryQR] = useState<DeliveryPackageQR | null>(null)
  const [handover, setHandover] = useState<HandoverState | null>(null)
  const [statusFlash, setStatusFlash] = useState(false)
  const prevStatusRef = useRef<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [, setTick] = useState(0) // force re-render for timeAgo

  const fetchTracking = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const t = await buyerApi.tracking(orderId)
      const normalized = t ? { ...t, history: asArray(t.history) } : t
      const effectiveStatus = normalized
        ? getTrackingDisplayStatus(normalized.current_status, normalized.delivery_status)
        : undefined
      if (effectiveStatus && prevStatusRef.current && prevStatusRef.current !== effectiveStatus) {
        setStatusFlash(true)
        setTimeout(() => setStatusFlash(false), 1500)
      }
      if (effectiveStatus) prevStatusRef.current = effectiveStatus
      setData(normalized)
      void buyerApi.deliveryQR(orderId).then(setDeliveryQR).catch(() => setDeliveryQR(null))
      // At the door the parcel check and the payment live on the handover.
      if (normalized && AT_DOOR.includes(normalized.delivery_status || '')) {
        void buyerApi.handover(orderId).then(setHandover).catch(() => undefined)
      }
      setLastUpdated(new Date())
      setError('')
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : t('tracking.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [orderId])

  // Initial load
  useEffect(() => {
    void fetchTracking()
  }, [fetchTracking])

  // Auto-polling with tab visibility — stops once the Order reaches a final state
  const effectiveStatus = data
    ? getTrackingDisplayStatus(data.current_status, data.delivery_status)
    : undefined
  const terminal = isTerminalOrderStatus(effectiveStatus) || isTerminalOrderStatus(data?.current_status)
  useEffect(() => {
    function startPolling() {
      stopPolling()
      intervalRef.current = setInterval(() => void fetchTracking(true), POLL_INTERVAL)
    }
    function stopPolling() {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        void fetchTracking(true)
        if (!isTerminalOrderStatus(data?.current_status)) startPolling()
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
  }, [fetchTracking, terminal])

  // Update "Xs ago" display every 10 seconds
  useOrderEvents(() => void fetchTracking(true), { orderId })

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  if (loading) return <LoadingBlock label={t('tracking.loading')} />
  if (error || !data) return <ErrorBox error={error || t('tracking.noData')} onRetry={() => void fetchTracking()} />

  const currentStatus = getTrackingDisplayStatus(data.current_status, data.delivery_status)
  const tbk = isTbk(data.delivery_method)
  const steps = tbk
    ? tbkSteps(data, handover)
    : (() => {
        const list = getDeliverySteps(data.delivery_method, currentStatus)
        const idx = list.indexOf(currentStatus)
        return list.map((status, i) => ({ status, done: i <= idx }))
      })()
  const currentIdx = steps.findIndex((s) => !s.done)

  return (
    <div className="fade-in">
      <Link to={`/orders/${orderId}`} className="small section-link">← {t('tracking.orderDetails')}</Link>

      {/* Live sync bar */}
      <div className="live-bar">
        <span className="live-label"><span className="live-dot" /> {t('orders.live')}</span>
        <span>{lastUpdated ? t('orders.updated', { time: timeAgo(lastUpdated, t) }) : t('common.loading')}</span>
        <button className="refresh-btn" onClick={() => void fetchTracking()} disabled={refreshing}>
          {refreshing ? '⟳' : t('orders.refresh')}
        </button>
      </div>

      <div className={`row-between${statusFlash ? ' status-updated' : ''}`} style={{ marginTop: 8 }}>
        <h1 style={{ fontSize: '1.5rem' }}>{t('tracking.title')}</h1>
        <StatusBadge status={currentStatus} />
      </div>
      <div className="small muted">
        {t('tracking.summary', { number: data.order_number, method: data.delivery_method.replace(/_/g, ' ').toLowerCase(), status: data.payment_status.replace(/_/g, ' ').toLowerCase() })}
      </div>

      {data.latest_update && (
        <div className="card" style={{ marginTop: 12, background: 'var(--color-accent-soft)', border: 'none' }}>
          <div className="bold small">{t('tracking.latestUpdate')}</div>
          <p className="small mt-0">{data.latest_update}</p>
          <div className="t-time">{formatDateTime(data.latest_update_at)}</div>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <DeliveryPlanCard plan={data} status={data.current_status} deliveryStatus={data.delivery_status} deliveryMethod={data.delivery_method} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>{t('tracking.progress')}</h2>
        <ul className="timeline">
          {steps.map(({ status: s, done: reached }, i) => {
            const isCurrent = i === currentIdx
            const event = [...data.history].reverse().find((h) => h.status === s || h.status === HISTORY_ALIASES[s])
            return (
              <li key={s} className={`${reached ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
                <div className="t-status small">
                  {reached ? '✓ ' : ''}{t(`status.${s}` as TranslationKey)}
                  {isCurrent && t('tracking.current')}
                </div>
                {event && <><div className="small muted">{actorLabel(event.actor_type, t)}{event.notes ? `${actorLabel(event.actor_type, t) ? ' · ' : ''}${event.notes}` : ''}</div><div className="t-time">{formatDateTime(event.created_at)}</div></>}
              </li>
            )
          })}
        </ul>
      </div>

      <p className="pay-note" style={{ marginTop: 12 }}>
        {t('tracking.note')}
      </p>
      {data.current_status === 'COMPLETED' && (
        <div className="card stack" style={{ marginTop: 12 }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 4 }}>{t('reviews.writeReview')}</h2>
            <p className="small muted" style={{ margin: 0 }}>{t('reviews.completedOrderPrompt')}</p>
          </div>
          <Link to={`/orders/${orderId}#purchased-products`}>
            <Button variant="accent" block>★ {t('orders.reviewPurchasedProducts')}</Button>
          </Link>
          <Link to={`/orders/${orderId}/review?type=service`}>
            <Button variant="outline" block>★ {t('reviews.reviewDeliveryService')}</Button>
          </Link>
        </div>
      )}
      {/* Same handover as the order page: items first, then receipt. */}
      <div style={{ marginTop: 12 }}>
        <BuyerHandoverPanel orderId={orderId} deliveryStatus={data.delivery_status || undefined} onChanged={() => void fetchTracking(true)} />
      </div>
      {deliveryQR && <QRPanel qr={deliveryQR} title={t('tracking.deliveryQr')} imagePath={`/buyer/orders/${orderId}/delivery-qr/image`} />}
    </div>
  )
}

export default function TrackOrderPage() {
  return (
    <RequireAuth>
      <TrackInner />
    </RequireAuth>
  )
}
