import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router, useLocalSearchParams } from 'expo-router'
import { useQueries, useQuery } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { Button, ErrorState, Loading } from '../../src/components/ui'
import { CheckoutProgress } from '../../src/components/CheckoutProgress'
import { CardHead, CheckoutCard, Eyebrow, SmallText, checkoutPage } from '../../src/components/CheckoutUI'
import { useColors } from '../../src/store/theme'
import { useI18n } from '../../src/store/i18n'
import { formatMoney } from '../../src/lib/money'
import { fonts, type Colors } from '../../src/theme'

const PROVIDER_NAMES: Record<string, string> = { MPESA: 'M-Pesa', AIRTEL_MONEY: 'Airtel Money', ORANGE_MONEY: 'Orange Money' }

/**
 * Step 4 of checkout — the native twin of
 * web-app/src/pages/checkout/OrderSuccessPage.tsx (same cards, same wording).
 */
export default function OrderSuccessScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useI18n()
  const { orderId, orderIds: idsParam } = useLocalSearchParams<{ orderId?: string; orderIds?: string }>()
  const orderIds = (idsParam || orderId || '').split(',').filter(Boolean)

  const payment = useQuery({ queryKey: ['buyer', 'payment', orderId], queryFn: () => buyerApi.getPayment(orderId!), enabled: Boolean(orderId) })
  const orders = useQueries({ queries: orderIds.map((id) => ({ queryKey: ['buyer', 'order', id], queryFn: () => buyerApi.order(id) })) })

  if (!orderId) return <ErrorState message={t('checkoutSuccess.notFound')} retry={() => router.replace('/(buyer)/cart')} />
  if (orders.some((q) => q.isLoading)) return <Loading label={t('checkoutSuccess.confirming')} />
  const details = orders.map((q) => q.data).filter((d): d is NonNullable<typeof d> => Boolean(d))
  const order = details.find((d) => d.order.id === orderId) ?? details[0]
  if (!order) return <ErrorState message={t('checkoutSuccess.notFound')} retry={() => orders.forEach((q) => void q.refetch())} />

  const p = payment.data
  const isMultiShop = details.length > 1
  const currency = p?.currency || order.order.currency || 'USD'
  const finalTotal = isMultiShop
    ? details.reduce((sum, d) => sum + d.order.final_total + (d.order.delivery_fee_final ?? 0), 0)
    : (p?.final_total ?? order.order.final_total + (order.order.delivery_fee_final ?? 0))
  const providerName = p?.provider ? PROVIDER_NAMES[p.provider] || p.provider : ''
  const isPaid = p ? ['PAID', 'VERIFIED'].includes(p.status) : false
  const isCash = p?.payment_method === 'CASH_ON_DELIVERY'
  const isMobileDelivery = p?.payment_method === 'MOBILE_AT_DELIVERY'

  let headline = t('checkoutSuccess.headline')
  let subtext = t('checkoutSuccess.subtext')
  if (p?.payment_method === 'MOBILE_PAY_NOW' && isPaid) {
    headline = t('checkoutSuccess.headlinePaid')
    subtext = t('checkoutSuccess.subtextPaid', { provider: providerName || 'Mobile Money' })
  } else if (isCash) {
    headline = t('checkoutSuccess.headlineCash')
    subtext = t('checkoutSuccess.subtextCash')
  } else if (isMobileDelivery) {
    headline = t('checkoutSuccess.headlineMobileDelivery')
    subtext = t('checkoutSuccess.subtextMobileDelivery', { provider: providerName || 'Mobile Money' })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = order.order as any
  const deliveryAddress = [o.delivery_building_number, o.delivery_street, o.delivery_commune, o.delivery_city, o.delivery_province].filter(Boolean).join(', ') || o.delivery_address || ''
  const money = (v: number) => formatMoney(v, currency)
  const sum = (pick: (d: typeof details[number]) => number) => details.reduce((acc, d) => acc + pick(d), 0)

  return (
    <ScrollView contentContainerStyle={checkoutPage}>
      <CheckoutProgress current="order" />

      <CheckoutCard style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.mark}><Ionicons name={isPaid || isCash || isMobileDelivery ? 'checkmark' : 'information'} size={28} color={colors.onGold} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>{headline}</Text>
            <Text style={styles.sub}>{subtext}</Text>
          </View>
        </View>
      </CheckoutCard>

      <CheckoutCard>
        <CardHead
          title={isMultiShop ? t('checkoutSuccess.groupTitle') : t('checkoutSuccess.orderNumber', { number: order.order.order_number || order.order.id.slice(0, 8) })}
          meta={isMultiShop ? t('checkoutSuccess.shopOrdersCount', { count: details.length }) : order.shop_name || t('orders.shop')}
        />
        {details.map((d) => (
          <View key={d.order.id} style={styles.orderBlock}>
            <View style={styles.rowBetween}>
              <Text style={styles.bold}>{t('checkoutSuccess.orderFromShop', { number: d.order.order_number || d.order.id.slice(0, 8), shop: d.shop_name || t('orders.shop') })}</Text>
              <Text style={styles.muted}>{money(isMultiShop ? d.order.final_total + (d.order.delivery_fee_final ?? 0) : finalTotal)}</Text>
            </View>
            {d.lines.map((line) => (
              <View key={line.id} style={styles.reviewLine}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.bold}>{line.product_name}</Text>
                  <Text style={styles.muted}>{t('checkoutSuccess.variantQty', { variant: line.variant_name || t('checkoutSuccess.standard'), count: line.quantity })}</Text>
                  <Text style={styles.muted}>{t('checkoutSuccess.unitPrice', { price: money(line.final_unit_price || line.unit_price || 0) })}</Text>
                </View>
                <Text style={styles.bold}>{money((line.final_unit_price || line.unit_price || 0) * line.quantity)}</Text>
              </View>
            ))}
          </View>
        ))}
      </CheckoutCard>

      <CheckoutCard>
        <CardHead title={t('checkoutSuccess.deliveryAddress')} meta={o.delivery_method === 'PICKUP' ? t('checkoutSuccess.pickup') : t('checkoutSuccess.homeDelivery')} />
        {deliveryAddress ? (
          <Text style={styles.address}><Ionicons name="location-outline" size={15} color={colors.muted} /> {deliveryAddress}</Text>
        ) : <SmallText>{t('checkoutSuccess.deliveryModeNote')}</SmallText>}
      </CheckoutCard>

      <CheckoutCard>
        <Eyebrow>{t('checkoutSuccess.finalSummary')}</Eyebrow>
        <View>
          <View style={styles.summaryLine}><Text style={styles.muted}>{t('orders.productsSubtotal')}</Text><Text style={styles.value}>{money(sum((d) => d.order.base_total ?? d.order.final_total))}</Text></View>
          {sum((d) => d.order.points_discount_amount ?? 0) > 0 ? <View style={styles.summaryLine}><Text style={styles.muted}>{t('web.cart.pointsDiscount')}</Text><Text style={[styles.value, { color: colors.success }]}>−{money(sum((d) => d.order.points_discount_amount ?? 0))}</Text></View> : null}
          <View style={styles.summaryLine}><Text style={styles.muted}>{t('checkoutPayment.deliveryFee')}</Text><Text style={styles.value}>{money(sum((d) => d.order.delivery_fee_final ?? 0))}</Text></View>
          {p?.payment_markup ? <View style={styles.summaryLine}><Text style={styles.muted}>{t('checkoutSuccess.paymentFee')}</Text><Text style={styles.value}>{money(p.payment_markup)}</Text></View> : null}
        </View>
        <View style={styles.total}>
          <Text style={styles.totalLabel}>{t('checkoutSuccess.grandTotal')}</Text>
          <Text style={styles.totalValue}>{money(finalTotal)}</Text>
          <SmallText>{t('checkoutSuccess.paymentRecorded')}</SmallText>
        </View>
        <View>
          <View style={styles.summaryLine}><Text style={styles.muted}>{t('checkoutPayment.method')}</Text><Text style={styles.value}>{isCash ? t('checkoutSuccess.modeCash') : isMobileDelivery ? t('checkoutSuccess.modeMobileDelivery') : t('checkoutPayment.methodMobileNow')}</Text></View>
          {providerName ? <View style={styles.summaryLine}><Text style={styles.muted}>{t('seller.paymentOperator')}</Text><Text style={styles.value}>{providerName}</Text></View> : null}
          <View style={styles.summaryLine}><Text style={styles.muted}>{t('common.status')}</Text><Text style={[styles.value, isPaid && { color: colors.success }]}>{isPaid ? t('orders.paymentPaid') : t('checkoutSuccess.toPay')}</Text></View>
        </View>
        <Button variant="gold" title={t('checkoutSuccess.trackDelivery')} onPress={() => router.replace({ pathname: '/orders/[id]', params: { id: orderId } })} />
        <Button variant="outline" title={t('profile.myOrders')} onPress={() => router.replace('/orders')} />
      </CheckoutCard>
    </ScrollView>
  )
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    statusCard: { paddingVertical: 28, paddingHorizontal: 24 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    mark: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.gold, alignItems: 'center', justifyContent: 'center' },
    h1: { color: c.ink, fontFamily: fonts.display, fontWeight: '500', fontSize: 22 },
    sub: { color: c.muted, fontSize: 15, marginTop: 4 },
    orderBlock: { gap: 4 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
    bold: { color: c.ink, fontWeight: '700', fontSize: 15, flexShrink: 1 },
    muted: { color: c.muted, fontSize: 14 },
    reviewLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    address: { color: c.ink, fontSize: 15, lineHeight: 22 },
    summaryLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border, borderStyle: 'dashed' },
    value: { color: c.ink, fontWeight: '700', fontSize: 14, flexShrink: 1, textAlign: 'right' },
    total: { gap: 5, paddingTop: 14, borderTopWidth: 2, borderTopColor: c.green },
    totalLabel: { color: c.ink, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
    totalValue: { color: c.ink, fontSize: 30, fontWeight: '700' },
  })
