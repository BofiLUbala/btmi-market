import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useQueries, useQuery } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { resolveMediaUrl } from '../../src/api/client'
import { Button, ErrorState, Loading } from '../../src/components/ui'
import { CheckoutProgress } from '../../src/components/CheckoutProgress'
import { CardHead, CheckoutCard, Eyebrow, SmallText } from '../../src/components/CheckoutUI'
import { useColors } from '../../src/store/theme'
import { useI18n } from '../../src/store/i18n'
import { formatMoney } from '../../src/lib/money'
import { fonts, radius, shadow, spacing, type Colors } from '../../src/theme'

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
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <View style={styles.progressChip}><CheckoutProgress current="order" /></View>
        <View style={styles.mark}><Ionicons name={isPaid || isCash || isMobileDelivery ? 'checkmark' : 'information'} size={34} color={colors.green} /></View>
        <Text style={styles.h1}>{headline}</Text>
        <Text style={styles.sub}>{subtext}</Text>
      </View>

      <View style={styles.body}>
      <CheckoutCard style={styles.overlap}>
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
                <View style={styles.thumb}>{line.image_url ? <Image source={resolveMediaUrl(line.image_url)} style={styles.thumbImg} contentFit="cover" /> : <Ionicons name="bag-handle-outline" size={20} color={colors.green} />}</View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.bold}>{line.product_name}</Text>
                  <Text style={styles.muted}>{t('checkoutSuccess.variantQty', { variant: line.variant_name || t('checkoutSuccess.standard'), count: line.quantity })}</Text>
                  <Text style={styles.muted}>{t('checkoutSuccess.unitPrice', { price: money(line.final_unit_price || line.unit_price || 0) })}</Text>
                </View>
                <Text style={styles.price}>{money((line.final_unit_price || line.unit_price || 0) * line.quantity)}</Text>
              </View>
            ))}
          </View>
        ))}
      </CheckoutCard>

      <CheckoutCard>
        <CardHead title={t('checkoutSuccess.deliveryAddress')} meta={o.delivery_method === 'PICKUP' ? t('checkoutSuccess.pickup') : t('checkoutSuccess.homeDelivery')} />
        <View style={styles.iconRow}>
          <View style={styles.iconTile}><Ionicons name="location" size={18} color={colors.green} /></View>
          <View style={{ flex: 1 }}>
            {deliveryAddress ? (
              <Text style={styles.address}>{deliveryAddress}</Text>
            ) : <SmallText>{t('checkoutSuccess.deliveryModeNote')}</SmallText>}
          </View>
        </View>
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
          <View style={styles.rowBetween}>
            <Text style={styles.totalLabel}>{t('checkoutSuccess.grandTotal')}</Text>
            <Text style={styles.totalValue}>{money(finalTotal)}</Text>
          </View>
          <SmallText>{t('checkoutSuccess.paymentRecorded')}</SmallText>
        </View>
        <View>
          <View style={styles.summaryLine}><Text style={styles.muted}>{t('checkoutPayment.method')}</Text><Text style={styles.value}>{isCash ? t('checkoutSuccess.modeCash') : isMobileDelivery ? t('checkoutSuccess.modeMobileDelivery') : t('checkoutPayment.methodMobileNow')}</Text></View>
          {providerName ? <View style={styles.summaryLine}><Text style={styles.muted}>{t('seller.paymentOperator')}</Text><Text style={styles.value}>{providerName}</Text></View> : null}
          <View style={styles.summaryLine}><Text style={styles.muted}>{t('common.status')}</Text><Text style={[styles.value, isPaid && { color: colors.success }]}>{isPaid ? t('orders.paymentPaid') : t('checkoutSuccess.toPay')}</Text></View>
        </View>
        <Button title={t('checkoutSuccess.trackDelivery')} onPress={() => router.replace({ pathname: '/orders/[id]', params: { id: orderId } })} />
        <Button variant="outline" title={t('web.cart.continueShopping')} onPress={() => router.replace('/')} />
        <Button variant="outline" title={t('profile.myOrders')} onPress={() => router.replace('/orders')} />
      </CheckoutCard>
      </View>
    </ScrollView>
  )
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    page: { paddingBottom: spacing.xl },
    hero: { backgroundColor: c.green, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 56, alignItems: 'center', gap: 10, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
    progressChip: { alignSelf: 'stretch', backgroundColor: c.white, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
    mark: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center', marginBottom: 4, ...shadow.card },
    h1: { color: c.onGreen, fontFamily: fonts.display, fontWeight: '700', fontSize: 22, letterSpacing: -0.3, textAlign: 'center' },
    sub: { color: c.onGreen, opacity: 0.82, fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
    body: { paddingHorizontal: spacing.md, gap: 14 },
    overlap: { marginTop: -36 },
    orderBlock: { gap: 4 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
    bold: { color: c.ink, fontWeight: '700', fontSize: 14, flexShrink: 1 },
    price: { color: c.green, fontWeight: '800', fontSize: 14 },
    muted: { color: c.muted, fontSize: 12.5 },
    reviewLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    thumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    thumbImg: { width: '100%', height: '100%' },
    iconRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconTile: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
    address: { color: c.ink, fontSize: 14, fontWeight: '600', lineHeight: 20 },
    summaryLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.border },
    value: { color: c.ink, fontWeight: '700', fontSize: 13, flexShrink: 1, textAlign: 'right' },
    total: { gap: 4, paddingTop: 12 },
    totalLabel: { color: c.muted, fontSize: 13, fontWeight: '600' },
    totalValue: { color: c.green, fontSize: 22, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3 },
  })
