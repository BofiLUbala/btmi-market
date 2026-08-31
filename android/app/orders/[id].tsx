import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { colors, spacing } from '../../src/theme'
import type { OrderStatusHistory } from '../../src/types'

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

export default function OrderScreen(){
  const { t, lang } = useI18n()
  const { id } = useLocalSearchParams<{id:string}>()
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState('')

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

  return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={o.order_number||t('orders.detailFallback')}/>
    <Text style={styles.shop}>{order.data.shop_name} · {deliveryMethod ? deliveryMethod.replaceAll('_',' ').toLowerCase() : t('orders.deliveryToChoose')}</Text>
    <Card>
      <Text style={styles.status}>{(t2?.current_status || o.status).replaceAll('_',' ')}</Text>
      <Text style={styles.total}>{o.final_total.toLocaleString()} FC</Text>
      {isTerminal(o.status) && <Text style={styles.hint}>{t('orders.terminalNote')}</Text>}
      {!isTerminal(o.status) && tracking.isFetching && <Text style={styles.hint}>{t('orders.updating')}</Text>}
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
          <Text style={[styles.stepStatus, step.event && styles.stepDone]}>{step.status.replaceAll('_',' ').toLowerCase().replace(/\b\w/,c=>c.toUpperCase())}</Text>
          {step.event ? <>
            {step.event.notes ? <Text style={styles.muted}>{step.event.notes}</Text> : null}
            <Text style={styles.time}>{t(ACTOR_KEYS[step.event.actor_type || ''] ?? 'orders.actorSystem')} · {formatDateTime(step.event.created_at, lang)}</Text>
          </> : <Text style={styles.time}>{t('orders.upcoming')}</Text>}
        </View>
      </View>
    )) : <Text style={styles.muted}>{t('orders.historyUnavailable')}</Text>}</Card>

    {deliveryMethod ? <Card>
      <Text style={styles.name}>{t('orders.cashPayment')}</Text>
      {p ? <>
        <Text style={styles.muted}>{t('orders.amountDue', { amount: `${p.cash_due.toLocaleString()} ${p.currency}` })}</Text>
        <Text style={styles.muted}>{t('orders.you')} : {p.buyer_confirmed ? t('orders.paymentDeclared') : t('orders.notConfirmed')}</Text>
        <Text style={styles.muted}>{t('orders.actorSeller')} : {p.seller_confirmed ? t('orders.cashReceived') : t('orders.waitingSeller')}</Text>
        <Text style={[styles.muted,{fontWeight:'800'}]}>{t('orders.status')} : {p.status}</Text>
        {!p.buyer_confirmed && <Button title={t('orders.paid')} loading={confirmPaidMutation.isPending} onPress={()=>{ setActionError(''); confirmPaidMutation.mutate() }}/>}
        {p.buyer_confirmed && !p.seller_confirmed && <Text style={styles.hint}>{t('orders.paymentNote')}</Text>}
      </> : <Button variant="outline" title={t('orders.prepareCashPayment')} loading={createPaymentMutation.isPending} onPress={()=>{ setActionError(''); createPaymentMutation.mutate() }}/>}
    </Card> : null}

    <SectionTitle title={t('orders.itemsBought')}/>{lines.map((line,i)=>{const e=eligibility[i].data;return <Card key={line.id}><Text style={styles.name}>{line.product_name}</Text><Text style={styles.muted}>{line.variant_name||t('orders.standardOption')} · {t('orders.qty', { count: line.quantity })} · {(line.final_unit_price*line.quantity).toLocaleString()} FC</Text>{e?.eligible ? <Button title={t('orders.rateProduct')} onPress={()=>router.push({pathname:'/reviews/write',params:{orderId:id,lineId:line.id,productName:line.product_name}})}/> : e?.existing_review_id ? <Button variant="outline" title={t('orders.editReview')} onPress={()=>router.push({pathname:'/reviews/write',params:{orderId:id,lineId:line.id,reviewId:e.existing_review_id,productName:line.product_name}})}/> : <Text style={styles.hint}>{e?.reason ? t(REASON_KEYS[e.reason] ?? 'orders.reviewUnavailable') : t('orders.reviewUnavailable')}</Text>}</Card>})}
    <SectionTitle title={t('orders.deliveryService')}/><Card><Text style={styles.muted}>{t('orders.deliveryServiceBody')}</Text>{service.data?.eligible?<Button variant="outline" title={t('orders.rateService')} onPress={()=>router.push({pathname:'/reviews/write',params:{orderId:id,type:'service',productName:order.data.shop_name}})}/>:<Text style={styles.hint}>{service.data?.reason ? t(REASON_KEYS[service.data.reason] ?? 'orders.serviceReviewUnavailable') : t('orders.serviceReviewUnavailable')}</Text>}</Card>
  </ScrollView>
}

const styles=StyleSheet.create({page:{padding:spacing.md,gap:spacing.md,paddingBottom:spacing.xl},shop:{color:colors.muted},status:{fontWeight:'900',color:colors.green},total:{fontSize:23,fontWeight:'900',color:colors.ink,marginTop:6},name:{fontSize:17,fontWeight:'900',color:colors.ink},muted:{color:colors.muted,marginBottom:4},hint:{color:colors.muted,fontSize:13},error:{color:colors.danger},timelineRow:{flexDirection:'row',gap:spacing.sm,paddingVertical:6},dot:{width:12,height:12,borderRadius:6,borderWidth:2,borderColor:colors.border,marginTop:4},dotDone:{backgroundColor:colors.green,borderColor:colors.green},stepStatus:{color:colors.ink,fontWeight:'800',textTransform:'capitalize'},stepDone:{color:colors.green},time:{color:colors.muted,fontSize:12}})