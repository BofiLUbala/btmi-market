import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { courierApi } from '../../../src/api'
import { CourierHeader, IconDisc, openMission } from '../../../src/components/CourierUI'
import { useI18n } from '../../../src/store/i18n'
import { useColors } from '../../../src/store/theme'
import { dateLocale } from '../../../src/lib/format'
import { formatMoney } from '../../../src/lib/money'
import { fonts, radius, shadow, spacing, type Colors } from '../../../src/theme'
import { cashLabel, kinshasaToday, shiftDay } from '../../../src/lib/courier'
import type { CourierDeliveredProduct, CourierEarnings } from '../../../src/types'

type Period = 'today' | 'week' | 'month'

/** First Kinshasa day of the period (the week starts on Monday). */
function periodStart(period: Period, today: string): string {
  if (period === 'today') return today
  const d = new Date(`${today}T12:00:00Z`)
  const back = period === 'week' ? (d.getUTCDay() + 6) % 7 : d.getUTCDate() - 1
  return shiftDay(today, -back)
}

/** Kinshasa calendar day (UTC+1, no DST) of a timestamp. */
const kinshasaDay = (iso: string) => new Date(Date.parse(iso) + 3600_000).toISOString().slice(0, 10)

/**
 * "Mes gains". The backend reports cash taken at the door (GET /courier/earnings),
 * not the courier's pay, so the figures are labelled "Encaissé". Week and month
 * add up the days of the period; the history comes from GET /courier/delivered-products.
 */
export default function CourierEarningsScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t, lang } = useI18n()
  const [period, setPeriod] = useState<Period>('today')
  const today = kinshasaToday()
  const from = useMemo(() => periodStart(period, today), [period, today])

  const todayEarnings = useQuery({ queryKey: ['courier', 'earnings', today], queryFn: () => courierApi.earnings(today), refetchInterval: 30_000 })
  // One request for the whole span. Asking day by day meant up to 31 at once,
  // and a phone on a slow link timed out on most of them, so the figures came
  // up empty with no way to tell that apart from a day with no delivery.
  const span = useQuery({
    queryKey: ['courier', 'earnings', 'range', from, today],
    queryFn: () => (period === 'today' ? courierApi.earnings(today) : courierApi.earningsRange(from, today)),
    refetchInterval: 30_000,
  })
  const products = useQuery({ queryKey: ['courier', 'delivered', 'all'], queryFn: () => courierApi.deliveredProducts() })

  const loading = span.isLoading
  const failed = span.isError
  const total = span.data ?? { date: today, cash_collected: [], cash_orders: 0, orders_delivered: 0, items_delivered: 0 }

  const daySet = useMemo(() => {
    const out = new Set<string>()
    for (let day = from; day <= today; day = shiftDay(day, 1)) out.add(day)
    return out
  }, [from, today])
  const orders = useMemo(() => {
    const byOrder = new Map<string, CourierDeliveredProduct[]>()
    for (const it of products.data ?? []) {
      if (!daySet.has(kinshasaDay(it.delivered_at))) continue
      byOrder.set(it.order_id, [...(byOrder.get(it.order_id) ?? []), it])
    }
    return [...byOrder.values()]
  }, [products.data, daySet])

  const locale = dateLocale(lang)
  const timeOf = (iso: string) => {
    const time = new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    return kinshasaDay(iso) === today ? t('courierUi.earnings.todayAt', { time }) : `${new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${time}`
  }

  const periods: Array<{ key: Period; label: string }> = [
    { key: 'today', label: t('courierUi.earnings.today') },
    { key: 'week', label: t('courierUi.earnings.week') },
    { key: 'month', label: t('courierUi.earnings.month') },
  ]
  const value = (v: string | number) => (loading ? '…' : failed ? '—' : String(v))

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={todayEarnings.isRefetching || products.isRefetching} onRefresh={() => { void todayEarnings.refetch(); void span.refetch(); void products.refetch() }} />}
    >
      <CourierHeader title={t('courierUi.earnings.title')} overlap={56} />
      <View style={styles.body}>
        <View style={styles.hero}>
          <View style={styles.shrink}>
            <Text style={styles.heroLabel}>{t('courierUi.earnings.cashToday')}</Text>
            <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>{todayEarnings.isLoading ? '…' : todayEarnings.isError ? '—' : cashLabel(todayEarnings.data)}</Text>
            <Text style={styles.heroHint}>{t('courierUi.earnings.heroHint', { count: todayEarnings.data?.orders_delivered ?? 0 })}</Text>
          </View>
          <View style={styles.heroIcon}><Ionicons name="cash-outline" size={28} color={colors.green} /></View>
        </View>

        <View style={styles.card}>
          <View style={styles.periods} accessibilityRole="tablist">
            {periods.map((p) => {
              const selected = p.key === period
              return (
                <Pressable key={p.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setPeriod(p.key)} style={[styles.period, selected && styles.periodOn]}>
                  <Text style={[styles.periodText, selected && styles.periodTextOn]} numberOfLines={1}>{p.label}</Text>
                </Pressable>
              )
            })}
          </View>
          <Row icon="cube-outline" label={t('courierUi.earnings.delivered')} value={value(total.orders_delivered)} />
          <Row icon="pricetags-outline" label={t('courierUi.earnings.items')} value={value(total.items_delivered)} />
          <Row icon="cash-outline" label={t('courierUi.earnings.cashOrders')} value={value(total.cash_orders)} />
          <Row icon="wallet-outline" label={t('courierUi.earnings.totalCash')} value={value(cashLabel(total))} strong last />
          <Text style={styles.note}>{t('courierUi.earnings.cashNote')}</Text>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('courierUi.earnings.history')}</Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/courier/delivered')} style={styles.seeAll}>
            <Text style={styles.seeAllText}>{t('courierUi.home.seeAll')}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.green} />
          </Pressable>
        </View>
        <View style={styles.card}>
          {products.isLoading ? <Text style={styles.muted}>{t('common.loading')}</Text> : null}
          {products.isError ? <Text style={styles.error}>{t('courier.delivered.failed')}</Text> : null}
          {!products.isLoading && !products.isError && orders.length === 0 ? <Text style={styles.muted}>{t('courierUi.earnings.historyEmpty')}</Text> : null}
          {orders.slice(0, 10).map((lines, i, shown) => {
            const head = lines[0]
            const amount = lines.reduce((sum, l) => sum + l.line_total, 0)
            return (
              <Pressable key={head.order_id} accessibilityRole="button" onPress={() => openMission(head.order_id)} style={[styles.histRow, i < shown.length - 1 && styles.divider]}>
                <IconDisc name="cube" size={36} colors={colors} />
                <View style={styles.shrink}>
                  <Text style={styles.histTitle} numberOfLines={1}>{t('courierUi.card.order', { number: head.order_number })}</Text>
                  <Text style={styles.histMeta} numberOfLines={1}>{timeOf(head.delivered_at)}</Text>
                </View>
                <View style={styles.histRight}>
                  <Text style={styles.histAmount}>{formatMoney(amount, head.currency)}</Text>
                  <Text style={head.cash_collected ? styles.cashTag : styles.histMeta}>{head.cash_collected ? t('courier.delivered.cashCollected') : head.payment_method === 'CASH_ON_DELIVERY' ? t('courier.delivered.cash') : t('courier.delivered.paidOnline')}</Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      </View>
    </ScrollView>
  )
}

function Row({ icon, label, value, strong, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; strong?: boolean; last?: boolean }) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <View style={[styles.row, !last && styles.divider]}>
      <IconDisc name={icon} size={30} colors={colors} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowStrong]} numberOfLines={1}>{value}</Text>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { paddingBottom: spacing.xl, backgroundColor: c.cream, flexGrow: 1 },
  body: { paddingHorizontal: spacing.md, gap: spacing.md, marginTop: -56 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: c.navy, borderRadius: radius.lg, padding: spacing.md + 4, ...shadow.raised },
  heroLabel: { color: c.onNavyMuted, fontWeight: '700', fontSize: 13 },
  heroValue: { color: c.onNavy, fontFamily: fonts.display, fontWeight: '700', fontSize: 32, marginVertical: 2 },
  heroHint: { color: c.cyan, fontWeight: '700', fontSize: 13 },
  heroIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: c.white, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md, gap: 2, ...shadow.card },
  periods: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border, marginBottom: spacing.xs },
  period: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  periodOn: { borderBottomColor: c.green },
  periodText: { color: c.muted, fontWeight: '600', fontSize: 13.5 },
  periodTextOn: { color: c.green, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  divider: { borderBottomWidth: 1, borderBottomColor: c.border },
  rowLabel: { flex: 1, color: c.muted, fontSize: 14 },
  rowValue: { color: c.ink, fontWeight: '700', fontSize: 14.5, flexShrink: 1, textAlign: 'right' },
  rowStrong: { fontWeight: '900', fontSize: 15.5 },
  note: { color: c.muted, fontSize: 12, marginTop: spacing.xs },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: c.ink, fontFamily: fonts.display, fontWeight: '700', fontSize: 18 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  seeAllText: { color: c.green, fontWeight: '700', fontSize: 13 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  histTitle: { color: c.ink, fontWeight: '800', fontSize: 14.5 },
  histMeta: { color: c.muted, fontSize: 12.5 },
  histRight: { alignItems: 'flex-end', gap: 2 },
  histAmount: { color: c.ink, fontWeight: '800', fontSize: 14.5 },
  cashTag: { color: c.green, fontWeight: '700', fontSize: 12.5 },
  muted: { color: c.muted },
  error: { color: c.danger, fontWeight: '700' },
  shrink: { flex: 1, minWidth: 0 },
})
