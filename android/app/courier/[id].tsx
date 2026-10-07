import { Suspense, useMemo, useState } from 'react'
import { Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { confirmAction } from '../../src/lib/confirmAction'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { courierApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Card, ErrorState, Field, Loading } from '../../src/components/ui'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { fonts, radius, shadow, spacing, type Colors } from '../../src/theme'
import { formatMoney } from '../../src/lib/money'
import { CASH_ON_DELIVERY, MOBILE_PAY_NOW } from '../../src/lib/paymentStatus'
import { idempotencyKey } from '../../src/lib/idempotency'
import { courierStatusLabel, invalidateCourierMission, productVerificationBody } from '../../src/lib/courier'
import type { ConfirmCashResponse, HandoverState, HandoverVerificationResult } from '../../src/types'
import { HANDOVER_STATUSES, MissionActions, MissionPrimaryAction, primaryStepOf } from '../../src/components/CourierMissionActions'
import { CourierOrderSummary, CourierTopBar } from '../../src/components/CourierOrderHeader'
import { LazyLiveCourierMap } from '../../src/components/LazyLiveCourierMap'
import type { ChatParty } from '../../src/api/communication'
import { lineLabel } from '../../src/lib/lineLabel'
import { OrderChatFeed } from '../../src/components/OrderChatFeed'

const PROVIDER_LABELS: Record<string, string> = { MPESA: 'M-Pesa', AIRTEL_MONEY: 'Airtel Money', ORANGE_MONEY: 'Orange Money' }
const VERDICT_KEYS: Record<string, TranslationKey> = {
  VALID: 'courier.verdict.VALID',
  ALREADY_USED: 'courier.verdict.ALREADY_USED',
  WRONG_ORDER: 'courier.verdict.WRONG_ORDER',
  WRONG_PRODUCT: 'courier.verdict.WRONG_PRODUCT',
  WRONG_VARIANT: 'courier.verdict.WRONG_VARIANT',
  WRONG_SHOP: 'courier.verdict.WRONG_SHOP',
  INVALID_QR: 'courier.verdict.INVALID_QR',
}
/** How far the blue bar runs down behind the order card. */
const OVERLAP = 44

/** "Détail de la commande": everything about one mission, its next step pinned at the bottom. */
export default function CourierMissionScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [chat, setChat] = useState<ChatParty | 'ALL' | null>(null)
  // A finger on the map moves the map, not the page.
  const [mapTouched, setMapTouched] = useState(false)

  const mission = useQuery({
    queryKey: ['courier', 'mission', id],
    queryFn: () => courierApi.mission(id!),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  })
  // The order's lines (names, photos, quantities, prices) as the handover sees them.
  const handover = useQuery({
    queryKey: ['courier', 'handover', id],
    queryFn: () => courierApi.handover(id!),
    enabled: Boolean(id),
    retry: false,
  })

  const header = (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CourierTopBar title={t('courierMap.detailTitle')} />
    </>
  )
  if (mission.isLoading) return <View style={styles.screen}>{header}<Loading label={t('common.loading')} /></View>
  if (mission.isError || !mission.data) return <View style={styles.screen}>{header}<ErrorState message={t('courier.missionsFailed')} retry={() => void mission.refetch()} /></View>

  const m = mission.data
  const atDoor = HANDOVER_STATUSES.includes(m.delivery_status)
  const openMap = () => router.push({ pathname: '/courier/itinerary', params: { id: m.order_id } })
  const call = () => { if (m.delivery_phone) void Linking.openURL(`tel:${m.delivery_phone.replace(/\s+/g, '')}`) }
  const lines = handover.data?.lines ?? []
  const hasPrimary = primaryStepOf(m) !== null

  if (chat) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <Stack.Screen options={{ headerShown: false }} />
        <OrderChatFeed orderId={m.order_id} role="COURIER" initialParty={chat === 'ALL' ? undefined : chat} onClose={() => setChat(null)} />
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.page, { paddingBottom: (hasPrimary ? 120 : spacing.xl) + insets.bottom }]}
        scrollEnabled={!mapTouched}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={mission.isRefetching} onRefresh={() => { void mission.refetch(); void handover.refetch() }} />}
      >
        <View style={styles.band} />
        <View>
          <CourierOrderSummary mission={m} showDelivery>
            {m.total_amount != null ? (
              <View style={styles.amounts}>
                <Text style={styles.muted}>{t('courier.amount.products' as TranslationKey, { amount: formatMoney(m.products_total ?? 0, m.currency) })}</Text>
                <Text style={styles.muted}>{t('courier.amount.delivery' as TranslationKey, { amount: formatMoney(m.delivery_fee ?? 0, m.currency) })}</Text>
                {(m.payment_markup ?? 0) > 0 ? <Text style={styles.muted}>{t('courier.amount.markup' as TranslationKey, { amount: formatMoney(m.payment_markup ?? 0, m.currency) })}</Text> : null}
                <Text style={styles.status}>{t('courier.amount.total' as TranslationKey, { amount: formatMoney(m.total_amount, m.currency) })}</Text>
              </View>
            ) : null}
          </CourierOrderSummary>
        </View>

        {/* Articles: the lines of the order, as the handover will check them. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('courierMap.items')}</Text>
          {lines.length ? lines.map((line) => (
            <View key={line.order_line_id} style={styles.item}>
              {line.image_url
                ? <Image source={{ uri: line.image_url }} style={styles.thumb} accessibilityIgnoresInvertColors />
                : <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name="cube-outline" size={22} color={colors.muted} /></View>}
              <View style={styles.itemBody}>
                <Text style={styles.itemName} numberOfLines={2}>{lineLabel(line.product_name, line.variant_name)}</Text>
                <Text style={styles.muted}>{line.quantity} × {formatMoney(line.unit_price, handover.data?.currency)}</Text>
              </View>
              <Text style={styles.itemPrice}>{formatMoney(line.line_total, handover.data?.currency)}</Text>
            </View>
          )) : handover.isLoading ? <Text style={styles.muted}>{t('common.loading')}</Text>
            : <Text style={styles.muted}>{t('courierMap.packages', { count: m.package_count })}</Text>}
        </View>

        {/* Where to go: the address, the shop to pick up from, the map. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('courierMap.deliveryAddress')}</Text>
          <View style={styles.addressBox}>
            <Ionicons name="location" size={20} color={colors.green} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.addressText}>{m.delivery_address || '—'}</Text>
              {m.service_zone ? <Text style={styles.muted}>{m.service_zone}</Text> : null}
              {m.delivery_notes ? <Text style={styles.muted}>{t('checkout.instructions')} : {m.delivery_notes}</Text> : null}
              <Text style={styles.muted}>{t('courierMap.pickupAt', { shop: [m.shop_name, m.shop_address].filter(Boolean).join(' · ') })}</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={openMap} style={({ pressed }) => [styles.mapBtn, pressed && { opacity: 0.85 }]}>
            <Ionicons name="map-outline" size={18} color={colors.onGreen} />
            <Text style={styles.mapBtnText}>{t('courierMap.seeOnMap')}</Text>
          </Pressable>
          <Suspense fallback={null}>
            <LazyLiveCourierMap orderId={m.order_id} audience="courier" preview mapHeight={200} onExpand={openMap} onGesture={setMapTouched} />
          </Suspense>
        </View>

        {/* The customer: call, write, or the full order conversation. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('courierMap.clientInfo')}</Text>
          {m.delivery_contact ? (
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={18} color={colors.green} />
              <Text style={styles.infoText}>{m.delivery_contact}</Text>
            </View>
          ) : null}
          {m.delivery_phone ? (
            <Pressable accessibilityRole="link" accessibilityLabel={t('courierMap.callClient')} onPress={call} style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color={colors.green} />
              <Text style={[styles.infoText, styles.infoLink]}>{m.delivery_phone}</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => setChat('BUYER')} style={styles.infoRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.green} />
            <Text style={[styles.infoText, styles.infoLink]}>{t('courierMap.writeClient')}</Text>
          </Pressable>
          <Button variant="outline" dense title={t('courier.messagesAll' as TranslationKey)} onPress={() => setChat('ALL')} />
        </View>

        {/* The other steps: refuse, scan at the shop, delivery plan, failure. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{courierStatusLabel(t, m.delivery_status)}</Text>
          <MissionActions mission={m} compact hidePrimary />
          {/* Identifying one ordered item. A read: it resolves what this courier may
              see about that line and moves no handover step, so it stays available
              at every stage of the mission, not only at the door. */}
          <Button
            variant="outline"
            title={t('courier.scanItem')}
            onPress={() => router.push({ pathname: '/courier/scan', params: { type: 'ITEM', order_id: m.order_id } })}
          />
        </View>
        {atDoor ? <CourierHandover orderId={m.order_id} /> : null}
      </ScrollView>
      {hasPrimary ? (
        <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
          <MissionPrimaryAction mission={m} style={styles.footerBtn} />
        </View>
      ) : null}
    </View>
  )
}

/**
 * The courier's side of the handover: check each product (camera QR or the printed
 * PRD-/VAR- number), then - for cash only - confirm the money is in hand. Buttons
 * follow the server flags. There is deliberately no "mobile money paid" button:
 * only the operator's callback settles mobile money.
 */
function CourierHandover({ orderId }: { orderId: string }) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [verdict, setVerdict] = useState<HandoverVerificationResult | null>(null)
  const [receipt, setReceipt] = useState<ConfirmCashResponse | null>(null)
  const [error, setError] = useState('')

  const handover = useQuery({
    queryKey: ['courier', 'handover', orderId],
    queryFn: () => courierApi.handover(orderId),
    retry: false,
    refetchInterval: (q) => ((q.state.data as HandoverState | undefined)?.receipt_confirmed ? false : 10_000),
  })

  const verify = useMutation({
    mutationFn: () => courierApi.verifyProduct(orderId, productVerificationBody(code)),
    onSuccess: (result) => {
      setVerdict(result)
      setError('')
      if (result.result === 'VALID' || result.result === 'ALREADY_USED') setCode('')
      invalidateCourierMission(queryClient, orderId)
    },
    onError: (e) => { setVerdict(null); setError(e instanceof ApiError && e.message ? e.message : t('courier.verifyFailed')); invalidateCourierMission(queryClient, orderId) },
  })

  const confirmCash = useMutation({
    // A fresh key per confirmation: a retried request is the same collection, not a second one.
    mutationFn: () => courierApi.confirmCash(orderId, idempotencyKey()),
    onSuccess: (result) => { setReceipt(result); setError(''); invalidateCourierMission(queryClient, orderId) },
    onError: (e) => { setError(e instanceof ApiError && e.message ? e.message : t('courier.cashFailed')); invalidateCourierMission(queryClient, orderId) },
  })

  const state = handover.data
  if (handover.isLoading) return <Loading label={t('common.loading')} />
  if (!state) return handover.isError ? <ErrorState message={t('courier.handoverFailed')} retry={() => void handover.refetch()} /> : null

  const isCash = state.payment_method === CASH_ON_DELIVERY
  const amount = formatMoney(state.amount_due, state.currency)
  const provider = state.payment_provider ? PROVIDER_LABELS[state.payment_provider] ?? state.payment_provider : ''
  const mode = isCash
    ? t('courier.modeCash')
    : state.payment_method === MOBILE_PAY_NOW
      ? t('courier.modeMobileNow', { provider })
      : t('courier.modeMobileAtDelivery', { provider })

  const paymentLine = state.payment_verified
    ? isCash ? t('courier.cashReceived') : t('courier.mobileConfirmed')
    : isCash ? t('courier.cashToCollect', { amount }) : t('courier.mobileAwaiting')

  const askConfirmCash = () => confirmAction(
    t('courier.confirmCash'),
    t('courier.confirmCashQuestion', { amount })
      + '\n\n' + t('courier.confirmCashRecap', {
        order: state.order_number,
        buyer: state.buyer_name || '—',
        amount,
        mode,
      }),
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('courier.confirmCashSubmit'), onPress: () => confirmCash.mutate() },
    ],
  )

  return (
    <Card>
      <Text style={styles.title}>{t('courier.handoverTitle')}</Text>
      <View style={styles.row}><Text style={styles.key}>{t('handover.payment')}</Text><Text style={styles.value}>{mode}</Text></View>
      <View style={styles.row}><Text style={styles.key}>{t('handover.totalDue')}</Text><Text style={styles.value}>{amount}</Text></View>
      <Text style={state.payment_verified ? styles.success : styles.muted}>{paymentLine}</Text>

      <Text style={styles.subtitle}>{t('courier.products')}</Text>
      {state.lines.map((line) => (
        <View key={line.order_line_id} style={styles.lineBox}>
          <Text style={styles.lineName}>{lineLabel(line.product_name, line.variant_name)} × {line.quantity}</Text>
          <Text style={line.product_verified ? styles.success : styles.muted}>
            {line.product_verified ? `✓ ${t('courier.productVerified')}` : t('courier.productToVerify')}
          </Text>
        </View>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {verdict ? (
        <Text style={verdict.result === 'VALID' || verdict.result === 'ALREADY_USED' ? styles.success : styles.error}>
          {verdict.reason === 'ORDER_NUMBER_NOT_PRODUCT' ? t('courier.verdict.ORDER_NUMBER_NOT_PRODUCT') : t(VERDICT_KEYS[verdict.result] ?? 'courier.verdict.INVALID_QR')}{verdict.product_name ? ` · ${verdict.product_name}` : ''}
        </Text>
      ) : null}

      {state.courier_can_verify_product ? (
        <View style={styles.block}>
          <Button
            title={t('courier.scanProduct')}
            onPress={() => router.push({ pathname: '/courier/scan', params: { type: 'PRODUCT', order_id: orderId } })}
          />
          <Field label={t('courier.manualCode')} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} placeholder="BTMI-XXXXXXXX" returnKeyType="go" onSubmitEditing={() => { if (code.trim()) verify.mutate() }} />
          <Text style={styles.muted}>{t('courier.verifyHint')}</Text>
          <Button variant="outline" title={t('courier.verifyCode')} disabled={!code.trim()} loading={verify.isPending} onPress={() => verify.mutate()} />
        </View>
      ) : null}

      {/* No door QR: verified goods plus settled payment close the handover on the server. */}
      {isCash && !state.payment_verified ? (
        <View style={styles.block}>
          <Button
            variant="gold"
            title={t('courier.confirmCash')}
            loading={confirmCash.isPending}
            disabled={!state.courier_can_confirm_cash}
            onPress={askConfirmCash}
          />
          {!state.courier_can_confirm_cash ? <Text style={styles.muted}>{t('courier.cashBlocked')}</Text> : null}
        </View>
      ) : null}
      {!isCash && !state.payment_verified ? <Text style={styles.muted}>{t('courier.mobileNoButton')}</Text> : null}

      {receipt ? (
        <Text style={styles.success}>✓ {t('courier.cashRecorded', { amount: formatMoney(receipt.amount_collected, receipt.currency) })}</Text>
      ) : null}
      {state.receipt_confirmed ? <Text style={styles.success}>✓ {t('handover.receiptDone')}</Text> : state.all_products_verified && state.payment_verified ? <Text style={styles.muted}>{t('courier.scan.waitingBuyer')}</Text> : null}
    </Card>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.cream },
  scroll: { flex: 1 },
  /** The blue bar continues behind the top of the order card. */
  band: { position: 'absolute', top: 0, left: 0, right: 0, height: OVERLAP + spacing.md, backgroundColor: c.green },
  page: { padding: spacing.md, gap: spacing.md },
  amounts: { gap: 2, marginTop: 4, paddingTop: spacing.xs, borderTopWidth: 1, borderColor: c.border },
  section: { backgroundColor: c.white, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: c.border, ...shadow.card },
  sectionTitle: { color: c.ink, fontSize: 16, fontWeight: '800', fontFamily: fonts.display },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: c.surfaceAlt },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  itemBody: { flex: 1, gap: 2 },
  itemName: { color: c.ink, fontWeight: '700' },
  itemPrice: { color: c.ink, fontWeight: '900' },
  addressBox: { flexDirection: 'row', gap: spacing.sm, backgroundColor: c.greenSoft, borderRadius: radius.sm, padding: spacing.sm },
  addressText: { color: c.ink, fontWeight: '700' },
  mapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: 48, borderRadius: 14, backgroundColor: c.green, ...shadow.raised },
  mapBtnText: { color: c.onGreen, fontWeight: '800', fontSize: 15 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 36 },
  infoText: { color: c.ink, fontSize: 14, flex: 1 },
  infoLink: { color: c.green, fontWeight: '700' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md, paddingTop: spacing.sm, backgroundColor: c.cream },
  footerBtn: { minHeight: 56, borderRadius: radius.md, ...shadow.raised },
  title: { color: c.ink, fontWeight: '900', fontSize: 17 },
  subtitle: { color: c.ink, fontWeight: '800', marginTop: spacing.sm },
  status: { color: c.green, fontWeight: '900' },
  muted: { color: c.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  key: { color: c.muted },
  value: { color: c.ink, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  block: { gap: spacing.sm, marginTop: spacing.sm },
  lineBox: { borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, padding: spacing.sm, gap: 2 },
  lineName: { color: c.ink, fontWeight: '700' },
  error: { color: c.danger, fontWeight: '700' },
  success: { color: c.success, fontWeight: '800' },
})
