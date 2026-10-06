import { useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { courierApi } from '../../../src/api'
import { ApiError, resolveMediaUrl } from '../../../src/api/client'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ErrorState, Loading } from '../../../src/components/ui'
import { MissionActions } from '../../../src/components/CourierMissionActions'
import { CardAction, CourierHeader, CourierMissionCard, FINISHED_STATUSES, IconDisc, missionPhase, openItinerary, useCourierHeaderColors } from '../../../src/components/CourierUI'
import { useAuth } from '../../../src/store/auth'
import { useI18n } from '../../../src/store/i18n'
import { useColors } from '../../../src/store/theme'
import { fonts, radius, shadow, spacing, type Colors } from '../../../src/theme'
import { cashLabel } from '../../../src/lib/courier'
import { resumeCourierTrackingIfNeeded } from '../../../src/lib/courierTracking'
import type { CourierAvailability, CourierMission } from '../../../src/types'

/** Missions picked up and on their way: the "Carte" tile opens the first one's route. */
const firstOngoing = (list: CourierMission[]) => list.find((m) => missionPhase(m.delivery_status) === 'ongoing') ?? list.find((m) => missionPhase(m.delivery_status) === 'upcoming')

/**
 * Courier home (reference "Écran d'accueil livreur"): zone and greeting on the
 * blue band, today's figures and the availability switch, shortcuts, and the
 * missions still open (GET /courier/missions), with accept/refuse for new ones.
 */
export default function CourierHomeScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const header = useCourierHeaderColors()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const user = useAuth((s) => s.user)

  const missions = useQuery({ queryKey: ['courier', 'missions'], queryFn: courierApi.missions, refetchInterval: 15_000 })
  const profile = useQuery({ queryKey: ['courier', 'profile'], queryFn: courierApi.profile, retry: false })
  const earnings = useQuery({ queryKey: ['courier', 'earnings', 'today'], queryFn: () => courierApi.earnings(), refetchInterval: 30_000 })
  // After a restart or a force-close: an accepted mission is tracked again,
  // and tracking of any other state is stopped.
  useEffect(() => { void resumeCourierTrackingIfNeeded(missions.data) }, [missions.data])

  // Tabs have no header: keep full-screen states clear of the status bar.
  if (missions.isLoading) return <SafeAreaView style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.cream }} edges={['top']}><Loading label={t('common.loading')} /></SafeAreaView>
  if (missions.isError) {
    const notCourier = missions.error instanceof ApiError && [403, 404].includes(missions.error.status)
    return <SafeAreaView style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.cream }} edges={['top']}><ErrorState message={notCourier ? t('courier.notCourier') : t('courier.missionsFailed')} retry={() => void missions.refetch()} /></SafeAreaView>
  }

  const active = (missions.data ?? []).filter((m) => !FINISHED_STATUSES.includes(m.delivery_status))
  const p = profile.data
  const firstName = p?.first_name || user?.first_name || ''
  const doneToday = earnings.data?.orders_delivered ?? p?.completed_today ?? 0
  const mapTarget = firstOngoing(active)
  const avatarUrl = user?.avatar_url
  const initials = `${firstName[0] ?? ''}${(p?.last_name || user?.last_name || '')[0] ?? ''}`.toUpperCase()

  const refresh = () => {
    void missions.refetch()
    void queryClient.invalidateQueries({ queryKey: ['courier', 'profile'] })
    void queryClient.invalidateQueries({ queryKey: ['courier', 'earnings'] })
  }

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={missions.isRefetching} onRefresh={refresh} />}>
      <CourierHeader overlap={44}>
        <View style={styles.topRow}>
          <View style={styles.zone}>
            <Ionicons name="location" size={20} color={header.ink} />
            <View style={styles.shrink}>
              <Text style={[styles.zoneKicker, { color: header.soft }]}>{t('courierUi.home.deliverTo')}</Text>
              <Text style={[styles.zoneText, { color: header.ink }]} numberOfLines={1}>{p?.service_zone || t('courierUi.home.noZone')}</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('courierUi.home.notifications')} hitSlop={8} onPress={() => router.push('/notifications')} style={[styles.headerBtn, { backgroundColor: header.chip }]}>
            <Ionicons name="notifications-outline" size={21} color={header.ink} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('courierUi.home.profile')} onPress={() => router.navigate('/courier/profile')} style={[styles.avatar, { borderColor: header.ink }]}>
            {avatarUrl ? <Image source={resolveMediaUrl(avatarUrl)} style={styles.avatarImg} contentFit="cover" /> : <Text style={styles.avatarText}>{initials || '?'}</Text>}
          </Pressable>
        </View>
        <Text style={[styles.greeting, { color: header.ink }]}>{t('courierUi.home.greeting', { name: firstName })}</Text>
        <Text style={[styles.subtitle, { color: header.soft }]}>{t('courierUi.home.subtitle')}</Text>
      </CourierHeader>

      <View style={styles.body}>
        <StatsCard doneToday={doneToday} cash={earnings.isLoading ? '…' : earnings.isError ? '—' : cashLabel(earnings.data)} />

        <View style={styles.tiles}>
          <Tile icon="reader-outline" label={t('courierUi.home.myDeliveries')} onPress={() => router.navigate('/courier/deliveries')} />
          <Tile icon="map-outline" label={t('courierUi.home.map')} chevron onPress={() => (mapTarget ? openItinerary(mapTarget.order_id) : router.navigate('/courier/deliveries'))} />
          <Tile icon="headset-outline" label={t('courierUi.home.assistance')} onPress={() => router.push('/courier/assistance')} />
          <Tile icon="wallet-outline" label={t('courierUi.home.myEarnings')} onPress={() => router.navigate('/courier/earnings')} />
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('courierUi.home.ongoing')}{active.length ? ` · ${active.length}` : ''}</Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.navigate('/courier/deliveries')} style={styles.seeAll}>
            <Text style={styles.seeAllText}>{t('courierUi.home.seeAll')}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.green} />
          </Pressable>
        </View>
        {active.length === 0 ? <View style={styles.empty}><Text style={styles.muted}>{t('courierUi.home.noOngoing')}</Text></View> : null}
        {active.map((m) => (
          <CourierMissionCard
            key={m.order_id}
            mission={m}
            footer={missionPhase(m.delivery_status) === 'new'
              // New assignment: the existing accept / refuse-with-reason actions.
              ? <MissionActions mission={m} compact />
              : <CardAction icon="navigate" title={t('courierUi.card.itinerary')} onPress={() => openItinerary(m.order_id)} />}
          />
        ))}
      </View>
    </ScrollView>
  )
}

/** Today's deliveries, cash taken at the door today, and the online switch. */
function StatsCard({ doneToday, cash }: { doneToday: number; cash: string }) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useI18n()
  return (
    <View style={styles.statsCard}>
      <View style={styles.statsRow}>
        <Pressable accessibilityRole="button" style={styles.stat} onPress={() => router.navigate('/courier/deliveries')}>
          <IconDisc name="cube" size={34} colors={colors} />
          <View style={styles.shrink}>
            <Text style={styles.statLabel} numberOfLines={2}>{t('courierUi.home.deliveriesToday')}</Text>
            <Text style={styles.statValue}>{doneToday}</Text>
          </View>
        </Pressable>
        <View style={styles.statDivider} />
        <Pressable accessibilityRole="button" style={styles.stat} onPress={() => router.navigate('/courier/earnings')}>
          <IconDisc name="cash" size={34} colors={colors} />
          <View style={styles.shrink}>
            <Text style={styles.statLabel} numberOfLines={2}>{t('courierUi.home.cashToday')}</Text>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{cash}</Text>
          </View>
        </Pressable>
      </View>
      <AvailabilitySwitch />
    </View>
  )
}

/**
 * Same rules as the former availability card: PATCH /courier/availability,
 * refused for a non-active account; BUSY is set by the backend during a mission.
 */
function AvailabilitySwitch() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const profile = useQuery({ queryKey: ['courier', 'profile'], queryFn: courierApi.profile, retry: false })
  const update = useMutation({
    mutationFn: (value: CourierAvailability) => courierApi.updateAvailability(value),
    onSuccess: () => { setError(''); void queryClient.invalidateQueries({ queryKey: ['courier', 'profile'] }) },
    onError: (e) => {
      setError(e instanceof ApiError && e.code === 'COURIER_NOT_ACTIVE' ? t('courier.notActive') : e instanceof ApiError && e.message ? e.message : t('common.actionImpossible'))
      void queryClient.invalidateQueries({ queryKey: ['courier', 'profile'] })
    },
  })
  if (!profile.data) return null
  const current = update.isPending && update.variables ? update.variables : profile.data.availability
  const accountActive = profile.data.status === 'ACTIVE'
  const on = current !== 'UNAVAILABLE'
  const label = current === 'AVAILABLE' ? t('courierUi.home.online') : current === 'BUSY' ? t('courierUi.home.busy') : t('courierUi.home.offline')
  const tint = current === 'AVAILABLE' ? colors.success : current === 'BUSY' ? colors.gold : colors.muted

  return (
    <View style={styles.availability}>
      <View style={styles.availabilityRow}>
        <View style={[styles.dot, { backgroundColor: tint }]} />
        <Text style={[styles.availabilityText, { color: tint }]}>{label}</Text>
        <Switch
          accessibilityLabel={t('courier.availabilityTitle')}
          value={on}
          disabled={!accountActive || update.isPending}
          onValueChange={(next) => update.mutate(next ? 'AVAILABLE' : 'UNAVAILABLE')}
          trackColor={{ false: colors.borderControl, true: colors.success }}
          thumbColor={colors.white}
        />
      </View>
      {!accountActive ? <Text style={styles.hint}>{t('courier.notActive')}</Text> : null}
      {current === 'BUSY' ? <Text style={styles.hint}>{t('courier.busyHint')}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

function Tile({ icon, label, onPress, chevron }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; chevron?: boolean }) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}>
      <IconDisc name={icon} size={44} colors={colors} />
      <View style={styles.tileLabelRow}>
        <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
        {chevron ? <Ionicons name="chevron-forward" size={13} color={colors.muted} /> : null}
      </View>
    </Pressable>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { paddingBottom: spacing.xl, backgroundColor: c.cream, flexGrow: 1 },
  body: { paddingHorizontal: spacing.md, gap: spacing.md, marginTop: -44 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  zone: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  zoneKicker: { fontSize: 12, fontWeight: '600' },
  zoneText: { fontSize: 15, fontWeight: '800' },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: c.navy },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: c.onNavy, fontWeight: '800', fontSize: 15 },
  greeting: { fontFamily: fonts.display, fontWeight: '700', fontSize: 26, marginTop: spacing.sm },
  subtitle: { fontSize: 14, fontWeight: '500' },
  statsCard: { backgroundColor: c.white, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.md, gap: spacing.sm, ...shadow.card },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: c.border },
  statLabel: { color: c.muted, fontSize: 12, fontWeight: '600' },
  statValue: { color: c.ink, fontFamily: fonts.display, fontWeight: '700', fontSize: 20 },
  availability: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: spacing.sm, gap: 4 },
  availabilityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 9, height: 9, borderRadius: 5 },
  availabilityText: { flex: 1, fontWeight: '800', fontSize: 14 },
  hint: { color: c.muted, fontSize: 12.5 },
  error: { color: c.danger, fontWeight: '700', fontSize: 13 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '47%', flexGrow: 1, minHeight: 96, backgroundColor: c.white, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.sm, ...shadow.card },
  tileLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  tileLabel: { color: c.ink, fontWeight: '700', fontSize: 13.5 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  sectionTitle: { color: c.ink, fontFamily: fonts.display, fontWeight: '700', fontSize: 18 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  seeAllText: { color: c.green, fontWeight: '700', fontSize: 13 },
  empty: { backgroundColor: c.white, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  muted: { color: c.muted },
  shrink: { flex: 1, minWidth: 0 },
})
