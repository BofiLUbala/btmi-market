import { useEffect, useMemo, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { buyerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'
import { formatMoney } from '../../src/lib/money'
import { CASH_ON_DELIVERY, MOBILE_AT_DELIVERY, MOBILE_PAY_NOW, isPaymentPaid } from '../../src/lib/paymentStatus'
import type { BuyerPayment, PaymentMethodConfig, PaymentProviderCode } from '../../src/types'

const money = (value: number, currency?: string) => formatMoney(value, currency)

type Timing = 'NOW' | 'DELIVERY'
const isMobile = (method: string) => method === MOBILE_PAY_NOW || method === MOBILE_AT_DELIVERY

/**
 * Checkout payment, same hierarchy and endpoints as the web:
 *   Payer maintenant → Paiement mobile → M-Pesa / Airtel Money / Orange Money
 *   Payer à la livraison → Espèces | Paiement mobile → opérateur
 *
 * Confirming records how the buyer intends to pay. Every payment starts DUE;
 * pay-now moves to PROCESSING once the operator is asked to charge, and only
 * the operator's signed callback can make it PAID. Nothing here marks paid.
 */
export default function PaymentScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const { orderId, orderIds: orderIdsParam } = useLocalSearchParams<{ orderId?: string; orderIds?: string }>()
  // One payment decision, recorded against each order of a multi-shop checkout,
  // so every shop's payment keeps its own amount.
  const orderIds = useMemo(() => {
    const ids = (orderIdsParam || '').split(',').filter(Boolean)
    return ids.length ? ids : orderId ? [orderId] : []
  }, [orderIdsParam, orderId])
  const { t } = useI18n()

  const [timing, setTiming] = useState<Timing | ''>('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [provider, setProvider] = useState<PaymentProviderCode | ''>('')
  const [payerPhone, setPayerPhone] = useState('')
  const [error, setError] = useState('')
  const [instructions, setInstructions] = useState('')
  const [started, setStarted] = useState(false)
  // Initiation outcome per child order: one operator refusal must not hide the others.
  const [initErrors, setInitErrors] = useState<Record<string, string>>({})

  // Base quote: the methods and operators Finance has enabled.
  const quote = useQuery({
    queryKey: ['checkout', 'quote', orderId],
    queryFn: () => buyerApi.checkoutQuote(orderId!),
    enabled: Boolean(orderId),
  })
  // Every method change is re-priced by the server for every order of the group.
  const pricedQuotes = useQueries({
    queries: orderIds.map((id) => ({
      queryKey: ['checkout', 'quote', id, paymentMethod],
      queryFn: () => buyerApi.checkoutQuote(id, paymentMethod),
      enabled: Boolean(paymentMethod),
    })),
  })
  const orders = useQueries({
    queries: orderIds.map((id) => ({ queryKey: ['checkout', 'order', id], queryFn: () => buyerApi.order(id) })),
  })

  // Pay-now: a checkout group has one payment row per shop order (the backend has no
  // grouped payment), so every child payment is polled until its operator settles it.
  const payments = useQueries({
    queries: orderIds.map((id) => ({
      queryKey: ['buyer', 'payment', id],
      queryFn: () => buyerApi.getPayment(id),
      enabled: started,
      refetchInterval: (q: { state: { data?: BuyerPayment } }) => {
        const status = q.state.data?.status
        return status && ['PAID', 'VERIFIED', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(status) ? false : 5_000
      },
    })),
  })

  const invalidate = () => {
    for (const id of orderIds) {
      void queryClient.invalidateQueries({ queryKey: ['buyer', 'payment', id] })
      void queryClient.invalidateQueries({ queryKey: ['buyer', 'order', id] })
      void queryClient.invalidateQueries({ queryKey: ['buyer', 'handover', id] })
    }
    void queryClient.invalidateQueries({ queryKey: ['buyer', 'orders'] })
  }

  const goToOrder = () => orderIds.length > 1
    ? router.replace('/orders')
    : router.replace({ pathname: '/orders/[id]', params: { id: orderId! } })

  // Done only when EVERY child order is paid - never on the first one alone.
  const allPaid = started && payments.length > 0 && payments.every((q) => isPaymentPaid(q.data))
  useEffect(() => {
    if (allPaid) {
      invalidate()
      goToOrder()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPaid])

  const retryInitiate = useMutation({
    mutationFn: (id: string) => buyerApi.initiatePayment(id, payerPhone.trim() || undefined),
    onSuccess: (_data, id) => { setInitErrors((prev) => { const next = { ...prev }; delete next[id]; return next }); invalidate() },
    onError: (e, id) => { setInitErrors((prev) => ({ ...prev, [id]: e instanceof ApiError && e.message ? e.message : t('handover.payFailed') })); invalidate() },
  })

  const needsProvider = isMobile(paymentMethod)
  // Pay-now charges the handset right away, so the number is required here.
  // Pay-at-delivery asks for it at the door, once the products are verified.
  const needsPhoneNow = paymentMethod === MOBILE_PAY_NOW
  const phoneReady = !needsPhoneNow || payerPhone.replace(/\D/g, '').length >= 9
  const readyToPlace = Boolean(paymentMethod) && (!needsProvider || Boolean(provider)) && phoneReady

  const place = useMutation({
    mutationFn: async () => {
      const phone = needsPhoneNow ? payerPhone.trim() : undefined
      const payments = await Promise.all(
        orderIds.map((id) => buyerApi.createPayment(id, paymentMethod, needsProvider ? provider : undefined, phone))
      )
      if (paymentMethod !== MOBILE_PAY_NOW) return { payments, initiated: false }
      // Each child order is charged separately; collect every outcome instead of
      // stopping at the first refusal, so the buyer sees the whole group.
      const results = await Promise.allSettled(orderIds.map((id) => buyerApi.initiatePayment(id, phone)))
      const errors: Record<string, string> = {}
      results.forEach((r, i) => {
        if (r.status === 'rejected') errors[orderIds[i]] = r.reason instanceof ApiError && r.reason.message ? r.reason.message : t('handover.payFailed')
      })
      setInitErrors(errors)
      const firstOk = results.find((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof buyerApi.initiatePayment>>> => r.status === 'fulfilled')
      setInstructions(firstOk?.value.instructions || '')
      return { payments, initiated: true }
    },
    onSuccess: ({ initiated }) => {
      invalidate()
      if (initiated) {
        // Stay: the buyer approves the operator prompt on the phone; the screen
        // follows the payment status the backend reports.
        setStarted(true)
        return
      }
      goToOrder()
    },
    onError: (e) => {
      invalidate()
      setError(e instanceof ApiError && e.message ? e.message : t('checkout.prepareFailed'))
    },
  })

  if (!orderId) return <ErrorState message={t('checkout.orderNotFound')} retry={() => router.replace('/(buyer)/cart')} />
  if (quote.isLoading) return <Loading label={t('checkout.preparingPayment')} />
  if (quote.isError || !quote.data) {
    return <ErrorState message={t('checkout.paymentFailed')} retry={() => quote.refetch()} />
  }

  const base = quote.data
  const enabledMethods = base.payment_methods.filter((m) => m.enabled !== false)
  const methodsFor = (value: Timing) => enabledMethods.filter((m) => m.timing === value)
  const providers = (base.providers ?? []).filter((p) => p.enabled).sort((a, b) => a.display_order - b.display_order)

  const priced = pricedQuotes.map((q) => q.data).filter(Boolean)
  const pricedReady = Boolean(paymentMethod) && priced.length === orderIds.length
  const currency = priced[0]?.currency || base.currency
  const sum = (pick: (q: NonNullable<typeof priced[number]>) => number) => priced.reduce((acc, q) => acc + pick(q!), 0)
  const methodTotal = (q: NonNullable<typeof priced[number]>) =>
    q.payment_methods.find((m) => m.code === paymentMethod)?.quoted_total ?? q.final_total
  const methodMarkup = (q: NonNullable<typeof priced[number]>) =>
    q.payment_methods.find((m) => m.code === paymentMethod)?.markup_amount ?? q.payment_markup

  const chooseTiming = (next: Timing) => {
    setTiming(next)
    setProvider('')
    setError('')
    const available = methodsFor(next)
    // Only one method under a timing: nothing to choose, go to the operator step.
    setPaymentMethod(available.length === 1 ? available[0].code : '')
  }

  const methodLabel = (m: PaymentMethodConfig) =>
    m.code === CASH_ON_DELIVERY ? t('payment.cash') : isMobile(m.code) ? t('payment.mobileMoney') : m.label

  const lines = orders.flatMap((o) => (o.data ? o.data.lines.map((line) => ({ line, shop: o.data!.shop_name, currency: o.data!.order.currency })) : []))
  const statusText = (p?: BuyerPayment) => {
    if (!p) return t('common.loading')
    if (isPaymentPaid(p)) return t('orders.paymentPaid')
    if (p.status === 'FAILED') return t('orders.paymentFailed')
    if (p.status === 'PROCESSING' || p.status === 'PENDING') return t('payment.processing')
    if (p.status === 'CANCELLED' || p.status === 'REFUNDED') return t('orders.paymentCancelled')
    return t('orders.paymentDue')
  }
  const paidCount = payments.filter((q) => isPaymentPaid(q.data)).length

  // Pay-now in progress: the screen becomes the status of the whole checkout group.
  if (started) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <SectionTitle title={t('payment.awaitingTitle')} />
        <Card>
          <Text style={styles.muted}>{instructions || t('payment.approveOnPhone')}</Text>
          {orderIds.length > 1 ? <Text style={styles.blockTitle}>{t('payment.groupProgress', { paid: paidCount, total: orderIds.length })}</Text> : null}
          <Text style={styles.muted}>{t('payment.onlyOperatorConfirms')}</Text>
        </Card>
        {orderIds.map((id, index) => {
          const p = payments[index]?.data
          const detail = orders[index]?.data
          const paid = isPaymentPaid(p)
          const failed = p?.status === 'FAILED'
          const retryable = Boolean(p) && !paid && !['PROCESSING', 'PENDING', 'CANCELLED', 'REFUNDED'].includes(p!.status)
          return (
            <Card key={id}>
              <View style={styles.row}>
                <Ionicons
                  name={paid ? 'checkmark-circle' : failed ? 'close-circle' : 'time-outline'}
                  size={22}
                  color={paid ? colors.success : failed ? colors.danger : colors.green}
                />
                <View style={styles.lineInfo}>
                  <Text style={styles.name}>{t('payment.orderFromShop', { shop: detail?.shop_name || '—' })}</Text>
                  {detail?.order.order_number ? <Text style={styles.muted}>#{detail.order.order_number}</Text> : null}
                </View>
              </View>
              {p?.provider_label || p?.provider ? <Text style={styles.muted}>{t('seller.paymentOperator')} : {p?.provider_label || p?.provider}</Text> : null}
              <Text style={paid ? styles.discount : failed ? styles.errorText : styles.value}>{statusText(p)}</Text>
              {p ? <Text style={styles.value}>{money(p.final_total, p.currency)}</Text> : null}
              {p?.receipt_reference || p?.internal_reference ? <Text style={styles.muted}>{t('seller.paymentReference')} : {p?.receipt_reference || p?.internal_reference}</Text> : null}
              {initErrors[id] ? <Text style={styles.errorText}>{initErrors[id]}</Text> : null}
              {retryable ? (
                <Button
                  variant="outline"
                  title={t('payment.retryOrder')}
                  loading={retryInitiate.isPending && retryInitiate.variables === id}
                  onPress={() => retryInitiate.mutate(id)}
                />
              ) : null}
            </Card>
          )
        })}
        <Button title={orderIds.length > 1 ? t('profile.myOrders') : t('checkout.viewOrder')} variant="outline" onPress={goToOrder} />
      </ScrollView>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.steps}>
          <Text style={styles.stepDone}>1 {t('tabs.cart')}</Text>
          <Text style={styles.stepDone}>2 {t('checkout.delivery')}</Text>
          <Text style={styles.stepActive}>3 {t('checkout.payment')}</Text>
        </View>

        <SectionTitle title={t('checkout.reviewOrder')} />

        {/* Step 1 — when. */}
        <Card>
          <Text style={styles.blockTitle}>{t('payment.whenTitle')}</Text>
          {(['NOW', 'DELIVERY'] as Timing[]).filter((value) => methodsFor(value).length > 0).map((value) => (
            <Choice
              key={value}
              styles={styles}
              selected={timing === value}
              title={value === 'NOW' ? t('payment.payNow') : t('payment.payAtDelivery')}
              hint={value === 'NOW' ? t('payment.payNowHint') : t('payment.payAtDeliveryHint')}
              onPress={() => chooseTiming(value)}
            />
          ))}
        </Card>

        {/* Step 2 — how, within that timing. */}
        {timing && methodsFor(timing).length > 1 ? (
          <Card>
            <Text style={styles.blockTitle}>{t('payment.howAtDelivery')}</Text>
            {methodsFor(timing).map((m) => (
              <Choice
                key={m.code}
                styles={styles}
                selected={paymentMethod === m.code}
                title={methodLabel(m)}
                hint={m.code === CASH_ON_DELIVERY ? t('payment.cashHint') : t('payment.mobileAtDeliveryHint')}
                onPress={() => { setPaymentMethod(m.code); setProvider(''); setError('') }}
              />
            ))}
          </Card>
        ) : null}

        {/* Step 3 — which operator, for either mobile method. */}
        {needsProvider ? (
          <Card>
            <Text style={styles.blockTitle}>{t('payment.chooseOperator')}</Text>
            {providers.length === 0 ? <Text style={styles.muted}>{t('payment.noOperator')}</Text> : providers.map((p) => (
              <Choice key={p.code} styles={styles} selected={provider === p.code} title={p.label} onPress={() => setProvider(p.code)} />
            ))}
          </Card>
        ) : null}

        {needsPhoneNow && provider ? (
          <Card>
            <Field
              label={t('payment.payerPhone')}
              value={payerPhone}
              keyboardType="phone-pad"
              onChangeText={setPayerPhone}
            />
            <Text style={styles.muted}>{t('payment.payerPhoneHint')}</Text>
          </Card>
        ) : null}

        {paymentMethod === MOBILE_AT_DELIVERY && provider ? (
          <Card><Text style={styles.muted}>{t('payment.mobileAtDeliveryRule')}</Text></Card>
        ) : null}
        {paymentMethod === CASH_ON_DELIVERY ? (
          <Card><Text style={styles.muted}>{t('payment.cashRule')}</Text></Card>
        ) : null}

        <Card>
          <Text style={styles.blockTitle}>{t('checkout.products')}</Text>
          {lines.map(({ line, shop, currency: lineCurrency }) => (
            <View key={line.id} style={styles.lineRow}>
              <View style={styles.lineInfo}>
                <Text style={styles.name} numberOfLines={2}>{line.product_name}</Text>
                <Text style={styles.muted}>
                  {[line.variant_name, shop, `${t('common.quantity')} ${line.quantity}`].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text style={styles.linePrice}>{money(line.final_unit_price * line.quantity, lineCurrency)}</Text>
            </View>
          ))}
        </Card>

        {pricedReady ? (
          <Card>
            <Text style={styles.blockTitle}>{t('checkout.amountBreakdown')}</Text>
            <View style={styles.totalRow}>
              <Text style={styles.muted}>{t('checkout.products')}</Text>
              <Text style={styles.value}>{money(sum((q) => q.subtotal), currency)}</Text>
            </View>
            {sum((q) => q.points_discount) > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.muted}>{t('payment.pointsDiscount')}</Text>
                <Text style={styles.discount}>−{money(sum((q) => q.points_discount), currency)}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.muted}>{t('checkout.delivery')}</Text>
              <Text style={styles.value}>{money(sum((q) => q.delivery_fee), currency)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.muted}>{t('orders.paymentMarkup')}</Text>
              <Text style={styles.value}>{money(sum(methodMarkup), currency)}</Text>
            </View>
            <Text style={styles.eyebrow}>{t('payment.serverTotal')}</Text>
            <Text style={styles.cashDue}>{money(sum(methodTotal), currency)}</Text>
            {orderIds.length > 1 ? <Text style={styles.muted}>{t('payment.coversOrders', { count: orderIds.length })}</Text> : null}
          </Card>
        ) : paymentMethod && pricedQuotes.some((q) => q.isError) ? (
          <ErrorState message={t('checkout.paymentFailed')} retry={() => pricedQuotes.forEach((q) => void q.refetch())} />
        ) : paymentMethod ? <Loading label={t('checkout.preparingPayment')} /> : null}

        {error ? <ErrorState message={error} /> : null}

        <Button
          variant="gold"
          title={needsPhoneNow ? t('payment.payNowButton') : t('checkout.confirmOrder')}
          loading={place.isPending}
          disabled={!readyToPlace || !pricedReady}
          onPress={() => { setError(''); place.mutate() }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Choice({ styles, selected, title, hint, onPress }: { styles: ReturnType<typeof makeStyles>; selected: boolean; title: string; hint?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <View style={[styles.radio, selected && styles.radioOn]} />
      <View style={styles.lineInfo}>
        <Text style={styles.name}>{title}</Text>
        {hint ? <Text style={styles.muted}>{hint}</Text> : null}
      </View>
    </Pressable>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1 },
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  steps: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  stepDone: { color: colors.green, fontWeight: '800', fontSize: 12 },
  stepActive: { color: colors.ink, fontWeight: '900', fontSize: 12 },
  blockTitle: { color: colors.ink, fontWeight: '900', fontSize: 16 },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  lineRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  lineInfo: { flex: 1, gap: 2 },
  name: { color: colors.ink, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 13, flexShrink: 1 },
  linePrice: { color: colors.ink, fontWeight: '800' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  value: { color: colors.ink, fontWeight: '700' },
  discount: { color: colors.success, fontWeight: '800' },
  errorText: { color: colors.danger, fontWeight: '800' },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: spacing.sm },
  cashDue: { color: colors.green, fontSize: 32, fontWeight: '900' },
  choice: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, minHeight: 48 },
  choiceSelected: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.muted },
  radioOn: { borderColor: colors.green, backgroundColor: colors.green },
})
