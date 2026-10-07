import { CancelReasonSheet } from '../../src/components/CancelReasonSheet'
import { CancellationCard } from '../../src/components/CancellationCard'
import { Suspense, useMemo, useState } from 'react'
import { LazyLiveCourierMap } from '../../src/components/LazyLiveCourierMap'
import { isLiveTracked } from '../../src/lib/liveTracking'
import { Image } from 'expo-image'
import { Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { resolveMediaUrl } from '../../src/api/client'
import { timelineNote } from '../../src/lib/timelineNote'
import { OrderRatingCard } from '../../src/components/OrderRatingCard'
import { DeliveryPlanCard } from '../../src/components/DeliveryPlanCard'
import { buyerCanCancel, isPaidBeforeHandover, PARCEL_WITH_COURIER } from '../../src/lib/deliveryPlan'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../src/components/ui'
import { KeyboardAwareScrollView } from '../../src/components/KeyboardAwareScrollView'
import { OrderChatFeed } from '../../src/components/OrderChatFeed'
import type { ChatParty } from '../../src/api/communication'
import { BuyerHandoverCard, MobilePaymentCard } from '../../src/components/BuyerHandover'
import { formatMoney } from '../../src/lib/money'
import { dateLocale } from '../../src/lib/format'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { fonts, radius, shadow, spacing, type Colors } from '../../src/theme'
import type { OrderStatusHistory, BuyerPayment, ProductVerification, OrderLine } from '../../src/types'
import { statusLabel } from '../../src/lib/statusLabels'
import { deliveryLabel } from '../../src/lib/deliveryLabels'
import { courierReached } from '../../src/lib/courierSteps'
import {
  paymentStatusKey,
  paymentMethodKey,
  confirmationActorKey,
  isPaymentPaid,
  isPaymentConfirmed,
  isPaymentCancelled,
  isPaymentFailed,
  isPaymentProcessing,
  isCashOnDelivery,
  isMobileAtDelivery,
} from '../../src/lib/paymentStatus'

const POLL_INTERVAL = 15_000
// Order state that is final: the buyer stops polling here. DELIVERED is not:
// the buyer still has to acknowledge the items and confirm receipt.
const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED', 'RECEIVED']
// Delivery-level states that are terminal for this courier's work (FAILED can be
// reassigned by an admin, so it is NOT a terminal order state).
const TERMINAL_DELIVERY_STATUSES = ['DELIVERED', 'RECEIVED', 'COMPLETED', 'CANCELLED', 'FAILED', 'COURIER_REJECTED']
const isTerminal = (status?: string) => !!status && TERMINAL_STATUSES.includes(status)
const isTerminalDelivery = (status?: string) => !!status && TERMINAL_DELIVERY_STATUSES.includes(status)

const FLOW_STEPS: Record<string, string[]> = {
  PICKUP: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'RECEIVED', 'COMPLETED'],
  SHOP_DELIVERY: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RECEIVED', 'COMPLETED'],
  PARTNER: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'HANDED_TO_PARTNER', 'DELIVERED', 'RECEIVED', 'COMPLETED'],
  // The seller's steps (order statuses) then the courier's (delivery statuses).
  TBK_STANDARD: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COURIER_ASSIGNED', 'COURIER_ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED', 'DELIVERED', 'RECEIVED'],
  // DELIVERED: handed over once the goods are verified and the money settled - no door QR.
}

// Waiting states already covered by a step of the flow: never appended as an extra step.
const COVERED_STATUSES = ['PENDING_TBK_ASSIGNMENT', 'READY_FOR_PICKUP', 'AWAITING_BUYER_CONFIRMATION', 'DELIVERY_SCAN_SUCCESS']

// Real rows carry several spellings of the TBK courier method.
FLOW_STEPS.TBK_DELIVERY = FLOW_STEPS.TBK_STANDARD
FLOW_STEPS.TBK = FLOW_STEPS.TBK_STANDARD

// The tracking history records order statuses only. A courier step is dated by
// the order transition that happens at the same moment.
const HISTORY_ALIASES: Record<string, string> = {
  PICKED_UP: 'OUT_FOR_DELIVERY',
  DELIVERY_SCAN_SUCCESS: 'DELIVERED',
}

function getDeliverySteps(method: string, currentStatus: string): string[] {
  const base = FLOW_STEPS[method] || [currentStatus]
  return base.includes(currentStatus) || COVERED_STATUSES.includes(currentStatus) ? base : [...base, currentStatus]
}

const ACTOR_KEYS: Record<string, TranslationKey> = {
  SELLER: 'orders.actorSeller',
  BUYER: 'orders.actorBuyer',
  SYSTEM: 'orders.actorSystem',
}

const REASON_KEYS: Record<string, TranslationKey> = {
  ORDER_NOT_COMPLETED: 'orders.reasonNotCompleted',
  PAYMENT_NOT_VERIFIED: 'orders.reasonPaymentNotVerified',
  REVIEW_ALREADY_EXISTS: 'orders.reasonReviewExists',
}

const locale = (lang: string) => dateLocale(lang === 'en' ? 'en' : 'fr')

function formatDateTime(value: string, lang: string) {
  return new Date(value).toLocaleString(locale(lang), { dateStyle: 'medium', timeStyle: 'medium' })
}

/* ── "Parcours de la commande": the web OrderTimeline, step for step ── */
const ORDER_STAGES = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RECEIVED', 'COMPLETED']
const COURIER_AT_DOOR = ['COURIER_ARRIVED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION', 'RECEIVED']
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ord = any
const isTbkDelivery = (o: Ord) => String(o.delivery_method || '').startsWith('TBK')
const stageAtLeast = (o: Ord, stage: string) => ORDER_STAGES.indexOf(o.status) >= ORDER_STAGES.indexOf(stage)
const WEB_TIMELINE: Array<{ key: string; label: string; tbkOnly?: boolean; done: (o: Ord, p: BuyerPayment | null) => boolean }> = [
  { key: 'cart', label: 'nav.cart', done: () => true },
  { key: 'checkout', label: 'orders.checkoutStarted', done: () => true },
  { key: 'address', label: 'orders.addressConfirmed', done: (o) => !!o.delivery_method },
  { key: 'method', label: 'orders.paymentMethodChosen', done: (_, p) => !!p },
  { key: 'created', label: 'orders.orderCreated', done: () => true },
  { key: 'payment', label: 'orders.paymentStep', done: (_, p) => isPaymentPaid(p) },
  { key: 'preparing', label: 'orders.sellerPreparing', done: (o) => stageAtLeast(o, 'ACCEPTED') },
  { key: 'assigned', label: 'orders.courierAssigned', tbkOnly: true, done: (o) => courierReached(o, 'COURIER_ASSIGNED') },
  { key: 'courierAccepted', label: 'orders.courierAccepted', tbkOnly: true, done: (o) => courierReached(o, 'COURIER_ACCEPTED') },
  { key: 'picked', label: 'orders.productPicked', tbkOnly: true, done: (o) => courierReached(o, 'PICKED_UP') },
  { key: 'delivery', label: 'orders.inDelivery', done: (o) => isTbkDelivery(o) ? courierReached(o, 'IN_TRANSIT') : stageAtLeast(o, 'OUT_FOR_DELIVERY') },
  { key: 'arrived', label: 'orders.arrived', done: (o) => COURIER_AT_DOOR.includes(o.delivery_status || '') || stageAtLeast(o, 'DELIVERED') },
  { key: 'received', label: 'orders.received', done: (o) => stageAtLeast(o, 'RECEIVED') },
]

function WebOrderTimeline({ o, payment, styles }: { o: Ord; payment: BuyerPayment | null; styles: ReturnType<typeof makeStyles> }) {
  const { t } = useI18n()
  const colors = useColors()
  const w = (key: string) => t(`web.${key}` as TranslationKey)
  let visible = WEB_TIMELINE.filter((step) => !step.tbkOnly || isTbkDelivery(o))
  // Paid at the door: payment sits after "Arrivé", as on the web.
  if (!payment || payment.payment_timing === 'DELIVERY') {
    const pay = visible.find((step) => step.key === 'payment')
    visible = visible.filter((step) => step.key !== 'payment')
    if (pay) visible.splice(visible.findIndex((step) => step.key === 'arrived') + 1, 0, pay)
  }
  const done = visible.map((step) => step.done(o, payment))
  const current = done.findIndex((d) => !d)
  return (
    <View style={styles.timelineCard}>
      <Text style={styles.cardH2}>{w('orders.lifecycle')}</Text>
      {visible.map((step, i) => {
        const isCurrent = i === current
        const last = i === visible.length - 1
        return (
          <View key={step.key} style={styles.webStep}>
            <View style={styles.webRail}>
              <View style={[styles.webDot, done[i] && styles.webDotDone, isCurrent && styles.webDotCurrent]}>
                {done[i] ? <Ionicons name="checkmark" size={13} color={colors.onGreen} /> : isCurrent ? <Ionicons name="ellipse" size={8} color={colors.green} /> : null}
              </View>
              {!last ? <View style={[styles.webLine, done[i] && { backgroundColor: colors.green }]} /> : null}
            </View>
            <View style={styles.webStepBody}>
              <Text style={[styles.webStepText, isCurrent && { color: colors.green }, !done[i] && !isCurrent && { color: colors.muted, fontWeight: '600' }]}>{w(step.label)}</Text>
              {step.key === 'payment' ? <Text style={styles.webStepSub}>{t(paymentStatusKey(payment) as TranslationKey)}</Text> : null}
            </View>
          </View>
        )
      })}
      <Text style={[styles.hint, { marginTop: 8 }]}>{w('tracking.note')}</Text>
    </View>
  )
}

/**
 * The payment lifecycle as the buyer should read it, per method.
 *
 * Cash runs through the physical handover - courier arrives, goods are checked, money
 * changes hands - and only the courier's confirmation makes it paid. Mobile money runs
 * through the operator instead. Each step is drawn from a stored fact.
 */
function PaymentLifecycle({ p, o, t, styles }: { p: BuyerPayment; o: { status: string; delivery_status?: string | null }; t: (key: TranslationKey, vars?: Record<string, string | number>) => string; styles: ReturnType<typeof makeStyles> }) {
  const paid = isPaymentPaid(p)
  const arrived = ['COURIER_ARRIVED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION', 'RECEIVED'].includes(o.delivery_status || '')
    || ['DELIVERED', 'RECEIVED', 'COMPLETED'].includes(o.status)
  const verified = ['DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION', 'RECEIVED'].includes(o.delivery_status || '')

  const steps: Array<{ key: TranslationKey; done: boolean }> = isCashOnDelivery(p)
    ? [
        { key: 'orders.lifecycleDue', done: true },
        { key: 'orders.lifecycleCourierArrived', done: arrived },
        { key: 'orders.lifecycleProductVerified', done: verified || paid },
        { key: 'orders.lifecycleCashReceived', done: paid },
        { key: 'orders.lifecyclePaid', done: paid },
      ]
    : [
        { key: 'orders.lifecycleDue', done: true },
        { key: 'orders.lifecyclePaymentStarted', done: isPaymentProcessing(p) || paid },
        { key: 'orders.lifecycleProviderConfirmation', done: paid },
        { key: 'orders.lifecyclePaid', done: paid },
      ]

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={[styles.muted, { fontWeight: '800' }]}>{t('orders.paymentTimeline')}</Text>
      {steps.map(step => (
        <Text key={step.key} style={[styles.muted, { opacity: step.done ? 1 : 0.45 }]}>
          {step.done ? '✓' : '○'} {t(step.key)}
        </Text>
      ))}
    </View>
  )
}

/**
 * What actually happened to this payment, with times. Only backend-recorded events
 * appear, and a settlement is attributed to whoever the backend says settled it.
 */
function PaymentAttempts({ p, o, lang, t, styles }: { p: BuyerPayment | null; o: { created_at: string }; lang: string; t: (key: TranslationKey, vars?: Record<string, string | number>) => string; styles: ReturnType<typeof makeStyles> }) {
  if (!p) return null
  const methodLabel = t(paymentMethodKey(p.payment_method))
  const attempts: Array<{ label: string; at: string; ok: boolean }> = [
    { label: t('orders.orderCreated'), at: formatDateTime(o.created_at, lang), ok: true },
    { label: `${t('orders.paymentMethodChosen')} · ${methodLabel}`, at: formatDateTime(p.created_at, lang), ok: true },
  ]
  const settledAt = p.paid_at || p.cash_received_at || p.verified_at
  if (isPaymentPaid(p) && settledAt) {
    const actor = confirmationActorKey(p.confirmation_actor)
    attempts.push({
      label: actor ? `${t('orders.paymentPaid')} · ${t(actor)}` : t('orders.paymentPaid'),
      at: formatDateTime(settledAt, lang),
      ok: true,
    })
  }
  if (isPaymentFailed(p)) attempts.push({ label: t('orders.paymentFailed'), at: formatDateTime(p.updated_at || p.created_at, lang), ok: false })
  if (isPaymentCancelled(p)) attempts.push({ label: t('orders.paymentCancelled'), at: formatDateTime(p.updated_at || p.created_at, lang), ok: false })

  return (
    <Card>
      <Text style={styles.name}>{t('orders.attempts')}</Text>
      {attempts.map((a, i) => (
        <View key={i} style={styles.breakRow}>
          <Text style={styles.muted}>{a.ok ? '✓' : '✕'} {a.label}</Text>
          <Text style={styles.time}>{a.at}</Text>
        </View>
      ))}
    </Card>
  )
}

export default function OrderScreen(){const colors=useColors();const styles=useMemo(()=>makeStyles(colors),[colors]);
  const { t, lang } = useI18n()
  const { id } = useLocalSearchParams<{id:string}>()
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState('')
  const [productNumber, setProductNumber] = useState('')
  const [productVerification, setProductVerification] = useState<ProductVerification | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [chatParty, setChatParty] = useState<ChatParty | undefined>(undefined)

  const order = useQuery({
    queryKey: ['buyer','order',id],
    queryFn: () => buyerApi.order(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => isTerminal(query.state.data?.order?.status) ? false : POLL_INTERVAL,
  })
  const tracking = useQuery({
    queryKey: ['buyer','tracking',id],
    queryFn: () => buyerApi.tracking(id!),
    enabled: Boolean(id),
    // Stop once the order or its delivery is over (the order may be reassigned later).
    refetchInterval: (query) => isTerminal(query.state.data?.current_status) || isTerminalDelivery(query.state.data?.delivery_status || undefined) ? false : POLL_INTERVAL,
  })
  const payment = useQuery({
    queryKey: ['buyer','payment',id],
    queryFn: () => buyerApi.getPayment(id!),
    enabled: Boolean(id),
    retry: false,
    // A payment with the operator settles by callback: follow it until it lands.
    refetchInterval: (query) => ['PROCESSING', 'PENDING'].includes(query.state.data?.status || '') ? 5_000 : isPaymentPaid(query.state.data) ? false : POLL_INTERVAL,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['buyer','order',id] })
    void queryClient.invalidateQueries({ queryKey: ['buyer','tracking',id] })
    void queryClient.invalidateQueries({ queryKey: ['buyer','payment',id] })
    void queryClient.invalidateQueries({ queryKey: ['buyer','handover',id] })
    void queryClient.invalidateQueries({ queryKey: ['buyer','orders'] })
  }

  const receiveMutation = useMutation({ mutationFn: () => buyerApi.confirmReceived(id!), onSuccess: invalidate, onError: (e) => setActionError(e instanceof ApiError ? e.message : t('common.actionImpossible')) })
  // Cancelling asks for the reason first (CancelReasonSheet): everyone sees it.
  const [cancelAsk, setCancelAsk] = useState(false)
  const cancelMutation = useMutation({ mutationFn: (reason: string) => buyerApi.cancelOrder(id!, reason), onSuccess: () => { setCancelAsk(false); invalidate() }, onError: (e) => { setCancelAsk(false); setActionError(e instanceof ApiError ? e.message : t('common.actionImpossible')) } })
  const createPaymentMutation = useMutation({ mutationFn: () => buyerApi.createPayment(id!), onSuccess: invalidate, onError: (e) => setActionError(e instanceof ApiError ? e.message : t('common.actionImpossible')) })
  // There is no "I have paid" mutation. Cash is settled by the assigned courier at the
  // door and mobile money by the operator's callback, so the buyer can only read the
  // outcome here - saying so is not paying.
  const verifyMutation = useMutation({
    mutationFn: () => buyerApi.verifyProduct(id!, { product_number: productNumber.trim() }),
    onSuccess: (result) => { setProductVerification(result); setActionError('') },
    onError: (e) => { setProductVerification(null); setActionError(e instanceof ApiError && e.code === 'PRODUCT_MISMATCH' ? t('ordersId.productMismatch') : (e instanceof Error ? e.message : t('common.actionImpossible'))) },
  })

  const lines = order.data?.lines || []
  const eligibility = useQueries({ queries: lines.map(line=>({queryKey:['review-eligibility',id,line.id],queryFn:()=>buyerApi.reviewEligibility(id!,line.id)})) })

  if(order.isLoading)return <Loading label={t('orders.loadingDetail')}/>
  if(order.isError||!order.data)return <ErrorState message={t('checkout.orderNotFound')} retry={()=>void order.refetch()}/>

  const o = order.data.order
  const t2 = tracking.data
  const p = payment.data ?? null
  const deliveryMethod = o.delivery_method || t2?.delivery_method || ''
  const canReceive = (deliveryMethod === 'PICKUP' && o.status === 'READY_FOR_PICKUP') || (Boolean(productVerification) && deliveryMethod !== 'PICKUP' && o.status === 'DELIVERED')
  const needsDelivery = !o.delivery_method
  const productsTotal = (o.final_total || 0) + (o.points_discount_amount || 0)
  // Once a payment exists it is what the buyer owes, payment surcharge included.
  const grandTotal = p?.final_total ?? (o.final_total || 0) + (o.delivery_fee_final || 0)
  const currency = p?.currency || o.currency
  const canVerify = ['COURIER_ARRIVED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION'].includes(o.delivery_status || '')
  const canCancel = buyerCanCancel(o.status, o.delivery_status, p?.status)
  const paidBeforeHandover = isPaidBeforeHandover(o.status, o.delivery_status, p?.status)

  const history: OrderStatusHistory[] = t2?.history?.length ? [...t2.history].reverse() : (order.data.history ? [...order.data.history].reverse() : [])
  // current_status is the order status; a TBK delivery is followed by delivery_status.
  const isTbk = deliveryMethod.startsWith('TBK')
  const steps = getDeliverySteps(deliveryMethod, (isTbk ? o.delivery_status : t2?.current_status) || '')
  // A step is done once the delivery has reached it, even when no history row
  // dates it: the courier steps live in delivery_status, not in the history.
  const closed = ['RECEIVED', 'COMPLETED'].includes(o.status)
  const timeline = t2
    ? steps.map((status) => {
        const event = history.find((h) => h.status === status || h.status === HISTORY_ALIASES[status])
        return { status, event, done: Boolean(event) || closed || courierReached(o, status) || (status === 'DELIVERED' && ['DELIVERED', 'RECEIVED', 'COMPLETED'].includes(o.status)) }
      })
    : history.map((h) => ({ status: h.status, event: h, done: true }))

  // The reason sheet is the confirmation (an Alert with buttons never shows
  // on the web): it explains what happens next and asks why.
  const confirmCancel = () => { setActionError(''); setCancelAsk(true) }

  return <View style={{ flex: 1, backgroundColor: colors.cream }}>
    <KeyboardAwareScrollView contentContainerStyle={styles.page}>
      {/* Blue order-tracking header (reference 5); the timeline card overlaps it. */}
      <View style={styles.hero}>
        <Pressable onPress={() => router.push('/orders')} accessibilityRole="link" style={styles.backRow}>
          <View style={styles.backCircle}><Ionicons name="chevron-back" size={18} color={colors.onGreen} /></View>
          <Text style={styles.backLink}>{t('web.account.myOrders' as TranslationKey)}</Text>
        </Pressable>

        <Text style={styles.heroKicker}>{t('web.orders.orderNumber' as TranslationKey, { number: o.order_number || o.id.slice(0, 8).toUpperCase() })}</Text>
        <Text style={styles.h1}>{statusLabel(t, o.status)}</Text>
        <Text style={styles.heroMuted}>{formatDateTime(o.created_at, lang)}</Text>
        <Text style={styles.shopLine}><Text style={styles.heroMuted}>{t('web.orders.shop' as TranslationKey)}: </Text><Text style={styles.bold}>{order.data.shop_name}</Text>{order.data.business_name ? <Text style={styles.heroMuted}> · {order.data.business_name}</Text> : null}{order.data.seller_name ? <Text style={styles.heroMuted}> · {order.data.seller_name}</Text> : null}</Text>
        {isTerminal(o.status) && <Text style={styles.heroMuted}>{t('orders.terminalNote')}</Text>}

        {/* web .live-bar */}
        <View style={styles.liveBar}>
          {/* A finished order no longer streams updates; do not claim it is live. */}
          {!isTerminal(o.status) ? <View style={styles.liveLabel}><View style={styles.liveDot} /><Text style={styles.liveText}>{t('web.orders.live' as TranslationKey)}</Text></View> : null}
          <Text style={[styles.heroMuted, { flex: 1, fontSize: 12 }]}>{t('web.orders.updated' as TranslationKey, { time: formatDateTime(new Date(order.dataUpdatedAt).toISOString(), lang) })}</Text>
          <Pressable accessibilityRole="button" disabled={order.isFetching} onPress={() => void order.refetch()} style={styles.refreshBtn}><Text style={styles.refreshText}>{order.isFetching ? '⟳' : t('web.orders.refresh' as TranslationKey)}</Text></Pressable>
        </View>
      </View>

      <WebOrderTimeline o={o} payment={p ?? null} styles={styles} />

      {/* Courier card (reference 5): once a TBK courier is assigned and the delivery is still open. The API never names the courier, so the card shows the delivery step; the round button opens the courier channel of the order chat. */}
      {isTbk && courierReached(o, 'COURIER_ASSIGNED') && !closed && !isTerminalDelivery(o.delivery_status || undefined) ? (
        <View style={styles.courierCard}>
          <View style={styles.courierAvatar}><Ionicons name="bicycle" size={20} color={colors.onNavy} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.courierKicker}>{t('orders.yourCourier')}</Text>
            <Text style={styles.courierName} numberOfLines={1}>{statusLabel(t, o.delivery_status || o.status)}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('orders.messageCourier')} onPress={() => { setChatParty('COURIER'); setShowChat(true) }} style={styles.courierBtn}>
            <Ionicons name="chatbubble-ellipses" size={19} color={colors.navy} />
          </Pressable>
        </View>
      ) : null}

      {/* Items summary row (reference 5) */}
      {lines.length ? (
        <View style={styles.summaryRow}>
          <View style={styles.summaryThumbs}>
            {lines.slice(0, 2).map((line, i) => (
              <View key={line.id} style={[styles.summaryThumb, i > 0 && { marginLeft: -14 }]}>
                {line.image_url ? <Image source={resolveMediaUrl(line.image_url)} style={styles.summaryThumbImg} contentFit="cover" /> : <Ionicons name="cube-outline" size={18} color={colors.green} />}
              </View>
            ))}
          </View>
          <Text style={styles.summaryCount}>{t('orders.itemsCount', { count: lines.reduce((n, l) => n + l.quantity, 0) })}</Text>
          <Text style={styles.summaryTotal}>{formatMoney(grandTotal, currency)}</Text>
        </View>
      ) : null}

      <DeliveryPlanCard plan={o} status={o.status} deliveryStatus={o.delivery_status} deliveryMethod={deliveryMethod} />

      {/* Live courier map: from the courier's acceptance (on the way to the shop) until arrival. Viewing it asks the buyer for no permission. */}
      {isLiveTracked(o.delivery_status) ? (
        <>
          <Suspense fallback={<Loading label={t('common.loading')} />}>
            <LazyLiveCourierMap orderId={id!} preview mapHeight={220} onExpand={() => router.push({ pathname: '/tracking', params: { id: id! } })} />
          </Suspense>
          <Button variant="outline" title={`🛵 ${t('liveMap.follow')}`} onPress={() => router.push({ pathname: '/tracking', params: { id: id! } })} />
        </>
      ) : null}

      {/* web "Articles" card: purchased lines, then products subtotal, points, delivery and total due */}
      <Card>
        <Text style={styles.cardH2}>{t('web.orders.items' as TranslationKey)}</Text>
        {lines.map((line, i) => <PurchasedLine key={line.id} line={line} orderId={id!} eligibility={eligibility[i]?.data} styles={styles} reasonText={(r) => t(REASON_KEYS[r] ?? 'orders.reviewUnavailable')} />)}
        <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.productsSubtotal')}</Text><Text style={styles.muted}>{formatMoney(productsTotal)}</Text></View>
        {(o.points_used ?? 0) > 0 ? <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.pointsUsed', { count: o.points_used ?? 0 })}</Text><Text style={[styles.muted, { color: colors.success }]}>−{formatMoney(o.points_discount_amount ?? 0)}</Text></View> : null}
        <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.productsTotal')}</Text><Text style={styles.muted}>{formatMoney(o.final_total)}</Text></View>
        <View style={styles.breakRow}><Text style={[styles.muted, { flex: 1 }]}>{t('orders.delivery', { method: o.delivery_method ? deliveryLabel(t, o.delivery_method) : t('orders.notSelected') })}</Text><Text style={styles.muted}>{(o.delivery_points_used ?? 0) > 0 ? <Text style={{ textDecorationLine: 'line-through' }}>{formatMoney(o.delivery_fee_base ?? 0)} </Text> : null}{formatMoney(o.delivery_fee_final ?? 0)}</Text></View>
        <View style={styles.breakRow}><Text style={[styles.muted, { fontWeight: '700', color: colors.ink }]}>{t('orders.totalDue')}</Text><Text style={[styles.muted, { fontWeight: '700', color: colors.ink }]}>{formatMoney(grandTotal)}</Text></View>
        {o.delivery_method ? <View style={styles.deliveryBox}>
          <Text style={[styles.muted, { fontWeight: '800', color: colors.ink }]}>{t('delivery.details')}</Text>
          <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.contact')}</Text><Text style={styles.muted}>{o.delivery_contact_name || '—'}</Text></View>
          <View style={styles.breakRow}><Text style={styles.muted}>{t('common.phone')}</Text><Text style={styles.muted}>{o.delivery_phone || '—'}</Text></View>
          <View style={styles.breakRow}><Text style={styles.muted}>{t('common.address')}</Text><Text style={[styles.muted, { flexShrink: 1, textAlign: 'right' }]}>{o.delivery_address || '—'}</Text></View>
          {o.delivery_notes ? <View style={styles.breakRow}><Text style={styles.muted}>{t('delivery.notes')}</Text><Text style={[styles.muted, { flexShrink: 1, textAlign: 'right' }]}>{o.delivery_notes}</Text></View> : null}
        </View> : null}
        {o.status === 'PENDING' && needsDelivery ? <Button title={t('orders.continueCheckout')} onPress={() => router.push({ pathname: '/checkout/delivery', params: { orderId: id } })} /> : null}
      </Card>

      <Card>
        <Button
          variant="outline"
          title={t('communication.contactSeller')}
          onPress={() => setShowChat(true)}
        />
      </Card>

      {actionError ? <Card><Text style={styles.error}>{actionError}</Text></Card> : null}
      {['CANCELLED', 'REJECTED'].includes(o.status) ? <CancellationCard cancellation={o.cancellation} rejected={o.status === 'REJECTED'} /> : null}
      <CancelReasonSheet visible={cancelAsk} side="buyer" note={t(PARCEL_WITH_COURIER.includes(o.delivery_status || '') ? 'orders.cancelAskInDelivery' : 'orders.cancelAskBeforePickup')} busy={cancelMutation.isPending} onConfirm={(reason) => cancelMutation.mutate(reason)} onClose={() => setCancelAsk(false)} />

      {canVerify && <Card>
        <Text style={styles.name}>{t('handover.orderCode')} : {o.order_number}</Text>
        <Field label={t('courier.manualCode')} value={productNumber} onChangeText={setProductNumber} placeholder="BTMI-XXXXXXXX" autoCapitalize="characters" autoCorrect={false} />
        <Button variant="outline" title={t('courier.verifyCode')} loading={verifyMutation.isPending} disabled={!productNumber.trim()} onPress={() => verifyMutation.mutate()} />
        {productVerification ? <Text style={styles.hint}>✓ {t('courier.verdict.VALID')} · {productVerification.product_name}</Text> : null}
      </Card>}

      <BuyerHandoverCard orderId={id!} deliveryStatus={o.delivery_status} onChanged={invalidate} />
      <MobilePaymentCard key={p?.id ?? 'none'} orderId={id!} payment={p} onChanged={invalidate} />

      {paidBeforeHandover ? <Card><Text style={styles.hint}>{t('orders.cancelPaidNote')}</Text></Card> : null}
      {(canCancel || canReceive) && <Card>
        {canReceive && <Button title={t('orders.received')} loading={receiveMutation.isPending} onPress={()=>{ setActionError(''); receiveMutation.mutate() }}/>}
        {canCancel && <Button variant="outline" title={t('orders.cancel')} loading={cancelMutation.isPending} onPress={confirmCancel}/>}
      </Card>}

      {deliveryMethod ? <SectionTitle title={t('orders.liveTracking')}/> : null}
      <Card>{timeline.length ? timeline.map((step,i)=>(
        <View key={`${step.status}-${i}`} style={styles.timelineRow}>
          <View style={styles.webRail}>
            <View style={[styles.webDot, step.done && styles.webDotDone]}>{step.done ? <Ionicons name="checkmark" size={13} color={colors.onGreen} /> : null}</View>
            {i < timeline.length - 1 ? <View style={[styles.webLine, step.done && { backgroundColor: colors.green }]} /> : null}
          </View>
          <View style={{flex:1,paddingBottom:12}}>
            <Text style={[styles.stepStatus, step.done && styles.stepDone]}>{statusLabel(t, step.status)}</Text>
            {step.event ? <>
              {step.event.notes ? <Text style={styles.muted}>{timelineNote(t, step.event.notes)}</Text> : null}
              <Text style={styles.time}>{t(ACTOR_KEYS[step.event.actor_type || ''] ?? 'orders.actorSystem')} · {formatDateTime(step.event.created_at, lang)}</Text>
            </> : step.done ? null : <Text style={styles.time}>{t('orders.upcoming')}</Text>}
          </View>
        </View>
      )) : <Text style={styles.muted}>{t('orders.historyUnavailable')}</Text>}</Card>

      {deliveryMethod ? <>
        <SectionTitle title={t('orders.paymentStepLabel')}/>
        <Card>
          <Text style={styles.name}>{t(paymentMethodKey(p?.payment_method))}</Text>
          {p ? <>
            <Text style={[styles.muted,{fontWeight:'800'}]}>{t(paymentStatusKey(p))}</Text>
            {p.provider ? <Text style={styles.muted}>{t('seller.paymentOperator')} : {p.provider_label || p.provider}</Text> : null}
            <Text style={styles.muted}>{t('orders.amountDue', { amount: formatMoney(p.final_total, p.currency) })}</Text>
            <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.productsAmount')}</Text><Text style={styles.muted}>{formatMoney(p.products_final_total, p.currency)}</Text></View>
            <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.deliveryFee')}</Text><Text style={styles.muted}>{formatMoney(p.delivery_fee_final, p.currency)}</Text></View>
            <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.paymentMarkup')}</Text><Text style={styles.muted}>{formatMoney(Math.max(p.payment_markup, 0), p.currency)}</Text></View>
            <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.pointsDiscount')}</Text><Text style={styles.muted}>-{formatMoney(p.products_points_discount + p.delivery_points_discount, p.currency)}</Text></View>
            <View style={styles.breakRow}><Text style={[styles.muted,{fontWeight:'900'}]}>{t('orders.finalTotal')}</Text><Text style={[styles.muted,{fontWeight:'900'}]}>{formatMoney(p.final_total, p.currency)}</Text></View>
            {isPaymentPaid(p)
              ? <Text style={styles.hint}>✓ {t('orders.paymentPaid')}{confirmationActorKey(p.confirmation_actor) ? ` · ${t(confirmationActorKey(p.confirmation_actor)!)}` : ''}</Text>
              : isCashOnDelivery(p)
                ? <Text style={styles.hint}>{t('orders.cashConfirmedByCourier')}</Text>
                : isMobileAtDelivery(p)
                  ? <Text style={styles.hint}>{t('orders.mobileToPayAtDelivery')}</Text>
                  : <Text style={styles.hint}>{t('orders.mobilePayNowNote')}</Text>}
            {isPaymentProcessing(p) && <Text style={styles.hint}>{t('orders.paymentAwaitingProvider')}</Text>}
            <PaymentLifecycle p={p} o={o} t={t} styles={styles} />
            {isPaymentCancelled(p) && <Text style={styles.hint}>{t('orders.paymentCancelled')}</Text>}
          </> : <Button variant="outline" title={t('orders.prepareCashPayment')} loading={createPaymentMutation.isPending} onPress={()=>{ setActionError(''); createPaymentMutation.mutate() }}/>}
        </Card>

        {p ? <Card>
          <Text style={styles.name}>{t('orders.paymentDetail')}</Text>
          <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.orderNumber', { number: o.order_number || o.id.slice(0, 8).toUpperCase() })}</Text><Text style={styles.muted}>{formatDateTime(o.created_at, lang)}</Text></View>
          <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.paymentMethod')}</Text><Text style={styles.muted}>{t(paymentMethodKey(p.payment_method))}</Text></View>
          {p.provider ? <View style={styles.breakRow}><Text style={styles.muted}>{t('seller.paymentOperator')}</Text><Text style={styles.muted}>{p.provider_label || p.provider}</Text></View> : null}
          <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.amountBeforeMarkup')}</Text><Text style={styles.muted}>{formatMoney(p.final_total - Math.max(p.payment_markup, 0), p.currency)}</Text></View>
          <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.paymentMarkup')}</Text><Text style={styles.muted}>{formatMoney(Math.max(p.payment_markup, 0), p.currency)}</Text></View>
          <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.totalDue')}</Text><Text style={[styles.muted, { fontWeight: '800' }]}>{formatMoney(p.final_total, p.currency)}</Text></View>
          <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.paymentStatus')}</Text><Text style={styles.muted}>{t(paymentStatusKey(p))}</Text></View>
          {isPaymentPaid(p) && confirmationActorKey(p.confirmation_actor) ? <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.confirmedBy')}</Text><Text style={styles.muted}>{t(confirmationActorKey(p.confirmation_actor)!)}</Text></View> : null}
          <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.createdAtLabel')}</Text><Text style={styles.muted}>{formatDateTime(p.created_at, lang)}</Text></View>
          <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.reference')}</Text><Text style={styles.muted}>{p.receipt_reference || p.internal_reference || p.provider_reference || p.id.slice(0, 8).toUpperCase()}</Text></View>
          {p.receipt_issued_at ? <View style={styles.breakRow}><Text style={styles.muted}>{t('ordersId.receiptIssuedAt')}</Text><Text style={styles.muted}>{formatDateTime(p.receipt_issued_at, lang)}</Text></View> : null}
          {p.updated_at ? <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.lastUpdate')}</Text><Text style={styles.muted}>{formatDateTime(p.updated_at, lang)}</Text></View> : null}
          {(p as BuyerPayment & { refund_status?: string | null }).refund_status ? <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.paymentStatus')}</Text><Text style={styles.muted}>{(() => { const r = (p as BuyerPayment & { refund_status?: string | null }).refund_status; return r === 'IN_PROGRESS' ? t('orders.refundInProgress') : r === 'REFUNDED' ? t('orders.refunded') : r === 'FAILED' ? t('orders.refundFailed') : r })()}</Text></View> : null}
        </Card> : null}

        <PaymentAttempts p={p} o={o} lang={lang} t={t} styles={styles} />
      </> : null}

      {o.status === 'COMPLETED' ? <OrderRatingCard orderId={id!} /> : null}
    </KeyboardAwareScrollView>

    {showChat && (
      <View style={StyleSheet.absoluteFill}>
        <OrderChatFeed
          orderId={id!}
          role="BUYER"
          onClose={() => { setShowChat(false); setChatParty(undefined) }}
          showHeader={true}
          initialParty={chatParty}
          product={lines[0] ? { name: lines[0].product_name, imageUrl: lines[0].image_url, price: lines[0].final_unit_price, productId: lines[0].product_id } : undefined}
        />
      </View>
    )}
  </View>
}

/** web PurchasedLine: the order-time snapshot of one line and its review
 *  action. No item QR: the courier checks the label on the parcel. */
function PurchasedLine({ line, orderId, eligibility, styles, reasonText }: { line: OrderLine; orderId: string; eligibility?: { eligible: boolean; reason?: string; existing_review_id?: string }; styles: ReturnType<typeof makeStyles>; reasonText: (reason: string) => string }) {
  const { t } = useI18n()
  const variantText = Object.values(line.variant_attributes ?? {}).filter(Boolean).join(' / ') || line.variant_name || line.variant_sku || t('orders.standardVariant')
  const price = line.final_unit_price
  const e = eligibility
  return <Card>
    <View style={styles.lineRow}>
      <View style={styles.thumb}>{line.image_url ? <Image source={resolveMediaUrl(line.image_url)} style={styles.thumbImg} contentFit="cover" /> : <Text style={styles.thumbText}>{(line.product_name || t('orders.product')).slice(0, 2).toUpperCase()}</Text>}</View>
      <View style={{ flex: 1 }}>
        <Pressable accessibilityRole="link" onPress={() => router.push(`/products/${line.product_id}`)}><Text style={styles.name}>{line.product_name || t('orders.productWithId', { id: line.product_id.slice(0, 8) })}</Text></Pressable>
        <Text style={styles.muted}>{variantText}</Text>
        <Text style={styles.muted}>{line.quantity} × {formatMoney(price)}</Text>
        <Text style={styles.hint}>{t('itemQr.snapshotNote')}</Text>
      </View>
      <Text style={[styles.name, { fontSize: 15 }]}>{formatMoney(line.quantity * price)}</Text>
    </View>
    {e?.eligible ? <Button title={t('orders.rateProduct')} onPress={()=>router.push({pathname:'/reviews/write',params:{orderId,lineId:line.id,productName:line.product_name,imageUrl:line.image_url ?? ''}})}/> : e?.existing_review_id ? <Button variant="outline" title={t('orders.editReview')} onPress={()=>router.push({pathname:'/reviews/write',params:{orderId,lineId:line.id,reviewId:e.existing_review_id,productName:line.product_name,imageUrl:line.image_url ?? ''}})}/> : <Text style={styles.hint}>{e?.reason ? reasonText(e.reason) : t('orders.reviewUnavailable')}</Text>}
  </Card>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  hero: { backgroundColor: colors.green, marginHorizontal: -spacing.md, marginTop: -spacing.md, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 56, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, gap: 4 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  backCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.onGreen, opacity: 0.9 },
  backLink: { color: colors.onGreen, fontSize: 16, fontFamily: fonts.display, fontWeight: '700' },
  heroKicker: { color: colors.onGreen, opacity: 0.75, fontSize: 12, fontWeight: '600' },
  heroMuted: { color: colors.onGreen, opacity: 0.8, fontSize: 13 },
  liveBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.onGreen, borderStyle: 'solid', opacity: 0.95 },
  liveLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveText: { color: colors.success, fontWeight: '700', fontSize: 12 },
  refreshBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.white },
  refreshText: { color: colors.green, fontWeight: '700', fontSize: 12 },
  h1: { color: colors.onGreen, fontFamily: fonts.display, fontWeight: '700', fontSize: 22, letterSpacing: -0.3 },
  shopLine: { fontSize: 13, marginTop: 2 },
  bold: { color: colors.onGreen, fontWeight: '700' },
  timelineCard: { marginTop: -56, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadow.card },
  cardH2: { color: colors.ink, fontFamily: fonts.display, fontWeight: '700', fontSize: 16, letterSpacing: -0.2, marginBottom: 10 },
  webStep: { flexDirection: 'row', gap: 12 },
  webRail: { width: 22, alignItems: 'center' },
  webDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  webDotDone: { backgroundColor: colors.green, borderColor: colors.green },
  webDotCurrent: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  webLine: { width: 2, flex: 1, minHeight: 12, backgroundColor: colors.border, marginVertical: 2 },
  webStepBody: { flex: 1, paddingBottom: 12, paddingTop: 2 },
  webStepText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  webStepSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  lineRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: 56, height: 56 },
  thumbText: { color: colors.muted, fontWeight: '800' },
  deliveryBox: { marginTop: 8, padding: 12, borderRadius: radius.sm, backgroundColor: colors.surface2, gap: 2 },
  page: { padding: spacing.md, gap: 12, paddingBottom: spacing.xl },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  muted: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  hint: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger },
  timelineRow: { flexDirection: 'row', gap: 12 },
  stepStatus: { color: colors.muted, fontWeight: '700', fontSize: 13, textTransform: 'capitalize', paddingTop: 2 },
  stepDone: { color: colors.ink },
  time: { color: colors.muted, fontSize: 12 },
  courierCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.navy, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.navyLine },
  courierAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.navySoft, borderWidth: 1, borderColor: colors.navyLine, alignItems: 'center', justifyContent: 'center' },
  courierKicker: { color: colors.onNavyMuted, fontSize: 11.5 },
  courierName: { color: colors.onNavy, fontSize: 14, fontWeight: '700', marginTop: 1 },
  courierBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.cyan, alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 12, ...shadow.card },
  summaryThumbs: { flexDirection: 'row' },
  summaryThumb: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.greenSoft, borderWidth: 2, borderColor: colors.white, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  summaryThumbImg: { width: '100%', height: '100%' },
  summaryCount: { flex: 1, color: colors.ink, fontSize: 13.5, fontWeight: '700' },
  summaryTotal: { color: colors.green, fontSize: 15, fontFamily: fonts.display, fontWeight: '700' },
  breakRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 8 },
})
