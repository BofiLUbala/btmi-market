import { useCallback, useMemo, useState } from 'react'
import { Image } from 'expo-image'
import { Pressable } from 'react-native'
import { resolveMediaUrl } from '../../src/api/client'
import { OrderItemQRSection } from '../../src/components/OrderItemQRSection'
import { DeliveryPlanCard } from '../../src/components/DeliveryPlanCard'
import { buyerCanCancel, isPaidBeforeHandover, PARCEL_WITH_COURIER } from '../../src/lib/deliveryPlan'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../src/components/ui'
import { OrderChatFeed } from '../../src/components/OrderChatFeed'
import { BuyerHandoverCard, MobilePaymentCard } from '../../src/components/BuyerHandover'
import { formatMoney } from '../../src/lib/money'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'
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
  TBK_STANDARD: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COURIER_ASSIGNED', 'COURIER_ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED', 'DELIVERY_SCAN_SUCCESS', 'RECEIVED'],
}

// Waiting states already covered by a step of the flow: never appended as an extra step.
const COVERED_STATUSES = ['PENDING_TBK_ASSIGNMENT', 'READY_FOR_PICKUP', 'AWAITING_BUYER_CONFIRMATION']

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

const locale = (lang: string) => (lang === 'en' ? 'en-US' : 'fr-FR')

function formatDateTime(value: string, lang: string) {
  return new Date(value).toLocaleString(locale(lang), { dateStyle: 'medium', timeStyle: 'short' })
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
  const cancelMutation = useMutation({ mutationFn: () => buyerApi.cancelOrder(id!), onSuccess: invalidate, onError: (e) => setActionError(e instanceof ApiError ? e.message : t('common.actionImpossible')) })
  const createPaymentMutation = useMutation({ mutationFn: () => buyerApi.createPayment(id!), onSuccess: invalidate, onError: (e) => setActionError(e instanceof ApiError ? e.message : t('common.actionImpossible')) })
  // There is no "I have paid" mutation. Cash is settled by the assigned courier at the
  // door and mobile money by the operator's callback, so the buyer can only read the
  // outcome here - saying so is not paying.
  const verifyMutation = useMutation({
    mutationFn: () => buyerApi.verifyProduct(id!, { product_number: productNumber.trim() }),
    onSuccess: (result) => { setProductVerification(result); setActionError('') },
    onError: (e) => { setProductVerification(null); setActionError(e instanceof ApiError && e.code === 'PRODUCT_MISMATCH' ? 'Ce produit ne correspond pas à votre commande.' : (e instanceof Error ? e.message : t('common.actionImpossible'))) },
  })

  const lines = order.data?.lines || []
  const eligibility = useQueries({ queries: lines.map(line=>({queryKey:['review-eligibility',id,line.id],queryFn:()=>buyerApi.reviewEligibility(id!,line.id)})) })
  const service = useQuery({queryKey:['review-eligibility',id,'service'],queryFn:()=>buyerApi.reviewEligibility(id!),enabled:Boolean(id)})

  if(order.isLoading)return <Loading label={t('orders.loadingDetail')}/>
  if(order.isError||!order.data)return <ErrorState message={t('checkout.orderNotFound')} retry={()=>void order.refetch()}/>

  const o = order.data.order
  const t2 = tracking.data
  const p = payment.data ?? null
  const deliveryMethod = o.delivery_method || t2?.delivery_method || ''
  const canReceive = (deliveryMethod === 'PICKUP' && o.status === 'READY_FOR_PICKUP') || (Boolean(productVerification) && deliveryMethod !== 'PICKUP' && o.status === 'DELIVERED')
  const needsDelivery = !o.delivery_method
  const productsTotal = (o.final_total || 0) + (o.points_discount_amount || 0)
  const grandTotal = (o.final_total || 0) + (o.delivery_fee_final || 0)
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
        return { status, event, done: Boolean(event) || closed || courierReached(o, status) }
      })
    : history.map((h) => ({ status: h.status, event: h, done: true }))

  const confirmCancel = () => {
    Alert.alert(t('orders.cancel'), t(PARCEL_WITH_COURIER.includes(o.delivery_status || '') ? 'orders.cancelAskInDelivery' : 'orders.cancelAskBeforePickup'),[
      { text: t('orders.back'), style: 'cancel' },
      { text: t('orders.cancel'), style: 'destructive', onPress:()=>{ setActionError(''); cancelMutation.mutate() } },
    ])
  }

  return <View style={{ flex: 1, backgroundColor: colors.cream }}>
    <ScrollView contentContainerStyle={styles.page}>
      <SectionTitle title={o.order_number||t('orders.detailFallback')}/>
      <Text style={styles.shop}>{order.data.shop_name} · {deliveryMethod ? deliveryLabel(t, deliveryMethod) : t('orders.deliveryToChoose')}</Text>
      <Card>
        <Text style={styles.status}>{statusLabel(t, t2?.current_status || o.status)}</Text>
        <Text style={styles.total}>{formatMoney(p?.final_total ?? o.final_total, currency)}</Text>
        {isTerminal(o.status) && <Text style={styles.hint}>{t('orders.terminalNote')}</Text>}
        {!isTerminal(o.status) && tracking.isFetching && <Text style={styles.hint}>{t('orders.updating')}</Text>}
      </Card>

      <DeliveryPlanCard plan={o} status={o.status} deliveryStatus={o.delivery_status} deliveryMethod={deliveryMethod} />

      {/* web: products subtotal, points, delivery (struck base when points were used) and the total due */}
      <Card>
        <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.productsSubtotal')}</Text><Text style={styles.muted}>{formatMoney(productsTotal)}</Text></View>
        {(o.points_used ?? 0) > 0 ? <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.pointsUsed', { count: o.points_used ?? 0 })}</Text><Text style={[styles.muted, { color: colors.success }]}>−{formatMoney(o.points_discount_amount ?? 0)}</Text></View> : null}
        <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.productsTotal')}</Text><Text style={styles.muted}>{formatMoney(o.final_total)}</Text></View>
        <View style={styles.breakRow}><Text style={[styles.muted, { flex: 1 }]}>{t('orders.delivery', { method: o.delivery_method || t('orders.notSelected') })}</Text><Text style={styles.muted}>{(o.delivery_points_used ?? 0) > 0 ? <Text style={{ textDecorationLine: 'line-through' }}>{formatMoney(o.delivery_fee_base ?? 0)} </Text> : null}{formatMoney(o.delivery_fee_final ?? 0)}</Text></View>
        <View style={styles.breakRow}><Text style={[styles.muted, { fontWeight: '900', color: colors.ink }]}>{t('orders.totalDue')}</Text><Text style={[styles.muted, { fontWeight: '900', color: colors.ink }]}>{formatMoney(grandTotal)}</Text></View>
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
          title={`💬 ${t('communication.contactSeller')}`}
          onPress={() => setShowChat(true)}
        />
      </Card>

      {actionError ? <Card><Text style={styles.error}>{actionError}</Text></Card> : null}

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
          <View style={[styles.dot, step.done && styles.dotDone]}/>
          <View style={{flex:1}}>
            <Text style={[styles.stepStatus, step.done && styles.stepDone]}>{statusLabel(t, step.status)}</Text>
            {step.event ? <>
              {step.event.notes ? <Text style={styles.muted}>{step.event.notes}</Text> : null}
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
          {p.provider ? <View style={styles.breakRow}><Text style={styles.muted}>Opérateur</Text><Text style={styles.muted}>{p.provider_label || p.provider}</Text></View> : null}
          <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.amountDue', { amount: '' }).replace(/[:\s]+$/, '')}</Text><Text style={[styles.muted, { fontWeight: '800' }]}>{formatMoney(p.cash_due, p.currency)}</Text></View>
          <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.paymentMarkup')}</Text><Text style={styles.muted}>{formatMoney(Math.max(p.payment_markup, 0), p.currency)}</Text></View>
          <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.totalDue')}</Text><Text style={[styles.muted, { fontWeight: '800' }]}>{formatMoney(p.final_total, p.currency)}</Text></View>
          <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.paymentStatus')}</Text><Text style={styles.muted}>{t(paymentStatusKey(p))}</Text></View>
          {isPaymentPaid(p) && confirmationActorKey(p.confirmation_actor) ? <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.confirmedBy')}</Text><Text style={styles.muted}>{t(confirmationActorKey(p.confirmation_actor)!)}</Text></View> : null}
          <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.createdAtLabel')}</Text><Text style={styles.muted}>{formatDateTime(p.created_at, lang)}</Text></View>
          <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.reference')}</Text><Text style={styles.muted}>{p.receipt_reference || p.internal_reference || p.provider_reference || p.id.slice(0, 8).toUpperCase()}</Text></View>
          {p.receipt_issued_at ? <View style={styles.breakRow}><Text style={styles.muted}>Reçu émis le</Text><Text style={styles.muted}>{formatDateTime(p.receipt_issued_at, lang)}</Text></View> : null}
          {p.updated_at ? <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.lastUpdate')}</Text><Text style={styles.muted}>{formatDateTime(p.updated_at, lang)}</Text></View> : null}
          {(p as BuyerPayment & { refund_status?: string | null }).refund_status ? <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.paymentStatus')}</Text><Text style={styles.muted}>{(() => { const r = (p as BuyerPayment & { refund_status?: string | null }).refund_status; return r === 'IN_PROGRESS' ? t('orders.refundInProgress') : r === 'REFUNDED' ? t('orders.refunded') : r === 'FAILED' ? t('orders.refundFailed') : r })()}</Text></View> : null}
        </Card> : null}

        <PaymentAttempts p={p} o={o} lang={lang} t={t} styles={styles} />
      </> : null}

      <SectionTitle title={t('orders.itemsBought')}/>{lines.map((line,i)=><PurchasedLine key={line.id} line={line} orderId={id!} eligibility={eligibility[i]?.data} styles={styles} reasonText={(r) => t(REASON_KEYS[r] ?? 'orders.reviewUnavailable')} />)}
      <SectionTitle title={t('orders.deliveryService')}/><Card><Text style={styles.muted}>{t('orders.deliveryServiceBody')}</Text>{service.data?.eligible?<Button variant="outline" title={t('orders.rateService')} onPress={()=>router.push({pathname:'/reviews/write',params:{orderId:id,type:'service',productName:order.data.shop_name}})}/>:<Text style={styles.hint}>{service.data?.reason ? t(REASON_KEYS[service.data.reason] ?? 'orders.serviceReviewUnavailable') : t('orders.serviceReviewUnavailable')}</Text>}</Card>
    </ScrollView>

    {showChat && (
      <View style={StyleSheet.absoluteFill}>
        <OrderChatFeed
          orderId={id!}
          role="BUYER"
          onClose={() => setShowChat(false)}
          showHeader={true}
        />
      </View>
    )}
  </View>
}

/** web PurchasedLine: the order-time snapshot of one line, its review action
 *  and its own ORDER_ITEM QR on demand. */
function PurchasedLine({ line, orderId, eligibility, styles, reasonText }: { line: OrderLine; orderId: string; eligibility?: { eligible: boolean; reason?: string; existing_review_id?: string }; styles: ReturnType<typeof makeStyles>; reasonText: (reason: string) => string }) {
  const { t } = useI18n()
  const [showQR, setShowQR] = useState(false)
  const variantText = Object.values(line.variant_attributes ?? {}).filter(Boolean).join(' / ') || line.variant_name || line.variant_sku || t('orders.standardVariant')
  const price = line.final_unit_price
  const loadQR = useCallback(() => buyerApi.orderItemQR(orderId, line.id), [orderId, line.id])
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
    {e?.eligible ? <Button title={t('orders.rateProduct')} onPress={()=>router.push({pathname:'/reviews/write',params:{orderId,lineId:line.id,productName:line.product_name}})}/> : e?.existing_review_id ? <Button variant="outline" title={t('orders.editReview')} onPress={()=>router.push({pathname:'/reviews/write',params:{orderId,lineId:line.id,reviewId:e.existing_review_id,productName:line.product_name}})}/> : <Text style={styles.hint}>{e?.reason ? reasonText(e.reason) : t('orders.reviewUnavailable')}</Text>}
    <Button dense variant="outline" title={showQR ? t('itemQr.hide') : t('itemQr.action')} onPress={() => setShowQR((v) => !v)} />
    {showQR ? <OrderItemQRSection load={loadQR} imagePath={buyerApi.orderItemQRImagePath(orderId, line.id)} instruction={t('itemQr.buyerInstruction')} fields={[
      { label: t('itemQr.labelProduct'), value: line.product_name || '' },
      { label: t('itemQr.labelVariant'), value: variantText },
      { label: t('itemQr.labelQuantity'), value: String(line.quantity) },
    ]} /> : null}
  </Card>
}

const makeStyles = (colors: Colors) => StyleSheet.create({lineRow:{flexDirection:'row',gap:12,alignItems:'flex-start'},thumb:{width:56,height:56,borderRadius:10,backgroundColor:colors.surface2,alignItems:'center',justifyContent:'center',overflow:'hidden'},thumbImg:{width:56,height:56},thumbText:{color:colors.muted,fontWeight:'800'},deliveryBox:{marginTop:8,padding:12,borderRadius:10,backgroundColor:colors.surface2,gap:2},page:{padding:spacing.md,gap:spacing.md,paddingBottom:spacing.xl},shop:{color:colors.muted},status:{fontWeight:'900',color:colors.green},total:{fontSize:23,fontWeight:'900',color:colors.ink,marginTop:6},name:{fontSize:17,fontWeight:'900',color:colors.ink},muted:{color:colors.muted,marginBottom:4},hint:{color:colors.muted,fontSize:13},error:{color:colors.danger},timelineRow:{flexDirection:'row',gap:spacing.sm,paddingVertical:6},dot:{width:12,height:12,borderRadius:6,borderWidth:2,borderColor:colors.border,marginTop:4},dotDone:{backgroundColor:colors.green,borderColor:colors.green},stepStatus:{color:colors.ink,fontWeight:'800',textTransform:'capitalize'},stepDone:{color:colors.green},time:{color:colors.muted,fontSize:12},breakRow:{flexDirection:'row',justifyContent:'space-between',gap:8}})
