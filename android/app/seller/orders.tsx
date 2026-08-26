import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View, Pressable, RefreshControl } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { colors, radius, spacing } from '../../src/theme'
import type { SellerOrder } from '../../src/types'

export default function SellerOrders() {
  const [shopId, setShopId] = useState('ALL')
  const businesses = useQuery({ queryKey: ['seller', 'businesses'], queryFn: sellerApi.businesses })
  const business = businesses.data?.[0]
  const shops = useQuery({
    queryKey: ['seller', 'shops', business?.id],
    queryFn: () => sellerApi.shops(business!.id),
    enabled: Boolean(business),
  })
  const orders = useQuery({
    queryKey: ['seller', 'orders', business?.id, shopId],
    queryFn: () => shopId === 'ALL' ? sellerApi.businessOrders(business!.id) : sellerApi.shopOrders(shopId),
    enabled: Boolean(business),
  })

  const groups = useMemo(() => {
    const names = new Map((shops.data ?? []).map((shop) => [shop.id, shop.name]))
    const grouped = new Map<string, SellerOrder[]>()
    for (const order of orders.data ?? []) grouped.set(order.shop_id, [...(grouped.get(order.shop_id) ?? []), order])
    return [...grouped.entries()].map(([id, shopOrders]) => ({
      id,
      name: names.get(id) ?? 'Boutique inconnue',
      orders: shopOrders,
      total: shopOrders.reduce((sum, order) => sum + (order.final_total || 0), 0),
    })).sort((a, b) => a.name.localeCompare(b.name))
  }, [orders.data, shops.data])

  if (businesses.isLoading || shops.isLoading) return <Loading label="Chargement des boutiques…"/>
  if (businesses.isError || shops.isError) return <ErrorState message="Impossible de charger l’espace vendeur." retry={() => { void businesses.refetch(); void shops.refetch() }}/>
  if (!business) return <View style={styles.empty}><Text style={styles.title}>Aucune entreprise</Text><Text style={styles.muted}>Créez d’abord une entreprise pour recevoir des commandes.</Text></View>

  return <ScrollView
    contentContainerStyle={styles.page}
    refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} tintColor={colors.green}/>}
  >
    <SectionTitle title="Commandes"/>
    <Text style={styles.muted}>Les commandes sont classées selon la boutique concernée.</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      <ShopFilter label="Toutes les boutiques" selected={shopId === 'ALL'} onPress={() => setShopId('ALL')}/>
      {(shops.data ?? []).map((shop) => <ShopFilter key={shop.id} label={shop.name} selected={shopId === shop.id} onPress={() => setShopId(shop.id)}/>) }
    </ScrollView>
    {orders.isLoading ? <Loading label="Chargement des commandes…"/> : orders.isError ? <ErrorState message="Impossible de charger les commandes." retry={() => void orders.refetch()}/> : !groups.length ? <Card><Text style={styles.emptyText}>Aucune commande pour cette sélection.</Text></Card> : groups.map((group) => <View key={group.id} style={styles.group}>
      <View style={styles.groupHeader}>
        <View><Text style={styles.shop}>{group.name}</Text><Text style={styles.muted}>{group.orders.length} commande{group.orders.length === 1 ? '' : 's'}</Text></View>
        <Text style={styles.groupTotal}>{group.total.toLocaleString()} FC</Text>
      </View>
      {group.orders.map((order) => <Card key={order.id}>
        <View style={styles.row}><Text style={styles.number}>{order.order_number || `#${order.id.slice(0, 8)}`}</Text><Text style={styles.status}>{order.status.replaceAll('_', ' ')}</Text></View>
        <View style={styles.row}><Text style={styles.muted}>{order.total_items} article{order.total_items === 1 ? '' : 's'}</Text><Text style={styles.total}>{order.final_total.toLocaleString()} FC</Text></View>
        <Text style={styles.date}>{new Date(order.created_at).toLocaleDateString('fr-FR')}</Text>
      </Card>)}
    </View>)}
  </ScrollView>
}

function ShopFilter({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.filter, selected && styles.filterActive]}><Text style={[styles.filterText, selected && styles.filterTextActive]}>{label}</Text></Pressable>
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  filters: { gap: spacing.sm, paddingVertical: 2 },
  filter: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  filterActive: { backgroundColor: colors.green, borderColor: colors.green },
  filterText: { color: colors.ink, fontWeight: '800' },
  filterTextActive: { color: colors.white },
  group: { gap: spacing.sm, paddingTop: spacing.sm },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.greenSoft },
  shop: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  groupTotal: { color: colors.green, fontWeight: '900', fontSize: 17 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  number: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  status: { color: colors.green, fontSize: 12, fontWeight: '900' },
  total: { color: colors.green, fontSize: 16, fontWeight: '900' },
  date: { color: colors.muted, fontSize: 12 },
  muted: { color: colors.muted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  title: { color: colors.ink, fontSize: 23, fontWeight: '900' },
  emptyText: { color: colors.muted, textAlign: 'center' },
})
