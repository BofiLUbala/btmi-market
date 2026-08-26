import { useMemo, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View, Pressable, RefreshControl } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { colors, radius, spacing } from '../../src/theme'
import type { BuyerPayment, SellerOrder } from '../../src/types'

const POLL_INTERVAL = 30_000
const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED']
const isTerminal = (status?: string) => !!status && TERMINAL_STATUSES.includes(status)

interface SellerAction { label: string; status: string; destructive?: boolean }

function nextActions(order: SellerOrder): SellerAction[] {
  if (order.status === 'PENDING') return [{ label: 'Accepter', status: 'ACCEPTED' }]
  if (order.status === 'ACCEPTED') return [{ label: 'Commencer la préparation', status: 'PREPARING' }]
  if (order.status === 'PREPARING') {
    return order.delivery_method === 'PICKUP'
      ? [{ label: 'Prêt pour retrait', status: 'READY_FOR_PICKUP' }]
      : [{ label: 'Prêt', status: 'READY' }]
  }
  if (order.status === 'READY' && order.delivery_method === 'SHOP_DELIVERY') return [{ label: 'Expédier', status: 'OUT_FOR_DELIVERY' }]
  if (order.status === 'READY' && order.delivery_method === 'PARTNER') return [{ label: 'Remettre au livreur', status: 'HANDED_TO_PARTNER' }]
  if (order.status === 'OUT_FOR_DELIVERY' || order.status === 'HANDED_TO_PARTNER') return [{ label: 'Marquer livrée', status: 'DELIVERED' }]
  return []
}

export default function SellerOrders() {
  const queryClient = useQueryClient()
  const [shopId, setShopId] = useState('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
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
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data?.some((order) => !isTerminal(order.status))) return false
      return POLL_INTERVAL
    },
  })

  const invalidateOrders = () => { void queryClient.invalidateQueries({ queryKey: ['seller', 'orders'] }) }

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => sellerApi.sellerTransition(id, status),
    onSuccess: invalidateOrders,
    onError: (e) => setActionError(e instanceof ApiError ? e.message : 'Action impossible'),
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

  const runAction = (order: SellerOrder, action: SellerAction) => {
    setActionError('')
    transition.mutate({ id: order.id, status: action.status })
  }

  if (businesses.isLoading || shops.isLoading) return <Loading label="Chargement des boutiques…"/>
  if (businesses.isError || shops.isError) return <ErrorState message="Impossible de charger l’espace vendeur." retry={() => { void businesses.refetch(); void shops.refetch() }}/>
  if (!business) return <View style={styles.empty}><Text style={styles.title}>Aucune entreprise</Text><Text style={styles.muted}>Créez d’abord une entreprise pour recevoir des commandes.</Text></View>

  return <ScrollView
    contentContainerStyle={styles.page}
    refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} tintColor={colors.green}/>}
  >
    <SectionTitle title="Commandes"/>
    <Text style={styles.muted}>Les statuts sont synchronisés en direct avec l’acheteur.</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      <ShopFilter label="Toutes les boutiques" selected={shopId === 'ALL'} onPress={() => setShopId('ALL')}/>
      {(shops.data ?? []).map((shop) => <ShopFilter key={shop.id} label={shop.name} selected={shopId === shop.id} onPress={() => setShopId(shop.id)}/>) }
    </ScrollView>
    {actionError ? <Card><Text style={styles.error}>{actionError}</Text></Card> : null}
    {orders.isLoading ? <Loading label="Chargement des commandes…"/> : orders.isError ? <ErrorState message="Impossible de charger les commandes." retry={() => void orders.refetch()}/> : !groups.length ? <Card><Text style={styles.emptyText}>Aucune commande pour cette sélection.</Text></Card> : groups.map((group) => <View key={group.id} style={styles.group}>
      <View style={styles.groupHeader}>
        <View><Text style={styles.shop}>{group.name}</Text><Text style={styles.muted}>{group.orders.length} commande{group.orders.length === 1 ? '' : 's'}</Text></View>
        <Text style={styles.groupTotal}>{group.total.toLocaleString()} FC</Text>
      </View>
      {group.orders.map((order) => <OrderCard
        key={order.id}
        order={order}
        expanded={expandedId === order.id}
        busy={transition.isPending && transition.variables?.id === order.id}
        onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
        onAction={(action) => runAction(order, action)}
      />)}
    </View>)}
  </ScrollView>
}

function OrderCard({ order, expanded, busy, onToggle, onAction }: { order: SellerOrder; expanded: boolean; busy: boolean; onToggle: () => void; onAction: (action: SellerAction) => void }) {
  const queryClient = useQueryClient()
  const actions = nextActions(order)
  const payment = useQuery({
    queryKey: ['seller','payment',order.id],
    queryFn: () => sellerApi.getOrderPayment(order.id),
    enabled: expanded,
    retry: false,
  })
  const confirmCash = useMutation({
    mutationFn: () => sellerApi.sellerConfirmPayment(payment.data!.id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['seller'] }) },
    onError: (e) => Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Action impossible'),
  })

  return <Card>
    <View style={styles.row}><Text style={styles.number}>{order.order_number || `#${order.id.slice(0, 8)}`}</Text><Text style={[styles.status, isTerminal(order.status) && styles.statusDone]}>{order.status.replaceAll('_', ' ')}</Text></View>
    <View style={styles.row}><Text style={styles.muted}>{order.total_items} article{order.total_items === 1 ? '' : 's'} · {(order.delivery_method || '—').replaceAll('_',' ').toLowerCase()}</Text><Text style={styles.total}>{order.final_total.toLocaleString()} FC</Text></View>
    <Text style={styles.date}>{new Date(order.created_at).toLocaleDateString('fr-FR')}</Text>
    {actions.length ? actions.map((action) => (
      <Button key={action.status} title={action.label} loading={busy} style={styles.actionButton} onPress={() => onAction(action)}/>
    )) : null}
    <Button variant="outline" title={expanded ? 'Masquer les détails' : 'Voir les détails'} onPress={onToggle}/>
    {expanded && <View style={styles.details}>
      {payment.isLoading ? <Text style={styles.muted}>Chargement du paiement…</Text> : payment.data ? <>
        <Text style={styles.muted}>Montant dû : {payment.data.cash_due.toLocaleString()} {payment.data.currency}</Text>
        <Text style={styles.muted}>Acheteur : {payment.data.buyer_confirmed ? '✓ Paiement déclaré' : 'Non confirmé'}</Text>
        <Text style={styles.muted}>Vendeur : {payment.data.seller_confirmed ? '✓ Espèces reçues' : 'Non confirmé'}</Text>
        <Text style={styles.muted}>Statut : {payment.data.status}</Text>
        {!payment.data.seller_confirmed && <Button title="Confirmer les espèces reçues" loading={confirmCash.isPending} onPress={() => confirmCash.mutate()}/>}
      </> : <Text style={styles.muted}>Aucun paiement créé pour l’instant.</Text>}
    </View>}
  </Card>
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
  statusDone: { color: colors.muted },
  total: { color: colors.green, fontSize: 16, fontWeight: '900' },
  date: { color: colors.muted, fontSize: 12 },
  actionButton: { marginTop: spacing.xs },
  details: { gap: spacing.xs, paddingTop: spacing.xs },
  muted: { color: colors.muted },
  error: { color: colors.danger },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  title: { color: colors.ink, fontSize: 23, fontWeight: '900' },
  emptyText: { color: colors.muted, textAlign: 'center' },
})
