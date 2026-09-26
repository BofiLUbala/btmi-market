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
      setError('Impossible de charger les détails de la commande.')
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
  if (!order) return <ErrorBox error={error || 'Commande introuvable'} onRetry={loadData} />

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
  let statusHeadline = 'Commande confirmée'
  let statusSubtext = 'Votre commande a été transmise aux vendeurs.'

  if (payment?.payment_method === 'MOBILE_PAY_NOW') {
    if (isPaid) {
      statusHeadline = 'Commande confirmée — Paiement effectué'
      statusSubtext = `Le paiement par ${providerName || 'Mobile Money'} a été confirmé.`
    } else if (isPayNowProcessing) {
      statusHeadline = 'Commande créée — Paiement en cours'
      statusSubtext = 'Validez la demande de paiement reçue sur votre téléphone.'
    } else if (payment.status === 'FAILED') {
      statusHeadline = 'Paiement mobile non abouti'
      statusSubtext = 'La transaction a échoué. Vous pouvez réessayer la tentative.'
    }
  } else if (isCash) {
    statusHeadline = 'Commande confirmée — À payer à la livraison'
    statusSubtext = 'Montant à remettre en espèces au livreur lors de la livraison.'
  } else if (isMobileDelivery) {
    statusHeadline = 'Commande confirmée — Paiement mobile à la livraison'
    statusSubtext = `Le paiement par ${providerName || 'Mobile Money'} sera à effectuer lors de la remise de votre colis.`
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

      <div className="checkout-layout" style={{ gridTemplateColumns: '1fr 380px', gap: 24 }}>
        <div className="checkout-content stack">
          {/* STEP 4 MAIN STATUS CARD */}
          <section className="checkout-card" style={{ padding: '28px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div className="checkout-success-mark" style={{ width: 56, height: 56, fontSize: '1.6rem', flexShrink: 0 }}>
                {isPayNowProcessing ? '⏳' : isPaid || isCash || isMobileDelivery ? '✓' : 'ℹ️'}
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
                  <div><span>Opérateur</span><strong>{providerName || 'Mobile Money'}</strong></div>
                  <div><span>Référence</span><strong>{payment?.internal_reference || '—'}</strong></div>
                  <div><span>Montant à valider</span><strong>{formatMoney(payment?.final_total ?? finalTotal, currency)}</strong></div>
                  <div><span>Statut du paiement</span><strong style={{ color: 'var(--color-warning)' }}>Paiement en cours</strong></div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <Button
                    variant="accent"
                    loading={refreshingPayment}
                    onClick={() => void refreshPaymentStatus()}
                  >
                    Actualiser le statut
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/checkout/payment`, { state: { orderId, orderIds: statePayload?.orderIds }, replace: true })}
                  >
                    Changer de mode
                  </Button>
                </div>
              </div>
            )}

            {/* Mobile Pay Now Paid Details */}
            {isPaid && payment?.payment_method === 'MOBILE_PAY_NOW' && (
              <div className="summary-lines" style={{ marginTop: 16, padding: 14, borderRadius: 10, background: 'var(--color-surface-2)' }}>
                <div><span>Opérateur</span><strong>{providerName}</strong></div>
                <div><span>Référence transaction</span><strong>{payment?.internal_reference || '—'}</strong></div>
                <div><span>Montant réglé</span><strong>{formatMoney(payment?.final_total ?? finalTotal, currency)}</strong></div>
                <div><span>Confirmation</span><strong style={{ color: 'var(--color-success)' }}>✓ Payé et vérifié</strong></div>
              </div>
            )}
          </section>

          {/* MULTI-SHOP BREAKDOWN OR SINGLE ORDER BREAKDOWN */}
          <section className="checkout-card">
            <div className="checkout-card-head">
              <h2>{isMultiShop ? 'Boutiques & Commandes du groupe' : `Commande #${order.order.order_number || order.order.id.slice(0, 8)}`}</h2>
              <span>{isMultiShop ? `${displayOrders.length} commandes boutiques` : order.shop_name || 'Boutique'}</span>
            </div>

            {displayOrders.map((ordDetail, idx) => (
              <div key={ordDetail.order.id} style={{ marginTop: idx > 0 ? 20 : 12, paddingTop: idx > 0 ? 16 : 0, borderTop: idx > 0 ? '1px dashed var(--color-border)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <strong>Commande #{ordDetail.order.order_number || ordDetail.order.id.slice(0, 8)} — {ordDetail.shop_name || 'Boutique'}</strong>
                  {/* One shop: the order is the whole payment, so show what the buyer pays,
                      payment fee included - the same figure as the final total. */}
                  <span className="small muted">{formatMoney(isMultiShop ? ordDetail.order.final_total + ordDetail.order.delivery_fee_final : finalTotal, ordDetail.order.currency || 'USD')}</span>
                </div>
                {ordDetail.lines.map(line => (
                  <div className="review-order-line" key={line.id}>
                    <div>
                      <strong>{line.product_name || `Produit #${line.product_id.slice(0, 8)}`}</strong>
                      <span>{line.variant_name || line.variant_sku || 'Standard'} · Qté : {line.quantity}</span>
                      <span>Prix unitaire : {formatMoney(line.final_unit_price || line.unit_price, ordDetail.order.currency || 'USD')}</span>
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
              <h2>Adresse de livraison</h2>
              <span>{order.order.delivery_method === 'PICKUP' ? 'Retrait en magasin' : 'Livraison à domicile'}</span>
            </div>
            {deliveryAddress ? (
              <p style={{ margin: '10px 0 0', fontSize: '0.95rem', lineHeight: 1.5 }}>
                📍 {deliveryAddress}
                {order.order.delivery_landmark && (
                  <span className="muted" style={{ display: 'block', marginTop: 4 }}>
                    Instructions : {order.order.delivery_landmark}
                  </span>
                )}
              </p>
            ) : (
              <p className="muted" style={{ marginTop: 8 }}>Mode de livraison sélectionné lors de l’étape précédente.</p>
            )}
          </section>
        </div>

        {/* STICKY FINAL SUMMARY */}
        <aside className="checkout-card checkout-summary">
          <span className="eyebrow">Récapitulatif final</span>

          <div className="summary-lines">
            <div>
              <span>Sous-total produits</span>
              <strong>{formatMoney(displayOrders.reduce((sum, o) => sum + o.order.base_total, 0), currency)}</strong>
            </div>
            {displayOrders.some(o => o.order.points_discount_amount > 0) && (
              <div>
                <span>Remise points</span>
                <strong className="discount">−{formatMoney(displayOrders.reduce((sum, o) => sum + o.order.points_discount_amount, 0), currency)}</strong>
              </div>
            )}
            <div>
              <span>Frais de livraison</span>
              <strong>{formatMoney(displayOrders.reduce((sum, o) => sum + o.order.delivery_fee_final, 0), currency)}</strong>
            </div>
            {payment?.payment_markup ? (
              <div>
                <span>Frais paiement</span>
                <strong>{formatMoney(payment.payment_markup, currency)}</strong>
              </div>
            ) : null}
          </div>

          <div className="summary-total">
            <span>Total général</span>
            <strong>{formatMoney(finalTotal, currency)}</strong>
            <small>Paiement enregistré sur le serveur</small>
          </div>

          <div className="summary-lines" style={{ marginTop: 14 }}>
            <div>
              <span>Mode</span>
              <strong>{isCash ? 'Espèces à la livraison' : isMobileDelivery ? 'Mobile à la livraison' : 'Paiement mobile'}</strong>
            </div>
            {providerName && (
              <div><span>Opérateur</span><strong>{providerName}</strong></div>
            )}
            <div>
              <span>Statut</span>
              <strong style={{ color: isPaid ? 'var(--color-success)' : isPayNowProcessing ? 'var(--color-warning)' : 'var(--color-text)' }}>
                {isPaid ? 'Payé' : isPayNowProcessing ? 'En cours' : 'À payer'}
              </strong>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            <Link to={`/orders/${orderId}/tracking`} style={{ width: '100%' }}>
              <Button variant="accent" block>Suivre ma livraison</Button>
            </Link>
            <Link to="/orders" style={{ width: '100%' }}>
              <Button variant="outline" block>Mes commandes</Button>
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
