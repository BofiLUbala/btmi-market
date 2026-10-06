import { useMemo, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useI18n, type TranslationKey } from '../store/i18n'
import { useTheme } from '../store/theme'
import { fonts, radius, shadow, spacing, type Colors } from '../theme'
import { formatMoney } from '../lib/money'
import type { CourierMission } from '../types'

/** Delivery statuses after which a mission is over (same list as before the redesign). */
export const FINISHED_STATUSES = ['RECEIVED', 'DELIVERED', 'FAILED', 'CANCELLED', 'COURIER_REJECTED', 'RETURNED_TO_SELLER']
/** Not yet collected from the shop. */
const UPCOMING_STATUSES = ['COURIER_ASSIGNED', 'COURIER_ACCEPTED', 'READY_FOR_PICKUP']

export type MissionPhase = 'new' | 'upcoming' | 'ongoing' | 'finished'

/** Where a mission stands, from its delivery status only. */
export function missionPhase(status: string): MissionPhase {
  if (FINISHED_STATUSES.includes(status)) return 'finished'
  if (status === 'COURIER_ASSIGNED') return 'new'
  if (UPCOMING_STATUSES.includes(status)) return 'upcoming'
  return 'ongoing'
}

export function openItinerary(orderId: string) {
  router.push(`/courier/itinerary?id=${encodeURIComponent(orderId)}`)
}

export function openMission(orderId: string) {
  router.push({ pathname: '/courier/[id]', params: { id: orderId } })
}

/** Header colours: the reference blue in light mode, the navy hero in dark mode
 *  (the dark `green` is a pale blue that cannot carry white text). */
export function useCourierHeaderColors() {
  const { colors, theme } = useTheme()
  return theme === 'dark'
    ? { bg: colors.navySoft, ink: colors.onNavy, soft: colors.onNavyMuted, chip: 'rgba(255,255,255,0.10)' }
    : { bg: colors.green, ink: '#FFFFFF', soft: 'rgba(255,255,255,0.82)', chip: 'rgba(255,255,255,0.18)' }
}

/** Blue top band used by every courier screen; `extra` is drawn below the title row. */
export function CourierHeader({ title, back, right, children, overlap = 0 }: { title?: string; back?: boolean; right?: ReactNode; children?: ReactNode; overlap?: number }) {
  const insets = useSafeAreaInsets()
  const h = useCourierHeaderColors()
  const { t } = useI18n()
  return (
    <View style={[styles.header, { backgroundColor: h.bg, paddingTop: insets.top + spacing.sm, paddingBottom: spacing.md + overlap }]}>
      {title || back || right ? (
        <View style={styles.headerRow}>
          {back ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('courierUi.back')} hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace('/courier'))} style={styles.headerIcon}>
              <Ionicons name="arrow-back" size={22} color={h.ink} />
            </Pressable>
          ) : null}
          {title ? <Text style={[styles.headerTitle, { color: h.ink }]} numberOfLines={1}>{title}</Text> : <View style={{ flex: 1 }} />}
          {right}
        </View>
      ) : null}
      {children}
    </View>
  )
}

const PHASE_KEYS: Record<MissionPhase, TranslationKey> = {
  new: 'courierUi.card.new',
  upcoming: 'courierUi.card.upcoming',
  ongoing: 'courierUi.card.ongoing',
  finished: 'courierUi.card.done',
}

export function PhasePill({ phase, colors }: { phase: MissionPhase; colors: Colors }) {
  const { t } = useI18n()
  const filled = phase === 'ongoing' || phase === 'new'
  return (
    <View style={[styles.pill, { backgroundColor: filled ? colors.green : colors.greenSoft }]}>
      <Text style={[styles.pillText, { color: filled ? colors.onGreen : colors.green }]}>{t(PHASE_KEYS[phase])}</Text>
    </View>
  )
}

/** One mission as in the reference: icon tile, status pill, order number, amount, zone, client. */
export function CourierMissionCard({ mission: m, footer }: { mission: CourierMission; footer?: ReactNode }) {
  const { colors } = useTheme()
  const s = useMemo(() => makeStyles(colors), [colors])
  const { t } = useI18n()
  const phase = missionPhase(m.delivery_status)
  const amount = m.total_amount ?? m.products_total
  const place = m.delivery_address || m.service_zone
  return (
    <View style={s.card}>
      <Pressable accessibilityRole="button" onPress={() => openMission(m.order_id)} style={s.cardTop}>
        <View style={s.thumb}>
          <Ionicons name="cube-outline" size={30} color={colors.green} />
          {m.package_count > 1 ? <Text style={s.thumbCount}>×{m.package_count}</Text> : null}
        </View>
        <View style={s.cardBody}>
          <View style={s.rowBetween}>
            <PhasePill phase={phase} colors={colors} />
            {amount !== undefined && amount !== null ? <Text style={s.amount}>{formatMoney(amount, m.currency)}</Text> : null}
          </View>
          <Text style={s.cardTitle} numberOfLines={1}>{t('courierUi.card.order', { number: m.order_number })}</Text>
          {place ? (
            <View style={s.metaRow}>
              <Ionicons name="location-outline" size={14} color={colors.muted} />
              <Text style={s.meta} numberOfLines={1}>{place}</Text>
            </View>
          ) : null}
          {m.delivery_contact ? (
            <View style={s.metaRow}>
              <Ionicons name="person-outline" size={14} color={colors.muted} />
              <Text style={s.meta} numberOfLines={1}>{t('courierUi.card.client', { name: m.delivery_contact })}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      {footer}
    </View>
  )
}

/** Full-width action under a card: filled ("Voir l'itinéraire") or outlined ("Voir les détails"). */
export function CardAction({ title, icon, onPress, outline }: { title: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; outline?: boolean }) {
  const { colors } = useTheme()
  const s = useMemo(() => makeStyles(colors), [colors])
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.action, outline && s.actionOutline, pressed && { opacity: 0.85 }]}>
      <Ionicons name={icon} size={16} color={outline ? colors.green : colors.onGreen} />
      <Text style={[s.actionText, outline && { color: colors.green }]}>{title}</Text>
    </Pressable>
  )
}

/** Small round icon on a soft blue disc, used by rows and tiles. */
export function IconDisc({ name, size = 40, colors, tone = 'blue' }: { name: keyof typeof Ionicons.glyphMap; size?: number; colors: Colors; tone?: 'blue' | 'danger' }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: tone === 'danger' ? colors.dangerSoft : colors.greenSoft }}>
      <Ionicons name={name} size={Math.round(size * 0.5)} color={tone === 'danger' ? colors.danger : colors.green} />
    </View>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.md, gap: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  headerIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: fonts.display, fontWeight: '700', fontSize: 20 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  pillText: { fontSize: 11.5, fontWeight: '800' },
})

const makeStyles = (c: Colors) => StyleSheet.create({
  card: { backgroundColor: c.white, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.sm + 2, gap: spacing.sm, ...shadow.card },
  cardTop: { flexDirection: 'row', gap: spacing.sm + 2 },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
  thumbCount: { position: 'absolute', bottom: 4, right: 6, fontSize: 11, fontWeight: '800', color: c.green },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  amount: { color: c.green, fontWeight: '800', fontSize: 15 },
  cardTitle: { color: c.ink, fontWeight: '800', fontSize: 15.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { color: c.muted, fontSize: 13, flexShrink: 1 },
  action: { minHeight: 44, borderRadius: radius.sm, backgroundColor: c.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: spacing.md },
  actionOutline: { backgroundColor: c.white, borderWidth: 1.5, borderColor: c.green },
  actionText: { color: c.onGreen, fontWeight: '700', fontSize: 14.5 },
})
