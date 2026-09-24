import { useMemo, useState } from 'react'
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { courierApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'
import { formatMoney } from '../../src/lib/money'
import { CASH_ON_DELIVERY, MOBILE_PAY_NOW } from '../../src/lib/paymentStatus'
import { idempotencyKey } from '../../src/lib/idempotency'
import { courierStatusLabel, invalidateCourierMission, productVerificationBody } from '../../src/lib/courier'
import type { ConfirmCashResponse, HandoverState, HandoverVerificationResult } from '../../src/types'
import { MissionActions } from '../../src/components/CourierMissionActions'

const HANDOVER_STATUSES = ['COURIER_ARRIVED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION', 'RECEIVED']
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

export default function CourierMissionScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useI18n()
  const { id } = useLocalSearchParams<{ id: string }>()

  const mission = useQuery({
    queryKey: ['courier', 'mission', id],
    queryFn: () => courierApi.mission(id!),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  })

  if (mission.isLoading) return <Loading label={t('common.loading')} />
  if (mission.isError || !mission.data) return <ErrorState message={t('courier.missionsFailed')} retry={() => void mission.refetch()} />

  const m = mission.data
  const atDoor = HANDOVER_STATUSES.includes(m.delivery_status)

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={mission.isRefetching} onRefresh={() => void mission.refetch()} />}
    >
      <SectionTitle title={`#${m.order_number}`} />
      <Card>
        <Text style={styles.status}>{courierStatusLabel(t, m.delivery_status)}</Text>
        <Text style={styles.muted}>{t('courier.pickupAt')} : {m.shop_name}{m.shop_address ? ` · ${m.shop_address}` : ''}</Text>
        <Text style={styles.muted}>{t('courier.deliverTo')} : {m.delivery_contact}{m.delivery_address ? ` · ${m.delivery_address}` : ''}</Text>
        {m.delivery_phone ? <Text style={styles.muted}>{t('editProfile.phone')} : {m.delivery_phone}</Text> : null}
        {m.delivery_notes ? <Text style={styles.muted}>{t('checkout.instructions')} : {m.delivery_notes}</Text> : null}
        <MissionActions mission={m} compact />
        {/* Identifying one ordered item. A read: it resolves what this courier may
            see about that line and moves no handover step, so it stays available
            at every stage of the mission, not only at the door. */}
        <Button
          variant="outline"
          title={t('courier.scanItem')}
          onPress={() => router.push({ pathname: '/courier/scan', params: { type: 'ITEM', order_id: m.order_id } })}
        />
      </Card>
      {atDoor ? <CourierHandover orderId={m.order_id} /> : null}
    </ScrollView>
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

  const askConfirmCash = () => Alert.alert(
    t('courier.confirmCash'),
    t('courier.confirmCashQuestion', { amount }),
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
          <Text style={styles.lineName}>{line.product_name}{line.variant_name ? ` · ${line.variant_name}` : ''} × {line.quantity}</Text>
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

      {/* The delivery QR shown by the buyer closes the handover. */}
      {state.courier_arrived && !state.delivery_scanned ? (
        <Button title={t('courier.scanDelivery')} onPress={() => router.push({ pathname: '/courier/scan', params: { type: 'DELIVERY', order_id: orderId } })} />
      ) : null}

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
      {state.receipt_confirmed ? <Text style={styles.success}>✓ {t('handover.receiptDone')}</Text> : state.delivery_scanned ? <Text style={styles.muted}>{t('courier.scan.waitingBuyer')}</Text> : null}
    </Card>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
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
