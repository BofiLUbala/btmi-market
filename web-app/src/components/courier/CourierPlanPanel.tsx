import { useState } from 'react'
import type { CourierMission } from '@/api/types'
import { courierApi } from '@/api/courier'
import { useI18n } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'
import { DELIVERY_SLOTS, deliveryToday, expectedDeliveryText } from '@/lib/deliveryPlan'

const REASONS: TranslationKey[] = ['courierPlan.reason.unreachable', 'courierPlan.reason.absent', 'courierPlan.reason.wrongAddress']

/**
 * Mounted with a stable key so a date or reason being typed survives the
 * dashboard's refreshes. It owns the courier's delivery-plan actions: the day
 * and slot committed to after pickup, the "buyer not found" report, and the
 * notice for a parcel that has to go back to the seller.
 */
export function CourierPlanPanel({ mission: m, onChanged }: { mission: CourierMission; onChanged: () => void | Promise<void> }) {
  const { t, lang } = useI18n()
  const [date, setDate] = useState(m.expected_delivery_date || deliveryToday())
  const [slot, setSlot] = useState<string>(m.expected_delivery_slot || 'AFTERNOON')
  const [editing, setEditing] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState<string>(t(REASONS[0]))
  const [nextDate, setNextDate] = useState(deliveryToday(1))
  const [nextSlot, setNextSlot] = useState<string>('MORNING')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (m.delivery_status === 'RETURNING_TO_SELLER') {
    return (
      <div className="courier-glass courier-alert courier-alert-info" style={{ marginTop: 12 }}>
        <div><strong>{t('courierPlan.returnTitle')}</strong><p style={{ margin: '4px 0 0' }}>{t('courierPlan.returnBody')}</p></div>
      </div>
    )
  }
  if (!['PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED'].includes(m.delivery_status)) return null

  const planned = expectedDeliveryText(m, t, lang)
  const lastAttempt = (m.delivery_attempts || 0) + 1 >= 2
  const showDateForm = !planned || editing

  async function run(fn: () => Promise<unknown>, onDone?: () => void) {
    setBusy(true); setError('')
    try { await fn(); onDone?.(); await onChanged() }
    catch (e) { setError(e instanceof Error ? e.message : t('courierPlan.notFoundFailed')) }
    finally { setBusy(false) }
  }

  const slotSelect = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="courier-input">
      {DELIVERY_SLOTS.map((s) => <option key={s} value={s}>{t(`deliveryPlan.slot.${s}` as TranslationKey)}</option>)}
    </select>
  )

  return (
    <div className="courier-glass courier-section" style={{ marginTop: 12 }} data-testid="courier-plan">
      <p className="courier-eyebrow">{t('courierPlan.title')}</p>
      {planned && <h3 style={{ margin: '4px 0' }}>📅 {planned}</h3>}
      {!!m.delivery_attempts && <p className="courier-muted">{t('deliveryPlan.attempts', { count: m.delivery_attempts })}</p>}
      {!planned && <p className="courier-muted">{t('courierPlan.required')}</p>}

      {showDateForm ? (
        <div className="courier-actions" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="courier-fact"><small>{t('courierPlan.day')}</small>
            <input type="date" className="courier-input" value={date} min={deliveryToday()} max={deliveryToday(14)} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="courier-fact"><small>{t('courierPlan.slot')}</small>{slotSelect(slot, setSlot)}</label>
          <button disabled={busy || !date} className="courier-btn courier-btn-primary" onClick={() => void run(() => courierApi.setExpectedDelivery(m.order_id, date, slot), () => setEditing(false))}>
            {t('courierPlan.save')}
          </button>
        </div>
      ) : (
        <button className="courier-btn courier-btn-quiet" onClick={() => setEditing(true)}>{t('courierPlan.change')}</button>
      )}

      {['IN_TRANSIT', 'COURIER_ARRIVED'].includes(m.delivery_status) && (
        reporting ? (
          <div className="stack" style={{ marginTop: 12 }}>
            <strong>{t('courierPlan.notFound')}</strong>
            <label className="courier-fact"><small>{t('courierPlan.notFoundReason')}</small>
              <select className="courier-input" value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map((k) => <option key={k} value={t(k)}>{t(k)}</option>)}
              </select>
            </label>
            {lastAttempt ? (
              <p className="courier-muted">{t('courierPlan.notFoundLast')}</p>
            ) : (
              <div className="courier-actions" style={{ flexWrap: 'wrap' }}>
                <label className="courier-fact"><small>{t('courierPlan.notFoundNext')}</small>
                  <input type="date" className="courier-input" value={nextDate} min={deliveryToday()} max={deliveryToday(14)} onChange={(e) => setNextDate(e.target.value)} />
                </label>
                <label className="courier-fact"><small>{t('courierPlan.slot')}</small>{slotSelect(nextSlot, setNextSlot)}</label>
              </div>
            )}
            <div className="courier-actions">
              <button
                disabled={busy}
                className="courier-btn courier-btn-danger"
                onClick={() => void run(() => courierApi.buyerNotFound(m.order_id, lastAttempt ? { reason } : { reason, next_date: nextDate, next_slot: nextSlot }), () => setReporting(false))}
              >
                {t(lastAttempt ? 'courierPlan.notFoundLastSubmit' : 'courierPlan.notFoundSubmit')}
              </button>
              <button className="courier-btn courier-btn-quiet" onClick={() => setReporting(false)}>{t('common.cancel')}</button>
            </div>
          </div>
        ) : (
          <div className="courier-actions" style={{ marginTop: 12 }}>
            <button className="courier-btn courier-btn-danger" onClick={() => setReporting(true)}>{t('courierPlan.notFound')}</button>
          </div>
        )
      )}
      {error && <p className="courier-muted" role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    </div>
  )
}
