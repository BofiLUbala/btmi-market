export interface PaymentLike {
  status?: string | null
  payment_method?: string | null
  buyer_confirmed?: boolean
  seller_confirmed?: boolean
}

const CASH = 'CASH'
const PAY_NOW = 'PAY_NOW'
const MOBILE_PAY = 'MOBILE_PAY'
const MOBILE_ON_DELIVERY = 'MOBILE_ON_DELIVERY'

/** True only once the backend has actually confirmed the payment (VERIFIED or CONFIRMED with both party flags). */
export function isPaymentConfirmed(payment?: PaymentLike | null): boolean {
  if (!payment) return false
  if (payment.status === 'VERIFIED') return true
  return payment.status === 'CONFIRMED' && !!payment.buyer_confirmed && !!payment.seller_confirmed
}

/** True while the buyer still must pay (nothing confirmed yet and the flow is still open). */
export function isPaymentPending(payment?: PaymentLike | null): boolean {
  if (!payment) return false
  return !isPaymentConfirmed(payment) && !['CANCELLED', 'FAILED'].includes(payment.status ?? '')
}

export function isPaymentCancelled(payment?: PaymentLike | null): boolean {
  return !!payment && payment.status === 'CANCELLED'
}

export function isPaymentFailed(payment?: PaymentLike | null): boolean {
  return !!payment && payment.status === 'FAILED'
}

/** Map a real backend payment to a user-facing translation key. No frontend-only states are invented. */
export function paymentStatusKey(payment?: PaymentLike | null): string {
  const status = payment?.status || 'PENDING'
  const method = payment?.payment_method || CASH

  if (status === 'CANCELLED') return 'orders.paymentCancelled'
  if (status === 'FAILED') return 'orders.paymentFailed'

  if (method === CASH) {
    if (status === 'VERIFIED') return 'orders.paymentConfirmed'
    if (payment?.buyer_confirmed && !payment?.seller_confirmed) return 'orders.paymentInProgress'
    return 'orders.payAtDelivery'
  }

  if (method === MOBILE_ON_DELIVERY) {
    if (isPaymentConfirmed(payment)) return 'orders.paymentConfirmed'
    return 'orders.paymentPending'
  }

  // PAY_NOW / MOBILE families — backend-driven states only.
  if (isPaymentConfirmed(payment)) return 'orders.paymentConfirmed'
  return 'orders.paymentPending'
}

/** Method label used in the buyer order card. */
export function paymentMethodKey(method?: string | null): string {
  if (method === CASH || !method) return 'orders.cashOnDelivery'
  if (method === MOBILE_ON_DELIVERY) return 'orders.mobileOnDelivery'
  return 'orders.payment'
}

export { CASH, PAY_NOW, MOBILE_PAY, MOBILE_ON_DELIVERY }