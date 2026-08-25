import { router, useLocalSearchParams } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useQueries, useQuery } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { Button, Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { colors, spacing } from '../../src/theme'

const reason: Record<string,string> = { ORDER_NOT_COMPLETED:'Disponible après la fin de la commande', PAYMENT_NOT_VERIFIED:'Paiement non encore vérifié', REVIEW_ALREADY_EXISTS:'Avis déjà publié' }
export default function OrderScreen(){
 const {id}=useLocalSearchParams<{id:string}>(); const order=useQuery({queryKey:['buyer','order',id],queryFn:()=>buyerApi.order(id!),enabled:Boolean(id)})
 const lines=order.data?.lines||[]; const eligibility=useQueries({queries:lines.map(line=>({queryKey:['review-eligibility',id,line.id],queryFn:()=>buyerApi.reviewEligibility(id!,line.id)}))})
 const service=useQuery({queryKey:['review-eligibility',id,'service'],queryFn:()=>buyerApi.reviewEligibility(id!),enabled:Boolean(id)})
 if(order.isLoading)return <Loading label="Chargement de la commande…"/>; if(order.isError||!order.data)return <ErrorState message="Commande introuvable."/>
 return <ScrollView contentContainerStyle={styles.page}><SectionTitle title={order.data.order.order_number||'Détail de la commande'}/><Text style={styles.shop}>{order.data.shop_name}</Text><Card><Text style={styles.status}>{order.data.order.status.replaceAll('_',' ')}</Text><Text style={styles.total}>{order.data.order.final_total.toLocaleString()} FC</Text></Card><SectionTitle title="Produits achetés"/>{lines.map((line,i)=>{const e=eligibility[i].data;return <Card key={line.id}><Text style={styles.name}>{line.product_name}</Text><Text style={styles.muted}>{line.variant_name||'Option standard'} · Qté {line.quantity}</Text>{e?.eligible ? <Button title="Noter ce produit" onPress={()=>router.push({pathname:'/reviews/write',params:{orderId:id,lineId:line.id,productName:line.product_name}})}/> : e?.existing_review_id ? <Button variant="outline" title="Modifier mon avis" onPress={()=>router.push({pathname:'/reviews/write',params:{orderId:id,lineId:line.id,reviewId:e.existing_review_id,productName:line.product_name}})}/> : <Text style={styles.hint}>{reason[e?.reason||'']||'Avis non disponible'}</Text>}</Card>})}<SectionTitle title="Livraison et service"/><Card><Text style={styles.muted}>Évaluez séparément la livraison, la boutique et votre expérience de commande.</Text>{service.data?.eligible?<Button variant="outline" title="Noter le service" onPress={()=>router.push({pathname:'/reviews/write',params:{orderId:id,type:'service',productName:order.data.shop_name}})}/>:<Text style={styles.hint}>{reason[service.data?.reason||'']||'Avis de service non disponible'}</Text>}</Card></ScrollView>
}
const styles=StyleSheet.create({page:{padding:spacing.md,gap:spacing.md},shop:{color:colors.muted},status:{fontWeight:'900',color:colors.green},total:{fontSize:23,fontWeight:'900',color:colors.ink,marginTop:6},name:{fontSize:17,fontWeight:'900',color:colors.ink},muted:{color:colors.muted,marginBottom:10},hint:{color:colors.muted,fontSize:13},})
