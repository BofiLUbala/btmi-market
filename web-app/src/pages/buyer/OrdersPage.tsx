import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import type { BuyerPayment, OrderLine, OrderWithLines } from '@/api/types'
import { EmptyState, ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { StatusBadge } from '@/components/ui/Badges'
import { formatMoney, formatDateTime, initials, asArray } from '@/lib/format'
import { hasActiveOrderStatus } from '@/lib/orderStatus'
import { RequireAuth } from '@/components/auth/Guards'
import { useI18n } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

const POLL_INTERVAL = 60_000 // 60 seconds

interface OrderHistoryItem { detail: OrderWithLines; payment: BuyerPayment | null }

function variantLabel(line: OrderLine, t: (key: TranslationKey, vars?: Record<string, string | number>) => string) {
  const attributes = Object.values(line.variant_attributes ?? {}).filter(Boolean)
  return attributes.join(' / ') || line.variant_name || line.variant_sku || t('orders.standardVariant')
}

function timeAgo(date: Date, t: (key: TranslationKey, vars?: Record<string, string | number>) => string): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 5) return t('time.justNow')
  if (seconds < 60) return t('time.secondsAgo', { count: seconds })
  const minutes = Math.floor(seconds / 60)
  return t('time.minutesAgo', { count: minutes })
}

function ReviewAction({ orderId, lineId, completed }: { orderId: string; lineId: string; completed: boolean }) {
  const { t } = useI18n()
  const [eligibility, setEligibility] = useState<{ eligible: boolean; reason?: string; existing_review_id?: string } | null>(null)
  
  useEffect(() => {
    if (completed) {
      buyerApi.reviewEligibility(orderId, lineId)
        .then(setEligibility)
        .catch(() => setEligibility(null))
    }
  }, [orderId, lineId, completed])

  if (!completed) return null
  if (eligibility?.existing_review_id) {
    return (
      <div style={{ marginTop: 4 }}>
        <Link className="section-link small" to={`/orders/${orderId}/review?line=${lineId}`}>
          ✓ {t('reviews.reviewedEdit')}
        </Link>
      </div>
    )
  }
  if (eligibility?.eligible) {
    return (
      <div style={{ marginTop: 4 }}>
        <Link className="section-link small bold" style={{ color: 'var(--color-accent)' }} to={`/orders/${orderId}/review?line=${lineId}`}>
          ★ {t('reviews.reviewProductLink')}
        </Link>
      </div>
    )
  }
  return null
}

function OrdersInner() {
  const { t } = useI18n()
  const [items, setItems] = useState<OrderHistoryItem[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [, setTick] = useState(0)

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    try {
      const orders = asArray(await buyerApi.orders())
      const details = await Promise.all(orders.map(async (order) => {
        const [detail, payment] = await Promise.all([
          buyerApi.orderDetail(order.id),
          buyerApi.getPayment(order.id).catch(() => null),
        ])
        return { detail, payment }
      }))
      setItems(details)
      setLastUpdated(new Date())
      setError('')
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : t('orders.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Initial load
  useEffect(() => { void load() }, [load])

  // Auto-polling with tab visibility — pauses when every Order is in a final state
  const hasActive = hasActiveOrderStatus(items.map((item) => item.detail?.order?.status))
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
        if (hasActiveOrderStatus(items.map((item) => item.detail?.order?.status))) startPolling()
      } else {
        stopPolling()
      }
    }
    if (hasActive) startPolling()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load, hasActive])

  // Tick for timeAgo
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  if (loading) return <LoadingBlock label={t('orders.loading')} />
  if (error) return <ErrorBox error={error} onRetry={() => void load()} />
  if (items.length === 0) return <EmptyState icon="📦" title={t('orders.emptyTitle')} description={t('orders.emptyDesc')} action={<Link to="/" className="btn btn-primary">{t('orders.browse')}</Link>} />

  return <div className="fade-in">
    <div className="page-header"><div><div className="eyebrow">{t('account.eyebrow')}</div><h1>{t('account.myOrders')}</h1><p className="muted">{t('orders.subtitle')}</p></div></div>

    {/* Live sync bar */}
    <div className="live-bar">
      <span className="live-label"><span className="live-dot" /> {t('orders.live')}</span>
      <span>{lastUpdated ? t('orders.updated', { time: timeAgo(lastUpdated, t) }) : t('common.loading')}</span>
      <button className="refresh-btn" onClick={() => void load()} disabled={refreshing}>
        {refreshing ? '⟳' : t('orders.refresh')}
      </button>
    </div>

    <div className="stack buyer-order-list">
      {items.map(({ detail, payment }) => {
        const order = detail.order
        const total = order.final_total + order.delivery_fee_final
        return <article key={order.id} className="card buyer-order-card">
          <div className="row-between buyer-order-head"><div><div className="eyebrow">{t('orders.eyebrow')}</div><h2>{order.order_number || order.id.slice(0, 8).toUpperCase()}</h2><div className="small muted">{formatDateTime(order.created_at)}</div></div><StatusBadge status={order.status} /></div>
          <div className="buyer-order-shop"><span className="muted small">{t('orders.shop')}</span><strong>{detail.shop_name || t('orders.shopUnavailable')}</strong></div>
          <div className="stack buyer-order-lines">
            {detail.lines.map((line) => {
              const price = line.final_unit_price
              return <div className="cart-line" key={line.id}>
                <div className="cart-line-thumb">{line.image_url ? <img src={line.image_url} alt="" /> : initials(line.product_name || t('orders.product'))}</div>
                <div className="stack" style={{ gap: 2, flex: 1 }}>
                  <strong>{line.product_name || t('orders.productWithId', { id: line.product_id.slice(0, 8) })}</strong>
                  <span className="small muted">{t('orders.variantWithLabel', { variant: variantLabel(line, t) })}</span>
                  <span className="small muted">{t('orders.quantityUnitPrice', { quantity: line.quantity, price: formatMoney(price) })}</span>
                  <ReviewAction orderId={order.id} lineId={line.id} completed={order.status === 'COMPLETED'} />
                </div>
                <strong>{formatMoney(line.quantity * price)}</strong>
              </div>
            })}
          </div>
          <div className="buyer-order-footer">
            <div className="small"><span className="muted">{t('orders.payment')}</span><br /><strong>{payment ? payment.status : t('orders.notPrepared')}</strong>{payment?.buyer_confirmed ? ` ${t('orders.buyerConfirmed')}` : ''}{payment?.seller_confirmed ? ` ${t('orders.sellerConfirmed')}` : ''}</div>
            <div className="small"><span className="muted">{t('orders.deliveryLabel')}</span><br /><strong>{order.delivery_method ? order.delivery_method.replace(/_/g, ' ') : t('orders.notSelected')}</strong></div>
            <div><span className="muted small">{t('common.total')}</span><br /><strong>{formatMoney(total)}</strong></div>
            <Link to={`/orders/${order.id}`} className="btn btn-primary">{t('orders.viewOrder')}</Link>
          </div>
        </article>
      })}
    </div>
  </div>
}

export default function OrdersPage() { return <RequireAuth><OrdersInner /></RequireAuth> }
