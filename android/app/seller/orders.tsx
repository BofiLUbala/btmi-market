import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View, Pressable, RefreshControl } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Loading } from '../../src/components/ui'
import { DeliveryPlanCard } from '../../src/components/DeliveryPlanCard'
import { OrderItemQRSection, QRPanel } from '../../src/components/OrderItemQRSection'
import { useAuth } from '../../src/store/auth'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'
import type { OrderLine, SellerOrder } from '../../src/types'
import { expectedDeliveryText } from '../../src/lib/deliveryPlan'
import { confirmationActorKey, isPaymentPaid, paymentStatusKey } from '../../src/lib/paymentStatus'
import { DEFAULT_CURRENCY, formatMoney } from '../../src/lib/money'

// Port of web-app/src/pages/seller/orders/SellerOrdersPage.tsx. Same data flow:
// the active business (not the first one), an "all shops" / single-shop
// filter, orders grouped by shop with a per-shop total, 30 s polling while an
// order is still active, the live bar, the same seller actions and the same
// expanded detail (delivery box, delivery plan, lines with their ORDER_ITEM QR,
// payment box, package QR). `?orderId=` opens that order, as on web. Each web
// table row is rendered as a card at phone width.

const POLL_INTERVAL = 30_000
const ACTIVE_STATUSES_DONE = ['COMPLETED', 'CANCELLED', 'REJECTED']
const PACKAGE_QR_STATUSES = ['READY', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RECEIVED', 'COMPLETED']
type Translate = ReturnType<typeof useI18n>['t']

function timeAgo(date: Date, t: Translate): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 5) return t('time.justNow')
  if (seconds < 60) return t('time.secondsAgo', { count: seconds })
  return t('time.minutesAgo', { count: Math.floor(seconds / 60) })
}

function sharedCurrency(orders: SellerOrder[]): string | null {
  const codes = new Set(orders.map((order) => order.currency || DEFAULT_CURRENCY))
  return codes.size === 1 ? [...codes][0] : null
}

type SellerAction = { label: string; status?: string; action?: 'accept' | 'reject' | 'prepare' }

function nextActions(order: SellerOrder, t: Translate): SellerAction[] {
  if (order.status === 'PENDING') return [{ label: t('seller.orders.accept'), action: 'accept' }, { label: t('seller.orders.reject'), action: 'reject' }]
  if (order.status === 'ACCEPTED') return [{ label: t('seller.orders.startPreparing'), action: 'prepare' }]
  if (order.status === 'PREPARING') {
    return order.delivery_method === 'PICKUP'
      ? [{ label: t('seller.orders.readyForPickup'), status: 'READY_FOR_PICKUP' }]
      : [{ label: t('seller.orders.markReady'), status: 'READY' }]
  }
  if (order.status === 'READY' && order.delivery_method === 'SHOP_DELIVERY') return [{ label: t('seller.orders.dispatchOrder'), status: 'OUT_FOR_DELIVERY' }]
  if (order.status === 'READY' && order.delivery_method === 'PARTNER') return [{ label: t('seller.orders.handToPartner'), status: 'HANDED_TO_PARTNER' }]
  if (order.status === 'OUT_FOR_DELIVERY' || order.status === 'HANDED_TO_PARTNER') return [{ label: t('seller.orders.markDelivered'), status: 'DELIVERED' }]
  return []
}

function orderStatusLabel(status: string, t: Translate): string {
  const key = `status.${status}`
  const value = t(key as TranslationKey)
  return value === key ? status : value
}

/** web getStatusColor → badge-success / warning / info / primary / danger / muted */
function statusTint(status: string, c: Colors) {
  switch (status) {
    case 'COMPLETED': return { bg: c.successSoft, fg: c.success }
    case 'PENDING': return { bg: c.warningSoft, fg: c.warning }
    case 'ACCEPTED': case 'PREPARING': case 'READY': return { bg: c.infoSoft, fg: c.info }
    case 'OUT_FOR_DELIVERY': case 'DELIVERED': return { bg: c.greenSoft, fg: c.green }
    case 'CANCELLED': case 'REJECTED': return { bg: c.dangerSoft, fg: c.danger }
    default: return { bg: c.surface2, fg: c.muted }
  }
}

export default function SellerOrders() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const params = useLocalSearchParams<{ orderId?: string }>()
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const [shopFilter, setShopFilter] = useState('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(typeof params.orderId === 'string' ? params.orderId : null)
  const [actionError, setActionError] = useState('')
  const [actingId, setActingId] = useState<string | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => { if (typeof params.orderId === 'string') setExpandedId(params.orderId) }, [params.orderId])
  useEffect(() => { setShopFilter('ALL') }, [activeBusiness?.id])
  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 10_000); return () => clearInterval(id) }, [])

  const shops = useQuery({ queryKey: ['seller', 'shops', activeBusiness?.id], queryFn: () => sellerApi.shops(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  const orders = useQuery({
    queryKey: ['seller', 'orders', activeBusiness?.id, shopFilter],
    queryFn: () => shopFilter === 'ALL' ? sellerApi.businessOrders(activeBusiness!.id) : sellerApi.shopOrders(shopFilter),
    enabled: Boolean(activeBusiness),
    // web: polls every 30 s only while at least one order is still active
    refetchInterval: (query) => (query.state.data?.some((o) => !ACTIVE_STATUSES_DONE.includes(o.status)) ? POLL_INTERVAL : false),
  })

  const shopNames = useMemo(() => new Map((shops.data ?? []).map((shop) => [shop.id, shop.name])), [shops.data])
  const visibleOrders = orders.data ?? []
  const orderGroups = useMemo(() => {
    const grouped = new Map<string, SellerOrder[]>()
    for (const order of visibleOrders) grouped.set(order.shop_id, [...(grouped.get(order.shop_id) ?? []), order])
    return [...grouped.entries()].map(([shopId, shopOrders]) => ({
      shopId,
      shopName: shopNames.get(shopId) ?? t('seller.orders.unknownShop'),
      orders: shopOrders,
      total: shopOrders.reduce((sum, order) => sum + (order.final_total || 0), 0),
      currency: sharedCurrency(shopOrders),
    })).sort((a, b) => a.shopName.localeCompare(b.shopName))
  }, [visibleOrders, shopNames, t])

  const refreshAfterAction = useCallback(async (orderId: string) => {
    await queryClient.invalidateQueries({ queryKey: ['seller', 'orders'] })
    for (const key of ['orderDetail', 'payment', 'packageQR']) void queryClient.invalidateQueries({ queryKey: ['seller', key, orderId] })
  }, [queryClient])

  async function runAction(order: SellerOrder, fn: () => Promise<unknown>) {
    setActingId(order.id)
    setActionError('')
    try {
      await fn()
      await refreshAfterAction(order.id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('seller.orders.actionFailed'))
    } finally {
      setActingId(null)
    }
  }

  if (!activeBusiness) return <View style={styles.empty}>
    <Text style={styles.emptyIcon}>🧾</Text>
    <Text style={styles.emptyTitle}>{t('seller.noBusinessSelected')}</Text>
    <Text style={[styles.muted, styles.centerText]}>{t('seller.orders.noBusinessSubtitle')}</Text>
  </View>

  const lastUpdated = orders.dataUpdatedAt ? new Date(orders.dataUpdatedAt) : null
  const count = visibleOrders.length

  return <ScrollView
    contentContainerStyle={styles.page}
    refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} tintColor={colors.green} />}
  >
    <Text style={styles.h1}>{t('seller.orders')}</Text>

    {/* Live sync bar */}
    <View style={styles.liveBar}>
      <View style={styles.liveLabel}><View style={styles.liveDot} /><Text style={styles.liveText}>{t('orders.live')}</Text></View>
      <Text style={[styles.small, styles.flex1]}>{lastUpdated ? t('orders.updated', { time: timeAgo(lastUpdated, t) }) : t('orders.loading')}</Text>
      <Pressable accessibilityRole="button" disabled={orders.isFetching} onPress={() => void orders.refetch()} style={styles.refreshBtn}>
        <Text style={styles.refreshText}>{orders.isFetching ? '⟳' : t('orders.refresh')}</Text>
      </Pressable>
    </View>

    <View style={styles.filters}>
      <View>
        <Text style={styles.bold}>{count === 1 ? t('seller.orders.count', { count }) : t('seller.orders.count_plural', { count })}</Text>
        <Text style={styles.small}>{shopFilter === 'ALL'
          ? (orderGroups.length === 1 ? t('seller.orders.classifiedAcross', { count: orderGroups.length }) : t('seller.orders.classifiedAcross_plural', { count: orderGroups.length }))
          : t('seller.orders.forShop', { shop: shopNames.get(shopFilter) ?? t('seller.orders.selectedShop') })}</Text>
      </View>
      <Text style={styles.small}>{t('orders.shop')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label={t('seller.allShops')} selected={shopFilter === 'ALL'} onPress={() => setShopFilter('ALL')} styles={styles} />
        {(shops.data ?? []).map((shop) => <Chip key={shop.id} label={shop.name} selected={shopFilter === shop.id} onPress={() => setShopFilter(shop.id)} styles={styles} />)}
      </ScrollView>
    </View>

    {orders.isLoading ? <Loading label={t('seller.orders.loading')} />
      : orders.isError ? <View style={styles.errorBox}>
        <Text style={styles.errorText}>{t('seller.orders.unableToLoad', { error: orders.error instanceof ApiError || orders.error instanceof Error ? orders.error.message : '' })}</Text>
        <Pressable accessibilityRole="button" onPress={() => void orders.refetch()}><Text style={styles.retryText}>{t('common.retry')}</Text></Pressable>
      </View>
      : count === 0 ? <View style={styles.card}>
        <View style={styles.emptyInline}>
          <Text style={{ fontSize: 48 }}>🧾</Text>
          <Text style={styles.h3}>{shopFilter === 'ALL' ? t('seller.orders.emptyTitle') : t('seller.orders.emptyShopTitle')}</Text>
          <Text style={[styles.muted, styles.centerText]}>{shopFilter === 'ALL' ? t('seller.orders.emptyDesc') : t('seller.orders.emptyShopDesc')}</Text>
        </View>
      </View>
      : <>
        {actionError ? <View style={styles.errorBox}><Text style={styles.errorText}>{actionError}</Text></View> : null}
        {orderGroups.map((group) => <View key={group.shopId} style={styles.group}>
          <View style={styles.groupHeader}>
            <Text style={[styles.flex1, styles.text]}><Text style={styles.bold}>{group.shopName}</Text><Text style={styles.muted}> · {group.orders.length === 1 ? t('seller.orders.count', { count: group.orders.length }) : t('seller.orders.count_plural', { count: group.orders.length })}</Text></Text>
            <Text style={styles.bold}>{group.currency ? formatMoney(group.total, group.currency) : '—'}</Text>
          </View>
          {group.orders.map((order) => <OrderRow
            key={order.id}
            order={order}
            expanded={expandedId === order.id}
            acting={actingId === order.id}
            businessName={activeBusiness.name}
            onToggle={() => { setActionError(''); setExpandedId(expandedId === order.id ? null : order.id) }}
            onAction={(a) => void runAction(order, () => {
              if (a.action === 'accept') return sellerApi.acceptOrder(order.id)
              if (a.action === 'reject') return sellerApi.rejectOrder(order.id)
              if (a.action === 'prepare') return sellerApi.prepareOrder(order.id)
              return sellerApi.sellerTransition(order.id, a.status!)
            })}
            onConfirmReturn={() => Alert.alert(t('deliveryPlan.confirmReturn'), t('deliveryPlan.confirmReturnAsk'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('deliveryPlan.confirmReturn'), onPress: () => void runAction(order, () => sellerApi.confirmReturn(order.id)) },
            ])}
            styles={styles}
          />)}
        </View>)}
      </>}
  </ScrollView>
}

type S = ReturnType<typeof makeStyles>

function Chip({ label, selected, onPress, styles }: { label: string; selected: boolean; onPress: () => void; styles: S }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipActive]}><Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text></Pressable>
}

function OrderRow({ order, expanded, acting, businessName, onToggle, onAction, onConfirmReturn, styles }: {
  order: SellerOrder; expanded: boolean; acting: boolean; businessName: string
  onToggle: () => void; onAction: (a: SellerAction) => void; onConfirmReturn: () => void; styles: S
}) {
  const { t, lang } = useI18n()
  const colors = useColors()
  const actions = nextActions(order, t)
  const currency = order.currency || DEFAULT_CURRENCY
  const displayStatus = order.delivery_status || order.status
  const tint = statusTint(displayStatus, colors)
  const detail = useQuery({ queryKey: ['seller', 'orderDetail', order.id], queryFn: () => sellerApi.order(order.id), enabled: expanded, retry: false })
  const payment = useQuery({
    queryKey: ['seller', 'payment', order.id],
    queryFn: () => sellerApi.getOrderPayment(order.id).catch((err) => { if (err instanceof Error && /PAYMENT_NOT_FOUND/i.test(`${(err as ApiError).code ?? ''} ${err.message}`)) return null; throw err }),
    enabled: expanded,
    retry: false,
  })
  const showPackageQR = expanded && PACKAGE_QR_STATUSES.includes(order.status)
  const packageQR = useQuery({ queryKey: ['seller', 'packageQR', order.id], queryFn: () => sellerApi.packageQR(order.id), enabled: showPackageQR, retry: false })
  const orderNumber = order.order_number || order.id.slice(0, 8)
  const d = detail.data?.order
  const p = payment.data

  return <View style={styles.card}>
    <View style={styles.rowBetween}>
      <Text style={styles.bold}>{orderNumber}</Text>
      <Text style={styles.small}>{new Date(order.created_at).toLocaleDateString()}</Text>
    </View>
    <View style={styles.rowBetween}>
      <Text style={[styles.badge, { backgroundColor: tint.bg, color: tint.fg }]}>{orderStatusLabel(displayStatus, t)}</Text>
      <Text style={styles.bold}>{formatMoney(order.final_total || 0, currency)}</Text>
    </View>
    {order.expected_delivery_date && !['CANCELLED', 'COMPLETED'].includes(order.status) ? <Text style={styles.small}>📅 {expectedDeliveryText(order, t, lang)}</Text> : null}

    <View style={styles.actions}>
      {actions.map((a) => <Button key={a.label} dense variant="outline" title={a.label} disabled={acting} onPress={() => onAction(a)} />)}
      {order.delivery_status === 'RETURNING_TO_SELLER' ? <Button dense title={t('deliveryPlan.confirmReturn')} disabled={acting} onPress={onConfirmReturn} /> : null}
      <Button dense variant="outline" title={expanded ? t('seller.orders.hide') : t('common.view')} onPress={onToggle} />
    </View>

    {expanded && <View style={styles.details}>
      <Text style={styles.small}><Text style={styles.strong}>{t('orders.deliveryLabel')}:</Text> {order.delivery_method || '—'}</Text>
      <Text style={styles.small}><Text style={styles.strong}>{t('seller.orders.baseTotal')}:</Text> {formatMoney(order.base_total ?? order.final_total, currency)}</Text>
      {order.notes ? <Text style={styles.small}><Text style={styles.strong}>{t('seller.orders.notesLabel')}:</Text> {order.notes}</Text> : null}
      <Text style={styles.small}><Text style={styles.strong}>{t('seller.orders.shopId')}:</Text> {order.shop_id}</Text>
      {d ? <View style={styles.box}>
        <Text style={styles.strong}>Livraison</Text>
        <Text style={styles.small}>Statut: <Text style={styles.strong}>{d.delivery_status || '—'}</Text></Text>
        <Text style={styles.small}>Client: {d.delivery_contact_name || '—'} · {d.delivery_phone || '—'}</Text>
        <Text style={styles.small}>Adresse: {d.delivery_address || '—'}</Text>
        {d.delivery_notes ? <Text style={styles.small}>Instructions: {d.delivery_notes}</Text> : null}
        <Text style={styles.small}>Frais: {formatMoney(d.delivery_fee_final ?? 0, d.currency || currency)}</Text>
      </View> : null}
      {d ? <DeliveryPlanCard plan={d} status={d.status} deliveryStatus={d.delivery_status ?? undefined} deliveryMethod={d.delivery_method ?? undefined} /> : null}
      {detail.data?.lines?.length ? <View style={styles.box}>
        <Text style={styles.strong}>{t('cart.products')}</Text>
        {detail.data.lines.map((line) => <SellerOrderLineQR key={line.id} line={line} orderId={order.id} orderNumber={orderNumber} shopName={businessName} currency={d?.currency || currency} styles={styles} />)}
      </View> : <Text style={styles.small}>{t('seller.orders.loadingDetails')}</Text>}
      <View style={styles.box}>
        <Text style={styles.strong}>{t('seller.orders.cashPayment')}</Text>
        {p ? <>
          <Text style={[styles.small, styles.strong]}>{t('orders.amountDue', { amount: formatMoney(p.cash_due, p.currency || currency) })}</Text>
          <Text style={styles.small}>Mode: <Text style={styles.strong}>{p.payment_method}</Text>{p.provider ? ` · ${p.provider}` : ''}</Text>
          <Text style={styles.small}>Majoration: {formatMoney(p.payment_markup ?? 0, p.currency || currency)} · Total: <Text style={styles.strong}>{formatMoney(p.final_total, p.currency || currency)}</Text></Text>
          <Text style={styles.small}>{t('common.status')}: <Text style={styles.strong}>{t(paymentStatusKey(p))}</Text></Text>
          {isPaymentPaid(p)
            ? <Text style={styles.small}>{confirmationActorKey(p.confirmation_actor) ? t(confirmationActorKey(p.confirmation_actor)!) : t('orders.paymentPaid')}</Text>
            : <Text style={styles.small}>{t('seller.orders.cashAwaitingCourier')}</Text>}
        </> : payment.isLoading ? <Text style={styles.small}>{t('common.loading')}</Text> : <Text style={styles.small}>{t('seller.orders.noPaymentCreated')}</Text>}
      </View>
      {showPackageQR && packageQR.data ? <QRPanel
        qr={packageQR.data}
        title="TBK Package QR"
        imagePath={`/orders/${order.id}/package-qr/label`}
        fields={[
          { label: 'Commande', value: orderNumber },
          { label: 'Colis', value: `#${packageQR.data.package_number}` },
          { label: 'Boutique', value: businessName },
        ]}
      /> : null}
    </View>}
  </View>
}

/** One order line with its own ORDER_ITEM QR (web SellerOrderLineQR). */
function SellerOrderLineQR({ line, orderId, orderNumber, shopName, currency, styles }: { line: OrderLine; orderId: string; orderNumber: string; shopName: string; currency: string; styles: S }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const load = useCallback(() => sellerApi.orderItemQR(orderId, line.id), [orderId, line.id])
  const price = formatMoney(line.final_unit_price || line.unit_price || 0, currency)
  const name = line.product_name || line.product_id || ''
  const variant = line.variant_name || line.variant_sku || ''
  return <View style={{ marginBottom: 6 }}>
    <View style={styles.lineRow}>
      <View style={styles.flex1}>
      {line.product_id ? <Pressable accessibilityRole="link" onPress={() => router.push(`/seller/products/${line.product_id}`)}>
        <Text style={styles.productLink}>{name}</Text>
      </Pressable> : null}
      <Text style={styles.small}>{variant
        ? t('seller.orders.lineWithVariant', { name, variant, quantity: line.quantity, price })
        : t('seller.orders.line', { name, quantity: line.quantity, price })}</Text>
      </View>
      <Button dense variant="outline" title={open ? t('itemQr.hide') : t('itemQr.action')} onPress={() => setOpen((v) => !v)} />
    </View>
    {open ? <OrderItemQRSection
      load={load}
      imagePath={sellerApi.orderItemQRImagePath(orderId, line.id)}
      instruction={t('itemQr.sellerInstruction')}
      fields={[
        { label: t('itemQr.labelOrder'), value: orderNumber },
        { label: t('itemQr.labelProduct'), value: name },
        { label: t('itemQr.labelVariant'), value: variant },
        { label: t('itemQr.labelQuantity'), value: String(line.quantity) },
        { label: t('itemQr.labelShop'), value: shopName },
      ]}
    /> : null}
  </View>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 28, gap: 16 },
  flex1: { flex: 1 },
  productLink: { color: c.green, fontWeight: '700', fontSize: 14, textDecorationLine: 'underline', marginBottom: 2 },
  centerText: { textAlign: 'center' },
  h1: { fontSize: 24, fontWeight: '700', color: c.ink },
  h3: { fontSize: 18, fontWeight: '700', color: c.ink, textAlign: 'center' },
  text: { color: c.ink, fontSize: 14 },
  bold: { color: c.ink, fontSize: 14, fontWeight: '700' },
  strong: { color: c.ink, fontWeight: '700' },
  muted: { color: c.muted, fontSize: 14 },
  small: { color: c.muted, fontSize: 13, lineHeight: 19 },
  liveBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
  liveLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.success },
  liveText: { color: c.success, fontWeight: '700', fontSize: 13 },
  refreshBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: c.border, backgroundColor: c.white },
  refreshText: { color: c.ink, fontSize: 12, fontWeight: '600' },
  filters: { gap: 8 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.white },
  chipActive: { backgroundColor: c.green, borderColor: c.green },
  chipText: { color: c.ink, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: c.onGreen },
  errorBox: { padding: 12, borderRadius: radius.sm, backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: c.danger, gap: 6 },
  errorText: { color: c.danger, fontSize: 14 },
  retryText: { color: c.green, fontWeight: '700' },
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, gap: 8, boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' },
  emptyInline: { alignItems: 'center', paddingVertical: 32, gap: 6 },
  group: { gap: 10 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: c.surface2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: { fontSize: 12, fontWeight: '700', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  details: { gap: 6, marginTop: 8 },
  box: { gap: 4, padding: 12, borderRadius: radius.sm, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 8 },
  emptyIcon: { fontSize: 64 },
  emptyTitle: { color: c.ink, fontSize: 20, fontWeight: '700', textAlign: 'center' },
})
