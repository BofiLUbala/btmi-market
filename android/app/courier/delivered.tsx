import { useMemo, useState } from 'react'
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useQuery } from '@tanstack/react-query'
import { courierApi } from '../../src/api'
import { Card, ErrorState, Loading } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { dateLocale } from '../../src/lib/format'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'
import { formatMoney } from '../../src/lib/money'
import { cashLabel, kinshasaToday, shiftDay } from '../../src/lib/courier'
import type { CourierDeliveredProduct } from '../../src/types'

/**
 * "Produits livrés": the cash the courier took at the door on a chosen day
 * (GET /courier/earnings) and every product they delivered, that day or all
 * days (GET /courier/delivered-products).
 */
export default function CourierDeliveredScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t, lang } = useI18n()
  const [day, setDay] = useState(kinshasaToday)
  const [allDays, setAllDays] = useState(false)
  const today = kinshasaToday()
  const locale = dateLocale(lang)

  const earnings = useQuery({ queryKey: ['courier', 'earnings', day], queryFn: () => courierApi.earnings(day) })
  const products = useQuery({
    queryKey: ['courier', 'delivered', allDays ? 'all' : day],
    queryFn: () => courierApi.deliveredProducts(allDays ? undefined : day),
  })

  const orders = useMemo(() => {
    const byOrder = new Map<string, CourierDeliveredProduct[]>()
    for (const it of products.data ?? []) byOrder.set(it.order_id, [...(byOrder.get(it.order_id) ?? []), it])
    return [...byOrder.values()]
  }, [products.data])

  if (earnings.isLoading && products.isLoading) return <Loading label={t('common.loading')} />
  if (earnings.isError && products.isError) {
    return <ErrorState message={t('courier.delivered.failed')} retry={() => { void earnings.refetch(); void products.refetch() }} />
  }

  const dayText = new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long' })
  const e = earnings.data

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={earnings.isRefetching || products.isRefetching} onRefresh={() => { void earnings.refetch(); void products.refetch() }} />}
    >
      <View style={styles.dayBar}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('courier.delivered.previousDay')} hitSlop={8} style={styles.dayArrow} onPress={() => setDay((d) => shiftDay(d, -1))}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.dayText}>{day === today ? t('courier.delivered.cashToday') : dayText}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('courier.delivered.nextDay')}
          hitSlop={8}
          disabled={day >= today}
          style={[styles.dayArrow, day >= today && styles.disabled]}
          onPress={() => setDay((d) => shiftDay(d, 1))}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <Card>
        <Text style={styles.muted}>{day === today ? t('courier.delivered.cashToday') : t('courier.delivered.cashOn', { date: dayText })}</Text>
        <Text style={styles.cash}>{cashLabel(e)}</Text>
        <Text style={styles.muted}>{t('courier.delivered.cashHint', { count: e?.cash_orders ?? 0 })}</Text>
        <View style={styles.figures}>
          <View style={styles.figure}>
            <Text style={styles.figureValue}>{e?.orders_delivered ?? 0}</Text>
            <Text style={styles.muted}>{t('courier.delivered.orders')}</Text>
          </View>
          <View style={styles.figure}>
            <Text style={styles.figureValue}>{e?.items_delivered ?? 0}</Text>
            <Text style={styles.muted}>{t('courier.delivered.items')}</Text>
          </View>
        </View>
      </Card>

      <View style={styles.rowBetween}>
        <Text style={styles.section}>{t('courier.delivered.title')} · {(products.data ?? []).length}</Text>
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: allDays }} onPress={() => setAllDays((v) => !v)} style={styles.toggle} hitSlop={6}>
          <Ionicons name={allDays ? 'checkbox' : 'square-outline'} size={20} color={colors.ink} />
          <Text style={styles.toggleText}>{t('courier.delivered.allDays')}</Text>
        </Pressable>
      </View>

      {products.isError ? <Text style={styles.error}>{t('courier.delivered.failed')}</Text> : null}
      {!products.isLoading && orders.length === 0 ? <Card><Text style={styles.muted}>{t('courier.delivered.empty')}</Text></Card> : null}

      {orders.map((lines) => {
        const head = lines[0]
        const total = lines.reduce((sum, l) => sum + l.line_total, 0)
        return (
          <Card key={head.order_id}>
            <View style={styles.rowBetween}>
              <Text style={styles.title}>#{head.order_number}</Text>
              <Text style={styles.total}>{formatMoney(total, head.currency)}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={[styles.muted, styles.shrink]} numberOfLines={1}>
                {head.shop_name} · {new Date(head.delivered_at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}
              </Text>
              <Text style={head.cash_collected ? styles.cashTag : styles.muted}>
                {head.cash_collected ? t('courier.delivered.cashCollected') : head.payment_method === 'CASH_ON_DELIVERY' ? t('courier.delivered.cash') : t('courier.delivered.paidOnline')}
              </Text>
            </View>
            {lines.map((l, i) => (
              <View key={`${l.order_id}-${i}`} style={styles.line}>
                {l.image_url ? <Image source={{ uri: l.image_url }} style={styles.thumb} /> : <View style={styles.thumb} />}
                <View style={styles.shrink}>
                  <Text style={styles.product} numberOfLines={1}>{l.product_name}</Text>
                  {l.variant_name ? <Text style={styles.muted} numberOfLines={1}>{l.variant_name}</Text> : null}
                </View>
                <Text style={styles.muted}>× {l.quantity}</Text>
                <Text style={styles.product}>{formatMoney(l.line_total, l.currency)}</Text>
              </View>
            ))}
          </Card>
        )
      })}
    </ScrollView>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  dayBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  dayArrow: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', backgroundColor: c.white },
  disabled: { opacity: 0.35 },
  dayText: { color: c.ink, fontWeight: '800', fontSize: 16, flexShrink: 1, textAlign: 'center' },
  cash: { color: c.ink, fontWeight: '900', fontSize: 30, marginVertical: 4 },
  figures: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  figure: { flex: 1, padding: spacing.sm, borderRadius: 12, borderWidth: 1, borderColor: c.border },
  figureValue: { color: c.ink, fontWeight: '900', fontSize: 22 },
  section: { color: c.ink, fontWeight: '800', fontSize: 17, flexShrink: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  toggleText: { color: c.ink, fontWeight: '600' },
  title: { color: c.ink, fontWeight: '900', fontSize: 17 },
  total: { color: c.ink, fontWeight: '800' },
  cashTag: { color: c.green, fontWeight: '800' },
  muted: { color: c.muted },
  error: { color: c.danger, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  shrink: { flex: 1, minWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: c.border },
  product: { color: c.ink, fontWeight: '700' },
})
