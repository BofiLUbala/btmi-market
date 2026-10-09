import { useEffect, useMemo, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { buyerApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, shadow, spacing, type Colors, fonts } from '../../src/theme'
import { formatMoney } from '../../src/lib/money'
import { CASH_ON_DELIVERY, MOBILE_AT_DELIVERY, MOBILE_PAY_NOW, isPaymentPaid } from '../../src/lib/paymentStatus'
import type { BuyerPayment, PaymentMethodConfig, PaymentProviderCode } from '../../src/types'
import { CheckoutProgress } from '../../src/components/CheckoutProgress'
import { CardHead, CheckoutCard, CheckoutHeading, Eyebrow, SmallText, checkoutPage } from '../../src/components/CheckoutUI'
import type { TranslationKey } from '../../src/locales/fr'

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
/* Same wording as web-app/src/pages/checkout/PaymentPage.tsx. */
const TIMING_CHOICES: Array<{ timing: Timing; title: TranslationKey; hint: TranslationKey }> = [
  { timing: 'NOW', title: 'checkoutPayment.payNow', hint: 'checkoutPayment.payNowHint' },
  { timing: 'DELIVERY', title: 'checkoutPayment.payOnDelivery', hint: 'checkoutPayment.payOnDeliveryHint' },
]
const METHOD_HINT: Record<string, TranslationKey> = {
  CASH_ON_DELIVERY: 'checkoutPayment.methodHintCash',
  MOBILE_AT_DELIVERY: 'checkoutPayment.methodHintMobileAtDelivery',
  MOBILE_PAY_NOW: 'checkoutPayment.methodHintMobileNow',
}
const METHOD_TITLE: Record<string, TranslationKey> = {
  CASH_ON_DELIVERY: 'checkoutPayment.methodCash',
  MOBILE_AT_DELIVERY: 'checkoutPayment.methodMobileAtDelivery',
  MOBILE_PAY_NOW: 'checkoutPayment.methodMobileNow',
}

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
  const insets = useSafeAreaInsets()

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
  const openOrder = () => orderIds.length > 1
    ? router.push('/(buyer)/my-orders' as never)
    : router.push({ pathname: '/orders/[id]', params: { id: orderId! } } as never)

  // Done only when EVERY child order is paid - never on the first one alone.
  const allPaid = started && payments.length > 0 && payments.every((q) => isPaymentPaid(q.data))
  useEffect(() => {
    if (allPaid) {
      invalidate()
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
      // Step 4 confirmation, as on the web (/orders/:id/success).
      router.replace({ pathname: '/checkout/success', params: { orderId: orderId!, orderIds: orderIds.join(',') } })
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
  /** Markup of any listed method (web shows "+ x $" / "Sans frais" per choice). */
  const methodMarkupFor = (q: NonNullable<typeof priced[number]>, code: string) =>
    q.payment_methods.find((m) => m.code === code)?.markup_amount ?? 0

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
    if (!p) return t('payment.statusUnknown')
    if (isPaymentPaid(p)) return t('payment.statusConfirmed')
    if (p.status === 'FAILED') return t('orders.paymentFailed')
    if (p.status === 'PROCESSING' || p.status === 'PENDING') return t('payment.processing')
    if (p.status === 'CANCELLED' || p.status === 'REFUNDED') return t('payment.statusCancelled')
    return t('payment.statusUnknown')
  }
  const paidCount = payments.filter((q) => isPaymentPaid(q.data)).length

  // Pay-now in progress: the screen becomes the status of the whole checkout group.
  if (started) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <SectionTitle title={t('payment.awaitingTitle')} />
        <Card>
          <Text style={styles.blockTitle}>{allPaid ? t('payment.statusConfirmed') : t('payment.approveOnPhone')}</Text>
          <Text style={styles.muted}>{allPaid ? t('payment.statusConfirmedHelp') : instructions || t('payment.awaitingPrompt')}</Text>
          {orderIds.length > 1 ? <Text style={styles.blockTitle}>{t('payment.groupProgress', { paid: paidCount, total: orderIds.length })}</Text> : null}
          <Text style={styles.muted}>{t('payment.onlyOperatorConfirms')}</Text>
        </Card>
        {orderIds.map((id, index) => {
          const p = payments[index]?.data
          const detail = orders[index]?.data
          const paid = isPaymentPaid(p)
          const failed = p?.status === 'FAILED'
          // A timeout or missing status is not proof the provider did not charge.
          // Retry only after an authoritative FAILED state from the backend.
          const retryable = p?.status === 'FAILED' && !paid
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
              <Button title={t('checkout.viewOrder')} variant="outline" onPress={openOrder} />
            </Card>
          )
        })}
        <Button title={t('payment.getHelp')} variant="outline" onPress={() => router.push('/help' as never)} />
        <Button title={orderIds.length > 1 ? t('profile.myOrders') : t('checkout.viewOrder')} variant="outline" onPress={goToOrder} />
      </ScrollView>
    )
  }

  const w = (key: string, vars?: Record<string, string | number>) => t(`web.${key}` as TranslationKey, vars)
  const totalItems = lines.reduce((sum, item) => sum + item.line.quantity, 0)
  const selectedMethod = enabledMethods.find((m) => m.code === paymentMethod)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const firstOrder = orders[0]?.data?.order as any
  const deliveryRows: Array<[string, string]> = firstOrder
    ? ([
        [t('seller.province'), firstOrder.delivery_province], [t('common.city'), firstOrder.delivery_city], [t('common.commune'), firstOrder.delivery_commune],
        [t('common.address'), firstOrder.delivery_street || firstOrder.delivery_address], [t('checkoutPayment.buildingNumber'), firstOrder.delivery_building_number],
        [t('checkoutPayment.landmark'), firstOrder.delivery_landmark],
      ] as Array<[string, string]>).filter(([, v]) => Boolean(v))
    : []
  let ctaLabel = t('checkoutPayment.confirmOrder')
  if (place.isPending) ctaLabel = t('checkoutPayment.creatingOrder')
  else if (paymentMethod === MOBILE_PAY_NOW) ctaLabel = t('checkoutPayment.payNow')

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={checkoutPage} keyboardShouldPersistTaps="handled">
        <CheckoutProgress current="payment" />
        <CheckoutHeading title={w('payment.title')} subtitle={w('payment.subtitle')} />
        {error ? <ErrorState message={error} /> : null}

        {/* One payment card with the numbered steps, as on the web */}
        <CheckoutCard>
          <CardHead title={t('checkoutPayment.paymentMethod')} meta={t('checkoutPayment.secureSelection')} />

          <Text style={styles.stepTitle}>{t('checkoutPayment.step1')}</Text>
          {TIMING_CHOICES.filter((choice) => methodsFor(choice.timing).length > 0).map((choice) => (
            <Choice key={choice.timing} styles={styles} colors={colors} icon={choice.timing === 'NOW' ? 'flash-outline' : 'cube-outline'} selected={timing === choice.timing} title={t(choice.title)} hint={t(choice.hint)} onPress={() => chooseTiming(choice.timing)} />
          ))}

          {timing && methodsFor(timing).length > 0 ? (
            <>
              <Text style={[styles.stepTitle, styles.stepGap]}>{timing === 'NOW' ? t('checkoutPayment.step2Now') : t('checkoutPayment.step2Delivery')}</Text>
              {methodsFor(timing).map((m) => {
                // Before a method is picked nothing is re-priced yet: fall back to the
                // base quote's own figure instead of claiming the method is free.
                const markup = priced.length ? sum((q) => methodMarkupFor(q, m.code)) : m.markup_amount ?? 0
                return (
                  <Choice
                    key={m.code}
                    styles={styles}
                    colors={colors}
                    icon={m.code === CASH_ON_DELIVERY ? 'cash-outline' : 'phone-portrait-outline'}
                    selected={paymentMethod === m.code}
                    title={METHOD_TITLE[m.code] ? t(METHOD_TITLE[m.code]) : methodLabel(m)}
                    hint={METHOD_HINT[m.code] ? t(METHOD_HINT[m.code]) : ''}
                    aside={markup > 0 ? `+ ${money(markup, currency)}` : t('checkoutPayment.noFee')}
                    onPress={() => { setPaymentMethod(m.code); setProvider(''); setError('') }}
                  />
                )
              })}
            </>
          ) : null}

          {needsProvider ? (
            <>
              <Text style={[styles.stepTitle, styles.stepGap]}>{t('checkoutPayment.step3')}</Text>
              {providers.length === 0 ? <SmallText>{t('checkoutPayment.noProvider')}</SmallText> : (
                <View style={styles.providers}>
                  {providers.map((prov) => (
                    <Pressable key={prov.code} onPress={() => setProvider(prov.code)} accessibilityRole="radio" accessibilityState={{ selected: provider === prov.code }} style={[styles.provider, provider === prov.code && styles.choiceSelected]}>
                      <View style={[styles.logo, provider === prov.code && styles.logoOn]}>
                        <Ionicons name="phone-portrait" size={16} color={provider === prov.code ? colors.onGreen : colors.green} />
                      </View>
                      <Text style={[styles.name, styles.flex]}>{prov.label}</Text>
                      <View style={[styles.radio, provider === prov.code && styles.radioOn]}>{provider === prov.code ? <View style={styles.radioDot} /> : null}</View>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          ) : null}

          {needsProvider && provider ? (
            <View style={styles.phoneBlock}>
              <Text style={styles.stepTitle}>{t('checkoutPayment.step4')}</Text>
              <Field
                label={needsPhoneNow ? t('checkoutPayment.phoneNowLabel') : t('checkoutPayment.phoneDeliveryLabel')}
                value={payerPhone}
                keyboardType="phone-pad"
                placeholder="+243 ..."
                accessibilityLabel={needsPhoneNow ? t('checkoutPayment.phoneNowLabel') : t('checkoutPayment.phoneDeliveryLabel')}
                accessibilityHint={t('payment.phoneHint')}
                textContentType="telephoneNumber"
                error={needsPhoneNow && payerPhone.length > 0 && !phoneReady ? t('checkoutPayment.phoneWarn') : undefined}
                onChangeText={setPayerPhone}
              />
              {needsPhoneNow ? <Text style={styles.muted}>{t('payment.currencyNote', { currency })}</Text> : null}
              {paymentMethod === MOBILE_AT_DELIVERY ? <SmallText>{t('checkoutPayment.mobileAtDeliveryNote')}</SmallText> : null}
            </View>
          ) : null}
        </CheckoutCard>

        {/* Products recap */}
        <CheckoutCard>
          <CardHead title={t('payment.orderSummary')} meta={`${totalItems} ${totalItems === 1 ? w('cart.item') : w('cart.items')}`} />
          {firstOrder?.order_number ? <Text style={styles.muted}>{t('payment.orderNumber', { number: firstOrder.order_number })}</Text> : null}
          {lines.map(({ line, shop, currency: lineCurrency }) => (
            <View key={line.id} style={styles.reviewLine}>
              <View style={styles.lineInfo}>
                <Text style={styles.name} numberOfLines={2}>{line.product_name}</Text>
                <Text style={styles.muted}>{[line.variant_name, w('payment.quantity', { count: line.quantity })].filter(Boolean).join(' · ')}</Text>
                <Text style={styles.muted}>{t('checkoutPayment.lineShopPrice', { shop: shop || '—', price: money(line.final_unit_price, lineCurrency) })}</Text>
              </View>
              <Text style={styles.linePrice}>{money(line.final_unit_price * line.quantity, lineCurrency)}</Text>
            </View>
          ))}
          {orderIds.length > 1 ? <SmallText>{t('checkoutPayment.coversOrders', { count: orderIds.length })}</SmallText> : null}
        </CheckoutCard>

        {/* Delivery recap */}
        {firstOrder ? (
          <CheckoutCard>
            <CardHead title={w('product.delivery')} meta={t('checkoutPayment.tbkDelivery')} />
            {deliveryRows.length ? (
              <View style={styles.addressBox}>
                {deliveryRows.map(([k, v]) => (
                  <View key={k} style={styles.totalRow}><Text style={styles.muted}>{k}</Text><Text style={styles.value}>{v}</Text></View>
                ))}
              </View>
            ) : null}
            <View style={styles.totalRow}><Text style={styles.muted}>{t('checkoutPayment.deliveryFee')}</Text><Text style={styles.value}>{money(priced.length ? sum((q) => q.delivery_fee) : Number(firstOrder.delivery_fee_final ?? 0), currency)}</Text></View>
          </CheckoutCard>
        ) : null}

        {/* Final summary (web .checkout-summary) */}
        <CheckoutCard>
          <Eyebrow>{w('payment.finalSummary')}</Eyebrow>
          {pricedReady ? (
            <>
              <View>
                <View style={styles.summaryLine}><Text style={styles.muted}>{w('cart.products')}</Text><Text style={styles.value}>{money(sum((q) => q.subtotal), currency)}</Text></View>
                {sum((q) => q.points_discount) > 0 ? <View style={styles.summaryLine}><Text style={styles.muted}>{w('payment.productPoints')}</Text><Text style={styles.discount}>−{money(sum((q) => q.points_discount), currency)}</Text></View> : null}
                <View style={styles.summaryLine}><Text style={styles.muted}>{w('product.delivery')}</Text><Text style={styles.value}>{money(sum((q) => q.delivery_fee), currency)}</Text></View>
                <View style={styles.summaryLine}><Text style={styles.muted}>{t('checkoutPayment.methodFee')}</Text><Text style={styles.value}>{money(sum(methodMarkup), currency)}</Text></View>
              </View>
              <View style={styles.total}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{t('checkoutPayment.finalTotal')}</Text>
                  <Text style={styles.totalValue}>{money(sum(methodTotal), currency)}</Text>
                </View>
                <SmallText>{t('checkoutPayment.serverTotal')}</SmallText>
              </View>
            </>
          ) : paymentMethod && pricedQuotes.some((q) => q.isError) ? (
            <ErrorState message={t('checkout.paymentFailed')} retry={() => pricedQuotes.forEach((q) => void q.refetch())} />
          ) : paymentMethod ? <Loading label={t('checkout.preparingPayment')} /> : null}
          <View>
            <View style={styles.summaryLine}><Text style={styles.muted}>{t('checkoutPayment.paymentTiming')}</Text><Text style={styles.value}>{timing === 'NOW' ? t('checkoutPayment.timingNow') : timing === 'DELIVERY' ? t('checkoutPayment.timingDelivery') : '—'}</Text></View>
            <View style={styles.summaryLine}><Text style={styles.muted}>{t('checkoutPayment.method')}</Text><Text style={styles.value}>{selectedMethod ? (METHOD_TITLE[selectedMethod.code] ? t(METHOD_TITLE[selectedMethod.code]) : methodLabel(selectedMethod)) : '—'}</Text></View>
            <View style={styles.summaryLine}><Text style={styles.muted}>{t('seller.paymentOperator')}</Text><Text style={styles.value}>{needsProvider ? (providers.find((item) => item.code === provider)?.label ?? '—') : t('checkoutPayment.notApplicable')}</Text></View>
          </View>
          <Text style={styles.payNote}>
            {!timing ? t('checkoutPayment.noteChooseTiming') : selectedMethod?.timing === 'NOW' ? t('checkoutPayment.noteNow') : t('checkoutPayment.noteDelivery')}
          </Text>
        </CheckoutCard>
        <Pressable accessibilityRole="link" onPress={() => router.push('/help' as never)} style={styles.helpLink}>
          <Ionicons name="help-circle-outline" size={19} color={colors.green} />
          <Text style={styles.helpText}>{t('payment.getHelp')}</Text>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={openOrder} style={styles.helpLink}>
          <Ionicons name="receipt-outline" size={19} color={colors.green} />
          <Text style={styles.helpText}>{t('checkout.viewOrder')}</Text>
        </Pressable>
      </ScrollView>

      {/* Fixed pay bar: amount due + secure CTA (reference "Paiement Mobile Money") */}
      <View style={[styles.payBar, { paddingBottom: Math.max(insets.bottom, 12) + 2 }]}>
        <View style={styles.payBarRow}>
          <Text style={styles.payBarLabel}>{t('checkoutSuccess.toPay')}</Text>
          <Text style={styles.payBarValue}>{pricedReady ? money(sum(methodTotal), currency) : '—'}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !readyToPlace || !pricedReady || place.isPending }}
          disabled={!readyToPlace || !pricedReady || place.isPending}
          onPress={() => { setError(''); place.mutate() }}
          style={({ pressed }) => [styles.payBtn, (!readyToPlace || !pricedReady || place.isPending) && styles.payBtnDisabled, pressed && styles.pressed]}
        >
          <Ionicons name="lock-closed" size={16} color={colors.onGreen} />
          <Text style={styles.payBtnText} numberOfLines={1}>{place.isPending ? t('common.oneMoment') : ctaLabel}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

function Choice({ styles, colors, icon, selected, title, hint, aside, onPress }: { styles: ReturnType<typeof makeStyles>; colors: Colors; icon: keyof typeof Ionicons.glyphMap; selected: boolean; title: string; hint?: string; aside?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <View style={[styles.logo, selected && styles.logoOn]}>
        <Ionicons name={icon} size={17} color={selected ? colors.onGreen : colors.green} />
      </View>
      <View style={styles.lineInfo}>
        <Text style={styles.name}>{title}</Text>
        {hint ? <Text style={styles.muted}>{hint}</Text> : null}
        {aside ? <Text style={styles.markup}>{aside}</Text> : null}
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
    </Pressable>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.88 },
  stepTitle: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  stepGap: { marginTop: 6 },
  lineInfo: { flex: 1, gap: 3 },
  name: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  muted: { color: colors.muted, fontSize: 12.5, lineHeight: 17, flexShrink: 1 },
  markup: { color: colors.green, fontWeight: '700', fontSize: 12.5, marginTop: 2 },
  warn: { color: colors.warning, fontSize: 13 },
  linePrice: { color: colors.green, fontWeight: '800', fontSize: 14 },
  reviewLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  value: { color: colors.ink, fontWeight: '700', fontSize: 13, flexShrink: 1, textAlign: 'right' },
  discount: { color: colors.success, fontWeight: '700', fontSize: 13 },
  addressBox: { gap: 6, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  total: { gap: 4, paddingTop: 12 },
  totalLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  totalValue: { color: colors.ink, fontSize: 22, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3 },
  payNote: { color: colors.muted, fontSize: 12.5, lineHeight: 18, padding: 12, borderRadius: 12, backgroundColor: colors.greenSoft },
  helpLink: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  helpText: { color: colors.green, fontSize: 14, fontWeight: '700' },
  providers: { gap: 10 },
  provider: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  phoneBlock: { gap: 8, marginTop: 6, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  // web .delivery-option + selected ring
  choice: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  choiceSelected: { borderColor: colors.green, borderWidth: 1.5 },
  logo: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  logoOn: { backgroundColor: colors.green },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderControl, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.green, backgroundColor: colors.green },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.onGreen },
  payBtn: { minHeight: 52, borderRadius: 14, backgroundColor: colors.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: spacing.lg, ...shadow.raised },
  payBtnDisabled: { opacity: 0.5 },
  payBar: { backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 14, gap: 10 },
  payBarRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  payBarLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  payBarValue: { color: colors.ink, fontSize: 20, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3 },
  payBtnText: { color: colors.onGreen, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  // kept for the post-payment status view above
  page: { padding: spacing.md, gap: 12, paddingBottom: spacing.xl },
  blockTitle: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  lineRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  errorText: { color: colors.danger, fontWeight: '700' },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: spacing.sm },
  cashDue: { color: colors.ink, fontSize: 32, fontFamily: fonts.display, fontWeight: '700' },
})
