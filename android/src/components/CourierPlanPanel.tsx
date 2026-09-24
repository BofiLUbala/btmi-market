import { useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { courierApi } from '../api'
import { ApiError } from '../api/client'
import { Button } from './ui'
import { useI18n, type TranslationKey } from '../store/i18n'
import { useColors } from '../store/theme'
import { radius, spacing, type Colors } from '../theme'
import { invalidateCourierMission } from '../lib/courier'
import { DELIVERY_SLOTS, deliveryDays, expectedDeliveryText, formatDeliveryDay } from '../lib/deliveryPlan'
import type { CourierMission } from '../types'

const REASONS: TranslationKey[] = ['courierPlan.reason.unreachable', 'courierPlan.reason.absent', 'courierPlan.reason.wrongAddress']

/**
 * The courier's delivery-plan actions once they hold the parcel: the day and
 * slot the buyer will receive it (required before leaving), the report when
 * the buyer cannot be found, and the notice for a parcel going back to the shop.
 */
export function CourierPlanPanel({ mission: m }: { mission: CourierMission }) {
  const { t, lang } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const days = useMemo(() => deliveryDays(), [])
  const [date, setDate] = useState(m.expected_delivery_date || days[0])
  const [slot, setSlot] = useState<string>(m.expected_delivery_slot || 'AFTERNOON')
  const [editing, setEditing] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState<TranslationKey>(REASONS[0])
  const [nextDate, setNextDate] = useState(days[1])
  const [nextSlot, setNextSlot] = useState<string>('MORNING')
  const [error, setError] = useState('')

  const onError = (e: unknown) => setError(e instanceof ApiError && e.message ? e.message : t('courierPlan.saveFailed'))
  const done = () => { setError(''); invalidateCourierMission(queryClient, m.order_id) }
  const save = useMutation({
    mutationFn: () => courierApi.setExpectedDelivery(m.order_id, date, slot),
    onSuccess: () => { setEditing(false); done() },
    onError,
  })
  const lastAttempt = (m.delivery_attempts || 0) + 1 >= 2
  const report = useMutation({
    mutationFn: () => courierApi.buyerNotFound(m.order_id, lastAttempt ? { reason: t(reason) } : { reason: t(reason), next_date: nextDate, next_slot: nextSlot }),
    onSuccess: () => { setReporting(false); done() },
    onError: (e) => setError(e instanceof ApiError && e.message ? e.message : t('courierPlan.notFoundFailed')),
  })

  if (m.delivery_status === 'RETURNING_TO_SELLER') {
    return (
      <View style={styles.notice}>
        <Text style={styles.title}>{t('courierPlan.returnTitle')}</Text>
        <Text style={styles.muted}>{t('courierPlan.returnBody')}</Text>
      </View>
    )
  }
  if (!['PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED'].includes(m.delivery_status)) return null

  const planned = expectedDeliveryText(m, t, lang)
  const chips = (values: readonly string[], selected: string, onPick: (v: string) => void, label: (v: string) => string) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {values.map((v) => (
        <Pressable key={v} onPress={() => onPick(v)} accessibilityRole="radio" accessibilityState={{ selected: v === selected }} style={[styles.chip, v === selected && styles.chipOn]}>
          <Text style={v === selected ? styles.chipTextOn : styles.chipText}>{label(v)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
  const dayLabel = (d: string) => formatDeliveryDay(d, lang)
  const slotLabel = (s: string) => t(`deliveryPlan.slot.${s}` as TranslationKey)

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{t('courierPlan.title')}</Text>
      {planned ? <Text style={styles.planned}>📅 {planned}</Text> : <Text style={styles.muted}>{t('courierPlan.required')}</Text>}
      {m.delivery_attempts ? <Text style={styles.muted}>{t('deliveryPlan.attempts', { count: m.delivery_attempts })}</Text> : null}

      {!planned || editing ? (
        <View style={styles.block}>
          <Text style={styles.label}>{t('courierPlan.day')}</Text>
          {chips(days, date, setDate, dayLabel)}
          <Text style={styles.label}>{t('courierPlan.slot')}</Text>
          {chips(DELIVERY_SLOTS, slot, setSlot, slotLabel)}
          <Button title={t('courierPlan.save')} loading={save.isPending} onPress={() => save.mutate()} />
        </View>
      ) : (
        <Button variant="outline" title={t('courierPlan.change')} onPress={() => setEditing(true)} />
      )}

      {['IN_TRANSIT', 'COURIER_ARRIVED'].includes(m.delivery_status) ? (reporting ? (
        <View style={[styles.block, styles.danger]}>
          <Text style={styles.dangerTitle}>{t('courierPlan.notFound')}</Text>
          <Text style={styles.label}>{t('courierPlan.notFoundReason')}</Text>
          {chips(REASONS, reason, (v) => setReason(v as TranslationKey), (v) => t(v as TranslationKey))}
          {lastAttempt ? <Text style={styles.muted}>{t('courierPlan.notFoundLast')}</Text> : <>
            <Text style={styles.label}>{t('courierPlan.notFoundNext')}</Text>
            {chips(days, nextDate, setNextDate, dayLabel)}
            {chips(DELIVERY_SLOTS, nextSlot, setNextSlot, slotLabel)}
          </>}
          <Button
            title={t(lastAttempt ? 'courierPlan.notFoundLastSubmit' : 'courierPlan.notFoundSubmit')}
            loading={report.isPending}
            onPress={() => lastAttempt
              ? Alert.alert(t('courierPlan.notFound'), t('courierPlan.notFoundLast'), [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('courierPlan.notFoundLastSubmit'), style: 'destructive', onPress: () => report.mutate() },
                ])
              : report.mutate()}
          />
          <Button variant="outline" title={t('common.cancel')} onPress={() => setReporting(false)} />
        </View>
      ) : <Button variant="outline" title={t('courierPlan.notFound')} onPress={() => setReporting(true)} />) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  box: { gap: spacing.sm, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm },
  notice: { gap: 4, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm, backgroundColor: c.greenSoft },
  block: { gap: spacing.xs },
  title: { color: c.ink, fontWeight: '900' },
  planned: { color: c.ink, fontWeight: '900', fontSize: 16, textTransform: 'capitalize' },
  label: { color: c.muted, fontWeight: '700', fontSize: 13 },
  muted: { color: c.muted },
  chips: { gap: spacing.xs, paddingVertical: 2 },
  chip: { borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { borderColor: c.ink, backgroundColor: c.ink },
  chipText: { color: c.ink, fontSize: 13, textTransform: 'capitalize' },
  chipTextOn: { color: c.white, fontSize: 13, fontWeight: '800', textTransform: 'capitalize' },
  danger: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: spacing.sm },
  dangerTitle: { color: c.danger, fontWeight: '900' },
  error: { color: c.danger, fontWeight: '700' },
})
