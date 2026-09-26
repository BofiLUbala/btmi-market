import { useAuth } from '@/store/auth'
import { orderApi, shopApi } from '@/api/seller'
import type { BuyerPayment, DeliveryPlan, OrderLine, OrderStatus, OrderWithLines, Shop, DeliveryPackageQR } from '@/api/types'
import { OrderItemQRSection } from '@/components/qr/OrderItemQRSection'
import { QRPanel } from '@/components/qr/QRPanel'
import { Card } from '@/components/ui/Card'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { hasActiveOrderStatus } from '@/lib/orderStatus'
import { paymentStatusKey, confirmationActorKey, isPaymentPaid } from '@/lib/paymentStatus'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { useI18n, useT } from '@/store/i18n'
import { useOrderEvents } from '@/lib/orderEvents'
import { expectedDeliveryText } from '@/lib/deliveryPlan'
import { DeliveryPlanCard } from '@/components/checkout/DeliveryPlanCard'
import { DEFAULT_CURRENCY, formatMoney, formatDateTime } from '@/lib/format'
import type { TranslationKey } from '@/locales/fr'

const POLL_INTERVAL = 30_000 // 30 seconds

function timeAgo(date: Date, t: ReturnType<typeof useT>): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 5) return t('time.justNow')
  if (seconds < 60) return t('time.secondsAgo', { count: seconds })
  const minutes = Math.floor(seconds / 60)
  return t('time.minutesAgo', { count: minutes })
}

interface Order extends DeliveryPlan {
  id: string
  order_number?: string
  status: string
  final_total: number
  base_total?: number
  /** Snapshot taken when the order was placed; never re-derived from config. */
  currency?: string
  created_at: string
  shop_id: string
  delivery_method?: string
  delivery_status?: string
  notes?: string
}

/**
 * An order always renders in the currency it was sold in. Orders placed before
 * the platform moved to USD keep their own code, so a shop total is only shown
 * as one figure when every order under it agrees; otherwise each line speaks
 * for itself rather than adding CDF to USD.
 */
function sharedCurrency(orders: Order[]): string | null {
  const codes = new Set(orders.map((order) => order.currency || DEFAULT_CURRENCY))
  return codes.size === 1 ? [...codes][0] : null
}

type SellerAction = { label: string; status?: OrderStatus; action?: 'accept' | 'reject' | 'prepare' }

function nextActions(order: Order, t: ReturnType<typeof useT>): SellerAction[] {
  if (order.status === 'PENDING') return [{ label: t('seller.orders.accept'), action: 'accept' }, { label: t('seller.orders.reject'), action: 'reject' }]
  if (order.status === 'ACCEPTED') return [{ label: t('seller.orders.startPreparing'), action: 'prepare' }]
  if (order.status === 'PREPARING') {
    return order.delivery_method === 'PICKUP'
      ? [{ label: t('seller.orders.readyForPickup'), status: 'READY_FOR_PICKUP' }]
      : [{ label: t('seller.orders.markReady'), status: 'READY' }]
  }
  if (order.status === 'READY' && order.delivery_method === 'SHOP_DELIVERY') return [{ label: t('seller.orders.dispatchOrder'), status: 'OUT_FOR_DELIVERY' }]
  if (order.status === 'READY' && order.delivery_method === 'PARTNER') return [{ label: t('seller.orders.handToPartner'), status: 'HANDED_TO_PARTNER' }]
  // Delivery is always carried out by a TBK courier, who confirms the handover at the
  // buyer's door; the seller never marks an order delivered themselves.
  return []
}

function orderStatusLabel(status: string, t: ReturnType<typeof useT>): string {
  const key = `status.${status}`
  const value = t(key as TranslationKey)
  return value === key ? status : value
}

export default function SellerOrdersPage() {
  const { t, lang } = useI18n()
  const [searchParams] = useSearchParams()
  // Notifications link with ?order_id=, older links with ?orderId=.
  const orderIdParam = searchParams.get('orderId') || searchParams.get('order_id')
  const { activeBusiness } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(orderIdParam)
  const [actionError, setActionError] = useState('')
  const [actingId, setActingId] = useState<string | null>(null)
  const [payments, setPayments] = useState<Record<string, BuyerPayment | null>>({})
  const [details, setDetails] = useState<Record<string, OrderWithLines>>({})
  const [packageQRs, setPackageQRs] = useState<Record<string, DeliveryPackageQR>>({})
  const [shops, setShops] = useState<Shop[]>([])
  const [shopFilter, setShopFilter] = useState('ALL')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    setShopFilter('ALL')
    if (activeBusiness) {
      void shopApi.listByBusiness(activeBusiness.id).then(setShops).catch(() => setShops([]))
    } else {
      setShops([])
    }
  }, [activeBusiness?.id])

  const loadOrders = useCallback(async (silent = false) => {
    if (!activeBusiness) return
    if (!silent) { setLoading(true); setError('') }
    if (silent) setRefreshing(true)
    try {
      const data = shopFilter === 'ALL'
        ? await orderApi.listByBusiness(activeBusiness.id)
        : await orderApi.listByShop(shopFilter)
      setOrders(Array.isArray(data) ? data : [])
      setLastUpdated(new Date())
      if (!silent) setError('')
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : t('seller.orders.loadFailed'))
        setOrders([])
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeBusiness?.id, shopFilter, t])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  // Auto-polling with tab visibility — pauses when every Order is in a final state
  const hasActive = useMemo(() => hasActiveOrderStatus(orders.map((o) => o.status)), [orders])
  useEffect(() => {
    function startPolling() {
      stopPolling()
      intervalRef.current = setInterval(() => void loadOrders(true), POLL_INTERVAL)
    }
    function stopPolling() {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        void loadOrders(true)
        if (hasActiveOrderStatus(orders.map((o) => o.status))) startPolling()
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
  }, [loadOrders, hasActive])

  // Pushed the moment the buyer, TBK or the courier changes one of this business's orders.
  useOrderEvents((event) => {
    void loadOrders(true)
    if (event.order_id && event.order_id === expandedId) {
      const id = event.order_id
      void orderApi.get(id).then((d) => setDetails((prev) => ({ ...prev, [id]: d }))).catch(() => undefined)
      void orderApi.getOrderPayment(id).then((p) => setPayments((prev) => ({ ...prev, [id]: p }))).catch(() => undefined)
    }
  })

  // Tick for timeAgo
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  async function runAction(order: Order, fn: () => Promise<unknown>) {
    setActingId(order.id)
    setActionError('')
    try {
      await fn()
      await loadOrders()
      if (expandedId === order.id) {
        const detail = await orderApi.get(order.id)
        setDetails((prev) => ({ ...prev, [order.id]: detail }))
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('seller.orders.actionFailed'))
    } finally {
      setActingId(null)
    }
  }

  async function toggleDetails(order: Order) {
    if (expandedId === order.id) { setExpandedId(null); return }
    setExpandedId(order.id); setActionError('')
    try {
      const [detail, payment] = await Promise.all([
        orderApi.get(order.id),
        orderApi.getOrderPayment(order.id).catch((err) => {
          if (err instanceof Error && /PAYMENT_NOT_FOUND/i.test(err.message)) return null
          throw err
        })
      ])
      setDetails(prev => ({ ...prev, [order.id]: detail }))
      if (['READY', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RECEIVED', 'COMPLETED'].includes(order.status)) {
        void orderApi.getPackageQR(order.id).then((qr) => setPackageQRs((prev) => ({ ...prev, [order.id]: qr }))).catch(() => undefined)
      }
      setPayments(prev => ({ ...prev, [order.id]: payment }))
    }
    catch (err) {
      if (!(err instanceof Error && /PAYMENT_NOT_FOUND/i.test(err.message))) setActionError(err instanceof Error ? err.message : t('seller.orders.loadPaymentFailed'))
      setPayments(prev => ({ ...prev, [order.id]: null }))
    }
  }

  // The seller has no cash-confirmation action. Cash is handed to the courier at the
  // buyer's door, so the courier confirms it; the seller only reads the result.

  const visibleOrders = Array.isArray(orders) ? orders : []
  const shopNames = new Map(shops.map((shop) => [shop.id, shop.name]))
  const orderGroups = useMemo(() => {
    const grouped = new Map<string, Order[]>()
    for (const order of visibleOrders) {
      const group = grouped.get(order.shop_id) ?? []
      group.push(order)
      grouped.set(order.shop_id, group)
    }

    return [...grouped.entries()]
      .map(([shopId, shopOrders]) => ({
        shopId,
        shopName: shopNames.get(shopId) ?? t('seller.orders.unknownShop'),
        orders: shopOrders,
        total: shopOrders.reduce((sum, order) => sum + (order.final_total || 0), 0),
        currency: sharedCurrency(shopOrders),
      }))
      .sort((a, b) => {
        // Newest order first, across shops, so a fresh order never gets buried
        // under a shop that only sorts earlier alphabetically.
        const aLatest = a.orders[0]?.created_at ? new Date(a.orders[0].created_at).getTime() : 0
        const bLatest = b.orders[0]?.created_at ? new Date(b.orders[0].created_at).getTime() : 0
        return bLatest - aLatest
      })
  }, [visibleOrders, shops, t])

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <div className="empty-icon" style={{ fontSize: 64 }}>🧾</div>
        <h2>{t('seller.noBusinessSelected')}</h2>
        <p className="muted">{t('seller.orders.noBusinessSubtitle')}</p>
      </div>
    )
  }

  // Shared between the desktop table cell and the mobile card so a narrow
  // screen never has to scroll a table sideways to see order actions/details.
  function renderOrderActions(order: Order, actions: SellerAction[], isExpanded: boolean) {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {actions.map((a) => (
          <Button
            key={a.label}
            variant={a.action === 'reject' ? 'ghost' : 'outline'}
            size="sm"
            disabled={actingId === order.id}
            onClick={() =>
              runAction(order, () => {
                if (a.action === 'accept') return orderApi.accept(order.id)
                if (a.action === 'reject') return orderApi.reject(order.id)
                if (a.action === 'prepare') return orderApi.prepare(order.id)
                return orderApi.sellerTransition(order.id, { status: a.status! })
              })
            }
          >
            {a.label}
          </Button>
        ))}
        {order.delivery_status === 'RETURNING_TO_SELLER' && (
          <Button
            size="sm"
            disabled={actingId === order.id}
            onClick={() => {
              if (confirm(t('deliveryPlan.confirmReturnAsk'))) void runAction(order, () => orderApi.confirmReturn(order.id))
            }}
          >
            {t('deliveryPlan.confirmReturn')}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => void toggleDetails(order)}>
          {isExpanded ? t('seller.orders.hide') : t('common.view')}
        </Button>
      </div>
    )
  }

  function renderOrderDetails(order: Order) {
    const payment = payments[order.id]
    const detail = details[order.id]
    return (
      <div className="small muted" style={{ marginTop: 8, textAlign: 'left' }}>
        <div><strong>{t('orders.deliveryLabel')}:</strong> {order.delivery_method || '—'}</div>
        <div><strong>{t('seller.orders.baseTotal')}:</strong> {formatMoney(order.base_total ?? order.final_total, order.currency || DEFAULT_CURRENCY)}</div>
        {order.notes && <div><strong>{t('seller.orders.notesLabel')}:</strong> {order.notes}</div>}
        <div><strong>{t('seller.orders.shopId')}:</strong> {order.shop_id}</div>
        {detail?.order && <div className="seller-payment-box">
          <strong>Livraison</strong>
          <div>Statut: <strong>{detail.order.delivery_status || '—'}</strong></div>
          <div>Client: {detail.order.delivery_contact_name || '—'} · {detail.order.delivery_phone || '—'}</div>
          <div>Adresse: {detail.order.delivery_address || '—'}</div>
          {detail.order.delivery_notes && <div>Instructions: {detail.order.delivery_notes}</div>}
          <div>Frais de livraison TBK : {formatMoney(detail.order.delivery_fee_final, detail.order.currency || order.currency || DEFAULT_CURRENCY)} <span className="small muted">(tarif TBK payé par l’acheteur, hors de votre revenu)</span></div>
        </div>}
        {detail?.order && <DeliveryPlanCard plan={detail.order} status={detail.order.status} deliveryStatus={detail.order.delivery_status} deliveryMethod={detail.order.delivery_method} />}
        {detail?.lines?.length ? <div className="seller-order-lines"><strong>{t('cart.products')}</strong>{detail.lines.map((line) => <SellerOrderLineQR key={line.id} line={line} orderId={order.id} orderNumber={order.order_number || order.id.slice(0, 8)} shopName={activeBusiness?.name || ''} currency={detail.order?.currency || order.currency || DEFAULT_CURRENCY} />)}</div> : <div>{t('seller.orders.loadingDetails')}</div>}
        <div className="seller-payment-box">
          <strong>{t('seller.orders.cashPayment')}</strong>
          {payment ? <>
            <div>{t('orders.amountDue')}: <strong>{formatMoney(payment.cash_due, payment.currency || order.currency || DEFAULT_CURRENCY)}</strong></div>
            <div>Mode: <strong>{payment.payment_method}</strong>{payment.provider ? ` · ${payment.provider}` : ''}</div>
            <div>Majoration: {formatMoney(payment.payment_markup, payment.currency || order.currency || DEFAULT_CURRENCY)} · Total: <strong>{formatMoney(payment.final_total, payment.currency || order.currency || DEFAULT_CURRENCY)}</strong></div>
            <div>{t('common.status')}: <strong>{t(paymentStatusKey(payment) as TranslationKey)}</strong></div>
            {isPaymentPaid(payment)
              ? <div>{confirmationActorKey(payment.confirmation_actor)
                  ? t(confirmationActorKey(payment.confirmation_actor) as TranslationKey)
                  : t('orders.paymentPaid')}</div>
              : <div className="muted">{t('seller.orders.cashAwaitingCourier')}</div>}
          </> : <div>{t('seller.orders.noPaymentCreated')}</div>}
        </div>
        {packageQRs[order.id] && (
          <QRPanel
            qr={packageQRs[order.id]}
            title="TBK Package QR"
            imagePath={`/orders/${order.id}/package-qr/label`}
            fields={[
              { label: 'Commande', value: order.order_number || order.id.slice(0, 8) },
              { label: 'Colis', value: `#${packageQRs[order.id].package_number}` },
              { label: 'Boutique', value: activeBusiness?.name || '' },
            ]}
          />
        )}
      </div>
    )
  }

  return (
    <div className="seller-orders">
      <div className="page-header">
        <h1>{t('seller.orders')}</h1>
      </div>

      {/* Live sync bar */}
      <div className="live-bar">
        <span className="live-label"><span className="live-dot" /> {t('orders.live')}</span>
        <span>{lastUpdated ? t('orders.updated', { time: timeAgo(lastUpdated, t) }) : t('orders.loading')}</span>
        <button className="refresh-btn" onClick={() => void loadOrders()} disabled={refreshing}>
          {refreshing ? '⟳' : t('orders.refresh')}
        </button>
      </div>

      <div className="row-between seller-order-filters">
        <div><strong>{visibleOrders.length === 1 ? t('seller.orders.count', { count: visibleOrders.length }) : t('seller.orders.count_plural', { count: visibleOrders.length })}</strong><div className="small muted">{shopFilter === 'ALL' ? (orderGroups.length === 1 ? t('seller.orders.classifiedAcross', { count: orderGroups.length }) : t('seller.orders.classifiedAcross_plural', { count: orderGroups.length })) : t('seller.orders.forShop', { shop: shopNames.get(shopFilter) ?? t('seller.orders.selectedShop') })}</div></div>
        <label className="small"><span className="muted">{t('orders.shop')} </span><select className="select" value={shopFilter} onChange={(event) => setShopFilter(event.target.value)}><option value="ALL">{t('seller.allShops')}</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label>
      </div>

      {loading ? (
        <LoadingBlock label={t('seller.orders.loading')} />
      ) : error ? (
        <ErrorBox error={t('seller.orders.unableToLoad', { error })} onRetry={() => void loadOrders()} />
      ) : visibleOrders.length === 0 ? (
        <Card>
          <div className="empty-state" style={{ padding: '48px 0', textAlign: 'center' }}>
            <div className="empty-icon" style={{ fontSize: 48 }}>🧾</div>
            <h3>{shopFilter === 'ALL' ? t('seller.orders.emptyTitle') : t('seller.orders.emptyShopTitle')}</h3>
            <p className="muted">{shopFilter === 'ALL' ? t('seller.orders.emptyDesc') : t('seller.orders.emptyShopDesc')}</p>
          </div>
        </Card>
      ) : (
        <>
          {actionError && <ErrorBox error={actionError} />}
          <Card>
            {/* Desktop: a scannable table. Hidden under 768px so order info never
                requires sideways scrolling — the card list below takes over instead. */}
            <div className="table-responsive desktop-table-view">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('seller.orders.orderNumber')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('seller.orders.totalFc')}</th>
                    <th>{t('common.date')}</th>
                    <th>{t('orders.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orderGroups.flatMap((group) => [
                    <tr className="seller-order-shop-heading" key={`shop-${group.shopId}`}>
                      <td colSpan={5}>
                        <div className="seller-order-shop-summary">
                          <span><strong>{group.shopName}</strong> <span className="muted">· {group.orders.length === 1 ? t('seller.orders.count', { count: group.orders.length }) : t('seller.orders.count_plural', { count: group.orders.length })}</span></span>
                          <strong>{group.currency ? formatMoney(group.total, group.currency) : '—'}</strong>
                        </div>
                      </td>
                    </tr>,
                    ...group.orders.map((order) => {
                    const actions = nextActions(order, t)
                    const isExpanded = expandedId === order.id
                    return (
                      <tr key={order.id}>
                        <td>{order.order_number || order.id.slice(0, 8)}</td>
                        <td>
                          <span className={`badge badge-${getStatusColor(order.delivery_status || order.status)}`}>
                            {orderStatusLabel(order.delivery_status || order.status, t)}
                          </span>
                          {order.expected_delivery_date && !['CANCELLED', 'COMPLETED'].includes(order.status) && (
                            <div className="small muted" style={{ marginTop: 4 }}>📅 {expectedDeliveryText(order, t, lang)}</div>
                          )}
                        </td>
                        <td>{formatMoney(order.final_total || 0, order.currency || DEFAULT_CURRENCY)}</td>
                        <td>{formatDateTime(order.created_at)}</td>
                        <td>
                          {renderOrderActions(order, actions, isExpanded)}
                          {isExpanded && renderOrderDetails(order)}
                        </td>
                      </tr>
                    )
                    }),
                  ])}
                </tbody>
              </table>
            </div>

            {/* Mobile: one card per order, stacked vertically — no horizontal scroll. */}
            <div className="mobile-card-list">
              {orderGroups.flatMap((group) => [
                <div className="seller-order-shop-summary" key={`m-shop-${group.shopId}`} style={{ padding: '10px 4px' }}>
                  <span><strong>{group.shopName}</strong> <span className="muted">· {group.orders.length === 1 ? t('seller.orders.count', { count: group.orders.length }) : t('seller.orders.count_plural', { count: group.orders.length })}</span></span>
                  <strong>{group.currency ? formatMoney(group.total, group.currency) : '—'}</strong>
                </div>,
                ...group.orders.map((order) => {
                  const actions = nextActions(order, t)
                  const isExpanded = expandedId === order.id
                  return (
                    <div className="mobile-data-card" key={`m-${order.id}`}>
                      <div className="mobile-data-card-header">
                        <strong>{order.order_number || order.id.slice(0, 8)}</strong>
                        <span className="small muted">{formatDateTime(order.created_at)}</span>
                      </div>
                      <div className="mobile-data-card-row">
                        <span className={`badge badge-${getStatusColor(order.delivery_status || order.status)}`}>
                          {orderStatusLabel(order.delivery_status || order.status, t)}
                        </span>
                        <strong>{formatMoney(order.final_total || 0, order.currency || DEFAULT_CURRENCY)}</strong>
                      </div>
                      {order.expected_delivery_date && !['CANCELLED', 'COMPLETED'].includes(order.status) && (
                        <div className="small muted">📅 {expectedDeliveryText(order, t, lang)}</div>
                      )}
                      <div style={{ marginTop: 6 }}>
                        {renderOrderActions(order, actions, isExpanded)}
                        {isExpanded && renderOrderDetails(order)}
                      </div>
                    </div>
                  )
                }),
              ])}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

/**
 * One order line in the seller's fulfilment view, with its own ORDER_ITEM QR.
 *
 * Each line carries its own code: a two-item order produces two distinct QRs, and
 * the package QR is a separate thing that is not replaced here. The label fields
 * are preparation data only — the seller's response deliberately excludes buyer
 * contact and address, so none of it can reach the printer.
 */
function SellerOrderLineQR({
  line,
  orderId,
  orderNumber,
  shopName,
  currency,
}: {
  line: OrderLine
  orderId: string
  orderNumber: string
  shopName: string
  currency: string
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const load = useCallback(() => orderApi.getOrderItemQR(orderId, line.id), [orderId, line.id])
  const price = formatMoney(line.final_unit_price || line.unit_price, currency)
  const name = line.product_name || line.product_id || ''
  const variant = line.variant_name || line.variant_sku || ''

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ flex: '1 1 auto' }}>
          {line.product_id && <Link to={`/seller/products/${line.product_id}`} style={{ fontWeight: 700, marginRight: 6 }}>{name}</Link>}
          {variant
            ? t('seller.orders.lineWithVariant', { name, variant, quantity: line.quantity, price })
            : t('seller.orders.line', { name, quantity: line.quantity, price })}
        </span>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? t('itemQr.hide') : t('itemQr.action')}
        </Button>
      </div>
      {open && (
        <OrderItemQRSection
          load={load}
          imagePath={orderApi.orderItemQRImagePath(orderId, line.id)}
          instruction={t('itemQr.sellerInstruction')}
          fields={[
            { label: t('itemQr.labelOrder'), value: orderNumber },
            { label: t('itemQr.labelProduct'), value: name },
            { label: t('itemQr.labelVariant'), value: variant },
            { label: t('itemQr.labelQuantity'), value: String(line.quantity) },
            { label: t('itemQr.labelShop'), value: shopName },
          ]}
        />
      )}
    </div>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'success'
    case 'PENDING': return 'warning'
    case 'ACCEPTED':
    case 'PREPARING':
    case 'READY': return 'info'
    case 'OUT_FOR_DELIVERY':
    case 'DELIVERED': return 'primary'
    case 'CANCELLED':
    case 'REJECTED': return 'danger'
    default: return 'muted'
  }
}
