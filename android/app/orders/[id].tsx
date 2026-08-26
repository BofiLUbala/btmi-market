import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
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

function actorLabel(actor?: string) {
  if (actor === 'SELLER') return 'Boutique'
  if (actor === 'BUYER') return 'Acheteur'
  return 'Système'
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

const reason: Record<string,string> = { ORDER_NOT_COMPLETED:'Disponible après la fin de la commande', PAYMENT_NOT_VERIFIED:'Paiement non encore vérifié', REVIEW_ALREADY_EXISTS:'Avis déjà publié' }

export default function OrderScreen(){
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

  const receiveMutation = useMutation({ mutationFn: () => buyerApi.confirmReceived(id!), onSuccess: invalidate, onError: (e) => setActionError(e instanceof ApiError ? e.message : 'Action impossible') })
  const cancelMutation = useMutation({ mutationFn: () => buyerApi.cancelOrder(id!), onSuccess: invalidate, onError: (e) => setActionError(e instanceof ApiError ? e.message : 'Action impossible') })
  const createPaymentMutation = useMutation({ mutationFn: () => buyerApi.createPayment(id!), onSuccess: invalidate, onError: (e) => setActionError(e instanceof ApiError ? e.message : 'Action impossible') })
  const confirmPaidMutation = useMutation({ mutationFn: () => buyerApi.buyerConfirmPayment(payment.data!.id), onSuccess: invalidate, onError: (e) => setActionError(e instanceof ApiError ? e.message : 'Action impossible') })

  const lines = order.data?.lines || []
  const eligibility = useQueries({ queries: lines.map(line=>({queryKey:['review-eligibility',id,line.id],queryFn:()=>buyerApi.reviewEligibility(id!,line.id)})) })
  const service = useQuery({queryKey:['review-eligibility',id,'service'],queryFn:()=>buyerApi.reviewEligibility(id!),enabled:Boolean(id)})

  if(order.isLoading)return <Loading label="Chargement de la commande…"/>
  if(order.isError||!order.data)return <ErrorState message="Commande introuvable." retry={()=>void order.refetch()}/>

  const o = order.data.order
  const t = tracking.data
  const p = payment.data ?? null
  const deliveryMethod = o.delivery_method || t?.delivery_method || ''
  const canReceive = (deliveryMethod === 'PICKUP' && o.status === 'READY_FOR_PICKUP') || (deliveryMethod !== 'PICKUP' && o.status === 'DELIVERED')
  const canCancel = o.status === 'PENDING' || o.status === 'ACCEPTED'

  const history: OrderStatusHistory[] = t?.history?.length ? [...t.history].reverse() : (order.data.history ? [...order.data.history].reverse() : [])
  const steps = FLOW_STEPS[deliveryMethod]
  const timeline = steps && t
    ? (steps.includes(t.current_status) ? steps : [...steps, t.current_status]).map((status) => ({
        status,
        event: history.find((h) => h.status === status),
      }))
    : history.map((h) => ({ status: h.status, event: h }))

  const confirmCancel = () => {
    Alert.alert('Annuler la commande','Confirmer l’annulation de cette commande ?',[
      { text:'Retour', style:'cancel' },
      { text:'Annuler la commande', style:'destructive', onPress:()=>{ setActionError(''); cancelMutation.mutate() } },
    ])
  }

  return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={o.order_number||'Détail de la commande'}/>
    <Text style={styles.shop}>{order.data.shop_name} · {deliveryMethod ? deliveryMethod.replaceAll('_',' ').toLowerCase() : 'livraison à choisir'}</Text>
    <Card>
      <Text style={styles.status}>{(t?.current_status || o.status).replaceAll('_',' ')}</Text>
      <Text style={styles.total}>{o.final_total.toLocaleString()} FC</Text>
      {isTerminal(o.status) && <Text style={styles.hint}>Commande terminée — plus de mises à jour en direct.</Text>}
      {!isTerminal(o.status) && tracking.isFetching && <Text style={styles.hint}>Mise à jour…</Text>}
    </Card>

    {actionError ? <Card><Text style={styles.error}>{actionError}</Text></Card> : null}

    {(canCancel || canReceive) && <Card>
      {canReceive && <Button title="J’ai reçu ma commande" loading={receiveMutation.isPending} onPress={()=>{ setActionError(''); receiveMutation.mutate() }}/>}
      {canCancel && <Button variant="outline" title="Annuler la commande" loading={cancelMutation.isPending} onPress={confirmCancel}/>}
    </Card>}

    {deliveryMethod ? <SectionTitle title="Suivi en direct"/> : null}
    <Card>{timeline.length ? timeline.map((step,i)=>(
      <View key={`${step.status}-${i}`} style={styles.timelineRow}>
        <View style={[styles.dot, step.event && styles.dotDone]}/>
        <View style={{flex:1}}>
          <Text style={[styles.stepStatus, step.event && styles.stepDone]}>{step.status.replaceAll('_',' ').toLowerCase().replace(/\b\w/,c=>c.toUpperCase())}</Text>
          {step.event ? <>
            {step.event.notes ? <Text style={styles.muted}>{step.event.notes}</Text> : null}
            <Text style={styles.time}>{actorLabel(step.event.actor_type)} · {formatDateTime(step.event.created_at)}</Text>
          </> : <Text style={styles.time}>À venir</Text>}
        </View>
      </View>
    )) : <Text style={styles.muted}>Historique indisponible.</Text>}</Card>

    {deliveryMethod ? <Card>
      <Text style={styles.name}>Paiement en espèces</Text>
      {p ? <>
        <Text style={styles.muted}>Montant dû : {p.cash_due.toLocaleString()} {p.currency}</Text>
        <Text style={styles.muted}>Vous : {p.buyer_confirmed ? '✓ Paiement déclaré' : 'Non confirmé'}</Text>
        <Text style={styles.muted}>Boutique : {p.seller_confirmed ? '✓ Espèces reçues' : 'En attente du vendeur'}</Text>
        <Text style={[styles.muted,{fontWeight:'800'}]}>Statut : {p.status}</Text>
        {!p.buyer_confirmed && <Button title="J’ai payé" loading={confirmPaidMutation.isPending} onPress={()=>{ setActionError(''); confirmPaidMutation.mutate() }}/>}
        {p.buyer_confirmed && !p.seller_confirmed && <Text style={styles.hint}>Votre déclaration est enregistrée. Le vendeur doit confirmer la réception des espèces.</Text>}
      </> : <Button variant="outline" title="Préparer le paiement en espèces" loading={createPaymentMutation.isPending} onPress={()=>{ setActionError(''); createPaymentMutation.mutate() }}/>}
    </Card> : null}

    <SectionTitle title="Produits achetés"/>{lines.map((line,i)=>{const e=eligibility[i].data;return <Card key={line.id}><Text style={styles.name}>{line.product_name}</Text><Text style={styles.muted}>{line.variant_name||'Option standard'} · Qté {line.quantity} · {(line.final_unit_price*line.quantity).toLocaleString()} FC</Text>{e?.eligible ? <Button title="Noter ce produit" onPress={()=>router.push({pathname:'/reviews/write',params:{orderId:id,lineId:line.id,productName:line.product_name}})}/> : e?.existing_review_id ? <Button variant="outline" title="Modifier mon avis" onPress={()=>router.push({pathname:'/reviews/write',params:{orderId:id,lineId:line.id,reviewId:e.existing_review_id,productName:line.product_name}})}/> : <Text style={styles.hint}>{reason[e?.reason||'']||'Avis non disponible'}</Text>}</Card>})}
    <SectionTitle title="Livraison et service"/><Card><Text style={styles.muted}>Évaluez séparément la livraison, la boutique et votre expérience de commande.</Text>{service.data?.eligible?<Button variant="outline" title="Noter le service" onPress={()=>router.push({pathname:'/reviews/write',params:{orderId:id,type:'service',productName:order.data.shop_name}})}/>:<Text style={styles.hint}>{reason[service.data?.reason||'']||'Avis de service non disponible'}</Text>}</Card>
  </ScrollView>
}

const styles=StyleSheet.create({page:{padding:spacing.md,gap:spacing.md,paddingBottom:spacing.xl},shop:{color:colors.muted},status:{fontWeight:'900',color:colors.green},total:{fontSize:23,fontWeight:'900',color:colors.ink,marginTop:6},name:{fontSize:17,fontWeight:'900',color:colors.ink},muted:{color:colors.muted,marginBottom:4},hint:{color:colors.muted,fontSize:13},error:{color:colors.danger},timelineRow:{flexDirection:'row',gap:spacing.sm,paddingVertical:6},dot:{width:12,height:12,borderRadius:6,borderWidth:2,borderColor:colors.border,marginTop:4},dotDone:{backgroundColor:colors.green,borderColor:colors.green},stepStatus:{color:colors.ink,fontWeight:'800',textTransform:'capitalize'},stepDone:{color:colors.green},time:{color:colors.muted,fontSize:12}})
