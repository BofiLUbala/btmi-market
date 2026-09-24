import { get, post, patch } from './client'
import type {
  ConfirmCashResponse,
  HandoverState,
  HandoverVerificationResult,
  ProductVerificationRequestBody,
  CourierProfile,
  CourierMission,
  CourierHistory,
  QRScanResponse
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
  /** Get the courier's profile information. */
  getProfile: () => get<CourierProfile>('/courier/profile'),

  /** Update the courier's availability status. */
  updateAvailability: (availability: 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE') =>
    patch('/courier/availability', { availability }),

  /** Get all missions assigned to the courier. */
  getMissions: () => get<CourierMission[]>(`/courier/missions`),

  /** Get a single mission by order ID. */
  getMission: (orderId: string) => get<CourierMission>(`/courier/missions/${orderId}`),

  /** Get the courier's delivery history. */
  getHistory: (limit?: number) =>
    get<CourierHistory[]>(`/courier/history${limit ? `?limit=${limit}` : ''}`),

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
    }),

  /** Accept a mission assigned to the courier. */
  accept: (orderId: string) =>
    post<{ message: string }>(`/courier/missions/${orderId}/accept`, {}),

  /** Reject a mission assigned to the courier. */
  reject: (orderId: string, reason: string) =>
    post<{ message: string }>(`/courier/missions/${orderId}/reject`, { reason }),

  /** Confirm pickup of the order at the seller's location. */
  pickup: (orderId: string) =>
    post<{ message: string }>(`/courier/missions/${orderId}/pickup`, {}),

  /** Start the delivery (mark as in transit). */
  start: (orderId: string) =>
    post<{ message: string }>(`/courier/missions/${orderId}/start`, {}),

  /** Arrive at the delivery destination. */
  arrive: (orderId: string) =>
    post<{ message: string }>(`/courier/missions/${orderId}/arrive`, {}),

  /** Day and slot the buyer will receive the parcel; required before leaving. */
  setExpectedDelivery: (orderId: string, date: string, slot: string) =>
    post<{ message: string }>(`/courier/missions/${orderId}/expected-delivery`, { date, slot }),

  /** Nobody took the parcel: a new attempt at the given day and slot, or a return after the last one. */
  buyerNotFound: (orderId: string, body: { reason: string; notes?: string; next_date?: string; next_slot?: string }) =>
    post<{ outcome: 'RESCHEDULED' | 'RETURNING_TO_SELLER'; delivery_attempts: number }>(`/courier/missions/${orderId}/buyer-not-found`, body),

  /** Report a failed delivery. */
  fail: (orderId: string, reason: string) =>
    post<{ message: string }>(`/courier/missions/${orderId}/fail`, { reason }),

  /** Scan a pickup QR code at the seller's location. */
  scanPickup: (orderId: string, token: string) =>
    post<QRScanResponse>(`/courier/scans/pickup`, {
      token,
      order_id: orderId,
      idempotency_key: `pickup:${orderId}:${token}`,
      device_metadata: { platform: 'web' }
    }),

  /** Scan a delivery QR code at the buyer's location. */
  scanDelivery: (orderId: string, token: string) =>
    post<QRScanResponse>(`/courier/scans/delivery`, {
      token,
      order_id: orderId,
      idempotency_key: `delivery:${orderId}:${token}`,
      device_metadata: { platform: 'web' }
    }),
}
