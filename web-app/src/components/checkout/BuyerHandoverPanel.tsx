import { useCallback, useEffect, useState } from 'react'
import { buyerApi } from '@/api/buyer'
import { ApiError, type HandoverState } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ErrorBox } from '@/components/ui/Feedback'
import { formatMoney } from '@/lib/format'
import { useOrderEvents } from '@/lib/orderEvents'
import { useI18n } from '@/store/i18n'
import { lineLabel } from '@/lib/lineLabel'

// RECEIVED is included so the buyer sees the handover confirmed, not a card that vanishes.
const HANDOVER_STATUSES = ['COURIER_ARRIVED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION', 'RECEIVED']

type Answer = { product_received: boolean; matches_order: boolean; quantity_correct: boolean }

/**
 * The buyer's side of the handover at the door.
 *
 * Every control here is driven by the flags the server computes for this order
 * (buyer_can_acknowledge, buyer_can_confirm_receipt, payment_verified), so the
 * buyer is never offered a step the backend would refuse. Before this panel the
 * per-line acknowledgement had an endpoint but no screen, which meant receipt
 * confirmation - which requires it - could never succeed from the app.
 *
 * Nothing here can mark a payment paid. The buyer sees "Payé" only once the
 * courier has confirmed the cash or the operator has confirmed the transfer.
 */
export function BuyerHandoverPanel({ orderId, deliveryStatus, onChanged }: {
  orderId: string
  deliveryStatus?: string
  onChanged: () => void
}) {
  const { t } = useI18n()
  const [state, setState] = useState<HandoverState | null>(null)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const atDoor = HANDOVER_STATUSES.includes(deliveryStatus || '')

  const load = useCallback(async () => {
    try {
      setState(await buyerApi.handover(orderId))
    } catch (e) {
      // No package yet, or not at the handover: nothing to show. Any other
      // failure (network blip, API restart) keeps what the buyer already sees.
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) setState(null)
    }
  }, [orderId])

  // The courier drives this (parcel check, cash): follow it live.
  useOrderEvents(() => { if (atDoor) void load() }, { orderId })

  useEffect(() => {
    if (!atDoor) return
    void load()
    // Slow fallback for when the live stream is down.
    const timer = window.setInterval(() => { void load() }, 10_000)
    return () => window.clearInterval(timer)
  }, [atDoor, load])

  if (!atDoor || !state) return null

  const isCash = state.payment_method === 'CASH_ON_DELIVERY'
  const answerFor = (lineId: string): Answer =>
    answers[lineId] ?? { product_received: false, matches_order: false, quantity_correct: false }
  const pendingLines = state.lines.filter((line) => !line.buyer_acknowledged)
  const allAnswered = pendingLines.every((line) => {
    const a = answerFor(line.order_line_id)
    return a.product_received && a.matches_order && a.quantity_correct
  })

  async function acknowledge() {
    setBusy(true); setError('')
    try {
      const next = await buyerApi.acknowledgeHandover(
        orderId,
        pendingLines.map((line) => ({ order_line_id: line.order_line_id, ...answerFor(line.order_line_id) }))
      )
      setState(next)
      onChanged()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('handover.ackFailed'))
    } finally { setBusy(false) }
  }

  async function confirmReceipt() {
    setBusy(true); setError('')
    try {
      await buyerApi.confirmReceipt(orderId)
      await load()
      onChanged()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('handover.receiptFailed'))
    } finally { setBusy(false) }
  }

  return (
    <div className="card stack">
      <h2 style={{ fontSize: '1.1rem' }}>{t('handover.buyerTitle')}</h2>

      <div className="info-row">
        <span className="k">{t('handover.payment')}</span>
        <span className="v bold">
          {state.payment_verified
            ? isCash ? t('handover.paidCash') : t('handover.paidMobile')
            : isCash ? t('handover.cashToHand', { amount: formatMoney(state.amount_due, state.currency) }) : t('handover.awaitingMobile')}
        </span>
      </div>
      <div className="info-row">
        <span className="k">{t('handover.orderCode')}</span>
        <span className="v bold" style={{ fontSize: '1.15rem', letterSpacing: 1 }}>{state.order_number}</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>{t('handover.orderCodeHint')}</p>
      <div className="info-row">
        <span className="k">{t('handover.productsVerified')}</span>
        <span className="v">{state.all_products_verified ? `✓ ${t('handover.yes')}` : t('handover.notYet')}</span>
      </div>

      {error && <ErrorBox error={error} />}

      {/* Per-line receipt form: each product in hand, as ordered, right quantity. */}
      {state.buyer_can_acknowledge && pendingLines.length > 0 && (
        <div className="stack">
          <strong>{t('handover.confirmEachItem')}</strong>
          {pendingLines.map((line) => {
            const a = answerFor(line.order_line_id)
            const set = (key: keyof Answer) => (e: React.ChangeEvent<HTMLInputElement>) =>
              setAnswers((prev) => ({ ...prev, [line.order_line_id]: { ...a, [key]: e.target.checked } }))
            return (
              <fieldset key={line.order_line_id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 8 }}>
                <legend className="small">{lineLabel(line.product_name, line.variant_name)} × {line.quantity}</legend>
                <label className="small" style={{ display: 'block' }}><input type="checkbox" checked={a.product_received} onChange={set('product_received')} /> {t('handover.itemReceived')}</label>
                <label className="small" style={{ display: 'block' }}><input type="checkbox" checked={a.matches_order} onChange={set('matches_order')} /> {t('handover.itemMatches')}</label>
                <label className="small" style={{ display: 'block' }}><input type="checkbox" checked={a.quantity_correct} onChange={set('quantity_correct')} /> {t('handover.itemQuantity')}</label>
              </fieldset>
            )
          })}
          <Button variant="outline" loading={busy} disabled={!allAnswered} onClick={acknowledge}>
            {t('handover.validateItems')}
          </Button>
        </div>
      )}

      {!state.receipt_confirmed && (
        <>
          <Button loading={busy} disabled={!state.buyer_can_confirm_receipt} onClick={confirmReceipt}>
            {t('handover.confirmReceipt')}
          </Button>
          {!state.buyer_can_confirm_receipt && (
            <p className="small muted">
              {/* Same order the server checks them in: goods, then each line, then money. */}
              {!state.all_products_verified
                ? t('handover.blockedProducts')
                : !state.all_lines_acknowledged
                ? t('handover.blockedAck')
                : !state.payment_verified
                ? t('handover.blockedPayment')
                : t('handover.blockedOther')}
            </p>
          )}
        </>
      )}
      {state.receipt_confirmed && <p className="small">✓ {t('handover.receiptDone')}</p>}
    </div>
  )
}
