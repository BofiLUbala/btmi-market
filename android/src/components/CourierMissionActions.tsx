import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { confirmAction } from '../lib/confirmAction'
import { router } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { courierApi } from '../api'
import { ApiError } from '../api/client'
import { Button, Field } from './ui'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, spacing, type Colors } from '../theme'
import { invalidateCourierMission } from '../lib/courier'
import type { CourierMission } from '../types'
import { CourierPlanPanel } from './CourierPlanPanel'
import { CourierTrackingBanner } from './CourierTrackingBanner'
import { startCourierTracking, startCourierTrackingIfIdle, stopCourierTracking } from '../lib/courierTracking'

/** In-flight stages where a delivery can still fail: after pickup, before the delivery scan. */
const FAILABLE_STATUSES = ['PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED']
/** Suggested wording only: the backend stores the reason as free text (max 100 chars). */
const FAIL_REASON_KEYS = ['courier.failReason.buyerUnreachable', 'courier.failReason.buyerAbsent', 'courier.failReason.wrongAddress', 'courier.failReason.buyerRefused', 'courier.failReason.packageDamaged'] as const
const FAIL_REASON_MAX = 100

type MissionAction = 'accept' | 'reject' | 'pickup' | 'start' | 'arrive' | 'fail'
type ActionInput = { reason?: string; failReason?: string; failNotes?: string }

/** Statuses where the parcel is at the buyer's door: the handover card takes over. */
export const HANDOVER_STATUSES = ['COURIER_ARRIVED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION', 'RECEIVED']

/** Pickup is open once the courier accepted and the seller has the parcel ready. */
export function canScanPickupOf(m: CourierMission): boolean {
  return ['COURIER_ACCEPTED', 'READY_FOR_PICKUP'].includes(m.delivery_status) && ['READY', 'READY_FOR_PICKUP'].includes(m.status)
}

/**
 * The one mutation every mission step goes through, shared by the full action
 * list and the single primary button (itinerary, sticky footer): same
 * endpoints, same GPS rules, same refetches.
 */
export function useMissionAction(m: CourierMission, onDone?: () => void) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  // An error belongs to the step it was raised on: once the mission moved on
  // (refetch after success, or another device advanced it) it no longer applies.
  useEffect(() => { setError('') }, [m.delivery_status])
  const act = useMutation({
    mutationFn: ({ action, input = {} }: { action: MissionAction; input?: ActionInput }) =>
      action === 'accept' ? courierApi.acceptMission(m.order_id)
        : action === 'reject' ? courierApi.rejectMission(m.order_id, (input.reason ?? '').trim())
          : action === 'pickup' ? courierApi.confirmPickup(m.order_id)
          : action === 'start' ? courierApi.startDelivery(m.order_id)
            : action === 'fail' ? courierApi.failDelivery(m.order_id, (input.failReason ?? '').trim(), (input.failNotes ?? '').trim())
              : courierApi.arrive(m.order_id),
    onSuccess: (_data, { action }) => {
      // GPS follows the server's answer, never the other way round: sharing
      // starts once the acceptance is confirmed (the buyer follows the courier
      // to the shop) and stops on arrival. A refused permission never undoes
      // or blocks the delivery step.
      if (action === 'accept') void startCourierTrackingIfIdle(m.order_id)
      if (action === 'pickup' || action === 'start') void startCourierTracking(m.order_id)
      if (action === 'arrive' || action === 'fail') void stopCourierTracking()
      setError('')
      onDone?.()
      invalidateCourierMission(queryClient, m.order_id)
      void queryClient.invalidateQueries({ queryKey: ['courier', 'history'] })
      void queryClient.invalidateQueries({ queryKey: ['courier', 'profile'] })
      void queryClient.invalidateQueries({ queryKey: ['courier', 'courierLocation', m.order_id] })
    },
    onError: (e) => { setError(e instanceof ApiError && e.message ? e.message : t('common.actionImpossible')); invalidateCourierMission(queryClient, m.order_id) },
  })
  const run = (action: MissionAction, input?: ActionInput) => act.mutate({ action, input })
  return { run, pending: act.isPending, error }
}

export type PrimaryStep = 'accept' | 'pickup' | 'wait' | 'start' | 'arrive' | 'handover' | null

/** The mission's one next step, in MissionActions' own order; null when there is none. */
export function primaryStepOf(m: CourierMission, withHandover = false): PrimaryStep {
  const status = m.delivery_status
  if (status === 'COURIER_ASSIGNED') return 'accept'
  if (canScanPickupOf(m)) return 'pickup'
  if (['COURIER_ACCEPTED', 'READY_FOR_PICKUP'].includes(status)) return 'wait'
  if (status === 'PICKED_UP') return 'start'
  if (status === 'IN_TRANSIT') return 'arrive'
  if (withHandover && HANDOVER_STATUSES.includes(status) && status !== 'RECEIVED') return 'handover'
  return null
}

/** "Je suis arrive" ends the buyer's live map: always asked first. */
function confirmArrival(t: ReturnType<typeof useI18n>['t'], run: () => void) {
  confirmAction(t('courier.arrived'), t('courier.arrivedConfirm'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('courier.arrived'), onPress: run },
  ])
}

/**
 * The single next step of the mission, as one big button: the same transitions
 * as MissionActions, nothing more. Refusing, failing and the delivery plan stay
 * on the mission page. `onHandover` is offered at the door (the handover card
 * lives on the mission page); without it nothing is shown there.
 */
export function MissionPrimaryAction({ mission: m, onHandover, onPlan, style }: {
  mission: CourierMission
  onHandover?: () => void
  /** Where to set the delivery slot when leaving is blocked on it. */
  onPlan?: () => void
  style?: StyleProp<ViewStyle>
}) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { run, pending, error } = useMissionAction(m)
  const step = primaryStepOf(m, !!onHandover)

  let button: ReactNode = null
  let note: string | null = null
  if (step === 'accept') {
    button = <Button title={t('courier.accept')} loading={pending} onPress={() => run('accept')} style={style} />
  } else if (step === 'pickup') {
    button = <Button title={t('courierMap.pickedUp')} loading={pending} onPress={() => run('pickup')} style={style} />
  } else if (step === 'wait') {
    note = t('courier.waitSeller')
  } else if (step === 'start') {
    button = <Button title={t('courier.startDelivery')} loading={pending} disabled={!m.expected_delivery_date} onPress={() => run('start')} style={style} />
    if (!m.expected_delivery_date) note = t('courierPlan.required')
  } else if (step === 'arrive') {
    button = <Button title={t('courier.arrived')} loading={pending} onPress={() => confirmArrival(t, () => run('arrive'))} style={style} />
  } else if (step === 'handover' && onHandover) {
    button = <Button title={t('courierMap.handover')} onPress={onHandover} style={style} />
  }
  if (!button && !note && !error) return null
  return (
    <View style={styles.primaryWrap}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {note ? (
        onPlan && step === 'start'
          ? <Pressable accessibilityRole="link" onPress={onPlan}><Text style={styles.link}>{note}</Text></Pressable>
          : <Text style={styles.muted}>{note}</Text>
      ) : null}
      {button}
    </View>
  )
}

/**
 * Next mission step, offered only in the delivery stage where the backend accepts it.
 * hidePrimary: the screen already shows MissionPrimaryAction (sticky footer), so
 * only the secondary steps (refuse, scan, delivery plan, failure) are listed here.
 */
export function MissionActions({ mission: m, compact = false, hidePrimary = false }: { mission: CourierMission; compact?: boolean; hidePrimary?: boolean }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [failing, setFailing] = useState(false)
  const [failReason, setFailReason] = useState('')
  const [failNotes, setFailNotes] = useState('')
  const { run, pending, error } = useMissionAction(m, () => {
    setRejecting(false); setReason(''); setFailing(false); setFailReason(''); setFailNotes('')
  })
  const act = { isPending: pending, mutate: (action: MissionAction) => run(action, { reason, failReason, failNotes }) }

  const status = m.delivery_status
  const canScanPickup = canScanPickupOf(m)

  return (
    <View style={styles.actions}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {status === 'COURIER_ASSIGNED' ? <>
        {!hidePrimary ? <Button title={t('courier.accept')} loading={act.isPending} onPress={() => act.mutate('accept')} /> : null}
        {rejecting ? <>
          <Field label={t('courier.rejectReason')} value={reason} onChangeText={setReason} />
          <Button variant="outline" title={t('courier.confirmReject')} disabled={!reason.trim()} loading={act.isPending} onPress={() => act.mutate('reject')} />
        </> : <Button variant="outline" title={t('courier.reject')} onPress={() => setRejecting(true)} />}
      </> : null}
      {['COURIER_ACCEPTED', 'READY_FOR_PICKUP'].includes(status) && !canScanPickup && !hidePrimary ? <Text style={styles.muted}>{t('courier.waitSeller')}</Text> : null}
      {canScanPickup ? <>
        {!hidePrimary ? <Button title={t('courier.confirmPickup')} loading={act.isPending} onPress={() => act.mutate('pickup')} /> : null}
        <Button variant="outline" title={t('courier.scanPickup')} onPress={() => router.push({ pathname: '/courier/scan', params: { type: 'PICKUP', order_id: m.order_id } })} />
      </> : null}
      <CourierPlanPanel mission={m} />
      {['IN_TRANSIT', 'COURIER_ARRIVED'].includes(status) ? <CourierTrackingBanner orderId={m.order_id} /> : null}
      {status === 'PICKED_UP' && !hidePrimary ? <Button title={t('courier.startDelivery')} loading={act.isPending} disabled={!m.expected_delivery_date} onPress={() => act.mutate('start')} /> : null}
      {status === 'IN_TRANSIT' && !hidePrimary ? (
        <Button title={t('courier.arrived')} loading={act.isPending} onPress={() => confirmArrival(t, () => act.mutate('arrive'))} />
      ) : null}
      {FAILABLE_STATUSES.includes(status) ? (failing ? (
        <View style={styles.failBox}>
          <Text style={styles.failTitle}>{t('courier.failTitle')}</Text>
          <View style={styles.chips}>
            {FAIL_REASON_KEYS.map((key) => {
              const label = t(key)
              const selected = failReason === label
              return (
                <Pressable key={key} onPress={() => setFailReason(label)} accessibilityRole="radio" accessibilityState={{ selected }} style={[styles.chip, selected && styles.chipOn]}>
                  <Text style={selected ? styles.chipTextOn : styles.chipText}>{label}</Text>
                </Pressable>
              )
            })}
          </View>
          <Field label={t('courier.failReasonLabel')} value={failReason} maxLength={FAIL_REASON_MAX} onChangeText={setFailReason} />
          <Field label={t('courier.failNotes')} value={failNotes} multiline onChangeText={setFailNotes} />
          <Button
            title={t('courier.failConfirm')}
            disabled={!failReason.trim()}
            loading={act.isPending}
            onPress={() => confirmAction(t('courier.failTitle'), t('courier.failConfirmBody'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('courier.failConfirm'), style: 'destructive', onPress: () => act.mutate('fail') },
            ])}
          />
          <Button variant="outline" title={t('common.cancel')} onPress={() => setFailing(false)} />
        </View>
      ) : <Button variant="outline" title={t('courier.failDelivery')} onPress={() => setFailing(true)} />) : null}
      {status === 'FAILED' ? <Text style={styles.error}>{t('courier.failedNote')}</Text> : null}
      {!compact ? <Button variant="outline" title={t('courier.openMission')} onPress={() => router.push({ pathname: '/courier/[id]', params: { id: m.order_id } })} /> : null}
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  muted: { color: c.muted },
  error: { color: c.danger, fontWeight: '700' },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  primaryWrap: { gap: spacing.xs },
  link: { color: c.green, fontWeight: '700', textDecorationLine: 'underline' },
  failBox: { gap: spacing.sm, borderWidth: 1, borderColor: c.danger, borderRadius: radius.sm, padding: spacing.sm },
  failTitle: { color: c.danger, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn: { borderColor: c.danger, backgroundColor: c.dangerSoft },
  chipText: { color: c.ink, fontSize: 13 },
  chipTextOn: { color: c.danger, fontSize: 13, fontWeight: '800' },
})
