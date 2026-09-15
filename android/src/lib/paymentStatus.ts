import type { TranslationKey } from '../store/i18n'
import type { BuyerPayment } from '../types'

/**
 * The buyer-facing reading of a payment, derived only from what the backend stores.
 *
 * Selecting a payment method is not paying. Cash at delivery stays DUE from checkout
 * until the assigned courier confirms, at the door, that the money is in their hand;
 * mobile money stays DUE or PROCESSING until the operator's webhook confirms it. No
 * screen may invent a settled state between those two facts.
 */

export const CASH_ON_DELIVERY = 'CASH_ON_DELIVERY'
export const MOBILE_PAY_NOW = 'MOBILE_PAY_NOW'
export const MOBILE_AT_DELIVERY = 'MOBILE_AT_DELIVERY'

/** PAID is what every settlement writes; VERIFIED is the same fact on older rows. */
const SETTLED = ['PAID', 'VERIFIED']

export function paymentMethodOf(p?: BuyerPayment | null): string {
  return p?.payment_method || CASH_ON_DELIVERY
}

export function isPaymentPaid(p?: BuyerPayment | null | undefined): boolean {
  return !!p && SETTLED.includes(p.status || '')
}

/** Kept as the old name so existing call sites keep meaning "really paid". */
export const isPaymentConfirmed = isPaymentPaid

export function isPaymentCancelled(p?: BuyerPayment | null | undefined): boolean {
  return !!p && ['CANCELLED', 'REFUNDED'].includes(p.status || '')
}

export function isPaymentFailed(p?: BuyerPayment | null | undefined): boolean {
  return !!p && p.status === 'FAILED'
}

export function isPaymentProcessing(p?: BuyerPayment | null | undefined): boolean {
  return !!p && p.status === 'PROCESSING'
}

/** True while the buyer still owes the money and the payment is still open. */
export function isPaymentPending(p?: BuyerPayment | null | undefined): boolean {
  return !!p && !isPaymentPaid(p) && !isPaymentCancelled(p) && !isPaymentFailed(p)
}

export function isCashOnDelivery(p?: BuyerPayment | null): boolean {
  return paymentMethodOf(p) === CASH_ON_DELIVERY
}

export function isPayNow(p?: BuyerPayment | null): boolean {
  return paymentMethodOf(p) === MOBILE_PAY_NOW
}

export function isMobileAtDelivery(p?: BuyerPayment | null): boolean {
  return paymentMethodOf(p) === MOBILE_AT_DELIVERY
}

/** Map a real backend payment to a user-facing translation key. */
export function paymentStatusKey(p?: BuyerPayment | null | undefined): TranslationKey {
  if (!p) return 'orders.payAtDelivery'
  if (isPaymentCancelled(p)) return 'orders.paymentCancelled'
  if (isPaymentFailed(p)) return 'orders.paymentFailed'
  if (isPaymentPaid(p)) return 'orders.paymentPaid'
  if (isPaymentProcessing(p)) return 'orders.paymentAwaitingProvider'
  return isCashOnDelivery(p) ? 'orders.payAtDelivery' : 'orders.paymentDue'
}

/** Method label used wherever the buyer sees how they chose to pay. */
export function paymentMethodKey(method?: string | null): TranslationKey {
  if (method === MOBILE_PAY_NOW) return 'orders.mobilePayNow'
  if (method === MOBILE_AT_DELIVERY) return 'orders.mobileOnDelivery'
  return 'orders.cashOnDelivery'
}

/** Who the backend says settled the payment, for the buyer's own record. */
export function confirmationActorKey(actor?: string | null): TranslationKey | null {
  if (actor === 'COURIER') return 'orders.confirmedByCourier'
  if (actor === 'PROVIDER') return 'orders.confirmedByProvider'
  if (actor === 'ADMIN') return 'orders.confirmedByAdmin'
  return null
}
