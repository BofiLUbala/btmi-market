import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { colors, spacing } from '../../src/theme'

export default function OrdersScreen() {
  const query = useQuery({ queryKey: ['buyer','orders'], queryFn: buyerApi.orders })
  if (query.isLoading) return <Loading label="Chargement des commandes…"/>
  if (query.isError) return <ErrorState message="Impossible de charger vos commandes."/>
  return <ScrollView contentContainerStyle={styles.page}><SectionTitle title="Mes commandes"/>{!query.data?.length ? <Card><Text style={styles.muted}>Vous n’avez aucune commande.</Text></Card> : query.data.map((order) => <Pressable key={order.id} onPress={() => router.push(`/orders/${order.id}`)}><Card><Text style={styles.number}>{order.order_number || `Commande ${order.id.slice(0,8)}`}</Text><Text style={styles.status}>{order.status.replaceAll('_',' ')}</Text><Text style={styles.muted}>{order.total_items} article(s) · {order.final_total.toLocaleString()} FC</Text></Card></Pressable>)}</ScrollView>
}
const styles=StyleSheet.create({page:{padding:spacing.md,gap:spacing.md},number:{fontSize:17,fontWeight:'900',color:colors.ink},status:{color:colors.green,fontWeight:'800',marginVertical:4},muted:{color:colors.muted}})
