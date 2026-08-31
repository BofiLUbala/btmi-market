import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { colors, spacing } from '../../src/theme'

export default function OrdersScreen() {
  const { t } = useI18n()
  const query = useQuery({ queryKey: ['buyer','orders'], queryFn: buyerApi.orders })
  if (query.isLoading) return <Loading label={t('orders.loading')}/>
  if (query.isError) return <ErrorState message={t('orders.loadFailed')}/>
  return <ScrollView contentContainerStyle={styles.page}><SectionTitle title={t('profile.myOrders')}/>{!query.data?.length ? <Card><Text style={styles.muted}>{t('orders.empty')}</Text></Card> : query.data.map((order) => <Pressable key={order.id} onPress={() => router.push(`/orders/${order.id}`)}><Card><Text style={styles.number}>{order.order_number || t('orders.number', { number: order.id.slice(0,8) })}</Text><Text style={styles.status}>{order.status.replaceAll('_',' ')}</Text><Text style={styles.muted}>{t('orders.itemCount', { count: order.total_items })} · {order.final_total.toLocaleString()} FC</Text></Card></Pressable>)}</ScrollView>
}
const styles=StyleSheet.create({page:{padding:spacing.md,gap:spacing.md},number:{fontSize:17,fontWeight:'900',color:colors.ink},status:{color:colors.green,fontWeight:'800',marginVertical:4},muted:{color:colors.muted}})