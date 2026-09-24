import { useMemo, useState } from 'react'
import { Alert, StyleSheet, Text } from 'react-native'
import type { DeliveryPlan } from '../types'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { spacing, type Colors } from '../theme'
import { cancelStageText, expectedDeliveryText, returnedText } from '../lib/deliveryPlan'
import { Button, Card } from './ui'

interface Props {
  plan: DeliveryPlan
  status: string
  deliveryStatus?: string
  deliveryMethod?: string
  /** Seller or commerce admin: offered while the parcel travels back. */
  onConfirmReturn?: () => Promise<unknown>
}

/**
 * One order's delivery commitment and outcome, the same for buyer, seller and
 * commerce admin: the courier's day and slot, failed attempts, the stage of a
 * cancellation and the return of the parcel.
 */
export function DeliveryPlanCard({ plan, status, deliveryStatus, deliveryMethod, onConfirmReturn }: Props) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { t, lang } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (deliveryMethod === 'PICKUP' || deliveryMethod === 'DIGITAL') return null

  const when = expectedDeliveryText(plan, t, lang)
  const stage = cancelStageText(plan, t)
  const returned = returnedText(plan, t, lang)
  const returning = deliveryStatus === 'RETURNING_TO_SELLER'
  const cancelled = status === 'CANCELLED'
  if (cancelled && !stage && !returning && !returned) return null
  if (status === 'COMPLETED' && !when) return null

  const confirmReturn = () => Alert.alert(t('deliveryPlan.confirmReturn'), t('deliveryPlan.confirmReturnAsk'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('deliveryPlan.confirmReturn'),
      onPress: async () => {
        setBusy(true); setError('')
        try { await onConfirmReturn?.() } catch (e) { setError(e instanceof Error ? e.message : t('deliveryPlan.confirmReturnFailed')) } finally { setBusy(false) }
      },
    },
  ])

  return (
    <Card>
      <Text style={styles.title}>{t('deliveryPlan.title')}</Text>
      {!cancelled ? (when ? <Text style={styles.when}>📅 {when}</Text> : <Text style={styles.muted}>{t('deliveryPlan.notSet')}</Text>) : null}
      {plan.delivery_attempts ? <Text style={styles.muted}>{t('deliveryPlan.attempts', { count: plan.delivery_attempts })}</Text> : null}
      {stage ? <Text style={styles.stage}>{stage}</Text> : null}
      {returning ? <Text style={styles.muted}>{t('deliveryPlan.returning')}</Text> : null}
      {returned ? <Text style={styles.success}>✓ {returned}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {returning && onConfirmReturn ? <Button title={t('deliveryPlan.confirmReturn')} loading={busy} onPress={confirmReturn} /> : null}
    </Card>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  title: { color: c.ink, fontWeight: '900', fontSize: 16, marginBottom: spacing.xs },
  when: { color: c.green, fontWeight: '900', fontSize: 17, textTransform: 'capitalize' },
  muted: { color: c.muted },
  stage: { color: c.ink, fontWeight: '800' },
  success: { color: c.success, fontWeight: '800' },
  error: { color: c.danger, fontWeight: '700' },
})
