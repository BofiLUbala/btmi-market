import { useCallback, useEffect, useState, forwardRef } from 'react'
import { courierApi } from '@/api/courier'
import { ApiError, type ConfirmCashResponse, type HandoverState, type HandoverVerificationResult } from '@/api/types'
import { useI18n } from '@/store/i18n'
import { lineLabel } from '@/lib/lineLabel'
import { useOrderEvents } from '@/lib/orderEvents'
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

type StepState = 'COMPLETED' | 'CURRENT_ACTION' | 'WAITING_FOR_OTHER' | 'LOCKED'

interface StepInfo {
  key: string
  label: string
  state: StepState
  responsibleActor: string
  actionType?: 'VERIFY_PRODUCT' | 'CONFIRM_CASH' | 'SCAN_DELIVERY' | 'WAIT_PAYMENT' | 'WAIT_BUYER' | 'COMPLETED'
  primaryButtonText?: string
  canAct: boolean
  reason?: string
}

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
export const CourierHandoverPanel = forwardRef<HTMLElement, {
  orderId: string
  onActionReady?: () => void
}>(({ orderId, onActionReady }, ref) => {
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
  // acknowledged), and so does the action panel above it on the mission page: follow
  // every change of this order live, with a slow poll for when the stream is down.
  useOrderEvents(() => void load(), { orderId })
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { void load() }, 10_000)
    return () => window.clearInterval(timer)
  }, [load])

  // Notify parent when a new actionable step becomes available
  useEffect(() => {
    if (state && onActionReady) {
      const hasActiveAction = state.courier_can_verify_product ||
                              state.courier_can_confirm_cash ||
                              state.courier_can_scan_delivery
      if (hasActiveAction) {
        onActionReady()
      }
    }
  }, [state, onActionReady])

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

  async function scanDelivery() {
    // Navigate to the delivery scan page - the actual QR scanning happens there
    window.location.href = `/courier/scan?type=DELIVERY&order_id=${orderId}`
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

  // Build operational step list
  const steps: StepInfo[] = [
    {
      key: 'arrived',
      label: t('courier.handover.stepArrived'),
      state: state.courier_arrived ? 'COMPLETED' : 'LOCKED',
      responsibleActor: 'Livreur (Vous)',
      canAct: false,
      reason: state.courier_arrived ? undefined : 'Non encore arrivé'
    },
    {
      key: 'products_verified',
      label: `${t('courier.handover.stepVerified')} (${verifiedCount}/${state.lines.length})`,
      state: state.all_products_verified ? 'COMPLETED' :
             state.courier_arrived && !state.all_products_verified ? 'CURRENT_ACTION' : 'LOCKED',
      responsibleActor: 'Livreur (Vous)',
      actionType: 'VERIFY_PRODUCT',
      primaryButtonText: t('courier.handover.verifyTitle'),
      canAct: state.courier_can_verify_product === true,
      reason: state.courier_can_verify_product ? undefined : 'Produits non encore vérifiés'
    },
    {
      key: 'payment',
      label: isCash ? t('courier.handover.stepCashReceived') : t('courier.handover.stepProviderConfirmed'),
      state: state.payment_verified ? 'COMPLETED' :
             state.all_products_verified && !state.payment_verified ? 'CURRENT_ACTION' : 'LOCKED',
      responsibleActor: isCash ? 'Livreur (Vous)' : 'Acheteur / Opérateur',
      actionType: isCash ? 'CONFIRM_CASH' : 'WAIT_PAYMENT',
      primaryButtonText: isCash ? t('courier.handover.confirmCashAction') : undefined,
      canAct: state.courier_can_confirm_cash === true,
      reason: !state.all_products_verified ? 'Vérifiez d\'abord les produits' :
              state.payment_verified ? undefined :
              isCash ? 'En attente de confirmation espèces' : 'En attente de confirmation opérateur'
    },
    {
      key: 'scan_delivery',
      label: t('courier.handover.stepDeliveryScanned'),
      state: state.delivery_scanned ? 'COMPLETED' :
             state.all_products_verified && state.payment_verified && !state.delivery_scanned ? 'CURRENT_ACTION' : 'LOCKED',
      responsibleActor: 'Livreur (Vous)',
      actionType: 'SCAN_DELIVERY',
      primaryButtonText: 'Scanner le QR du colis',
      canAct: state.courier_can_scan_delivery === true,
      reason: state.courier_can_scan_delivery ? undefined : 'Produits et paiement requis'
    },
    {
      key: 'buyer_acknowledged',
      label: t('courier.handover.stepBuyerAcknowledged'),
      state: state.all_lines_acknowledged ? 'COMPLETED' :
             state.delivery_scanned && !state.all_lines_acknowledged ? 'WAITING_FOR_OTHER' : 'LOCKED',
      responsibleActor: 'Acheteur',
      actionType: 'WAIT_BUYER',
      canAct: false,
      reason: state.all_lines_acknowledged ? undefined : 'Acheteur doit confirmer les articles'
    },
    {
      key: 'delivered',
      label: t('courier.handover.stepDelivered'),
      state: state.receipt_confirmed ? 'COMPLETED' :
             state.all_lines_acknowledged && state.delivery_scanned && state.payment_verified ? 'CURRENT_ACTION' : 'LOCKED',
      responsibleActor: 'Acheteur',
      actionType: 'WAIT_BUYER',
      canAct: false,
      reason: state.receipt_confirmed ? undefined : 'Confirmation acheteur requise'
    }
  ]

  steps.find(s => s.state === 'CURRENT_ACTION')

  return (
    <section ref={ref} className="courier-card" style={{ marginTop: 16 }}>
      <h2>{t('courier.handover.title')}</h2>

      <div className="courier-details">
        <Row label={t('courier.dashboard.order')} value={`#${state.order_number}`} />
        <Row label={t('courier.handover.buyer')} value={state.buyer_name || '—'} />
        <Row label={t(isCash ? 'courier.handover.amountToCollect' : state.payment_verified ? 'courier.handover.amountSettledMobile' : 'courier.handover.amountPaidMobile')} value={amount} />
        <Row label={t('courier.handover.mode')} value={paymentModeLabel(state)} />
        <Row label={t('courier.handover.paymentStatus')} value={state.payment_verified ? t('courier.handover.paid') : state.payment_status} />
      </div>

      {/* Operational step list with clear states */}
      <ol style={{ listStyle: 'none', margin: '12px 0', padding: 0 }}>
        {steps.map((step) => (
          <StepItem
            key={step.key}
            step={step}
          />
        ))}
      </ol>

      {/* Product check at the door. */}
      {state.lines.length > 0 && (
        <div className="courier-details" style={{ marginBottom: 12 }}>
          {state.lines.map((line) => (
            <Row
              key={line.order_line_id}
              label={`${lineLabel(line.product_name, line.variant_name)} × ${line.quantity}`}
              value={t(line.product_verified ? 'courier.handover.lineVerified' : 'courier.handover.lineToVerify')}
            />
          ))}
        </div>
      )}

      {/* Product verification input — only when actionable */}
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
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            onKeyDown={(e) => { if (e.key === 'Enter' && productCode.trim() && !verifying) void verifyProduct() }}
            // 16px keeps iOS Safari from zooming into the field on small screens.
            style={{ minHeight: 48, padding: '0 12px', borderRadius: 10, fontSize: 16, width: '100%', boxSizing: 'border-box' }}
          />
          <small className="courier-muted">{t('courier.handover.verifyHint')}</small>
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
          {verdict.reason === 'ORDER_NUMBER_NOT_PRODUCT'
            ? t('courier.handover.verdict.ORDER_NUMBER_NOT_PRODUCT')
            : VERDICTS.includes(verdict.result) ? t(`courier.handover.verdict.${verdict.result}` as TranslationKey) : verdict.result}
        </p>
      )}

      {error && <div className="courier-error">{error}</div>}

      {receipt && (
        <p className="courier-muted">
          ✓ {t('courier.handover.cashRecorded', { amount: money(receipt.amount_collected, receipt.currency, lang) })}
          {receipt.commission_status && !receipt.commission_collected
            ? ` · ${t('courier.handover.commissionStillDue')}`
            : ''}
        </p>
      )}

      {/* Cash confirmation — only when actionable */}
      {isCash && !state.payment_verified && !asking && state.courier_can_confirm_cash && (
        <button
          className="courier-btn courier-btn-primary"
          onClick={() => setAsking(true)}
          disabled={busy}
          aria-disabled={busy}
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

      {/* Delivery scan button — only when actionable */}
      {state.courier_can_scan_delivery && (
        <button
          className="courier-btn courier-btn-primary courier-btn-scan"
          onClick={() => void scanDelivery()}
          disabled={busy}
        >
          {t('courier.handover.stepDeliveryScanned')}
        </button>
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
})

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="courier-detail">
      <label>{label}</label>
      {value || '—'}
    </div>
  )
}

function StepItem({ step }: { step: StepInfo }) {
  const stateStyles: Record<StepState, { opacity: number; prefix: string }> = {
    COMPLETED: { opacity: 1, prefix: '✓' },
    CURRENT_ACTION: { opacity: 1, prefix: '●' },
    WAITING_FOR_OTHER: { opacity: 0.6, prefix: '⟳' },
    LOCKED: { opacity: 0.35, prefix: '🔒' }
  }
  const style = stateStyles[step.state]

  return (
    <li style={{ padding: '6px 0', opacity: style.opacity }}>
      <strong>{style.prefix} {step.label}</strong>
      <div className="courier-muted" style={{ fontSize: '0.85rem', marginTop: 2 }}>
        {step.responsibleActor && `Responsable: ${step.responsibleActor}`}
        {step.reason && ` · ${step.reason}`}
      </div>
    </li>
  )
}

CourierHandoverPanel.displayName = 'CourierHandoverPanel'