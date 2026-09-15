import { useCallback, useEffect, useState } from 'react'
import { courierApi } from '@/api/courier'
import type { ConfirmCashResponse, HandoverState } from '@/api/types'
import { useI18n } from '@/store/i18n'

const CASH_ON_DELIVERY = 'CASH_ON_DELIVERY'

function money(amount: number, currency: string, lang: string): string {
  return `${amount.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

/**
 * The courier's side of the physical handover.
 *
 * Cash at delivery is settled here and nowhere else: the courier is the only actor
 * standing at the door when the money changes hands. The button is enabled solely by
 * `courier_can_confirm_cash`, which the server sets once the courier has arrived and
 * every product has been verified against the order, so this screen can never offer a
 * step the backend would refuse. Mobile money is deliberately not confirmable here - a
 * courier tapping a button is not evidence that an operator moved funds.
 */
export function CourierHandoverPanel({ orderId }: { orderId: string }) {
  const { t, lang } = useI18n()
  const [state, setState] = useState<HandoverState | null>(null)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<ConfirmCashResponse | null>(null)

  const load = useCallback(async () => {
    try {
      setState(await courierApi.handover(orderId))
      setError('')
    } catch {
      setError(t('courier.handover.loadError'))
    }
  }, [orderId, t])

  useEffect(() => { void load() }, [load])

  async function confirmCash() {
    setBusy(true)
    setError('')
    try {
      // A fresh key per confirmation, so a retried request is recognised by the server
      // as the same collection rather than counted as a second one.
      const result = await courierApi.confirmCash(orderId, crypto.randomUUID())
      setReceipt(result)
      setAsking(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('courier.handover.cashFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (!state) return null

  const isCash = state.payment_method === CASH_ON_DELIVERY
  const amount = money(state.amount_due, state.currency, lang)

  return (
    <section className="courier-card" style={{ marginTop: 16 }}>
      <h2>{t('courier.handover.title')}</h2>

      <div className="courier-details">
        <Row label={t('courier.dashboard.order')} value={`#${state.order_number}`} />
        <Row label={t('courier.handover.buyer')} value={state.buyer_name || '—'} />
        <Row label={t('courier.handover.method')} value={state.payment_method} />
        <Row label={t('courier.handover.amountDue')} value={amount} />
        <Row label={t('courier.handover.paymentStatus')} value={state.payment_status} />
      </div>

      <ol style={{ listStyle: 'none', margin: '12px 0', padding: 0 }}>
        <Step done={state.courier_arrived} label={t('courier.handover.stepArrived')} />
        <Step done={state.all_products_verified} label={t('courier.handover.stepVerified')} />
        <Step
          done={state.payment_verified}
          label={t(isCash ? 'courier.handover.stepCashReceived' : 'courier.handover.stepProviderConfirmed')}
        />
        <Step done={state.all_lines_acknowledged} label={t('courier.handover.stepBuyerAcknowledged')} />
        <Step done={state.receipt_confirmed} label={t('courier.handover.stepDelivered')} />
      </ol>

      {error && <div className="courier-error">{error}</div>}

      {receipt && (
        <p className="courier-muted">
          ✓ {t('courier.handover.cashRecorded', { amount: money(receipt.amount_collected, receipt.currency, lang) })}
          {/* The buyer is settled; TBK's own commission is a separate ledger. */}
          {receipt.commission_status && !receipt.commission_collected
            ? ` · ${t('courier.handover.commissionStillDue')}`
            : ''}
        </p>
      )}

      {isCash && state.courier_can_confirm_cash && !asking && (
        <button className="courier-btn courier-btn-primary" onClick={() => setAsking(true)} disabled={busy}>
          {t('courier.handover.confirmCashAction')}
        </button>
      )}

      {isCash && asking && (
        <div role="alertdialog" aria-label={t('courier.handover.confirmCashAction')} className="courier-details" style={{ marginTop: 12 }}>
          <p><strong>{t('courier.handover.confirmCashQuestion', { amount })}</strong></p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="courier-btn courier-btn-quiet" onClick={() => setAsking(false)} disabled={busy}>
              {t('common.cancel')}
            </button>
            <button className="courier-btn courier-btn-primary" onClick={() => void confirmCash()} disabled={busy}>
              {busy ? t('common.loading') : t('courier.handover.confirmCashSubmit')}
            </button>
          </div>
        </div>
      )}

      {/* Why the button is not there yet, so the courier is never left guessing. */}
      {isCash && !state.courier_can_confirm_cash && !state.payment_verified && (
        <p className="courier-muted">
          {t(state.all_products_verified
            ? 'courier.handover.cashBlockedOther'
            : 'courier.handover.cashNeedsVerification')}
        </p>
      )}
      {!isCash && !state.payment_verified && (
        <p className="courier-muted">{t('courier.handover.mobileNotCourierConfirmed')}</p>
      )}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="courier-detail">
      <label>{label}</label>
      {value || '—'}
    </div>
  )
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <li style={{ padding: '6px 0', opacity: done ? 1 : 0.45 }}>
      <strong>{done ? '✓' : '○'} {label}</strong>
    </li>
  )
}
