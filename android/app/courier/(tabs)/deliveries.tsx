import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useQuery } from '@tanstack/react-query'
import { courierApi } from '../../../src/api'
import { ApiError } from '../../../src/api/client'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ErrorState, Loading } from '../../../src/components/ui'
import { MissionActions } from '../../../src/components/CourierMissionActions'
import { CardAction, CourierHeader, CourierMissionCard, PhasePill, missionPhase, openItinerary, openMission } from '../../../src/components/CourierUI'
import { useI18n } from '../../../src/store/i18n'
import { useColors } from '../../../src/store/theme'
import { dateLocale } from '../../../src/lib/format'
import { radius, shadow, spacing, type Colors } from '../../../src/theme'
import { statusLabel } from '../../../src/lib/statusLabels'
import { courierStatusLabel } from '../../../src/lib/courier'
import type { CourierHistoryItem } from '../../../src/types'

type Segment = 'upcoming' | 'ongoing' | 'done'

/**
 * "Mes livraisons": open missions split into À venir (assigned, not yet picked
 * up) and En cours (picked up onwards), and finished ones from GET /courier/history.
 */
export default function CourierDeliveriesScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useI18n()
  const [segment, setSegment] = useState<Segment>('upcoming')
  const [picked, setPicked] = useState(false)

  const missions = useQuery({ queryKey: ['courier', 'missions'], queryFn: courierApi.missions, refetchInterval: 15_000 })
  const history = useQuery({ queryKey: ['courier', 'history'], queryFn: () => courierApi.history(50) })

  const all = missions.data ?? []
  const upcoming = all.filter((m) => ['new', 'upcoming'].includes(missionPhase(m.delivery_status)))
  const ongoing = all.filter((m) => missionPhase(m.delivery_status) === 'ongoing')
  const done = history.data ?? []
  // Open on "En cours" when something is on the road and nothing waits.
  const current: Segment = picked ? segment : (upcoming.length === 0 && ongoing.length > 0 ? 'ongoing' : segment)

  // Tabs have no header: keep full-screen states clear of the status bar.
  if (missions.isLoading) return <SafeAreaView style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.cream }} edges={['top']}><Loading label={t('common.loading')} /></SafeAreaView>
  if (missions.isError) {
    const notCourier = missions.error instanceof ApiError && [403, 404].includes(missions.error.status)
    return <SafeAreaView style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.cream }} edges={['top']}><ErrorState message={notCourier ? t('courier.notCourier') : t('courier.missionsFailed')} retry={() => void missions.refetch()} /></SafeAreaView>
  }

  const tabs: Array<{ key: Segment; label: string; count?: number }> = [
    { key: 'upcoming', label: t('courierUi.deliveries.upcoming'), count: upcoming.length },
    { key: 'ongoing', label: t('courierUi.deliveries.ongoing'), count: ongoing.length },
    { key: 'done', label: t('courierUi.deliveries.done') },
  ]

  return (
    <View style={styles.screen}>
      <CourierHeader title={t('courierUi.deliveries.title')} />
      <View style={styles.segmentsWrap}>
        <View style={styles.segments} accessibilityRole="tablist">
          {tabs.map((tab) => {
            const selected = current === tab.key
            return (
              <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => { setPicked(true); setSegment(tab.key) }} style={[styles.segment, selected && styles.segmentOn]}>
                <Text style={[styles.segmentText, selected && styles.segmentTextOn]} numberOfLines={1}>{tab.label}</Text>
                {tab.count ? <View style={[styles.count, selected && styles.countOn]}><Text style={[styles.countText, selected && styles.countTextOn]}>{tab.count}</Text></View> : null}
              </Pressable>
            )
          })}
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={missions.isRefetching || history.isRefetching} onRefresh={() => { void missions.refetch(); void history.refetch() }} />}
      >
        {current === 'upcoming' ? (
          upcoming.length === 0 ? <Empty text={t('courierUi.deliveries.emptyUpcoming')} /> : upcoming.map((m) => (
            <CourierMissionCard
              key={m.order_id}
              mission={m}
              footer={missionPhase(m.delivery_status) === 'new'
                ? <MissionActions mission={m} compact />
                : <CardAction outline icon="navigate-outline" title={t('courierUi.card.details')} onPress={() => openMission(m.order_id)} />}
            />
          ))
        ) : null}
        {current === 'ongoing' ? (
          ongoing.length === 0 ? <Empty text={t('courierUi.deliveries.emptyOngoing')} /> : ongoing.map((m) => (
            <CourierMissionCard key={m.order_id} mission={m} footer={<CardAction icon="navigate" title={t('courierUi.card.itinerary')} onPress={() => openItinerary(m.order_id)} />} />
          ))
        ) : null}
        {current === 'done' ? (
          history.isLoading ? <Loading /> : history.isError ? <ErrorState message={t('courier.historyFailed')} retry={() => void history.refetch()} />
            : done.length === 0 ? <Empty text={t('courierUi.deliveries.emptyDone')} /> : done.map((h) => <HistoryCard key={`${h.order_id}-${h.final_status}`} item={h} />)
        ) : null}
      </ScrollView>
    </View>
  )
}

function Empty({ text }: { text: string }) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return <View style={styles.empty}><Ionicons name="cube-outline" size={28} color={colors.mutedLight} /><Text style={styles.muted}>{text}</Text></View>
}

/** A finished delivery, only with what GET /courier/history returns. */
function HistoryCard({ item: h }: { item: CourierHistoryItem }) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t, lang } = useI18n()
  const when = h.delivered_at || h.assigned_at
  const failed = !['DELIVERED', 'RECEIVED'].includes(h.final_status)
  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" onPress={() => openMission(h.order_id)} style={styles.cardTop}>
        <View style={[styles.thumb, failed && { backgroundColor: colors.dangerSoft }]}>
          <Ionicons name={failed ? 'alert-circle-outline' : 'checkmark-done'} size={28} color={failed ? colors.danger : colors.green} />
        </View>
        <View style={styles.shrink}>
          <View style={styles.rowBetween}>
            {failed
              ? <Text style={styles.failText} numberOfLines={1}>{h.final_status === 'COURIER_REJECTED' ? courierStatusLabel(t, h.final_status) : statusLabel(t, h.final_status)}</Text>
              : <PhasePill phase="finished" colors={colors} />}
            {when ? <Text style={styles.date}>{new Date(when).toLocaleDateString(dateLocale(lang), { day: 'numeric', month: 'short' })}</Text> : null}
          </View>
          <Text style={styles.title} numberOfLines={1}>{t('courierUi.card.order', { number: h.order_number })}</Text>
          <View style={styles.metaRow}><Ionicons name="storefront-outline" size={14} color={colors.muted} /><Text style={styles.meta} numberOfLines={1}>{h.shop_name}</Text></View>
          {h.delivery_address ? <View style={styles.metaRow}><Ionicons name="location-outline" size={14} color={colors.muted} /><Text style={styles.meta} numberOfLines={1}>{h.delivery_address}</Text></View> : null}
          {h.incident_status ? <Text style={styles.failText}>{t('courier.incident')} : {h.incident_status}</Text> : null}
        </View>
      </Pressable>
      <CardAction outline icon="document-text-outline" title={t('courierUi.card.details')} onPress={() => openMission(h.order_id)} />
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.cream },
  segmentsWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  segments: { flexDirection: 'row', backgroundColor: c.white, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, padding: 4, gap: 4, ...shadow.card },
  segment: { flex: 1, minHeight: 38, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6 },
  segmentOn: { backgroundColor: c.green },
  segmentText: { color: c.muted, fontWeight: '700', fontSize: 13 },
  segmentTextOn: { color: c.onGreen },
  count: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: c.greenSoft },
  countOn: { backgroundColor: c.onGreen },
  countText: { color: c.green, fontWeight: '800', fontSize: 11 },
  countTextOn: { color: c.green },
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  empty: { backgroundColor: c.white, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.lg, alignItems: 'center', gap: spacing.xs },
  muted: { color: c.muted, textAlign: 'center' },
  card: { backgroundColor: c.white, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.sm + 2, gap: spacing.sm, ...shadow.card },
  cardTop: { flexDirection: 'row', gap: spacing.sm + 2 },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
  shrink: { flex: 1, minWidth: 0, gap: 3 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  date: { color: c.muted, fontSize: 12.5, fontWeight: '600' },
  title: { color: c.ink, fontWeight: '800', fontSize: 15.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { color: c.muted, fontSize: 13, flexShrink: 1 },
  failText: { color: c.danger, fontWeight: '700', fontSize: 12.5, flexShrink: 1 },
})
