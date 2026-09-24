import { useMemo, useState } from 'react'
import { cancelStageText, expectedDeliveryText } from '../../src/lib/deliveryPlan'
import { Alert, ScrollView, StyleSheet, Text, View, Pressable, RefreshControl } from 'react-native'
import { Image } from 'expo-image'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { API_URL, ApiError } from '../../src/api/client'
import { tokenStore } from '../../src/api/tokenStore'
import { Button, Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'
import type { BuyerPayment, SellerOrder } from '../../src/types'
import { statusLabel } from '../../src/lib/statusLabels'
import { deliveryLabel } from '../../src/lib/deliveryLabels'
import { DEFAULT_CURRENCY, formatMoney } from '../../src/lib/money'

const POLL_INTERVAL = 30_000
const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED']
const isTerminal = (status?: string) => !!status && TERMINAL_STATUSES.includes(status)

/**
 * An order always renders in the currency it was sold in. Orders placed before
 * the platform moved to USD keep their own code, so a shop total is only shown
 * as one figure when every order under it agrees; otherwise each card speaks
 * for itself rather than adding CDF to USD.
 */
function sharedCurrency(orders: SellerOrder[]): string | null {
  const codes = new Set(orders.map((order) => order.currency || DEFAULT_CURRENCY))
  return codes.size === 1 ? [...codes][0] : null
}

interface SellerAction { label: TranslationKey; status: string; kind?: 'accept' | 'reject' | 'prepare' | 'transition' | 'cancel'; destructive?: boolean }

function nextActions(order: SellerOrder): SellerAction[] {
  if (order.status === 'PENDING') return [{ label: 'seller.accept', status: 'ACCEPTED', kind: 'accept' }, { label: 'seller.reject', status: 'REJECTED', kind: 'reject', destructive: true }]
  if (order.status === 'ACCEPTED') return [{ label: 'seller.startPreparation', status: 'PREPARING', kind: 'prepare' }]
  if (order.status === 'PREPARING') {
    return order.delivery_method === 'PICKUP'
      ? [{ label: 'seller.readyForPickup', status: 'READY_FOR_PICKUP' }]
      : [{ label: 'seller.readyForTbkPickup', status: 'READY' }]
  }
  if (order.status === 'READY' && order.delivery_method === 'SHOP_DELIVERY') return [{ label: 'seller.ship', status: 'OUT_FOR_DELIVERY' }]
  if (order.status === 'READY' && order.delivery_method === 'PARTNER') return [{ label: 'seller.handToCourier', status: 'HANDED_TO_PARTNER' }]
  if (order.status === 'OUT_FOR_DELIVERY' || order.status === 'HANDED_TO_PARTNER') return [{ label: 'seller.markDelivered', status: 'DELIVERED' }]
  return []
}

/** Statuses in which the package label exists and the courier may still need it. */
const PACKAGE_QR_STATUSES = ['READY', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RECEIVED', 'COMPLETED']
/** The seller-cancel endpoint only accepts these; offering it later just fails. */
const CANCELLABLE = ['PENDING', 'ACCEPTED']
const SETTLED = ['PAID', 'VERIFIED']
const METHOD_KEYS: Record<string, TranslationKey> = {
  CASH_ON_DELIVERY: 'seller.method.CASH_ON_DELIVERY',
  MOBILE_PAY_NOW: 'seller.method.MOBILE_PAY_NOW',
  MOBILE_AT_DELIVERY: 'seller.method.MOBILE_AT_DELIVERY',
}
const PROVIDER_LABELS: Record<string, string> = { MPESA: 'M-Pesa', AIRTEL_MONEY: 'Airtel Money', ORANGE_MONEY: 'Orange Money' }

type Translate = ReturnType<typeof useI18n>['t']
function deliveryStatusLabel(t: Translate, status?: string): string {
  if (!status) return '—'
  const key = `delivery.status.${status}` as TranslationKey
  const label = t(key)
  return label === key ? status.replaceAll('_', ' ') : label
}

/** Who settles this payment and whether they already have - never a guess from the method name alone. */
function paymentNote(t: Translate, payment: BuyerPayment): string {
  if (SETTLED.includes(payment.status)) {
    return payment.confirmation_actor === 'COURIER' ? t('seller.paidByCourier') : t('seller.paidByProvider')
  }
  return payment.payment_method === 'CASH_ON_DELIVERY' ? t('seller.awaitingCourierCash') : t('seller.awaitingProvider')
}

export default function SellerOrders() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t, lang } = useI18n()
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

  // An action changes the list, the expanded detail, the payment card, the package
  // label and the dashboard counters, so all of them refetch from the backend.
  const invalidateOrders = (id?: string) => {
    for (const key of ['orders', 'cashSummary', 'growth']) void queryClient.invalidateQueries({ queryKey: ['seller', key] })
    if (id) for (const key of ['orderDetail', 'payment', 'packageQR']) void queryClient.invalidateQueries({ queryKey: ['seller', key, id] })
  }

  const transition = useMutation({
    mutationFn: ({ id, action }: { id: string; action: SellerAction }) => {
      if (action.kind === 'accept') return sellerApi.acceptOrder(id)
      if (action.kind === 'reject') return sellerApi.rejectOrder(id)
      if (action.kind === 'prepare') return sellerApi.prepareOrder(id)
      return sellerApi.sellerTransition(id, action.status)
    },
    onSuccess: (_data, variables) => invalidateOrders(variables.id),
    onError: (e) => { setActionError(e instanceof ApiError ? e.message : t('common.actionImpossible')); invalidateOrders() },
  })

  const cancel = useMutation({
    mutationFn: (id: string) => sellerApi.cancelOrder(id),
    onSuccess: (_data, id) => invalidateOrders(id),
    onError: (e) => { setActionError(e instanceof ApiError ? e.message : t('common.actionImpossible')); invalidateOrders() },
  })

  const groups = useMemo(() => {
    const names = new Map((shops.data ?? []).map((shop) => [shop.id, shop.name]))
    const grouped = new Map<string, SellerOrder[]>()
    for (const order of orders.data ?? []) grouped.set(order.shop_id, [...(grouped.get(order.shop_id) ?? []), order])
    return [...grouped.entries()].map(([id, shopOrders]) => ({
      id,
      name: names.get(id) ?? t('seller.unknownShop'),
      orders: shopOrders,
      total: shopOrders.reduce((sum, order) => sum + (order.final_total || 0), 0),
      currency: sharedCurrency(shopOrders),
    })).sort((a, b) => a.name.localeCompare(b.name))
  }, [orders.data, shops.data, t])

  const runAction = (order: SellerOrder, action: SellerAction) => {
    setActionError('')
    if (action.kind === 'reject') {
      Alert.alert(t('seller.rejectConfirmTitle'), t('seller.rejectConfirmBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('seller.reject'), style: 'destructive', onPress: () => transition.mutate({ id: order.id, action }) },
      ])
      return
    }
    transition.mutate({ id: order.id, action })
  }
  const runCancel = (order: SellerOrder) => {
    setActionError('')
    Alert.alert(t('seller.cancelConfirmTitle'), t('seller.cancelConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('seller.cancelOrder'), style: 'destructive', onPress: () => cancel.mutate(order.id) },
    ])
  }

  if (businesses.isLoading || shops.isLoading) return <Loading label={t('seller.loadingBusinesses')}/>
  if (businesses.isError || shops.isError) return <ErrorState message={t('seller.loadFailed')} retry={() => { void businesses.refetch(); void shops.refetch() }}/>
  if (!business) return <View style={styles.empty}><Text style={styles.title}>{t('seller.noBusiness')}</Text><Text style={styles.muted}>{t('seller.noBusinessBody')}</Text></View>

  return <ScrollView
    contentContainerStyle={styles.page}
    refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} tintColor={colors.green}/>}
  >
    <SectionTitle title={t('seller.orders')}/>
    <Text style={styles.muted}>{t('seller.liveStatusNote')}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      <ShopFilter label={t('seller.allShops')} selected={shopId === 'ALL'} onPress={() => setShopId('ALL')}/>
      {(shops.data ?? []).map((shop) => <ShopFilter key={shop.id} label={shop.name} selected={shopId === shop.id} onPress={() => setShopId(shop.id)}/>) }
    </ScrollView>
    {actionError ? <Card><Text style={styles.error}>{actionError}</Text></Card> : null}
    {orders.isLoading ? <Loading label={t('orders.loading')}/> : orders.isError ? <ErrorState message={t('orders.loadFailed')} retry={() => void orders.refetch()}/> : !groups.length ? <Card><Text style={styles.emptyText}>{t('seller.noOrdersFilter')}</Text></Card> : groups.map((group) => <View key={group.id} style={styles.group}>
      <View style={styles.groupHeader}>
        <View><Text style={styles.shop}>{group.name}</Text><Text style={styles.muted}>{t('orders.orderCount', { count: group.orders.length })}</Text></View>
        <Text style={styles.groupTotal}>{group.currency ? formatMoney(group.total, group.currency) : '—'}</Text>
      </View>
      {group.orders.map((order) => <OrderCard
        key={order.id}
        order={order}
        expanded={expandedId === order.id}
        busy={transition.isPending && transition.variables?.id === order.id}
        cancelBusy={cancel.isPending && cancel.variables === order.id}
        canCancel={CANCELLABLE.includes(order.status)}
        onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
        onAction={(action) => runAction(order, action)}
        onCancel={() => runCancel(order)}
      />)}
    </View>)}
  </ScrollView>
}

function OrderCard({ order, expanded, busy, cancelBusy, canCancel, onToggle, onAction, onCancel }: { order: SellerOrder; expanded: boolean; busy: boolean; cancelBusy: boolean; canCancel: boolean; onToggle: () => void; onAction: (action: SellerAction) => void; onCancel: () => void }) {
  const { t, lang } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const actions = nextActions(order)
  const orderCurrency = order.currency || DEFAULT_CURRENCY
  const payment = useQuery({
    queryKey: ['seller','payment',order.id],
    queryFn: () => sellerApi.getOrderPayment(order.id),
    enabled: expanded,
    retry: false,
  })
  // The list endpoint carries only the summary, so the lines, the buyer and the
  // delivery address are fetched on demand - the same detail the web dashboard
  // shows, rather than a thinner mobile-only view.
  const detail = useQuery({
    queryKey: ['seller','orderDetail',order.id],
    queryFn: () => sellerApi.order(order.id),
    enabled: expanded,
    retry: false,
  })
  // The courier scans this label at pickup. It was only shown on the web
  // dashboard, so a seller working from the phone had nothing to present.
  const showPackageQR = expanded && PACKAGE_QR_STATUSES.includes(order.status)
  const packageQR = useQuery({
    queryKey: ['seller','packageQR',order.id],
    queryFn: () => sellerApi.packageQR(order.id),
    enabled: showPackageQR,
    retry: false,
  })
  const accessToken = useQuery({ queryKey: ['auth','accessToken'], queryFn: () => tokenStore.getAccess(), enabled: showPackageQR, staleTime: 60_000 })
  const queryClient = useQueryClient()
  const confirmReturn = useMutation({
    mutationFn: () => sellerApi.confirmReturn(order.id),
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: ['seller'] }) },
    onError: (e) => Alert.alert(t('deliveryPlan.confirmReturnFailed'), e instanceof Error ? e.message : ''),
  })
  const planned = !['CANCELLED', 'COMPLETED'].includes(order.status) ? expectedDeliveryText(order, t, lang) : null
  const stage = cancelStageText(order, t)
  return <Card>
    <View style={styles.row}><Text style={styles.number}>{order.order_number || `#${order.id.slice(0, 8)}`}</Text><Text style={[styles.status, isTerminal(order.status) && styles.statusDone]}>{statusLabel(t, order.status)}</Text></View>
    <View style={styles.row}><Text style={styles.muted}>{t('orders.itemCount', { count: order.total_items })} · {order.delivery_method ? deliveryLabel(t, order.delivery_method) : '—'}</Text><Text style={styles.total}>{formatMoney(order.final_total, order.currency)}</Text></View>
    {order.delivery_status ? <Text style={styles.muted}>{t('seller.deliveryStatus')} : {deliveryStatusLabel(t, order.delivery_status)}</Text> : null}
    {planned ? <Text style={styles.detailHeading}>📅 {planned}</Text> : null}
    {stage ? <Text style={styles.muted}>{stage}</Text> : null}
    {order.delivery_status === 'RETURNING_TO_SELLER' ? (
      <Button
        title={t('deliveryPlan.confirmReturn')}
        loading={confirmReturn.isPending}
        style={styles.actionButton}
        onPress={() => Alert.alert(t('deliveryPlan.confirmReturn'), t('deliveryPlan.confirmReturnAsk'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('deliveryPlan.confirmReturn'), onPress: () => confirmReturn.mutate() },
        ])}
      />
    ) : null}
    <Text style={styles.date}>{new Date(order.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR')}</Text>
    {actions.length ? actions.map((action) => (
      <Button key={action.status} variant={action.destructive ? 'outline' : 'primary'} title={t(action.label)} loading={busy} style={styles.actionButton} onPress={() => onAction(action)}/>
    )) : null}
    <Button variant="outline" title={expanded ? t('seller.hideDetails') : t('seller.viewDetails')} onPress={onToggle}/>
    {canCancel && <Button variant="outline" title={t('seller.cancelOrder')} loading={cancelBusy} onPress={onCancel}/>}
    {expanded && <View style={styles.details}>
      {detail.data ? <>
        <Text style={styles.detailHeading}>{t('seller.products')}</Text>
        {detail.data.lines.map((line) => (
          <Text key={line.id} style={styles.muted}>
            {line.product_name}{line.variant_name && line.variant_name !== line.product_name ? ` · ${line.variant_name}` : ''}
            {' · '}{t('orders.itemCount', { count: line.quantity })}
            {' · '}{formatMoney(line.final_unit_price ?? line.unit_price ?? 0, orderCurrency)}
            {' = '}{formatMoney((line.final_unit_price ?? line.unit_price ?? 0) * line.quantity, orderCurrency)}
          </Text>
        ))}
        <Text style={styles.detailHeading}>{t('checkout.delivery')}</Text>
        <Text style={styles.muted}>{t('seller.deliveryStatus')} : {deliveryStatusLabel(t, detail.data.order.delivery_status || order.delivery_status || 'PENDING_TBK_ASSIGNMENT')}</Text>
        <Text style={styles.muted}>{detail.data.order.delivery_contact_name || '—'}{detail.data.order.delivery_phone ? ` · ${detail.data.order.delivery_phone}` : ''}</Text>
        <Text style={styles.muted}>{detail.data.order.delivery_address || '—'}</Text>
        {detail.data.order.delivery_notes ? <Text style={styles.muted}>{detail.data.order.delivery_notes}</Text> : null}
        <Text style={styles.muted}>{t('orders.deliveryFee')} : {formatMoney(detail.data.order.delivery_fee_final ?? 0, orderCurrency)}</Text>
        <Text style={styles.detailTotal}>{t('common.total')} : {formatMoney(order.final_total, orderCurrency)}</Text>
      </> : detail.isLoading ? <Text style={styles.muted}>{t('common.loading')}</Text> : null}
      <Text style={styles.detailHeading}>{t('seller.paymentHeading')}</Text>
      {payment.isLoading ? <Text style={styles.muted}>{t('seller.loadingPayment')}</Text> : payment.data ? <>
        <Text style={styles.muted}>{t('seller.paymentMode')} : {METHOD_KEYS[payment.data.payment_method] ? t(METHOD_KEYS[payment.data.payment_method]) : payment.data.payment_method}</Text>
        {payment.data.provider ? <Text style={styles.muted}>{t('seller.paymentOperator')} : {payment.data.provider_label || PROVIDER_LABELS[payment.data.provider] || payment.data.provider}</Text> : null}
        <Text style={styles.muted}>{t('orders.amountDue', { amount: formatMoney(payment.data.cash_due, payment.data.currency) })}</Text>
        <Text style={styles.muted}>{t('seller.paymentMarkup')} : {formatMoney(payment.data.payment_markup ?? 0, payment.data.currency)}</Text>
        <Text style={styles.detailTotal}>{t('seller.paymentTotal')} : {formatMoney(payment.data.final_total, payment.data.currency)}</Text>
        <Text style={styles.muted}>{t('seller.paymentStatus')} : {statusLabel(t, payment.data.status)}</Text>
        {(payment.data.receipt_reference || payment.data.internal_reference) ? <Text style={styles.muted}>{t('seller.paymentReference')} : {payment.data.receipt_reference || payment.data.internal_reference}</Text> : null}
        <Text style={styles.muted}>{paymentNote(t, payment.data)}</Text>
      </> : <Text style={styles.muted}>{t('seller.noPayment')}</Text>}
      {showPackageQR ? <View style={styles.qrBox}>
        <Text style={styles.detailHeading}>{t('seller.packageQr')}</Text>
        {packageQR.data && accessToken.data ? <>
          <Image
            source={{ uri: `${API_URL}/orders/${order.id}/package-qr/label`, headers: { Authorization: `Bearer ${accessToken.data}` } }}
            style={styles.qrImage}
            contentFit="contain"
            accessibilityLabel={t('seller.packageQr')}
          />
          <Text style={styles.number}>{packageQR.data.reference} · #{packageQR.data.package_number}</Text>
          <Text style={styles.muted}>{t('seller.packageQrHint')}</Text>
        </> : packageQR.isLoading || accessToken.isLoading ? <Text style={styles.muted}>{t('common.loading')}</Text> : <Text style={styles.muted}>{t('seller.packageQrUnavailable')}</Text>}
      </View> : null}
    </View>}
  </Card>
}

function ShopFilter({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.filter, selected && styles.filterActive]}><Text style={[styles.filterText, selected && styles.filterTextActive]}>{label}</Text></Pressable>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
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
  detailHeading: { color: colors.ink, fontWeight: '900', marginTop: spacing.xs },
  detailTotal: { color: colors.ink, fontWeight: '900' },
  qrBox: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  qrImage: { width: 220, height: 220, maxWidth: '100%' },
  muted: { color: colors.muted },
  error: { color: colors.danger },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  title: { color: colors.ink, fontSize: 23, fontWeight: '900' },
  emptyText: { color: colors.muted, textAlign: 'center' },
})
