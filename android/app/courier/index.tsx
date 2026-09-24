import { useMemo, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { courierApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { MissionActions } from '../../src/components/CourierMissionActions'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'
import { courierStatusLabel } from '../../src/lib/courier'
import type { CourierAvailability, CourierMission } from '../../src/types'

const FINISHED = ['RECEIVED', 'DELIVERED', 'FAILED', 'CANCELLED', 'COURIER_REJECTED', 'RETURNED_TO_SELLER']

/**
 * Courier missions, the same endpoints as the web courier dashboard:
 * ASSIGNED → ACCEPTED → READY_FOR_PICKUP → PICKED_UP → IN_TRANSIT → ARRIVED.
 * Each button only appears in the stage where the backend accepts it.
 */
export default function CourierMissionsScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const missions = useQuery({
    queryKey: ['courier', 'missions'],
    queryFn: courierApi.missions,
    refetchInterval: 15_000,
  })

  if (missions.isLoading) return <Loading label={t('common.loading')} />
  if (missions.isError) {
    const notCourier = missions.error instanceof ApiError && [403, 404].includes(missions.error.status)
    return <ErrorState message={notCourier ? t('courier.notCourier') : t('courier.missionsFailed')} retry={() => void missions.refetch()} />
  }

  const all = missions.data ?? []
  const active = all.filter((m) => !FINISHED.includes(m.delivery_status))
  const finished = all.filter((m) => FINISHED.includes(m.delivery_status))

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={missions.isRefetching} onRefresh={() => { void missions.refetch(); void queryClient.invalidateQueries({ queryKey: ['courier', 'profile'] }) }} />}
    >
      <AvailabilityCard />
      <Button variant="outline" title={t('courier.history')} onPress={() => router.push('/courier/history')} />
      <SectionTitle title={t('courier.activeMissions', { count: active.length })} />
      {active.length === 0 ? <Card><Text style={styles.muted}>{t('courier.noMission')}</Text></Card> : null}
      {active.map((m) => <MissionCard key={m.order_id} mission={m} />)}
      {finished.length > 0 ? <SectionTitle title={t('courier.finishedMissions')} /> : null}
      {finished.map((m) => <MissionCard key={m.order_id} mission={m} />)}
    </ScrollView>
  )
}

const AVAILABILITY_KEYS = {
  AVAILABLE: 'courier.availability.AVAILABLE',
  BUSY: 'courier.availability.BUSY',
  UNAVAILABLE: 'courier.availability.UNAVAILABLE',
} as const

/** Current availability from the backend, switched with PATCH /courier/availability. */
function AvailabilityCard() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
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
  const current = profile.data.availability
  const active = profile.data.status === 'ACTIVE'

  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={styles.title}>{t('courier.availabilityTitle')}</Text>
        <Text style={[styles.status, current === 'AVAILABLE' ? { color: colors.success } : current === 'BUSY' ? { color: colors.gold } : { color: colors.muted }]}>
          {AVAILABILITY_KEYS[current] ? t(AVAILABILITY_KEYS[current]) : current}
        </Text>
      </View>
      {!active ? <Text style={styles.muted}>{t('courier.notActive')}</Text> : null}
      {current === 'BUSY' ? <Text style={styles.muted}>{t('courier.busyHint')}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.toggleRow}>
        <Button
          dense
          style={styles.toggle}
          variant={current === 'AVAILABLE' ? 'primary' : 'outline'}
          title={t('courier.availability.AVAILABLE')}
          disabled={!active || current === 'AVAILABLE'}
          loading={update.isPending && update.variables === 'AVAILABLE'}
          onPress={() => update.mutate('AVAILABLE')}
        />
        <Button
          dense
          style={styles.toggle}
          variant={current === 'UNAVAILABLE' ? 'primary' : 'outline'}
          title={t('courier.availability.UNAVAILABLE')}
          disabled={!active || current === 'UNAVAILABLE'}
          loading={update.isPending && update.variables === 'UNAVAILABLE'}
          onPress={() => update.mutate('UNAVAILABLE')}
        />
      </View>
    </Card>
  )
}

function MissionCard({ mission: m }: { mission: CourierMission }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={styles.title}>#{m.order_number}</Text>
        <Text style={styles.status}>{courierStatusLabel(t, m.delivery_status)}</Text>
      </View>
      <Text style={styles.muted}>{t('courier.pickupAt')} : {m.shop_name}{m.shop_address ? ` · ${m.shop_address}` : ''}</Text>
      <Text style={styles.muted}>{t('courier.deliverTo')} : {m.delivery_contact}{m.delivery_address ? ` · ${m.delivery_address}` : ''}</Text>
      {m.delivery_phone ? <Text style={styles.muted}>{t('editProfile.phone')} : {m.delivery_phone}</Text> : null}
      <MissionActions mission={m} />
    </Card>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  title: { color: c.ink, fontWeight: '900', fontSize: 17 },
  status: { color: c.green, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  muted: { color: c.muted },
  error: { color: c.danger, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  toggle: { flex: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
})
