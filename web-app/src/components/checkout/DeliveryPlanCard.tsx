import { useState } from 'react'
import type { DeliveryPlan } from '../../api/types'
import { useI18n } from '../../store/i18n'
import { cancelStageText, expectedDeliveryText } from '../../lib/deliveryPlan'
import { Button } from '../ui/Button'
import { ErrorBox } from '../ui/Feedback'

interface Props {
  plan: DeliveryPlan
  status: string
  deliveryStatus?: string
  deliveryMethod?: string
  /** Seller or commerce admin: offered while the parcel is travelling back. */
  onConfirmReturn?: () => Promise<unknown>
}

/**
 * The delivery commitment and outcome of one order, identical for buyer,
 * seller and commerce admin: the day and slot the courier set, failed
 * attempts, the stage of a cancellation and the return of the parcel.
 */
export function DeliveryPlanCard({ plan, status, deliveryStatus, deliveryMethod, onConfirmReturn }: Props) {
  const { t, lang } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (deliveryMethod === 'PICKUP' || deliveryMethod === 'DIGITAL') return null

  const when = expectedDeliveryText(plan, t, lang)
  const stage = cancelStageText(plan, t)
  const returning = deliveryStatus === 'RETURNING_TO_SELLER'
  const returned = deliveryStatus === 'RETURNED_TO_SELLER'
  const cancelled = status === 'CANCELLED'
  // Once handed over the promised day is history: say it was delivered.
  const delivered = ['DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION', 'RECEIVED'].includes(deliveryStatus || '') ||
    ['DELIVERED', 'RECEIVED', 'COMPLETED'].includes(status)
  if (cancelled && !stage && !returning && !returned) return null
  if (status === 'COMPLETED' && !when) return null

  async function confirmReturn() {
    if (!onConfirmReturn || !confirm(t('deliveryPlan.confirmReturnAsk'))) return
    setBusy(true); setError('')
    try { await onConfirmReturn() } catch (e) { setError(e instanceof Error ? e.message : t('deliveryPlan.confirmReturnFailed')) } finally { setBusy(false) }
  }

  return (
    <div className="card stack" style={{ gap: 6 }} data-testid="delivery-plan">
      <strong>{t('deliveryPlan.title')}</strong>
      {delivered
        ? <>
            <div className="bold" style={{ fontSize: '1.05rem' }}>✓ {t('deliveryPlan.delivered')}</div>
            {when && <div className="small muted">{t('deliveryPlan.wasPlanned', { when })}</div>}
          </>
        : !cancelled && (when
          ? <div className="bold" style={{ fontSize: '1.05rem' }}>📅 {when}</div>
          : <div className="small muted">{t('deliveryPlan.notSet')}</div>)}
      {!!plan.delivery_attempts && <div className="small">{t('deliveryPlan.attempts', { count: plan.delivery_attempts })}</div>}
      {stage && <div className="small bold">{stage}</div>}
      {returning && <div className="small">{t('deliveryPlan.returning')}</div>}
      {returned && plan.returned_to_seller_at && (
        <div className="small">✓ {t('deliveryPlan.returned', { date: new Date(plan.returned_to_seller_at).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR') })}</div>
      )}
      {error && <ErrorBox error={error} />}
      {returning && onConfirmReturn && (
        <Button loading={busy} onClick={confirmReturn}>{t('deliveryPlan.confirmReturn')}</Button>
      )}
    </div>
  )
}
