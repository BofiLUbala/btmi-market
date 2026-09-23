import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { buyerApi } from '../api'
import { ApiError } from '../api/client'
import { Button, Card, Field } from './ui'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, spacing, type Colors } from '../theme'
import { formatMoney } from '../lib/money'
import { CASH_ON_DELIVERY } from '../lib/paymentStatus'
import type { BuyerPayment, HandoverLineAcknowledgement } from '../types'

// RECEIVED is included so the buyer sees the handover confirmed, not a card that vanishes.
export const BUYER_HANDOVER_STATUSES = ['COURIER_ARRIVED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION', 'RECEIVED']

type Answer = Omit<HandoverLineAcknowledgement, 'order_line_id'>
const EMPTY: Answer = { product_received: false, matches_order: false, quantity_correct: false }

/**
 * The buyer's side of the handover at the door, same endpoints as the web panel.
 *
 * Every control is driven by the flags the server computes (buyer_can_acknowledge,
 * buyer_can_confirm_receipt, payment_verified). Nothing here can mark a payment paid:
 * the buyer sees "Payé" only once the courier confirmed cash or the operator confirmed
 * the transfer.
 */
export function BuyerHandoverCard({ orderId, deliveryStatus, onChanged }: { orderId: string; deliveryStatus?: string | null; onChanged: () => void }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [error, setError] = useState('')

  const atDoor = BUYER_HANDOVER_STATUSES.includes(deliveryStatus || '')
  const handover = useQuery({
    queryKey: ['buyer', 'handover', orderId],
    queryFn: () => buyerApi.handover(orderId),
    enabled: atDoor,
    retry: false,
    // The courier drives most of this (product check, cash), so poll while open.
    refetchInterval: (q) => (q.state.data?.receipt_confirmed ? false : 10_000),
  })

  const acknowledge = useMutation({
    mutationFn: (lines: HandoverLineAcknowledgement[]) => buyerApi.acknowledgeHandover(orderId, lines),
    onSuccess: () => { setError(''); void handover.refetch(); onChanged() },
    onError: (e) => { setError(e instanceof ApiError && e.message ? e.message : t('handover.ackFailed')); void handover.refetch() },
  })
  const confirmReceipt = useMutation({
    mutationFn: () => buyerApi.confirmReceived(orderId),
    onSuccess: () => { setError(''); void handover.refetch(); onChanged() },
    onError: (e) => { setError(e instanceof ApiError && e.message ? e.message : t('handover.receiptFailed')); void handover.refetch(); onChanged() },
  })

  const state = handover.data
  if (!atDoor || !state) return null

  const isCash = state.payment_method === CASH_ON_DELIVERY
  const answerFor = (lineId: string) => answers[lineId] ?? EMPTY
  const pendingLines = state.lines.filter((line) => !line.buyer_acknowledged)
  const allAnswered = pendingLines.every((line) => {
    const a = answerFor(line.order_line_id)
    return a.product_received && a.matches_order && a.quantity_correct
  })
  const busy = acknowledge.isPending || confirmReceipt.isPending

  const paymentText = state.payment_verified
    ? isCash ? t('handover.paidCash') : t('handover.paidMobile')
    : isCash ? t('handover.cashToHand', { amount: formatMoney(state.amount_due, state.currency) }) : t('handover.awaitingMobile')

  const blockedText = !state.payment_verified
    ? t('handover.blockedPayment')
    : !state.all_lines_acknowledged
      ? t('handover.blockedAck')
      : !state.delivery_scanned
        ? t('handover.blockedScan')
        : t('handover.blockedOther')

  return (
    <Card>
      <Text style={styles.title}>{t('handover.buyerTitle')}</Text>
      <View style={styles.row}><Text style={styles.key}>{t('handover.payment')}</Text><Text style={styles.value}>{paymentText}</Text></View>
      <View style={styles.row}><Text style={styles.key}>{t('handover.productsVerified')}</Text><Text style={styles.value}>{state.all_products_verified ? `✓ ${t('handover.yes')}` : t('handover.notYet')}</Text></View>
      <View style={styles.row}><Text style={styles.key}>{t('handover.qrScanned')}</Text><Text style={styles.value}>{state.delivery_scanned ? `✓ ${t('handover.yes')}` : t('handover.notYet')}</Text></View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {state.buyer_can_acknowledge && pendingLines.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.subtitle}>{t('handover.confirmEachItem')}</Text>
          {pendingLines.map((line) => {
            const a = answerFor(line.order_line_id)
            const toggle = (key: keyof Answer) => setAnswers((prev) => ({ ...prev, [line.order_line_id]: { ...a, [key]: !a[key] } }))
            return (
              <View key={line.order_line_id} style={styles.lineBox}>
                <Text style={styles.lineName}>{line.product_name}{line.variant_name ? ` · ${line.variant_name}` : ''} × {line.quantity}</Text>
                <Check styles={styles} colors={colors} checked={a.product_received} label={t('handover.itemReceived')} onPress={() => toggle('product_received')} />
                <Check styles={styles} colors={colors} checked={a.matches_order} label={t('handover.itemMatches')} onPress={() => toggle('matches_order')} />
                <Check styles={styles} colors={colors} checked={a.quantity_correct} label={t('handover.itemQuantity')} onPress={() => toggle('quantity_correct')} />
              </View>
            )
          })}
          <Button
            variant="outline"
            title={t('handover.validateItems')}
            loading={acknowledge.isPending}
            disabled={!allAnswered || busy}
            onPress={() => acknowledge.mutate(pendingLines.map((line) => ({ order_line_id: line.order_line_id, ...answerFor(line.order_line_id) })))}
          />
        </View>
      ) : null}

      {!state.receipt_confirmed ? (
        <View style={styles.block}>
          <Button
            title={t('handover.confirmReceipt')}
            loading={confirmReceipt.isPending}
            disabled={!state.buyer_can_confirm_receipt || busy}
            onPress={() => confirmReceipt.mutate()}
          />
          {!state.buyer_can_confirm_receipt ? <Text style={styles.hint}>{blockedText}</Text> : null}
        </View>
      ) : <Text style={styles.success}>✓ {t('handover.receiptDone')}</Text>}
    </Card>
  )
}

function Check({ styles, colors, checked, label, onPress }: { styles: ReturnType<typeof makeStyles>; colors: Colors; checked: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }} style={styles.check}>
      <View style={[styles.tick, checked && styles.tickOn]}>
        {checked ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  )
}

/**
 * Mobile money the buyer pays themselves: pay-now that was not started yet, or
 * pay-at-delivery once the courier is there and the products are verified.
 * The server decides `payable`; this card only asks the operator to charge.
 */
export function MobilePaymentCard({ orderId, payment, onChanged }: { orderId: string; payment: BuyerPayment | null; onChanged: () => void }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [phone, setPhone] = useState(payment?.payer_phone ?? '')
  const [error, setError] = useState('')
  const [instructions, setInstructions] = useState('')

  const initiate = useMutation({
    mutationFn: () => buyerApi.initiatePayment(orderId, phone.trim() || undefined),
    onSuccess: (started) => { setError(''); setInstructions(started.instructions || t('payment.approveOnPhone')); onChanged() },
    onError: (e) => { setError(e instanceof ApiError && e.message ? e.message : t('handover.payFailed')); onChanged() },
  })

  if (!payment || payment.payment_method === CASH_ON_DELIVERY) return null
  if (payment.payable_reason === 'ALREADY_PAID' || payment.payable_reason === 'PAYMENT_CLOSED') return null
  if (['PAID', 'VERIFIED', 'REFUNDED', 'CANCELLED'].includes(payment.status)) return null

  const processing = payment.status === 'PROCESSING' || payment.status === 'PENDING'

  return (
    <Card>
      <Text style={styles.title}>{t('handover.payMobileTitle')}</Text>
      <View style={styles.row}><Text style={styles.key}>{t('handover.totalDue')}</Text><Text style={styles.value}>{formatMoney(payment.final_total, payment.currency)}</Text></View>
      {payment.provider ? <View style={styles.row}><Text style={styles.key}>{t('seller.paymentOperator')}</Text><Text style={styles.value}>{payment.provider_label || payment.provider}</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {instructions ? <Text style={styles.hint}>{instructions}</Text> : null}
      {payment.payable_reason === 'AWAITING_DELIVERY_STAGE' ? <Text style={styles.hint}>{t('handover.waitDelivery')}</Text> : null}
      {payment.payable_reason === 'AWAITING_PRODUCT_VERIFICATION' ? <Text style={styles.hint}>{t('handover.waitVerification')}</Text> : null}
      {payment.payable_reason === 'PAYMENT_PROVIDER_NOT_CONFIGURED' ? <Text style={styles.hint}>{t('payment.noOperator')}</Text> : null}
      {processing ? <Text style={styles.hint}>{t('handover.processing')}</Text> : null}
      {payment.payable ? <Field label={t('payment.payerPhone')} value={phone} keyboardType="phone-pad" onChangeText={setPhone} /> : null}
      <Button
        title={t('payment.payNowButton')}
        loading={initiate.isPending}
        disabled={!payment.payable || !phone.trim()}
        onPress={() => initiate.mutate()}
      />
    </Card>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  title: { fontSize: 17, fontWeight: '900', color: c.ink },
  subtitle: { fontWeight: '800', color: c.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  key: { color: c.muted },
  value: { color: c.ink, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  block: { gap: spacing.sm, marginTop: spacing.sm },
  lineBox: { borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, padding: spacing.sm, gap: 4 },
  lineName: { color: c.ink, fontWeight: '700' },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40 },
  tick: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: c.muted, alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: c.success, borderColor: c.success },
  checkLabel: { color: c.ink, flex: 1 },
  hint: { color: c.muted, fontSize: 13 },
  error: { color: c.danger, fontWeight: '700' },
  success: { color: c.success, fontWeight: '800', marginTop: spacing.sm },
})
