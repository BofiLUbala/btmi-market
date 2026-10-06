import { Suspense, lazy, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { courierApi } from '../../src/api'
import { ErrorState, Loading } from '../../src/components/ui'
import { LazyLiveCourierMap } from '../../src/components/LazyLiveCourierMap'
import { MissionPrimaryAction } from '../../src/components/CourierMissionActions'
import { CourierOrderSummary, CourierTopBar } from '../../src/components/CourierOrderHeader'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, shadow, spacing, type Colors } from '../../src/theme'
import { formatDistance, formatDuration } from '../../src/lib/routeFormat'

// MapLibre-backed planner: loaded only when shown (Expo Go lacks it).
const CourierRoutePlanner = lazy(() => import('../../src/components/CourierRoutePlanner').then((m) => ({ default: m.CourierRoutePlanner })).catch(() => ({ default: (() => null) as never })))
/** Delivery states in which the courier can plan or change the route (same rule as the mission page). */
const ROUTE_PLANNING = ['COURIER_ASSIGNED', 'COURIER_ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT']
/** Closer than this to the destination, the courier is there (same threshold as the map). */
const ARRIVED_WITHIN_M = 30
/** How far the blue bar runs down behind the order card. */
const OVERLAP = 44

/**
 * "Itinéraire": the courier's own route on the very same map the buyer follows
 * (LiveCourierMap, audience 'courier': next instruction, courier-side data),
 * with the order on top and the next mission step at the bottom. Every step
 * goes through the same mutation and rules as the mission page.
 */
export default function CourierItineraryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t, lang } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  // A finger on the map moves the map, not the page.
  const [mapTouched, setMapTouched] = useState(false)
  const [routeRefresh, setRouteRefresh] = useState(0)
  const [editingRoute, setEditingRoute] = useState(false)

  const mission = useQuery({
    queryKey: ['courier', 'mission', id],
    queryFn: () => courierApi.mission(id!),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  })
  // Same cache entry as the map: one poll feeds both the map and the figures below.
  const live = useQuery({
    queryKey: ['courier', 'courierLocation', id],
    queryFn: () => courierApi.live(id!),
    enabled: Boolean(id),
  })

  const scrollRef = useRef<ScrollView>(null)
  const openDetail = () => router.push({ pathname: '/courier/[id]', params: { id: id! } })

  const body = (() => {
    if (mission.isLoading) return <Loading label={t('common.loading')} />
    if (mission.isError || !mission.data) return <ErrorState message={t('courier.missionsFailed')} retry={() => void mission.refetch()} />
    const m = mission.data
    const route = live.data?.route ?? null
    const canPlan = ROUTE_PLANNING.includes(m.delivery_status)
    const showPlanner = canPlan && (!route || editingRoute)
    const arrived = !!route && !!live.data?.live_tracking_active && route.remaining_m < ARRIVED_WITHIN_M
    return (
      <>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.page, { paddingBottom: 150 + insets.bottom }]}
          scrollEnabled={!mapTouched}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.band} />
        <View>
            <CourierOrderSummary mission={m} />
          </View>
          <Suspense fallback={<Loading label={t('common.loading')} />}>
            <LazyLiveCourierMap
              orderId={m.order_id}
              audience="courier"
              refreshKey={routeRefresh}
              onGesture={setMapTouched}
              mapHeight={Math.max(360, Math.round(height * 0.55))}
            />
            {canPlan && !route && !live.isLoading ? <Text style={styles.note}>{t('courierMap.noRoute')}</Text> : null}
            {canPlan && route ? (
              <Pressable accessibilityRole="button" onPress={() => setEditingRoute((v) => !v)} style={styles.linkRow}>
                <Ionicons name={editingRoute ? 'chevron-up' : 'create-outline'} size={16} color={colors.green} />
                <Text style={styles.link}>{t(editingRoute ? 'courierMap.hideRoutePlanner' : 'courierMap.changeRoute')}</Text>
              </Pressable>
            ) : null}
            {showPlanner ? (
              <CourierRoutePlanner
                orderId={m.order_id}
                deliveryAddress={m.delivery_address}
                pickupAddress={m.shop_address}
                onSaved={() => { setRouteRefresh((n) => n + 1); setEditingRoute(false) }}
              />
            ) : null}
          </Suspense>
        </ScrollView>

        <View style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]}>
          <View style={styles.sheetRow}>
            <View style={styles.figures}>
              {route ? (
                <>
                  <Text style={styles.distance}>{formatDistance(route.remaining_m, lang)}</Text>
                  <Text style={styles.eta}>
                    {arrived ? t('courierMap.atDestination') : t('courierMap.arrivalIn', { duration: formatDuration(route.remaining_s) })}
                  </Text>
                </>
              ) : canPlan ? (
                // The map takes drag gestures, so the planner under it is hard
                // to reach by scrolling: offer a direct way down to it.
                <Pressable accessibilityRole="button" onPress={() => scrollRef.current?.scrollToEnd({ animated: true })} style={styles.linkRow} hitSlop={8}>
                  <Ionicons name="navigate-outline" size={16} color={colors.green} />
                  <Text style={styles.link}>{t('courierMap.planRoute')}</Text>
                </Pressable>
              ) : (
                <Text style={styles.eta}>{t('courierMap.remaining')} : —</Text>
              )}
            </View>
            <View style={styles.action}>
              <MissionPrimaryAction mission={m} onHandover={openDetail} onPlan={openDetail} style={styles.actionBtn} />
            </View>
          </View>
          <Pressable accessibilityRole="link" onPress={openDetail} hitSlop={8}>
            <Text style={styles.detailLink}>{t('courierMap.openDetail')} ›</Text>
          </Pressable>
        </View>
      </>
    )
  })()

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <CourierTopBar title={t('courierMap.title')} />
      {body}
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.cream },
  scroll: { flex: 1 },
  /** The blue bar continues behind the top of the order card. */
  band: { position: 'absolute', top: 0, left: 0, right: 0, height: OVERLAP + spacing.md, backgroundColor: c.green },
  page: { padding: spacing.md, gap: spacing.md },
  note: { color: c.muted, fontSize: 13 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  link: { color: c.green, fontWeight: '700' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: c.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.xs,
    borderTopWidth: 1, borderColor: c.border, ...shadow.card,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  figures: { flex: 1, gap: 2 },
  distance: { color: c.ink, fontSize: 20, fontWeight: '900' },
  eta: { color: c.muted, fontSize: 13 },
  action: { flex: 1.3 },
  actionBtn: { minHeight: 48 },
  detailLink: { color: c.green, fontWeight: '700', fontSize: 13, textAlign: 'center' },
})
