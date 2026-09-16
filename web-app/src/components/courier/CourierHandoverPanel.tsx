import { useCallback, useEffect, useState } from 'react'
import { courierApi } from '@/api/courier'
import { ApiError, type ConfirmCashResponse, type HandoverState, type HandoverVerificationResult } from '@/api/types'
import { useI18n } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

const CASH_ON_DELIVERY = 'CASH_ON_DELIVERY'

const PROVIDER_LABEL: Record<string, string> = {
  MPESA: 'M-Pesa',
  AIRTEL_MONEY: 'Airtel Money',
  ORANGE_MONEY: 'Orange Money'
}

function money(amount: number, currency: string, lang: string): string {
  return `${amount.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

const VERDICTS: string[] = ['VALID', 'ALREADY_USED', 'WRONG_ORDER', 'WRONG_PRODUCT', 'WRONG_VARIANT', 'WRONG_SHOP', 'INVALID_QR']

/**
 * The courier's side of the physical handover.
 *
 * Cash at delivery is settled here and nowhere else: the courier is the only actor
 * standing at the door when the money changes hands. The confirm button is usable
 * solely when `courier_can_confirm_cash` is set, which the server does once the
 * courier has arrived and every product has been verified against the order, so
 * this screen can never offer a step the backend would refuse. Mobile money is
 * deliberately not confirmable here - a courier tapping a button is not evidence
 * that an operator moved funds.
 */
export function CourierHandoverPanel({ orderId }: { orderId: string }) {
  const { t, lang } = useI18n()
  const [state, setState] = useState<HandoverState | null>(null)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<ConfirmCashResponse | null>(null)
  const [productCode, setProductCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verdict, setVerdict] = useState<HandoverVerificationResult | null>(null)

  const load = useCallback(async () => {
    try {
      setState(await courierApi.handover(orderId))
      setError('')
    } catch {
      setError(t('courier.handover.loadError'))
    }
  }, [orderId, t])

  // The buyer's side moves this state too (a mobile payment settling, lines being
  // acknowledged), so the panel keeps itself current rather than going stale.
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { void load() }, 10_000)
    return () => window.clearInterval(timer)
  }, [load])

  /**
   * Checks the parcel in hand against the order: the QR on the product label, or
   * the PRD-/VAR- number printed under it when the camera cannot read it. The
   * expected number is never shown here - the courier reads it off the parcel, or
   * the check would prove nothing.
   */
  async function verifyProduct() {
    const code = productCode.trim()
    if (!code) return
    setVerifying(true)
    setError('')
    setVerdict(null)
    try {
      const isQrToken = code.toLowerCase().startsWith('tbk.')
      const result = await courierApi.verifyProduct(
        orderId,
        isQrToken ? { token: code } : { product_number: code }
      )
      setVerdict(result)
      if (result.result === 'VALID' || result.result === 'ALREADY_USED') setProductCode('')
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('courier.handover.verifyFailed'))
    } finally {
      setVerifying(false)
    }
  }

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

  /** How the buyer pays, in the words the courier says out loud at the door. */
  const paymentModeLabel = (current: HandoverState): string => {
    if (current.payment_method === CASH_ON_DELIVERY) return t('courier.handover.modeCash')
    const provider = current.payment_provider ? PROVIDER_LABEL[current.payment_provider] ?? current.payment_provider : ''
    return provider ? `${t('courier.handover.modeMobile')} · ${provider}` : t('courier.handover.modeMobile')
  }

  const isCash = state.payment_method === CASH_ON_DELIVERY
  const amount = money(state.amount_due, state.currency, lang)
  const verifiedCount = state.lines.filter((line) => line.product_verified).length

  return (
    <section className="courier-card" style={{ marginTop: 16 }}>
      <h2>{t('courier.handover.title')}</h2>

      <div className="courier-details">
        <Row label={t('courier.dashboard.order')} value={`#${state.order_number}`} />
        <Row label={t('courier.handover.buyer')} value={state.buyer_name || '—'} />
        <Row label={t(isCash ? 'courier.handover.amountToCollect' : state.payment_verified ? 'courier.handover.amountSettledMobile' : 'courier.handover.amountPaidMobile')} value={amount} />
        <Row label={t('courier.handover.mode')} value={paymentModeLabel(state)} />
        <Row label={t('courier.handover.paymentStatus')} value={state.payment_verified ? t('courier.handover.paid') : state.payment_status} />
      </div>

      <ol style={{ listStyle: 'none', margin: '12px 0', padding: 0 }}>
        <Step done={state.courier_arrived} label={t('courier.handover.stepArrived')} />
        <Step done={state.all_products_verified} label={`${t('courier.handover.stepVerified')} (${verifiedCount}/${state.lines.length})`} />
        <Step
          done={state.payment_verified}
          label={t(isCash ? 'courier.handover.stepCashReceived' : 'courier.handover.stepProviderConfirmed')}
        />
        <Step done={state.delivery_scanned} label={t('courier.handover.stepDeliveryScanned')} />
        <Step done={state.all_lines_acknowledged} label={t('courier.handover.stepBuyerAcknowledged')} />
        <Step done={state.receipt_confirmed} label={t('courier.handover.stepDelivered')} />
      </ol>

      {/* Product check at the door. */}
      {state.lines.length > 0 && (
        <div className="courier-details" style={{ marginBottom: 12 }}>
          {state.lines.map((line) => (
            <Row
              key={line.order_line_id}
              label={`${line.product_name}${line.variant_name ? ` · ${line.variant_name}` : ''} × ${line.quantity}`}
              value={t(line.product_verified ? 'courier.handover.lineVerified' : 'courier.handover.lineToVerify')}
            />
          ))}
        </div>
      )}

      {state.courier_can_verify_product && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <label htmlFor={`verify-${orderId}`}><strong>{t('courier.handover.verifyTitle')}</strong></label>
          <input
            id={`verify-${orderId}`}
            name="product_code"
            value={productCode}
            onChange={(e) => setProductCode(e.target.value)}
            placeholder={t('courier.handover.verifyPlaceholder')}
            autoComplete="off"
            style={{ minHeight: 44, padding: '0 12px', borderRadius: 10 }}
          />
          <button
            className="courier-btn courier-btn-scan"
            onClick={() => void verifyProduct()}
            disabled={verifying || !productCode.trim()}
          >
            {verifying ? t('common.loading') : t('courier.handover.verifyTitle')}
          </button>
        </div>
      )}
      {verdict && (
        <p className={verdict.result === 'VALID' || verdict.result === 'ALREADY_USED' ? 'courier-muted' : 'courier-error'} role="status">
          {VERDICTS.includes(verdict.result) ? t(`courier.handover.verdict.${verdict.result}` as TranslationKey) : verdict.result}
        </p>
      )}

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

      {/* Cash: the button is always visible once there is cash to collect, and only
          usable when the server says the goods have been checked. */}
      {isCash && !state.payment_verified && !asking && (
        <button
          className="courier-btn courier-btn-primary"
          onClick={() => setAsking(true)}
          disabled={busy || !state.courier_can_confirm_cash}
          aria-disabled={busy || !state.courier_can_confirm_cash}
        >
          {t('courier.handover.confirmCashAction')}
        </button>
      )}

      {isCash && asking && state.courier_can_confirm_cash && (
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

      {/* Why the button is not usable yet, so the courier is never left guessing. */}
      {isCash && !state.courier_can_confirm_cash && !state.payment_verified && (
        <p className="courier-muted">
          {t(state.courier_arrived && !state.all_products_verified
            ? 'courier.handover.cashNeedsVerification'
            : 'courier.handover.cashBlockedOther')}
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
