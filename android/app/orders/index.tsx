import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { resolveMediaUrl } from '../../src/api/client'
import { Button, ErrorState, Loading } from '../../src/components/ui'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, type Colors } from '../../src/theme'
import { statusLabel } from '../../src/lib/statusLabels'
import { formatMoney } from '../../src/lib/money'
import { formatDateTime } from '../../src/lib/format'
import { confirmationActorKey, paymentStatusKey } from '../../src/lib/paymentStatus'
import type { BuyerPayment, OrderDetail, OrderLine } from '../../src/types'

// Port of web-app/src/pages/buyer/OrdersPage.tsx: every order is loaded with
// its detail and payment (as web does), filtered by the same seven tabs, with
// the live bar, 60 s polling while an order is still open, and one card per
// order: shop / business / seller, every line (photo, variant, quantity ×
// price, review link once COMPLETED), payment status, delivery method and the
// total including delivery.
type Translate = ReturnType<typeof useI18n>['t']
type OrderFilter = 'toutes' | 'a_payer' | 'payees' | 'en_preparation' | 'en_livraison' | 'terminees' | 'annulees'
interface OrderHistoryItem { detail: OrderDetail; payment: BuyerPayment | null }

const POLL_INTERVAL = 60_000
const TERMINAL = ['COMPLETED', 'CANCELLED', 'REJECTED', 'RECEIVED']
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
    case 'a_payer': return status === 'PENDING' || status === 'ACCEPTED' || status === 'PREPARING'
    case 'payees': return status === 'COMPLETED' || status === 'RECEIVED'
    case 'en_preparation': return status === 'PREPARING'
    case 'en_livraison': return status === 'OUT_FOR_DELIVERY' || status === 'DELIVERED'
    case 'terminees': return status === 'COMPLETED'
    case 'annulees': return status === 'CANCELLED'
    default: return true
  }
}

function timeAgo(date: Date, t: Translate): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 5) return t('time.justNow')
  if (seconds < 60) return t('time.secondsAgo', { count: seconds })
  return t('time.minutesAgo', { count: Math.floor(seconds / 60) })
}

const variantLabel = (line: OrderLine, t: Translate) => Object.values(line.variant_attributes ?? {}).filter(Boolean).join(' / ') || line.variant_name || line.variant_sku || t('orders.standardVariant')
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')

export default function OrdersScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [filter, setFilter] = useState<OrderFilter>('toutes')
  const [, setTick] = useState(0)
  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 10_000); return () => clearInterval(id) }, [])

  const query = useQuery({
    queryKey: ['buyer', 'orders', 'history'],
    queryFn: async (): Promise<OrderHistoryItem[]> => {
      const orders = await buyerApi.orders()
      return Promise.all((Array.isArray(orders) ? orders : []).map(async (order) => {
        const [detail, payment] = await Promise.all([buyerApi.order(order.id), buyerApi.getPayment(order.id).catch(() => null)])
        return { detail, payment }
      }))
    },
    refetchInterval: (q) => (q.state.data?.some((item) => item.detail?.order && !TERMINAL.includes(item.detail.order.status)) ? POLL_INTERVAL : false),
  })

  if (query.isLoading) return <Loading label={t('orders.loading')} />
  if (query.isError) return <ErrorState message={query.error instanceof Error ? query.error.message : t('orders.loadFailed')} retry={() => void query.refetch()} />
  const items = (query.data ?? []).filter((item) => isOrderStatus(item.detail?.order?.status, filter))
  const lastUpdated = query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null

  if (items.length === 0 && filter === 'toutes') return <View style={styles.empty}>
    <Text style={{ fontSize: 48 }}>📦</Text>
    <Text style={styles.h2}>{t('orders.emptyTitle')}</Text>
    <Text style={[styles.muted, { textAlign: 'center' }]}>{t('orders.emptyDesc')}</Text>
    <Button title={t('orders.browse')} onPress={() => router.replace('/(buyer)')} />
  </View>

  return <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.green} />}>
    <View>
      <Text style={styles.eyebrow}>{t('orders.eyebrow')}</Text>
      <Text style={styles.h1}>{t('account.myOrders')}</Text>
      <Text style={styles.muted}>{t('orders.subtitle')}</Text>
    </View>

    <View style={styles.tabs}>{FILTERS.map((f) => <Pressable key={f.key} accessibilityRole="tab" accessibilityState={{ selected: filter === f.key }} style={[styles.chip, filter === f.key && styles.chipActive]} onPress={() => setFilter(f.key)}>
      <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{t(f.label)}</Text>
    </Pressable>)}</View>

    <View style={styles.liveBar}>
      <View style={styles.liveLabel}><View style={styles.liveDot} /><Text style={styles.liveText}>{t('orders.live')}</Text></View>
      <Text style={[styles.small, { flex: 1 }]}>{lastUpdated ? t('orders.updated', { time: timeAgo(lastUpdated, t) }) : t('common.loading')}</Text>
      <Pressable accessibilityRole="button" disabled={query.isFetching} onPress={() => void query.refetch()} style={styles.refreshBtn}><Text style={styles.refreshText}>{query.isFetching ? '⟳' : t('orders.refresh')}</Text></Pressable>
    </View>

    {items.length === 0 ? <View style={styles.card}><Text style={[styles.muted, { textAlign: 'center' }]}>{t('orders.emptyTitle')}</Text></View> : items.map(({ detail, payment }) => {
      const order = detail.order
      const total = (order.final_total || 0) + (order.delivery_fee_final || 0)
      const actor = confirmationActorKey(payment?.confirmation_actor)
      return <View key={order.id} style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{t('orders.eyebrow')}</Text>
            <Text style={styles.h2}>{order.order_number || order.id.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.small}>{formatDateTime(order.created_at)}</Text>
          </View>
          <Text style={[styles.badge, statusTint(order.status, colors)]}>{statusLabel(t, order.status)}</Text>
        </View>
        <Text style={styles.text}><Text style={styles.small}>{t('orders.shop')} </Text><Text style={styles.bold}>{detail.shop_name || t('orders.shopUnavailable')}</Text>{detail.business_name ? <Text style={styles.small}> · {detail.business_name}</Text> : null}{detail.seller_name ? <Text style={styles.small}> · {detail.seller_name}</Text> : null}</Text>
        {detail.lines.map((line) => {
          const price = line.final_unit_price
          return <View key={line.id} style={styles.line}>
            <View style={styles.thumb}>{line.image_url ? <Image source={resolveMediaUrl(line.image_url)} style={styles.thumbImg} contentFit="cover" /> : <Text style={styles.thumbText}>{initials(line.product_name || t('orders.product'))}</Text>}</View>
            <View style={{ flex: 1, gap: 2 }}>
              <Pressable accessibilityRole="link" onPress={() => router.push(`/products/${line.product_id}`)}><Text style={styles.bold}>{line.product_name || t('orders.productWithId', { id: line.product_id.slice(0, 8) })}</Text></Pressable>
              <Text style={styles.small}>{t('orders.variantWithLabel', { variant: variantLabel(line, t) })}</Text>
              <Text style={styles.small}>{t('orders.quantityUnitPrice', { quantity: line.quantity, price: formatMoney(price) })}</Text>
              {order.status === 'COMPLETED' ? <ReviewAction orderId={order.id} line={line} styles={styles} /> : null}
            </View>
            <Text style={styles.bold}>{formatMoney(line.quantity * price)}</Text>
          </View>
        })}
        <View style={styles.footer}>
          <View style={styles.footerCell}><Text style={styles.small}>{t('orders.payment')}</Text><Text style={styles.bold}>{payment ? t(paymentStatusKey(payment)) : t('orders.notPrepared')}{actor ? ` · ${t(actor)}` : ''}</Text></View>
          <View style={styles.footerCell}><Text style={styles.small}>{t('orders.deliveryLabel')}</Text><Text style={styles.bold}>{order.delivery_method ? order.delivery_method.replace(/_/g, ' ') : t('orders.notSelected')}</Text></View>
          <View style={styles.footerCell}><Text style={styles.small}>{t('common.total')}</Text><Text style={styles.bold}>{formatMoney(total)}</Text></View>
        </View>
        <Button title={t('orders.viewOrder')} onPress={() => router.push(`/orders/${order.id}`)} />
      </View>
    })}
  </ScrollView>
}

/** web ReviewAction: once COMPLETED, "review" or "reviewed · edit" per line. */
function ReviewAction({ orderId, line, styles }: { orderId: string; line: OrderLine; styles: ReturnType<typeof makeStyles> }) {
  const { t } = useI18n()
  const eligibility = useQuery({ queryKey: ['review-eligibility', orderId, line.id], queryFn: () => buyerApi.reviewEligibility(orderId, line.id), retry: false })
  const e = eligibility.data
  if (e?.existing_review_id) return <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/reviews/write', params: { orderId, lineId: line.id, reviewId: e.existing_review_id, productName: line.product_name } })}><Text style={styles.link}>✓ {t('reviews.reviewedEdit')}</Text></Pressable>
  if (e?.eligible) return <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/reviews/write', params: { orderId, lineId: line.id, productName: line.product_name } })}><Text style={[styles.link, styles.linkAccent]}>★ {t('reviews.reviewProductLink')}</Text></Pressable>
  return null
}

function statusTint(status: string, c: Colors) {
  if (status === 'COMPLETED' || status === 'DELIVERED' || status === 'RECEIVED') return { backgroundColor: c.successSoft, color: c.success }
  if (status === 'CANCELLED' || status === 'REJECTED') return { backgroundColor: c.dangerSoft, color: c.danger }
  if (status === 'PENDING') return { backgroundColor: c.warningSoft, color: c.warning }
  return { backgroundColor: c.infoSoft, color: c.info }
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 48, gap: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  eyebrow: { color: c.green, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.3 },
  h1: { fontSize: 26, fontWeight: '700', color: c.ink },
  h2: { fontSize: 18, fontWeight: '700', color: c.ink },
  text: { color: c.ink, fontSize: 14 },
  bold: { color: c.ink, fontWeight: '700', fontSize: 14 },
  muted: { color: c.muted, fontSize: 15 },
  small: { color: c.muted, fontSize: 13 },
  link: { color: c.green, fontSize: 13, fontWeight: '600', marginTop: 4 },
  linkAccent: { color: c.gold, fontWeight: '700' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.white },
  chipActive: { backgroundColor: c.green, borderColor: c.green },
  chipText: { color: c.ink, fontSize: 13 },
  chipTextActive: { color: c.onGreen, fontWeight: '700' },
  liveBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
  liveLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.success },
  liveText: { color: c.success, fontWeight: '700', fontSize: 13 },
  refreshBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: c.border, backgroundColor: c.white },
  refreshText: { color: c.ink, fontSize: 12, fontWeight: '600' },
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, gap: 12, boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  badge: { fontSize: 12, fontWeight: '700', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden' },
  line: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border, alignItems: 'flex-start' },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: 56, height: 56 },
  thumbText: { color: c.muted, fontWeight: '800' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  footerCell: { minWidth: '28%', flexGrow: 1, gap: 2 },
})
