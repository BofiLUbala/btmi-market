import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import type { TrackingResponse, DeliveryPackageQR } from '@/api/types'
import { QRPanel } from '@/components/qr/QRPanel'
import { StatusBadge } from '@/components/ui/Badges'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { formatDateTime, asArray } from '@/lib/format'
import { isTerminalOrderStatus } from '@/lib/orderStatus'
import { getDeliverySteps, prettifyStatus } from '@/lib/orderWorkflow'
import { RequireAuth } from '@/components/auth/Guards'
import { useI18n } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

const POLL_INTERVAL = 4_000 // 4 seconds for live tracking auto-sync (3-5s range)

function actorLabel(actor: string | undefined, t: (key: TranslationKey, vars?: Record<string, string | number>) => string) {
  if (actor === 'SELLER') return t('tracking.byShop')
  if (actor === 'BUYER') return t('tracking.byBuyer')
  if (actor === 'SYSTEM') return t('tracking.bySystem')
  return ''
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
  const [statusFlash, setStatusFlash] = useState(false)
  const prevStatusRef = useRef<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [, setTick] = useState(0) // force re-render for timeAgo

  const fetchTracking = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const t = await buyerApi.tracking(orderId)
      const normalized = t ? { ...t, history: asArray(t.history) } : t
      const effectiveStatus = normalized?.delivery_status || normalized?.current_status
      if (effectiveStatus && prevStatusRef.current && prevStatusRef.current !== effectiveStatus) {
        setStatusFlash(true)
        setTimeout(() => setStatusFlash(false), 1500)
      }
      if (effectiveStatus) prevStatusRef.current = effectiveStatus
      setData(normalized)
      void buyerApi.deliveryQR(orderId).then(setDeliveryQR).catch(() => setDeliveryQR(null))
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
  const effectiveStatus = data?.delivery_status || data?.current_status
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
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  if (loading) return <LoadingBlock label={t('tracking.loading')} />
  if (error || !data) return <ErrorBox error={error || t('tracking.noData')} onRetry={() => void fetchTracking()} />

  const currentStatus = data.delivery_status || data.current_status
  const statusSteps = getDeliverySteps(data.delivery_method, currentStatus)
  const currentIdx = statusSteps.indexOf(currentStatus)

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

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>{t('tracking.progress')}</h2>
        <ul className="timeline">
          {statusSteps.map((s, i) => {
            const reached = i <= currentIdx
            const isCurrent = i === currentIdx
            const event = [...data.history].reverse().find((h) => h.status === s)
            return (
              <li key={s} className={`${reached ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
                <div className="t-status small">
                  {prettifyStatus(s)}
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
      {deliveryQR && <QRPanel qr={deliveryQR} title="Delivery verification QR" imagePath={`/buyer/orders/${orderId}/delivery-qr/image`} />}
      {deliveryQR?.delivery_scanned_at && !deliveryQR.receipt_confirmed_at && <button className="btn btn-primary" onClick={() => void buyerApi.confirmReceipt(orderId).then(() => fetchTracking())}>Confirmer que vous avez reçu votre commande</button>}
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
