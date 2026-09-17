import { useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
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

/** In-flight stages where a delivery can still fail: after pickup, before the delivery scan. */
const FAILABLE_STATUSES = ['PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED']
/** Suggested wording only: the backend stores the reason as free text (max 100 chars). */
const FAIL_REASON_KEYS = ['courier.failReason.buyerUnreachable', 'courier.failReason.buyerAbsent', 'courier.failReason.wrongAddress', 'courier.failReason.buyerRefused', 'courier.failReason.packageDamaged'] as const
const FAIL_REASON_MAX = 100

/** Next mission step, offered only in the delivery stage where the backend accepts it. */
export function MissionActions({ mission: m, compact = false }: { mission: CourierMission; compact?: boolean }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [failing, setFailing] = useState(false)
  const [failReason, setFailReason] = useState('')
  const [failNotes, setFailNotes] = useState('')

  const act = useMutation({
    mutationFn: (action: 'accept' | 'reject' | 'start' | 'arrive' | 'fail') =>
      action === 'accept' ? courierApi.acceptMission(m.order_id)
        : action === 'reject' ? courierApi.rejectMission(m.order_id, reason.trim())
          : action === 'start' ? courierApi.startDelivery(m.order_id)
            : action === 'fail' ? courierApi.failDelivery(m.order_id, failReason.trim(), failNotes.trim())
              : courierApi.arrive(m.order_id),
    onSuccess: () => {
      setError(''); setRejecting(false); setReason(''); setFailing(false); setFailReason(''); setFailNotes('')
      invalidateCourierMission(queryClient, m.order_id)
      void queryClient.invalidateQueries({ queryKey: ['courier', 'history'] })
      void queryClient.invalidateQueries({ queryKey: ['courier', 'profile'] })
    },
    onError: (e) => { setError(e instanceof ApiError && e.message ? e.message : t('common.actionImpossible')); invalidateCourierMission(queryClient, m.order_id) },
  })

  const status = m.delivery_status
  const canScanPickup = ['COURIER_ACCEPTED', 'READY_FOR_PICKUP'].includes(status) && ['READY', 'READY_FOR_PICKUP'].includes(m.status)

  return (
    <View style={styles.actions}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {status === 'COURIER_ASSIGNED' ? <>
        <Button title={t('courier.accept')} loading={act.isPending} onPress={() => act.mutate('accept')} />
        {rejecting ? <>
          <Field label={t('courier.rejectReason')} value={reason} onChangeText={setReason} />
          <Button variant="outline" title={t('courier.confirmReject')} disabled={!reason.trim()} loading={act.isPending} onPress={() => act.mutate('reject')} />
        </> : <Button variant="outline" title={t('courier.reject')} onPress={() => setRejecting(true)} />}
      </> : null}
      {['COURIER_ACCEPTED', 'READY_FOR_PICKUP'].includes(status) && !canScanPickup ? <Text style={styles.muted}>{t('courier.waitSeller')}</Text> : null}
      {canScanPickup ? <Button title={t('courier.scanPickup')} onPress={() => router.push({ pathname: '/courier/scan', params: { type: 'PICKUP', order_id: m.order_id } })} /> : null}
      {status === 'PICKED_UP' ? <Button title={t('courier.startDelivery')} loading={act.isPending} onPress={() => act.mutate('start')} /> : null}
      {status === 'IN_TRANSIT' ? (
        <Button
          title={t('courier.arrived')}
          loading={act.isPending}
          onPress={() => Alert.alert(t('courier.arrived'), t('courier.arrivedConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('courier.arrived'), onPress: () => act.mutate('arrive') },
          ])}
        />
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
            onPress={() => Alert.alert(t('courier.failTitle'), t('courier.failConfirmBody'), [
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
  failBox: { gap: spacing.sm, borderWidth: 1, borderColor: c.danger, borderRadius: radius.sm, padding: spacing.sm },
  failTitle: { color: c.danger, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn: { borderColor: c.danger, backgroundColor: c.dangerSoft },
  chipText: { color: c.ink, fontSize: 13 },
  chipTextOn: { color: c.danger, fontSize: 13, fontWeight: '800' },
})
