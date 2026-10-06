import { Suspense, useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router, useLocalSearchParams } from 'expo-router'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { buyerApi } from '../src/api'
import { resolveMediaUrl } from '../src/api/client'
import { Button, ErrorState, Loading } from '../src/components/ui'
import { LazyLiveCourierMap } from '../src/components/LazyLiveCourierMap'
import { DeliveryPlanCard } from '../src/components/DeliveryPlanCard'
import { BuyerHandoverCard } from '../src/components/BuyerHandover'
import { OrderChatFeed } from '../src/components/OrderChatFeed'
import { OrderRatingCard } from '../src/components/OrderRatingCard'
import { useOrderEvents } from '../src/lib/orderEvents'
import { isLiveTracked } from '../src/lib/liveTracking'
import { courierReached } from '../src/lib/courierSteps'
import { statusLabel } from '../src/lib/statusLabels'
import { deliveryLabel } from '../src/lib/deliveryLabels'
import { timelineNote } from '../src/lib/timelineNote'
import { paymentStatusKey } from '../src/lib/paymentStatus'
import { formatMoney } from '../src/lib/money'
import { dateLocale } from '../src/lib/format'
import { formatClock, formatDistance, formatDuration } from '../src/lib/routeFormat'
import { useAuth } from '../src/store/auth'
import { useI18n, type TranslationKey } from '../src/store/i18n'
import { useColors } from '../src/store/theme'
import { fonts, kicker, radius, shadow, spacing, type Colors } from '../src/theme'
import type { BuyerOrder, HandoverState, OrderDetail, TrackingResponse } from '../src/types'

/**
 * "Suivre mes livraisons": the buyer's own tracking page (port of the web
 * TrackOrderPage). A list of the buyer's TBK courier deliveries (in progress,
 * or delivered recently), then for the selected one the same live map as
 * /orders/live (courier position, planned route, travelled trace) and the
 * tracking details: summary, latest update, progress, items, address.
 * Everything comes from /buyer/orders, /buyer/orders/:id, /:id/tracking,
 * /:id/payment, /:id/courier-location (inside the map) and /:id/handover.
 */

/** Same rhythm as the web page while the delivery is open. */
const POLL_MS = 4_000
const LIST_POLL_MS = 30_000
/** A finished delivery stays in the list this long after the order was placed. */
const RECENT_DAYS = 14
const TERMINAL_ORDER = ['COMPLETED', 'CANCELLED', 'REJECTED']
const FINISHED_ORDER = ['DELIVERED', 'RECEIVED', 'COMPLETED']
const DEAD_DELIVERY = ['CANCELLED', 'COURIER_REJECTED', 'RETURNING_TO_SELLER', 'RETURNED_TO_SELLER']
const AT_DOOR = ['COURIER_ARRIVED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION', 'RECEIVED']
const ORDER_STAGES = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RECEIVED', 'COMPLETED']
// The history records order statuses only: a courier step is dated by the order
// transition that happens at the same moment.
const HISTORY_ALIASES: Record<string, string> = { PICKED_UP: 'OUT_FOR_DELIVERY', DELIVERY_SCAN_SUCCESS: 'DELIVERED' }
const ACTOR_KEYS: Record<string, TranslationKey> = { SELLER: 'orders.actorSeller', BUYER: 'orders.actorBuyer', SYSTEM: 'orders.actorSystem' }

/** Same thresholds as the map (LiveCourierMap.freshnessOf), without loading MapLibre here. */
function freshnessOf(age: number | null) {
  if (age == null) return 'UNAVAILABLE'
  if (age < 30) return 'LIVE'
  if (age <= 120) return 'RECENT'
  return 'STALE'
}

type ChatProduct = { name: string; imageUrl?: string; price: number; productId: string }

const isTbk = (method?: string | null) => (method || '').toUpperCase().startsWith('TBK')

/** A TBK order that a courier took (or takes) to the buyer. */
function hasCourierDelivery(o: BuyerOrder) {
  if (!isTbk(o.delivery_method) || o.status === 'CANCELLED' || o.status === 'REJECTED') return false
  if (DEAD_DELIVERY.includes(o.delivery_status || '')) return false
  return courierReached(o, 'COURIER_ASSIGNED')
}
const isFinished = (o: BuyerOrder) => FINISHED_ORDER.includes(o.status)
const isRecent = (o: BuyerOrder) => {
  const at = Date.parse(o.courier_arrived_at || o.created_at)
  return Number.isFinite(at) && Date.now() - at < RECENT_DAYS * 86_400_000
}

/** Every step of a TBK delivery, each one done from a stored fact (web tbkSteps). */
function tbkSteps(d: TrackingResponse, handover: HandoverState | null) {
  const o = { ...d, status: d.current_status }
  const stage = ORDER_STAGES.indexOf(d.current_status)
  const orderReached = (s: string) => stage >= ORDER_STAGES.indexOf(s)
  const paid = ['PAID', 'VERIFIED'].includes(d.payment_status) || !!handover?.payment_verified
  return [
    { status: 'PENDING', done: true },
    { status: 'ACCEPTED', done: orderReached('ACCEPTED') },
    { status: 'PREPARING', done: orderReached('PREPARING') },
    { status: 'READY', done: orderReached('READY') },
    { status: 'COURIER_ASSIGNED', done: courierReached(o, 'COURIER_ASSIGNED') },
    { status: 'COURIER_ACCEPTED', done: courierReached(o, 'COURIER_ACCEPTED') },
    { status: 'PICKED_UP', done: courierReached(o, 'PICKED_UP') },
    { status: 'IN_TRANSIT', done: courierReached(o, 'IN_TRANSIT') },
    { status: 'COURIER_ARRIVED', done: courierReached(o, 'COURIER_ARRIVED') },
    { status: 'PRODUCT_VERIFIED', done: !!handover?.all_products_verified || orderReached('DELIVERED') },
    { status: 'PAYMENT_VERIFIED', done: paid },
    { status: 'DELIVERED', done: orderReached('DELIVERED') },
    { status: 'RECEIVED', done: orderReached('RECEIVED') },
    { status: 'COMPLETED', done: orderReached('COMPLETED') },
  ]
}

function stepLabel(t: (key: TranslationKey) => string, status: string) {
  if (status === 'PRODUCT_VERIFIED') return t('track.step.productVerified')
  if (status === 'PAYMENT_VERIFIED') return t('track.step.paymentVerified')
  return statusLabel(t, status)
}

function ago(date: number, t: (key: TranslationKey, vars?: Record<string, string | number>) => string) {
  const seconds = Math.max(0, Math.floor((Date.now() - date) / 1000))
  if (seconds < 5) return t('time.justNow')
  if (seconds < 60) return t('time.secondsAgo', { count: seconds })
  return t('time.minutesAgo', { count: Math.floor(seconds / 60) })
}

export default function TrackingScreen() {
  const signedIn = useAuth((state) => Boolean(state.user))
  const { t } = useI18n()
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  if (!signedIn) {
    return (
      <View style={s.center}>
        <View style={s.emptyTile}><Ionicons name="navigate-outline" size={28} color={c.green} /></View>
        <Text style={s.h1}>{t('track.title')}</Text>
        <Text style={[s.muted, { textAlign: 'center' }]}>{t('profile.signInPrompt')}</Text>
        <Button title={t('common.signIn')} onPress={() => router.push('/auth/login')} style={{ alignSelf: 'stretch' }} />
      </View>
    )
  }
  return <TrackingInner />
}

function TrackingInner() {
  const { t } = useI18n()
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const { id: idParam } = useLocalSearchParams<{ id?: string }>()
  const [mapTouched, setMapTouched] = useState(false)
  const [chat, setChat] = useState<{ orderId: string; product?: ChatProduct } | null>(null)

  const orders = useQuery({ queryKey: ['buyer', 'orders'], queryFn: buyerApi.orders, refetchInterval: LIST_POLL_MS })
  // In progress first, then the recently delivered ones; newest first in each.
  const tracked = useMemo(() => {
    const list = (Array.isArray(orders.data) ? orders.data : []).filter((o) => hasCourierDelivery(o) && (!isFinished(o) || isRecent(o) || o.id === idParam))
    return list.sort((a, b) => Number(isFinished(a)) - Number(isFinished(b)) || Date.parse(b.created_at) - Date.parse(a.created_at))
  }, [orders.data, idParam])
  // Shop name and first product of each listed order (same cache as the order page).
  const details = useQueries({ queries: tracked.map((o) => ({ queryKey: ['buyer', 'order', o.id], queryFn: () => buyerApi.order(o.id), staleTime: 30_000 })) })
  const detailOf = (orderId: string) => details[tracked.findIndex((o) => o.id === orderId)]?.data as OrderDetail | undefined

  const selectedId = idParam || tracked[0]?.id
  // Without ?id the first delivery is shown: write it in the URL so a reload
  // or a shared link keeps the same order.
  useEffect(() => {
    if (!idParam && tracked[0]?.id) router.setParams({ id: tracked[0].id })
  }, [idParam, tracked])

  if (orders.isLoading) return <Loading label={t('track.loading')} />
  if (orders.isError) return <ErrorState message={t('track.loadFailed')} retry={() => void orders.refetch()} />

  return (
    <View style={{ flex: 1, backgroundColor: c.cream }}>
    <ScrollView
      contentContainerStyle={s.page}
      scrollEnabled={!mapTouched}
      refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} tintColor={c.green} />}
    >
      <View>
        <Text style={s.eyebrow}>{t('track.kicker')}</Text>
        <Text style={s.h1}>{t('track.title')}</Text>
        <Text style={s.muted}>{t('track.subtitle')}</Text>
      </View>

      {tracked.length === 0 && !idParam ? (
        <View style={[s.card, { alignItems: 'center' }]}>
          <View style={s.emptyTile}><Ionicons name="bicycle-outline" size={28} color={c.green} /></View>
          <Text style={s.h2}>{t('track.emptyTitle')}</Text>
          <Text style={[s.muted, { textAlign: 'center' }]}>{t('track.emptyBody')}</Text>
          <Button title={t('profile.myOrders')} variant="outline" onPress={() => router.push('/orders')} style={{ alignSelf: 'stretch' }} />
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.picker} style={s.pickerOuter}>
          {tracked.map((o) => {
            const d = detailOf(o.id)
            const line = d?.lines?.[0]
            const selected = o.id === selectedId
            const status = isFinished(o) ? o.status : (o.delivery_status || o.status)
            return (
              <Pressable
                key={o.id}
                onPress={() => router.setParams({ id: o.id })}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={t('track.selectOrder', { number: o.order_number || o.id.slice(0, 8).toUpperCase() })}
                style={({ pressed }) => [s.pick, selected && s.pickOn, pressed && s.pressed]}
              >
                <View style={s.pickThumb}>
                  {line?.image_url ? <Image source={resolveMediaUrl(line.image_url)} style={s.pickThumbImg} contentFit="cover" /> : <Ionicons name="cube-outline" size={20} color={c.green} />}
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={s.pickNumber} numberOfLines={1}>{o.order_number || o.id.slice(0, 8).toUpperCase()}</Text>
                  <Text style={s.pickProduct} numberOfLines={1}>{line?.product_name || t('orders.itemsCount', { count: o.total_items })}</Text>
                  <Text style={s.small} numberOfLines={1}>{d?.shop_name || ' '}</Text>
                  <View style={[s.pill, statusTone(status, c)]}>
                    {isLiveTracked(o.delivery_status) ? <View style={[s.pillDot, { backgroundColor: c.success }]} /> : null}
                    <Text style={[s.pillText, { color: statusTone(status, c).color }]} numberOfLines={1}>{statusLabel(t, status)}</Text>
                  </View>
                </View>
              </Pressable>
            )
          })}
        </ScrollView>
      )}

      {selectedId ? <TrackedOrder key={selectedId} orderId={selectedId} onMapGesture={setMapTouched} onOpenChat={(product) => setChat({ orderId: selectedId, product })} /> : null}
    </ScrollView>
    {/* The courier channel of the order chat, over the whole page. */}
    {chat ? (
      <View style={StyleSheet.absoluteFill}>
        <OrderChatFeed orderId={chat.orderId} role="BUYER" onClose={() => setChat(null)} showHeader initialParty="COURIER" product={chat.product} />
      </View>
    ) : null}
    </View>
  )
}

function TrackedOrder({ orderId, onMapGesture, onOpenChat }: { orderId: string; onMapGesture: (active: boolean) => void; onOpenChat: (product?: ChatProduct) => void }) {
  const { t, lang } = useI18n()
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const queryClient = useQueryClient()
  const { height } = useWindowDimensions()
  const [, setTick] = useState(0)
  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 10_000); return () => clearInterval(id) }, [])

  const tracking = useQuery({
    queryKey: ['buyer', 'tracking', orderId],
    queryFn: () => buyerApi.tracking(orderId),
    refetchInterval: (q) => (TERMINAL_ORDER.includes(q.state.data?.current_status || '') ? false : POLL_MS),
  })
  const order = useQuery({ queryKey: ['buyer', 'order', orderId], queryFn: () => buyerApi.order(orderId), refetchInterval: (q) => (TERMINAL_ORDER.includes(q.state.data?.order?.status || '') ? false : 15_000) })
  const payment = useQuery({ queryKey: ['buyer', 'payment', orderId], queryFn: () => buyerApi.getPayment(orderId), retry: false })
  const d = tracking.data
  const atDoor = AT_DOOR.includes(d?.delivery_status || '')
  // At the door the parcel check and the payment live on the handover (same cache as its card).
  const handover = useQuery({ queryKey: ['buyer', 'handover', orderId], queryFn: () => buyerApi.handover(orderId), enabled: atDoor, retry: false })
  // Live position for the status strip (the map shares this cache entry).
  const live = isLiveTracked(d?.delivery_status) || !!d?.live_tracking_active
  const location = useQuery({ queryKey: ['buyer', 'courierLocation', orderId], queryFn: () => buyerApi.courierLocation(orderId), enabled: live, refetchInterval: (q) => (q.state.data && !q.state.data.live_tracking_active ? false : 10_000) })

  const refreshAll = () => {
    void tracking.refetch()
    void order.refetch()
    void payment.refetch()
    if (live) void location.refetch()
    if (atDoor) void handover.refetch()
  }
  // An order event (shop, TBK, courier) refreshes everything at once.
  useOrderEvents(() => refreshAll(), { orderId })

  if (tracking.isLoading) return <Loading label={t('track.loadingOrder')} />
  if (tracking.isError || !d) return <ErrorState message={t('track.orderFailed')} retry={() => void tracking.refetch()} />

  const detail = order.data
  const o = detail?.order
  const lines = detail?.lines ?? []
  const p = payment.data ?? null
  const terminal = TERMINAL_ORDER.includes(d.current_status)
  const currentStatus = TERMINAL_ORDER.includes(d.current_status) ? d.current_status : (d.delivery_status || d.current_status)
  const steps = isTbk(d.delivery_method) ? tbkSteps(d, handover.data ?? null) : []
  // "Current" is where the delivery stands now: the last step reached, not the
  // next one (otherwise "Courier arrived" reads as happening while on the way).
  const nextIdx = steps.findIndex((step) => !step.done)
  const currentIdx = nextIdx === -1 ? steps.length - 1 : nextIdx - 1
  const history = Array.isArray(d.history) ? d.history : []
  const number = d.order_number || orderId.slice(0, 8).toUpperCase()
  const courierOpen = !!o && courierReached(o, 'COURIER_ASSIGNED') && !FINISHED_ORDER.includes(d.current_status) && !terminal && !DEAD_DELIVERY.includes(d.delivery_status || '')
  const grandTotal = p?.final_total ?? (o ? (o.final_total || 0) + (o.delivery_fee_final || 0) : 0)
  const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(dateLocale(lang === 'en' ? 'en' : 'fr'), { dateStyle: 'medium', timeStyle: 'short' }) : '')

  const openChat = () => onOpenChat(lines[0] ? { name: lines[0].product_name, imageUrl: lines[0].image_url, price: lines[0].final_unit_price, productId: lines[0].product_id } : undefined)

  // Courier position summary: the map shows it natively; on the web (no map) it is the only place.
  const loc = location.data
  const age = loc?.available && loc.age_seconds != null ? loc.age_seconds + Math.max(0, Math.floor((Date.now() - location.dataUpdatedAt) / 1000)) : null
  const freshness = freshnessOf(age)
  const route = loc?.route ?? null

  return (
    <View style={{ gap: 12 }}>
      {/* Live sync bar (web .live-bar) */}
      <View style={s.liveBar}>
        {!terminal ? <View style={s.liveLabel}><View style={s.liveDot} /><Text style={s.liveText}>{t('orders.live')}</Text></View> : null}
        <Text style={[s.small, { flex: 1 }]}>{tracking.dataUpdatedAt ? t('orders.updated', { time: ago(tracking.dataUpdatedAt, t) }) : t('common.loading')}</Text>
        <Pressable accessibilityRole="button" disabled={tracking.isFetching} onPress={refreshAll} style={s.refreshBtn}><Text style={s.refreshText}>{tracking.isFetching ? '⟳' : t('orders.refresh')}</Text></Pressable>
      </View>

      {/* Summary */}
      <View style={s.card}>
        <View style={s.rowBetween}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.eyebrow}>{t('track.order', { number })}</Text>
            <Text style={s.h2} numberOfLines={2}>{statusLabel(t, currentStatus)}</Text>
            {detail?.shop_name ? <Text style={s.small}>{t('orders.shop')} <Text style={s.bold}>{detail.shop_name}</Text></Text> : null}
          </View>
          <View style={[s.pill, statusTone(currentStatus, c)]}><Text style={[s.pillText, { color: statusTone(currentStatus, c).color }]}>{statusLabel(t, currentStatus)}</Text></View>
        </View>
        <View style={s.facts}>
          <View style={s.fact}><Text style={s.small}>{t('track.method')}</Text><Text style={s.bold}>{deliveryLabel(t, d.delivery_method) || '—'}</Text></View>
          <View style={s.fact}><Text style={s.small}>{t('track.payment')}</Text><Text style={s.bold}>{p ? t(paymentStatusKey(p)) : statusLabel(t, d.payment_status) || '—'}</Text></View>
          {o ? <View style={s.fact}><Text style={s.small}>{t('common.total')}</Text><Text style={s.bold}>{formatMoney(grandTotal, p?.currency || o.currency)}</Text></View> : null}
        </View>
      </View>

      {/* Live courier position: from the courier's acceptance until arrival (same map as /orders/live). */}
      {live ? (
        <>
          {Platform.OS === 'web' && loc ? (
            <View style={s.courierStrip}>
              <View style={[s.liveDot, { backgroundColor: freshness === 'LIVE' ? c.success : freshness === 'RECENT' ? c.warning : c.muted }]} />
              <Text style={[s.bold, { flex: 1 }]}>{freshness === 'LIVE' ? t('liveMap.live') : freshness === 'RECENT' ? t('liveMap.lastSeen', { count: age ?? 0 }) : t('liveMap.unavailable')}</Text>
              {route ? <Text style={s.small}>{t('liveMap.remaining')} {formatDistance(route.remaining_m, lang)} · {t('liveMap.eta')} {route.eta ? formatClock(route.eta) : formatDuration(route.remaining_s)}</Text> : null}
            </View>
          ) : null}
          <Suspense fallback={<Loading label={t('common.loading')} />}>
            <LazyLiveCourierMap orderId={orderId} onGesture={onMapGesture} mapHeight={Math.max(320, Math.round(height * 0.5))} />
          </Suspense>
        </>
      ) : isTbk(d.delivery_method) ? (
        <View style={s.noteCard}><Ionicons name="map-outline" size={18} color={c.muted} /><Text style={[s.small, { flex: 1 }]}>{FINISHED_ORDER.includes(d.current_status) ? t('track.mapEnded') : o && courierReached(o, 'COURIER_ARRIVED') ? t('track.mapArrived') : t('track.mapNotYet')}</Text></View>
      ) : null}

      {/* Courier: open the courier channel of the order chat. */}
      {courierOpen ? (
        <View style={s.courierCard}>
          <View style={s.courierAvatar}><Ionicons name="bicycle" size={20} color={c.onNavy} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.courierKicker}>{t('orders.yourCourier')}</Text>
            <Text style={s.courierName} numberOfLines={1}>{statusLabel(t, d.delivery_status || d.current_status)}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('orders.messageCourier')} onPress={() => openChat()} style={s.courierBtn}>
            <Ionicons name="chatbubble-ellipses" size={19} color={c.navy} />
          </Pressable>
        </View>
      ) : null}

      {d.latest_update ? (
        <View style={s.latest}>
          <Text style={s.bold}>{t('track.latestUpdate')}</Text>
          <Text style={s.text}>{statusLabel(t, d.latest_update)}</Text>
          {d.latest_update_at ? <Text style={s.small}>{fmt(d.latest_update_at)}</Text> : null}
        </View>
      ) : null}

      <DeliveryPlanCard plan={d} status={d.current_status} deliveryStatus={d.delivery_status ?? undefined} deliveryMethod={d.delivery_method} />

      {/* Progress: every step, dated by the history when it has a row. */}
      {steps.length ? (
        <View style={s.card}>
          <Text style={s.h2}>{t('track.progress')}</Text>
          <View>
            {steps.map((step, i) => {
              const isCurrent = i === currentIdx
              const event = [...history].reverse().find((h) => h.status === step.status || h.status === HISTORY_ALIASES[step.status])
              const last = i === steps.length - 1
              return (
                <View key={step.status} style={s.step}>
                  <View style={s.rail}>
                    <View style={[s.dot, step.done && s.dotDone, isCurrent && s.dotCurrent]}>
                      {step.done ? <Ionicons name="checkmark" size={12} color={c.onGreen} /> : isCurrent ? <Ionicons name="ellipse" size={7} color={c.green} /> : null}
                    </View>
                    {!last ? <View style={[s.line, step.done && { backgroundColor: c.green }]} /> : null}
                  </View>
                  <View style={s.stepBody}>
                    <Text style={[s.stepText, isCurrent && { color: c.green }, !step.done && !isCurrent && { color: c.muted, fontWeight: '600' }]}>
                      {stepLabel(t, step.status)}{isCurrent ? ` · ${t('track.current')}` : ''}
                    </Text>
                    {event ? <>
                      {event.notes ? <Text style={s.small}>{timelineNote(t, event.notes)}</Text> : null}
                      <Text style={s.time}>{t(ACTOR_KEYS[event.actor_type || ''] ?? 'orders.actorSystem')} · {fmt(event.created_at)}</Text>
                    </> : null}
                  </View>
                </View>
              )
            })}
          </View>
          <Text style={s.small}>{t('web.tracking.note')}</Text>
        </View>
      ) : null}

      {/* Same handover as the order page: items first, then receipt. */}
      <BuyerHandoverCard orderId={orderId} deliveryStatus={d.delivery_status} onChanged={() => { refreshAll(); void queryClient.invalidateQueries({ queryKey: ['buyer', 'orders'] }) }} />

      {lines.length ? (
        <View style={s.card}>
          <Text style={s.h2}>{t('track.items')}</Text>
          {lines.map((line) => (
            <Pressable key={line.id} onPress={() => router.push(`/products/${line.product_id}`)} accessibilityRole="link" style={s.itemRow}>
              <View style={s.itemThumb}>{line.image_url ? <Image source={resolveMediaUrl(line.image_url)} style={s.itemThumbImg} contentFit="cover" /> : <Ionicons name="cube-outline" size={18} color={c.green} />}</View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.bold} numberOfLines={2}>{line.product_name}</Text>
                <Text style={s.small}>{t('orders.quantityUnitPrice', { quantity: line.quantity, price: formatMoney(line.final_unit_price, o?.currency) })}</Text>
              </View>
              <Text style={s.bold}>{formatMoney(line.quantity * line.final_unit_price, o?.currency)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {o?.delivery_address || o?.delivery_contact_name ? (
        <View style={s.card}>
          <Text style={s.h2}>{t('track.address')}</Text>
          {o.delivery_contact_name ? <View style={s.kv}><Text style={s.small}>{t('orders.contact')}</Text><Text style={s.text}>{o.delivery_contact_name}</Text></View> : null}
          {o.delivery_phone ? <View style={s.kv}><Text style={s.small}>{t('common.phone')}</Text><Text style={s.text}>{o.delivery_phone}</Text></View> : null}
          {o.delivery_address ? <View style={s.kv}><Text style={s.small}>{t('common.address')}</Text><Text style={[s.text, { flexShrink: 1, textAlign: 'right' }]}>{o.delivery_address}</Text></View> : null}
          {o.delivery_notes ? <View style={s.kv}><Text style={s.small}>{t('delivery.notes')}</Text><Text style={[s.text, { flexShrink: 1, textAlign: 'right' }]}>{o.delivery_notes}</Text></View> : null}
        </View>
      ) : null}

      {d.current_status === 'COMPLETED' ? <OrderRatingCard orderId={orderId} /> : null}

      <View style={{ gap: 10 }}>
        <Button title={t('orders.viewOrder')} onPress={() => router.push(`/orders/${orderId}`)} />
        {courierOpen ? <Button variant="outline" title={t('orders.messageCourier')} onPress={() => openChat()} /> : null}
      </View>

    </View>
  )
}

function statusTone(status: string, c: Colors) {
  if (['COMPLETED', 'DELIVERED', 'RECEIVED', 'COURIER_ARRIVED'].includes(status)) return { backgroundColor: c.successSoft, color: c.success }
  if (['CANCELLED', 'REJECTED', 'FAILED'].includes(status)) return { backgroundColor: c.dangerSoft, color: c.danger }
  if (['PICKED_UP', 'IN_TRANSIT'].includes(status)) return { backgroundColor: c.greenSoft, color: c.green }
  return { backgroundColor: c.infoSoft, color: c.info }
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { paddingHorizontal: spacing.md, paddingTop: 20, paddingBottom: 48, gap: 12, backgroundColor: c.cream, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm, backgroundColor: c.cream },
  pressed: { opacity: 0.88 },
  eyebrow: { ...kicker, color: c.green },
  h1: { fontSize: 22, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3, color: c.ink, marginTop: 2 },
  h2: { fontSize: 16, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.2, color: c.ink },
  text: { color: c.ink, fontSize: 13 },
  bold: { color: c.ink, fontWeight: '700', fontSize: 13.5 },
  muted: { color: c.muted, fontSize: 13, marginTop: 2 },
  small: { color: c.muted, fontSize: 12 },
  time: { color: c.faint, fontSize: 11.5, marginTop: 2 },
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 16, gap: 10, ...shadow.card },
  emptyTile: { width: 64, height: 64, borderRadius: 18, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
  // Order picker
  pickerOuter: { marginHorizontal: -spacing.md },
  picker: { paddingHorizontal: spacing.md, gap: 10, paddingVertical: 2 },
  pick: { width: 248, flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: c.white, borderWidth: 1.5, borderColor: c.border, ...shadow.card },
  pickOn: { borderColor: c.green, backgroundColor: c.greenSoft },
  pickThumb: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pickThumbImg: { width: 52, height: 52 },
  pickNumber: { ...kicker, color: c.green, fontSize: 10 },
  pickProduct: { color: c.ink, fontWeight: '700', fontSize: 13 },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 3, paddingHorizontal: 9, borderRadius: radius.pill, marginTop: 2, maxWidth: '100%' },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: '700', flexShrink: 1 },
  // Live bar
  liveBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: c.white, borderWidth: 1, borderColor: c.border },
  liveLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.successSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.success },
  liveText: { color: c.success, fontWeight: '700', fontSize: 12 },
  refreshBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: c.greenSoft },
  refreshText: { color: c.green, fontSize: 12, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 12, borderRadius: radius.sm, backgroundColor: c.surface2 },
  fact: { minWidth: '28%', flexGrow: 1, gap: 2 },
  courierStrip: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: c.white, borderWidth: 1, borderColor: c.border },
  noteCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.sm, backgroundColor: c.surface2 },
  courierCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: c.navy, ...shadow.raised },
  courierAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  courierKicker: { ...kicker, color: c.onNavyMuted, fontSize: 9.5 },
  courierName: { color: c.onNavy, fontWeight: '700', fontSize: 14.5, marginTop: 2 },
  courierBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.onNavy, alignItems: 'center', justifyContent: 'center' },
  latest: { padding: 14, borderRadius: radius.md, backgroundColor: c.greenSoft, gap: 3 },
  // Progress
  step: { flexDirection: 'row', gap: 12 },
  rail: { width: 22, alignItems: 'center' },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.border, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: c.green, borderColor: c.green },
  dotCurrent: { borderColor: c.green },
  line: { flex: 1, width: 2, minHeight: 14, backgroundColor: c.border },
  stepBody: { flex: 1, paddingBottom: 12, gap: 1 },
  stepText: { color: c.ink, fontWeight: '700', fontSize: 13.5 },
  // Items / address
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border },
  itemThumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  itemThumbImg: { width: 48, height: 48 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
})
