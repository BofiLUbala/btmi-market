import { get, post } from './client'
import type {
  ConfirmCashResponse,
  HandoverState,
  HandoverVerificationResult,
  ProductVerificationRequestBody
} from './types'

/**
 * The courier's side of the physical handover.
 *
 * Every call here is authorised against the courier's own assignment on the
 * server. Nothing the client sends decides an outcome: the scanned value is an
 * opaque reference the backend resolves, and the cash confirmation only ever
 * settles the buyer's payment, never TBK's commission.
 */
export const courierApi = {
  /** Where the handover stands, and what the courier is allowed to do next. */
  handover: (orderId: string) => get<HandoverState>(`/courier/missions/${orderId}/handover`),

  /**
   * Check the physical product against the order, by QR or by the reference
   * printed under it. A mismatch comes back as a verdict, not an error, so the
   * scanner can show which kind of mismatch it was.
   */
  verifyProduct: (orderId: string, body: ProductVerificationRequestBody) =>
    post<HandoverVerificationResult>(`/courier/missions/${orderId}/verify-product`, body),

  /** Record cash actually received at the door. */
  confirmCash: (orderId: string, idempotencyKey: string) =>
    post<ConfirmCashResponse>(`/courier/missions/${orderId}/confirm-cash`, {
      confirmed: true,
      idempotency_key: idempotencyKey
    })
}
