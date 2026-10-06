import { useMemo, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { fonts, radius, shadow, spacing, type Colors } from '../theme'
import { formatMoney } from '../lib/money'
import { courierStatusLabel } from '../lib/courier'
import { expectedDeliveryText } from '../lib/deliveryPlan'
import type { CourierMission } from '../types'
import { PhasePill, missionPhase } from './CourierUI'


/** Blue courier top bar: back arrow + title, under the status bar. */
export function CourierTopBar({ title, right, extra = 0 }: { title: string; right?: ReactNode; extra?: number }) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const back = () => (router.canGoBack() ? router.back() : router.replace('/courier'))
  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm, paddingBottom: spacing.md + extra }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('courierMap.back')} hitSlop={10} onPress={back} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={c.onGreen} />
      </Pressable>
      <Text style={styles.barTitle} numberOfLines={1}>{title}</Text>
      {right ?? <View style={styles.backBtn} />}
    </View>
  )
}

/** The order at a glance: status pill, number, amount, zone, client and the promised delivery time. */
export function CourierOrderSummary({ mission: m, showDelivery = false, children }: { mission: CourierMission; showDelivery?: boolean; children?: ReactNode }) {
  const c = useColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const { t, lang } = useI18n()
  const zone = [m.service_zone, m.delivery_address].filter(Boolean).join(' · ')
  const planned = showDelivery ? expectedDeliveryText(m, t, lang) : null
  return (
    <View style={styles.summary}>
      <View style={styles.summaryTop}>
        {/* Same phase label as Mes livraisons (À venir / En cours / Terminée). */}
        <PhasePill phase={missionPhase(m.delivery_status)} colors={c} />
        {m.total_amount != null ? <Text style={styles.amount}>{formatMoney(m.total_amount, m.currency)}</Text> : null}
      </View>
      <Text style={styles.orderNo}>{t('courierMap.orderNumber', { number: m.order_number })}</Text>
      <Text style={styles.status}>{courierStatusLabel(t, m.delivery_status)}</Text>
      {zone ? <Row icon="location-outline" text={zone} styles={styles} color={c.muted} /> : null}
      {m.delivery_contact ? <Row icon="person-outline" text={t('courierMap.client', { name: m.delivery_contact })} styles={styles} color={c.muted} /> : null}
      {planned ? <Row icon="time-outline" text={t('courierMap.deliveryOn', { when: planned })} styles={styles} color={c.muted} /> : null}
      {children}
    </View>
  )
}

function Row({ icon, text, styles, color }: { icon: keyof typeof Ionicons.glyphMap; text: string; styles: ReturnType<typeof makeStyles>; color: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  bar: { backgroundColor: c.green, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  barTitle: { flex: 1, color: c.onGreen, fontSize: 18, fontWeight: '800', fontFamily: fonts.display },
  summary: { backgroundColor: c.white, borderRadius: radius.md, padding: spacing.md, gap: 6, borderWidth: 1, borderColor: c.border, ...shadow.card },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  amount: { color: c.ink, fontSize: 16, fontWeight: '900' },
  orderNo: { color: c.ink, fontSize: 16, fontWeight: '900', fontFamily: fonts.display },
  status: { color: c.green, fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  rowText: { color: c.muted, fontSize: 13, flex: 1 },
})
