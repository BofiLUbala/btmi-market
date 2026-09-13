import { useMemo, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { OrderChatFeed } from '../../src/components/OrderChatFeed'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'
import type { OrderStatusHistory, BuyerPayment } from '../../src/types'
import { statusLabel } from '../../src/lib/statusLabels'
import { deliveryLabel } from '../../src/lib/deliveryLabels'
import {
  paymentStatusKey,
  paymentMethodKey,
  isPaymentConfirmed,
  isPaymentCancelled,
  isPaymentFailed,
} from '../../src/lib/paymentStatus'

const POLL_INTERVAL = 15_000
const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED']
const isTerminal = (status?: string) => !!status && TERMINAL_STATUSES.includes(status)

const FLOW_STEPS: Record<string, string[]> = {
  PICKUP: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'RECEIVED', 'COMPLETED'],
  SHOP_DELIVERY: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RECEIVED', 'COMPLETED'],
  PARTNER: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'HANDED_TO_PARTNER', 'DELIVERED', 'RECEIVED', 'COMPLETED'],
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

function PaymentAttempts({ p, o, lang, t, styles }: { p: BuyerPayment | null; o: { created_at: string }; lang: string; t: (key: TranslationKey, vars?: Record<string, string | number>) => string; styles: ReturnType<typeof makeStyles> }) {
  if (!p) return null
  const methodLabel = (p.payment_method === 'CASH' || !p.payment_method) ? t('orders.attemptCash') : t('orders.attemptMobile')
  const attempts: Array<{ label: string; at: string; ok: boolean }> = [
    { label: t('orders.orderCreated'), at: formatDateTime(o.created_at, lang), ok: true },
    { label: methodLabel, at: formatDateTime(p.created_at, lang), ok: !isPaymentCancelled(p) && !isPaymentFailed(p) && !isPaymentConfirmed(p) },
  ]
  if (p.buyer_confirmed_at) attempts.push({ label: `${t('orders.attemptDeclared')} · ${methodLabel}`, at: formatDateTime(p.buyer_confirmed_at, lang), ok: true })
  if (p.seller_confirmed_at) attempts.push({ label: `${t('orders.attemptConfirmed')} · ${methodLabel}`, at: formatDateTime(p.seller_confirmed_at, lang), ok: true })
  if (p.verified_at) attempts.push({ label: `${t('orders.attemptConfirmed')} · ${methodLabel}`, at: formatDateTime(p.verified_at, lang), ok: true })
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
    refetchInterval: (query) => isTerminal(query.state.data?.current_status) ? false : POLL_INTERVAL,
  })
  const payment = useQuery({
    queryKey: ['buyer','payment',id],
    queryFn: () => buyerApi.getPayment(id!),
    enabled: Boolean(id),
    retry: false,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['buyer','order',id] })
    void queryClient.invalidateQueries({ queryKey: ['buyer','tracking',id] })
    void queryClient.invalidateQueries({ queryKey: ['buyer','payment',id] })
  }

  const receiveMutation = useMutation({ mutationFn: () => buyerApi.confirmReceived(id!), onSuccess: invalidate, onError: (e) => setActionError(e instanceof ApiError ? e.message : t('common.actionImpossible')) })
  const cancelMutation = useMutation({ mutationFn: () => buyerApi.cancelOrder(id!), onSuccess: invalidate, onError: (e) => setActionError(e instanceof ApiError ? e.message : t('common.actionImpossible')) })
  const createPaymentMutation = useMutation({ mutationFn: () => buyerApi.createPayment(id!), onSuccess: invalidate, onError: (e) => setActionError(e instanceof ApiError ? e.message : t('common.actionImpossible')) })
  const confirmPaidMutation = useMutation({ mutationFn: () => buyerApi.buyerConfirmPayment(payment.data!.id), onSuccess: invalidate, onError: (e) => setActionError(e instanceof ApiError ? e.message : t('common.actionImpossible')) })

  const lines = order.data?.lines || []
  const eligibility = useQueries({ queries: lines.map(line=>({queryKey:['review-eligibility',id,line.id],queryFn:()=>buyerApi.reviewEligibility(id!,line.id)})) })
  const service = useQuery({queryKey:['review-eligibility',id,'service'],queryFn:()=>buyerApi.reviewEligibility(id!),enabled:Boolean(id)})

  if(order.isLoading)return <Loading label={t('orders.loadingDetail')}/>
  if(order.isError||!order.data)return <ErrorState message={t('checkout.orderNotFound')} retry={()=>void order.refetch()}/>

  const o = order.data.order
  const t2 = tracking.data
  const p = payment.data ?? null
  const deliveryMethod = o.delivery_method || t2?.delivery_method || ''
  const canReceive = (deliveryMethod === 'PICKUP' && o.status === 'READY_FOR_PICKUP') || (deliveryMethod !== 'PICKUP' && o.status === 'DELIVERED')
  const canCancel = o.status === 'PENDING' || o.status === 'ACCEPTED'

  const history: OrderStatusHistory[] = t2?.history?.length ? [...t2.history].reverse() : (order.data.history ? [...order.data.history].reverse() : [])
  const steps = FLOW_STEPS[deliveryMethod]
  const timeline = steps && t2
    ? (steps.includes(t2.current_status) ? steps : [...steps, t2.current_status]).map((status) => ({
        status,
        event: history.find((h) => h.status === status),
      }))
    : history.map((h) => ({ status: h.status, event: h }))

  const confirmCancel = () => {
    Alert.alert(t('orders.cancel'), t('orders.cancelBody'),[
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
        <Text style={styles.total}>{o.final_total.toLocaleString()} FC</Text>
        {isTerminal(o.status) && <Text style={styles.hint}>{t('orders.terminalNote')}</Text>}
        {!isTerminal(o.status) && tracking.isFetching && <Text style={styles.hint}>{t('orders.updating')}</Text>}
      </Card>

      <Card>
        <Button
          variant="outline"
          title={`💬 ${t('communication.contactSeller')}`}
          onPress={() => setShowChat(true)}
        />
      </Card>

      {actionError ? <Card><Text style={styles.error}>{actionError}</Text></Card> : null}

      {(canCancel || canReceive) && <Card>
        {canReceive && <Button title={t('orders.received')} loading={receiveMutation.isPending} onPress={()=>{ setActionError(''); receiveMutation.mutate() }}/>}
        {canCancel && <Button variant="outline" title={t('orders.cancel')} loading={cancelMutation.isPending} onPress={confirmCancel}/>}
      </Card>}

      {deliveryMethod ? <SectionTitle title={t('orders.liveTracking')}/> : null}
      <Card>{timeline.length ? timeline.map((step,i)=>(
        <View key={`${step.status}-${i}`} style={styles.timelineRow}>
          <View style={[styles.dot, step.event && styles.dotDone]}/>
          <View style={{flex:1}}>
            <Text style={[styles.stepStatus, step.event && styles.stepDone]}>{statusLabel(t, step.status)}</Text>
            {step.event ? <>
              {step.event.notes ? <Text style={styles.muted}>{step.event.notes}</Text> : null}
              <Text style={styles.time}>{t(ACTOR_KEYS[step.event.actor_type || ''] ?? 'orders.actorSystem')} · {formatDateTime(step.event.created_at, lang)}</Text>
            </> : <Text style={styles.time}>{t('orders.upcoming')}</Text>}
          </View>
        </View>
      )) : <Text style={styles.muted}>{t('orders.historyUnavailable')}</Text>}</Card>

      {deliveryMethod ? <>
        <SectionTitle title={t('orders.paymentStepLabel')}/>
        <Card>
          <Text style={styles.name}>{t(paymentMethodKey(p?.payment_method))}</Text>
          {p ? <>
            <Text style={[styles.muted,{fontWeight:'800'}]}>{t(paymentStatusKey(p))}</Text>
            <Text style={styles.muted}>{t('orders.amountDue', { amount: `${p.cash_due.toLocaleString()} ${p.currency}` })}</Text>
            <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.productsAmount')}</Text><Text style={styles.muted}>{p.products_final_total.toLocaleString()} {p.currency}</Text></View>
            <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.deliveryFee')}</Text><Text style={styles.muted}>{p.delivery_fee_final.toLocaleString()} {p.currency}</Text></View>
            <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.paymentMarkup')}</Text><Text style={styles.muted}>{Math.max(p.cash_due - p.products_final_total - p.delivery_fee_final, 0).toLocaleString()} {p.currency}</Text></View>
            <View style={styles.breakRow}><Text style={styles.muted}>{t('orders.pointsDiscount')}</Text><Text style={styles.muted}>-{(p.products_points_discount + p.delivery_points_discount).toLocaleString()} {p.currency}</Text></View>
            <View style={styles.breakRow}><Text style={[styles.muted,{fontWeight:'900'}]}>{t('orders.finalTotal')}</Text><Text style={[styles.muted,{fontWeight:'900'}]}>{p.cash_due.toLocaleString()} {p.currency}</Text></View>
            <Text style={styles.muted}>{t('orders.you')} : {p.buyer_confirmed ? t('orders.paymentDeclared') : t('orders.notConfirmed')}</Text>
            <Text style={styles.muted}>{t('orders.actorSeller')} : {p.seller_confirmed ? t('orders.cashReceived') : t('orders.waitingSeller')}</Text>
            {p.payment_method === 'MOBILE_ON_DELIVERY' ?
              ((o.status === 'DELIVERED' || o.status === 'RECEIVED') && !isPaymentConfirmed(p)
                ? <Button title={t('orders.payNow')} loading={confirmPaidMutation.isPending} onPress={()=>{ setActionError(''); confirmPaidMutation.mutate() }}/>
                : <Text style={styles.hint}>{t('orders.mobileToPayAtDelivery')}</Text>)
              : (p.payment_method === 'CASH' || !p.payment_method)
                ? (!p.buyer_confirmed && !isPaymentCancelled(p) && !isPaymentConfirmed(p)
                  ? <Button title={t('orders.paid')} loading={confirmPaidMutation.isPending} onPress={()=>{ setActionError(''); confirmPaidMutation.mutate() }}/>
                  : null)
                : (!isPaymentConfirmed(p) && !isPaymentCancelled(p) && !isPaymentFailed(p)
                  ? <Button title={t('orders.continuePayment')} loading={confirmPaidMutation.isPending} onPress={()=>{ setActionError(''); confirmPaidMutation.mutate() }}/>
                  : null)}
            {isPaymentFailed(p) && <Button title={t('orders.retryPayment')} variant="outline" loading={confirmPaidMutation.isPending} onPress={()=>{ setActionError(''); confirmPaidMutation.mutate() }}/>}
            {p.buyer_confirmed && !p.seller_confirmed && <Text style={styles.hint}>{t('orders.paymentNote')}</Text>}
            {isPaymentConfirmed(p) && <Text style={styles.hint}>✓ {t('orders.paymentConfirmed')}</Text>}
            {isPaymentCancelled(p) && <Text style={styles.hint}>{t('orders.paymentCancelled')}</Text>}
          </> : <Button variant="outline" title={t('orders.prepareCashPayment')} loading={createPaymentMutation.isPending} onPress={()=>{ setActionError(''); createPaymentMutation.mutate() }}/>}
        </Card>

        {p ? <Card>
          <Text style={styles.name}>{t('orders.paymentDetail')}</Text>
          <Text style={styles.muted}>{t('orders.createdAtLabel')} : {formatDateTime(p.created_at, lang)}</Text>
          <Text style={styles.muted}>{t('orders.reference')} : {p.id.slice(0, 8).toUpperCase()}</Text>
          {p.updated_at ? <Text style={styles.muted}>{t('orders.lastUpdate')} : {formatDateTime(p.updated_at, lang)}</Text> : null}
        </Card> : null}

        <PaymentAttempts p={p} o={o} lang={lang} t={t} styles={styles} />
      </> : null}

      <SectionTitle title={t('orders.itemsBought')}/>{lines.map((line,i)=>{const e=eligibility[i].data;return <Card key={line.id}><Text style={styles.name}>{line.product_name}</Text><Text style={styles.muted}>{line.variant_name||t('orders.standardOption')} · {t('orders.qty', { count: line.quantity })} · {(line.final_unit_price*line.quantity).toLocaleString()} FC</Text>{e?.eligible ? <Button title={t('orders.rateProduct')} onPress={()=>router.push({pathname:'/reviews/write',params:{orderId:id,lineId:line.id,productName:line.product_name}})}/> : e?.existing_review_id ? <Button variant="outline" title={t('orders.editReview')} onPress={()=>router.push({pathname:'/reviews/write',params:{orderId:id,lineId:line.id,reviewId:e.existing_review_id,productName:line.product_name}})}/> : <Text style={styles.hint}>{e?.reason ? t(REASON_KEYS[e.reason] ?? 'orders.reviewUnavailable') : t('orders.reviewUnavailable')}</Text>}</Card>})}
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

const makeStyles = (colors: Colors) => StyleSheet.create({page:{padding:spacing.md,gap:spacing.md,paddingBottom:spacing.xl},shop:{color:colors.muted},status:{fontWeight:'900',color:colors.green},total:{fontSize:23,fontWeight:'900',color:colors.ink,marginTop:6},name:{fontSize:17,fontWeight:'900',color:colors.ink},muted:{color:colors.muted,marginBottom:4},hint:{color:colors.muted,fontSize:13},error:{color:colors.danger},timelineRow:{flexDirection:'row',gap:spacing.sm,paddingVertical:6},dot:{width:12,height:12,borderRadius:6,borderWidth:2,borderColor:colors.border,marginTop:4},dotDone:{backgroundColor:colors.green,borderColor:colors.green},stepStatus:{color:colors.ink,fontWeight:'800',textTransform:'capitalize'},stepDone:{color:colors.green},time:{color:colors.muted,fontSize:12},breakRow:{flexDirection:'row',justifyContent:'space-between',gap:8}})
