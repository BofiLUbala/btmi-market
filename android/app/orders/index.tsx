import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'
import { statusLabel } from '../../src/lib/statusLabels'

type OrderFilter = 'toutes' | 'a_payer' | 'payees' | 'en_preparation' | 'en_livraison' | 'terminees' | 'annulees'

const FILTERS: Array<{ key: OrderFilter; label: TranslationKey }> = [
  { key: 'toutes', label: 'orders.filterAll' },
  { key: 'a_payer', label: 'orders.filterToPay' },
  { key: 'payees', label: 'orders.filterPaid' },
  { key: 'en_preparation', label: 'orders.filterPreparing' },
  { key: 'en_livraison', label: 'orders.filterInDelivery' },
  { key: 'terminees', label: 'orders.filterCompleted' },
  { key: 'annulees', label: 'orders.filterCancelled' },
]

function isOrderStatus(status: string | null | undefined, filter: OrderFilter): boolean {
  if (!status) return false
  switch (filter) {
    case 'a_payer':
      return status === 'PENDING' || status === 'ACCEPTED' || status === 'PREPARING'
    case 'payees':
      return status === 'COMPLETED' || status === 'RECEIVED'
    case 'en_preparation':
      return status === 'PREPARING'
    case 'en_livraison':
      return status === 'OUT_FOR_DELIVERY' || status === 'DELIVERED'
    case 'terminees':
      return status === 'COMPLETED'
    case 'annulees':
      return status === 'CANCELLED'
    default:
      return true
  }
}

export default function OrdersScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [filter, setFilter] = useState<OrderFilter>('toutes')
  const query = useQuery({ queryKey: ['buyer','orders'], queryFn: buyerApi.orders })
  const orders = (query.data || []).filter((order) => isOrderStatus(order.status, filter))
  if (query.isLoading) return <Loading label={t('orders.loading')}/>
  if (query.isError) return <ErrorState message={t('orders.loadFailed')}/>
  return <ScrollView contentContainerStyle={styles.page} refreshControl={undefined}>
    <SectionTitle title={t('profile.myOrders')}/>
    <View style={styles.tabs}>{FILTERS.map((f) => (
      <Pressable key={f.key} style={[styles.chip, filter === f.key && styles.chipActive]} onPress={() => setFilter(f.key)}>
        <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{t(f.label)}</Text>
      </Pressable>
    ))}</View>
    {!orders.length ? <Card><Text style={styles.muted}>{t('orders.empty')}</Text></Card> : orders.map((order) => <Pressable key={order.id} onPress={() => router.push(`/orders/${order.id}`)}><Card><Text style={styles.number}>{order.order_number || t('orders.number', { number: order.id.slice(0,8) })}</Text><Text style={[styles.status, ['COMPLETED','RECEIVED'].includes(order.status) && styles.statusDone]}>{statusLabel(t, order.status)}</Text><Text style={styles.muted}>{t('orders.itemCount', { count: order.total_items })} · {order.final_total.toLocaleString()} FC</Text></Card></Pressable>)}
  </ScrollView>
}
const makeStyles = (colors: Colors) => StyleSheet.create({
  page:{padding:spacing.md,gap:spacing.md},
  number:{fontSize:17,fontWeight:'900',color:colors.ink},
  status:{color:colors.green,fontWeight:'800',marginVertical:4},
  statusDone:{color:colors.muted},
  muted:{color:colors.muted},
  tabs:{flexDirection:'row',flexWrap:'wrap',gap:8},
  chip:{paddingHorizontal:14,paddingVertical:7,borderRadius:999,borderWidth:1,borderColor:colors.border},
  chipActive:{backgroundColor:colors.green,borderColor:colors.green},
  chipText:{color:colors.ink,fontSize:13},
  chipTextActive:{color:'#fff',fontWeight:'800'},
})