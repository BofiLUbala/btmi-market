/**
 * The buyer-facing reading of a payment, derived only from what the backend stores.
 *
 * Selecting a payment method is not paying. For cash at delivery the payment stays DUE
 * from checkout until the assigned courier confirms, at the door, that the money is in
 * their hand; for mobile money it stays DUE or PROCESSING until the provider's webhook
 * confirms it. No screen may invent a settled state between those two facts.
 */
export interface PaymentLike {
  status?: string | null
  payment_method?: string | null
  payment_timing?: string | null
  confirmation_actor?: string | null
}

/** Business payment methods, exactly as the backend names them. */
export const CASH_ON_DELIVERY = 'CASH_ON_DELIVERY'
export const MOBILE_PAY_NOW = 'MOBILE_PAY_NOW'
export const MOBILE_AT_DELIVERY = 'MOBILE_AT_DELIVERY'

/** PAID is what every settlement writes; VERIFIED is the same fact on older rows. */
const SETTLED = ['PAID', 'VERIFIED']
const CLOSED = ['CANCELLED', 'REFUNDED']

export function paymentMethodOf(payment?: PaymentLike | null): string {
  return payment?.payment_method || CASH_ON_DELIVERY
}

/** True only once the backend has recorded that the money actually arrived. */
export function isPaymentPaid(payment?: PaymentLike | null): boolean {
  return !!payment && SETTLED.includes(payment.status ?? '')
}

/** Kept as the old name so existing call sites keep meaning "really paid". */
export const isPaymentConfirmed = isPaymentPaid

/** True while the buyer still owes the money and the payment is still open. */
export function isPaymentDue(payment?: PaymentLike | null): boolean {
  if (!payment) return false
  return !isPaymentPaid(payment) && !isPaymentCancelled(payment) && !isPaymentFailed(payment)
}

export const isPaymentPending = isPaymentDue

/** The buyer has asked the provider to charge them; the provider has not answered yet. */
export function isPaymentProcessing(payment?: PaymentLike | null): boolean {
  return payment?.status === 'PROCESSING'
}

export function isPaymentCancelled(payment?: PaymentLike | null): boolean {
  return !!payment && CLOSED.includes(payment.status ?? '')
}

export function isPaymentFailed(payment?: PaymentLike | null): boolean {
  return payment?.status === 'FAILED'
}

/** Cash owed at the door, settled by the courier and nobody else. */
export function isCashOnDelivery(payment?: PaymentLike | null): boolean {
  return paymentMethodOf(payment) === CASH_ON_DELIVERY
}

/** Paid before the courier leaves the shop, so nothing is owed at the door. */
export function isPayNow(payment?: PaymentLike | null): boolean {
  return paymentMethodOf(payment) === MOBILE_PAY_NOW
}

/** Mobile money, but due at the door: the provider still settles it, not the courier. */
export function isMobileAtDelivery(payment?: PaymentLike | null): boolean {
  return paymentMethodOf(payment) === MOBILE_AT_DELIVERY
}

/** Map a real backend payment to a user-facing translation key. */
export function paymentStatusKey(payment?: PaymentLike | null): string {
  if (!payment) return 'orders.payAtDelivery'
  if (payment.status === 'CANCELLED' || payment.status === 'REFUNDED') return 'orders.paymentCancelled'
  if (payment.status === 'FAILED') return 'orders.paymentFailed'
  if (isPaymentPaid(payment)) return 'orders.paymentPaid'
  if (isPaymentProcessing(payment)) return 'orders.paymentAwaitingProvider'
  return isCashOnDelivery(payment) ? 'orders.payAtDelivery' : 'orders.paymentDue'
}

/** Method label used wherever the buyer sees how they chose to pay. */
export function paymentMethodKey(method?: string | null): string {
  switch (method) {
    case MOBILE_PAY_NOW:
      return 'orders.mobilePayNow'
    case MOBILE_AT_DELIVERY:
      return 'orders.mobileOnDelivery'
    default:
      return 'orders.cashOnDelivery'
  }
}

/** Who the backend says settled the payment, for the buyer's own record. */
export function confirmationActorKey(actor?: string | null): string | null {
  switch (actor) {
    case 'COURIER':
      return 'orders.confirmedByCourier'
    case 'PROVIDER':
      return 'orders.confirmedByProvider'
    case 'ADMIN':
      return 'orders.confirmedByAdmin'
    default:
      return null
  }
}
