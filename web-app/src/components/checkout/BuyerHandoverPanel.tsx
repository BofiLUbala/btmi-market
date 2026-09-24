import { useCallback, useEffect, useState } from 'react'
import { buyerApi } from '@/api/buyer'
import { ApiError, type HandoverState } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ErrorBox } from '@/components/ui/Feedback'
import { formatMoney } from '@/lib/format'

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
  const [state, setState] = useState<HandoverState | null>(null)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const atDoor = HANDOVER_STATUSES.includes(deliveryStatus || '')

  const load = useCallback(async () => {
    try {
      setState(await buyerApi.handover(orderId))
    } catch {
      // No package yet, or not at the handover: nothing to show.
      setState(null)
    }
  }, [orderId])

  useEffect(() => {
    if (!atDoor) return
    void load()
    // The courier drives most of this (product check, cash), so poll while the
    // handover is open rather than waiting for the buyer to reload.
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
      setError(e instanceof ApiError ? e.message : 'La confirmation des articles a échoué.')
    } finally { setBusy(false) }
  }

  async function confirmReceipt() {
    setBusy(true); setError('')
    try {
      await buyerApi.confirmReceipt(orderId)
      setDone('Réception confirmée. Merci !')
      await load()
      onChanged()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'La confirmation de réception a échoué.')
    } finally { setBusy(false) }
  }

  return (
    <div className="card stack">
      <h2 style={{ fontSize: '1.1rem' }}>Remise de votre commande</h2>

      <div className="info-row">
        <span className="k">Paiement</span>
        <span className="v bold">
          {state.payment_verified
            ? isCash ? 'Paiement reçu · Payé (espèces remises au Livreur)' : 'Payé · confirmé par l’opérateur'
            : isCash ? `Espèces à remettre au Livreur : ${formatMoney(state.amount_due, state.currency)}` : 'En attente de votre paiement mobile'}
        </span>
      </div>
      <div className="info-row">
        <span className="k">Code de remise</span>
        <span className="v bold" style={{ fontSize: '1.15rem', letterSpacing: 1 }}>{state.order_number}</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Le livreur saisit ce code pour confirmer que c’est votre colis.</p>
      <div className="info-row">
        <span className="k">Produits vérifiés</span>
        <span className="v">{state.all_products_verified ? '✓ Oui' : 'Pas encore'}</span>
      </div>
      <div className="info-row">
        <span className="k">QR de remise scanné</span>
        <span className="v">{state.delivery_scanned ? '✓ Oui' : 'Pas encore'}</span>
      </div>

      {error && <ErrorBox error={error} />}
      {done && <p className="small">{done}</p>}

      {/* Per-line receipt form: each product in hand, as ordered, right quantity. */}
      {state.buyer_can_acknowledge && pendingLines.length > 0 && (
        <div className="stack">
          <strong>Confirmez chaque article reçu</strong>
          {pendingLines.map((line) => {
            const a = answerFor(line.order_line_id)
            const set = (key: keyof Answer) => (e: React.ChangeEvent<HTMLInputElement>) =>
              setAnswers((prev) => ({ ...prev, [line.order_line_id]: { ...a, [key]: e.target.checked } }))
            return (
              <fieldset key={line.order_line_id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 8 }}>
                <legend className="small">{line.product_name}{line.variant_name ? ` · ${line.variant_name}` : ''} × {line.quantity}</legend>
                <label className="small" style={{ display: 'block' }}><input type="checkbox" checked={a.product_received} onChange={set('product_received')} /> Article reçu</label>
                <label className="small" style={{ display: 'block' }}><input type="checkbox" checked={a.matches_order} onChange={set('matches_order')} /> Conforme à la commande</label>
                <label className="small" style={{ display: 'block' }}><input type="checkbox" checked={a.quantity_correct} onChange={set('quantity_correct')} /> Quantité correcte</label>
              </fieldset>
            )
          })}
          <Button variant="outline" loading={busy} disabled={!allAnswered} onClick={acknowledge}>
            Valider les articles
          </Button>
        </div>
      )}

      {!state.receipt_confirmed && (
        <>
          <Button loading={busy} disabled={!state.buyer_can_confirm_receipt} onClick={confirmReceipt}>
            Confirmer la réception
          </Button>
          {!state.buyer_can_confirm_receipt && (
            <p className="small muted">
              {!state.payment_verified
                ? 'Disponible une fois le paiement confirmé.'
                : !state.all_lines_acknowledged
                ? 'Validez d’abord chaque article reçu.'
                : !state.delivery_scanned
                ? 'Le Livreur doit d’abord scanner le QR de remise.'
                : 'Pas encore disponible.'}
            </p>
          )}
        </>
      )}
      {state.receipt_confirmed && <p className="small">✓ Commande remise et réception confirmée.</p>}
    </div>
  )
}
