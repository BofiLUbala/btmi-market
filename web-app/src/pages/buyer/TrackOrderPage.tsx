import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import type { TrackingResponse } from '@/api/types'
import { StatusBadge } from '@/components/ui/Badges'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { formatDateTime, asArray } from '@/lib/format'
import { isTerminalOrderStatus } from '@/lib/orderStatus'
import { RequireAuth } from '@/components/auth/Guards'
import { useI18n } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

const POLL_INTERVAL = 15_000 // 15 seconds

const FLOW_STEPS: Record<string, string[]> = {
  PICKUP: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'RECEIVED', 'COMPLETED'],
  SHOP_DELIVERY: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RECEIVED', 'COMPLETED'],
  PARTNER: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'HANDED_TO_PARTNER', 'DELIVERED', 'RECEIVED', 'COMPLETED'],
}

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
  const [statusFlash, setStatusFlash] = useState(false)
  const prevStatusRef = useRef<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [, setTick] = useState(0) // force re-render for timeAgo

  const fetchTracking = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const t = await buyerApi.tracking(orderId)
      const normalized = t ? { ...t, history: asArray(t.history) } : t
      if (normalized && prevStatusRef.current && prevStatusRef.current !== normalized.current_status) {
        setStatusFlash(true)
        setTimeout(() => setStatusFlash(false), 1500)
      }
      if (normalized) prevStatusRef.current = normalized.current_status
      setData(normalized)
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
  const terminal = isTerminalOrderStatus(data?.current_status)
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

  const baseSteps = FLOW_STEPS[data.delivery_method] ?? [data.current_status]
  const statusSteps = baseSteps.includes(data.current_status) ? baseSteps : [...baseSteps, data.current_status]
  const currentIdx = statusSteps.indexOf(data.current_status)

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
        <StatusBadge status={data.current_status} />
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
                  {s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
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
