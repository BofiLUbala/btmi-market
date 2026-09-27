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
import { radius, spacing, type Colors, fonts } from '../../src/theme'
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
const TIMING_CHOICES: Array<{ timing: Timing; title: string; hint: string }> = [
  { timing: 'NOW', title: 'Payer maintenant', hint: 'Paiement mobile immédiat, confirmé par l’opérateur avant la livraison.' },
  { timing: 'DELIVERY', title: 'Payer à la livraison', hint: 'Rien n’est prélevé maintenant. Le montant est dû à la remise de la commande.' },
]
const METHOD_HINT: Record<string, string> = {
  CASH_ON_DELIVERY: 'Espèces remises au Livreur, qui confirme la réception sur place.',
  MOBILE_AT_DELIVERY: 'Paiement mobile effectué à la remise, confirmé par l’opérateur.',
  MOBILE_PAY_NOW: 'Paiement mobile immédiat. Aucun paiement ne sera demandé à la livraison.',
}
const METHOD_TITLE: Record<string, string> = {
  CASH_ON_DELIVERY: 'Espèces',
  MOBILE_AT_DELIVERY: 'Paiement mobile à la livraison',
  MOBILE_PAY_NOW: 'Paiement mobile',
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

  const w = (key: string, vars?: Record<string, string | number>) => t(`web.${key}` as TranslationKey, vars)
  const totalItems = lines.reduce((sum, item) => sum + item.line.quantity, 0)
  const selectedMethod = enabledMethods.find((m) => m.code === paymentMethod)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const firstOrder = orders[0]?.data?.order as any
  const deliveryRows: Array<[string, string]> = firstOrder
    ? ([
        ['Province', firstOrder.delivery_province], ['Ville', firstOrder.delivery_city], ['Commune', firstOrder.delivery_commune],
        ['Adresse', firstOrder.delivery_street || firstOrder.delivery_address], ['Numéro', firstOrder.delivery_building_number],
        ['Point de repère', firstOrder.delivery_landmark],
      ] as Array<[string, string]>).filter(([, v]) => Boolean(v))
    : []
  let ctaLabel = 'Confirmer la commande'
  if (place.isPending) ctaLabel = 'Création de la commande...'
  else if (paymentMethod === MOBILE_PAY_NOW) ctaLabel = 'Payer maintenant'

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={checkoutPage} keyboardShouldPersistTaps="handled">
        <CheckoutProgress current="payment" />
        <CheckoutHeading title={w('payment.title')} subtitle={w('payment.subtitle')} />
        {error ? <ErrorState message={error} /> : null}

        {/* One payment card with the numbered steps, as on the web */}
        <CheckoutCard>
          <CardHead title="Mode de paiement" meta="Sélection sécurisée" />

          <Text style={styles.stepTitle}>1. Quand souhaitez-vous payer ?</Text>
          {TIMING_CHOICES.filter((choice) => methodsFor(choice.timing).length > 0).map((choice) => (
            <Choice key={choice.timing} styles={styles} selected={timing === choice.timing} title={choice.title} hint={choice.hint} onPress={() => chooseTiming(choice.timing)} />
          ))}

          {timing && methodsFor(timing).length > 0 ? (
            <>
              <Text style={[styles.stepTitle, styles.stepGap]}>2. {timing === 'NOW' ? 'Paiement mobile immédiat' : 'Comment payer à la livraison ?'}</Text>
              {methodsFor(timing).map((m) => {
                // Before a method is picked nothing is re-priced yet: fall back to the
                // base quote's own figure instead of claiming the method is free.
                const markup = priced.length ? sum((q) => methodMarkupFor(q, m.code)) : m.markup_amount ?? 0
                return (
                  <Choice
                    key={m.code}
                    styles={styles}
                    selected={paymentMethod === m.code}
                    title={METHOD_TITLE[m.code] ?? methodLabel(m)}
                    hint={METHOD_HINT[m.code] ?? ''}
                    aside={markup > 0 ? `+ ${money(markup, currency)}` : 'Sans frais'}
                    onPress={() => { setPaymentMethod(m.code); setProvider(''); setError('') }}
                  />
                )
              })}
            </>
          ) : null}

          {needsProvider ? (
            <>
              <Text style={[styles.stepTitle, styles.stepGap]}>3. Choisissez votre opérateur Mobile Money</Text>
              {providers.length === 0 ? <SmallText>Aucun opérateur mobile n’est disponible actuellement.</SmallText> : (
                <View style={styles.providers}>
                  {providers.map((prov) => (
                    <Pressable key={prov.code} onPress={() => setProvider(prov.code)} accessibilityRole="radio" accessibilityState={{ selected: provider === prov.code }} style={[styles.provider, provider === prov.code && styles.choiceSelected]}>
                      <Text style={styles.name}>{prov.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          ) : null}

          {needsProvider && provider ? (
            <View style={styles.phoneBlock}>
              <Text style={styles.stepTitle}>4. Numéro de téléphone Mobile Money</Text>
              <Field
                label={needsPhoneNow ? 'Entrez le numéro qui recevra la demande de paiement :' : 'Numéro pour la livraison (optionnel) :'}
                value={payerPhone}
                keyboardType="phone-pad"
                placeholder="+243 ..."
                onChangeText={setPayerPhone}
              />
              {needsPhoneNow && !phoneReady ? <Text style={styles.warn}>Entrez le numéro Mobile Money qui sera débité (min. 9 chiffres).</Text> : null}
              {paymentMethod === MOBILE_AT_DELIVERY ? <SmallText>Rien n’est prélevé maintenant. Le Livreur sera présent lors du paiement à la livraison.</SmallText> : null}
            </View>
          ) : null}
        </CheckoutCard>

        {/* Products recap */}
        <CheckoutCard>
          <CardHead title={w('cart.products')} meta={`${totalItems} ${totalItems === 1 ? w('cart.item') : w('cart.items')}`} />
          {lines.map(({ line, shop, currency: lineCurrency }) => (
            <View key={line.id} style={styles.reviewLine}>
              <View style={styles.lineInfo}>
                <Text style={styles.name} numberOfLines={2}>{line.product_name}</Text>
                <Text style={styles.muted}>{[line.variant_name, w('payment.quantity', { count: line.quantity })].filter(Boolean).join(' · ')}</Text>
                <Text style={styles.muted}>Boutique : {shop || '—'} · Prix unitaire : {money(line.final_unit_price, lineCurrency)}</Text>
              </View>
              <Text style={styles.linePrice}>{money(line.final_unit_price * line.quantity, lineCurrency)}</Text>
            </View>
          ))}
          {orderIds.length > 1 ? <SmallText>Ce paiement couvre {orderIds.length} commandes boutiques distinctes.</SmallText> : null}
        </CheckoutCard>

        {/* Delivery recap */}
        {firstOrder ? (
          <CheckoutCard>
            <CardHead title={w('product.delivery')} meta="Livraison TBK" />
            {deliveryRows.length ? (
              <View style={styles.addressBox}>
                {deliveryRows.map(([k, v]) => (
                  <View key={k} style={styles.totalRow}><Text style={styles.muted}>{k}</Text><Text style={styles.value}>{v}</Text></View>
                ))}
              </View>
            ) : null}
            <View style={styles.totalRow}><Text style={styles.muted}>Frais de livraison</Text><Text style={styles.value}>{money(priced.length ? sum((q) => q.delivery_fee) : Number(firstOrder.delivery_fee_final ?? 0), currency)}</Text></View>
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
                <View style={styles.summaryLine}><Text style={styles.muted}>Frais du mode de paiement</Text><Text style={styles.value}>{money(sum(methodMarkup), currency)}</Text></View>
              </View>
              <View style={styles.total}>
                <Text style={styles.totalLabel}>TOTAL FINAL</Text>
                <Text style={styles.totalValue}>{money(sum(methodTotal), currency)}</Text>
                <SmallText>Montant total calculé par le serveur</SmallText>
              </View>
            </>
          ) : paymentMethod && pricedQuotes.some((q) => q.isError) ? (
            <ErrorState message={t('checkout.paymentFailed')} retry={() => pricedQuotes.forEach((q) => void q.refetch())} />
          ) : paymentMethod ? <Loading label={t('checkout.preparingPayment')} /> : null}
          <View>
            <View style={styles.summaryLine}><Text style={styles.muted}>Moment du paiement</Text><Text style={styles.value}>{timing === 'NOW' ? 'Immédiat' : timing === 'DELIVERY' ? 'À la livraison' : '—'}</Text></View>
            <View style={styles.summaryLine}><Text style={styles.muted}>Mode</Text><Text style={styles.value}>{selectedMethod ? (METHOD_TITLE[selectedMethod.code] ?? methodLabel(selectedMethod)) : '—'}</Text></View>
            <View style={styles.summaryLine}><Text style={styles.muted}>Opérateur</Text><Text style={styles.value}>{needsProvider ? (providers.find((item) => item.code === provider)?.label ?? '—') : 'Sans objet'}</Text></View>
          </View>
          <Text style={styles.payNote}>
            {!timing ? 'Choisissez d’abord quand vous souhaitez payer.' : selectedMethod?.timing === 'NOW' ? 'Vous validerez la demande sur votre téléphone. La commande est confirmée dès validation.' : 'Aucun montant n’est prélevé maintenant. Le total est dû à la livraison.'}
          </Text>
          <Button
            variant="gold"
            title={ctaLabel}
            loading={place.isPending}
            disabled={!readyToPlace || !pricedReady}
            onPress={() => { setError(''); place.mutate() }}
          />
        </CheckoutCard>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Choice({ styles, selected, title, hint, aside, onPress }: { styles: ReturnType<typeof makeStyles>; selected: boolean; title: string; hint?: string; aside?: string; onPress: () => void }) {
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
        {aside ? <Text style={styles.markup}>{aside}</Text> : null}
      </View>
    </Pressable>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1 },
  stepTitle: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  stepGap: { marginTop: 8 },
  lineInfo: { flex: 1, gap: 3 },
  name: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  muted: { color: colors.muted, fontSize: 14, flexShrink: 1 },
  markup: { color: colors.ink, fontWeight: '700', fontSize: 14, marginTop: 4 },
  warn: { color: colors.warning, fontSize: 14 },
  linePrice: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  reviewLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  value: { color: colors.ink, fontWeight: '700', fontSize: 14, flexShrink: 1, textAlign: 'right' },
  discount: { color: colors.success, fontWeight: '700', fontSize: 14 },
  addressBox: { gap: 6, padding: 12, borderRadius: 12, backgroundColor: colors.surface2 },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, borderStyle: 'dashed' },
  total: { gap: 5, paddingTop: 14, borderTopWidth: 2, borderTopColor: colors.green },
  totalLabel: { color: colors.ink, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  totalValue: { color: colors.ink, fontSize: 30, fontWeight: '700' },
  payNote: { color: colors.muted, fontSize: 14, lineHeight: 20, padding: 12, borderRadius: 12, backgroundColor: colors.surface2 },
  providers: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  provider: { flexBasis: '46%', flexGrow: 1, alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  phoneBlock: { gap: 8, marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  // web .delivery-option + selected ring
  choice: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  choiceSelected: { borderColor: colors.green, borderWidth: 1.5 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, marginTop: 1 },
  radioOn: { borderWidth: 6, borderColor: colors.green },
  // kept for the post-payment status view above
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  blockTitle: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  lineRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  errorText: { color: colors.danger, fontWeight: '700' },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: spacing.sm },
  cashDue: { color: colors.ink, fontSize: 32, fontFamily: fonts.display, fontWeight: '500' },
})
