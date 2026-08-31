import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { marketplaceApi } from '@/api/marketplace'
import { ApiError, type BuyerPayment, type DeliverySelectResponse, type OrderWithLines, type PublicProductDetail } from '@/api/types'
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
  const [order, setOrder] = useState<OrderWithLines | null>(null)
  const [products, setProducts] = useState<Record<string, PublicProductDetail>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!orderId) {
      navigate('/cart', { replace: true })
      return
    }
    let mounted = true
    Promise.all([buyerApi.createPayment(orderId), buyerApi.orderDetail(orderId)]).then(
      ([p, o]) => { if (mounted) { setPayment(p); setOrder(o) } },
      (e: unknown) => mounted && setError(e instanceof ApiError ? e.message : t('payment.couldNotPrepare'))
    ).finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [orderId, navigate])

  useEffect(() => {
    if (!order) return
    const ids = [...new Set(order.lines.map(line => line.product_id))]
    Promise.allSettled(ids.map(id => marketplaceApi.productDetail(id))).then(results => {
      const next: Record<string, PublicProductDetail> = {}
      results.forEach((result, index) => { if (result.status === 'fulfilled') next[ids[index]] = result.value })
      setProducts(next)
    })
  }, [order])

  async function confirmCash() {
    if (!payment) return
    setConfirming(true)
    setError('')
    try {
      const updated = await buyerApi.buyerConfirmPayment(payment.id)
      setPayment(updated)
      navigate(`/orders/${orderId}/success`, {
        state: { payment: updated },
        replace: true
      })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('payment.couldNotConfirm'))
      setConfirming(false)
    }
  }

  if (loading) return <LoadingBlock label={t('payment.preparing')} />
  if (!payment)
    return <ErrorBox error={error || t('payment.noPayment')} onRetry={() => window.location.reload()} />

  return (
    <div className="checkout-page fade-in">
      <CheckoutProgress current="Review" />
      <header className="checkout-heading"><div><h1>{t('payment.title')}</h1><p>{t('payment.subtitle')}</p></div></header>

      {error && <ErrorBox error={error} />}

      <div className="checkout-layout">
        <div className="checkout-content stack">
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
        <div className="summary-lines"><div><span>{t('cart.products')}</span><strong>{formatMoney(payment.products_base_total, payment.currency)}</strong></div><div><span>{t('payment.productPoints')}</span><strong className="discount">−{formatMoney(payment.products_points_discount, payment.currency)}</strong></div><div><span>{t('product.delivery')}</span><strong>{formatMoney(payment.delivery_fee_base, payment.currency)}</strong></div><div><span>{t('payment.deliveryPoints')}</span><strong className="discount">−{formatMoney(payment.delivery_points_discount, payment.currency)}</strong></div></div>
        <div className="summary-total"><span>{t('payment.totalCash')}</span><strong>{formatMoney(payment.cash_due, payment.currency)}</strong><small>{t('payment.cashNote')}</small></div>
        <div className="pay-note">
          {payment.products_points_used > 0 && t('payment.productsPts', { count: payment.products_points_used })}
          {payment.delivery_points_used > 0 &&
            `${payment.products_points_used > 0 ? ' · ' : ''}${t('payment.deliveryPts', { count: payment.delivery_points_used })}`}
          {payment.buyer_confirmed ? ` · ${t('payment.alreadyConfirmed')}` : ''}
        </div>
        <Button variant="accent" size="lg" block onClick={confirmCash} loading={confirming} disabled={payment.buyer_confirmed}>
          {payment.buyer_confirmed ? t('payment.orderConfirmed') : t('payment.placeOrder')}
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
