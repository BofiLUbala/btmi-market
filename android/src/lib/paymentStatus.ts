import type { TranslationKey } from '../store/i18n'
import type { BuyerPayment } from '../types'

export function isPaymentConfirmed(p?: BuyerPayment | null | undefined): boolean {
  if (!p) return false
  if (p.status === 'VERIFIED') return true
  return p.status === 'CONFIRMED' && !!p.buyer_confirmed && !!p.seller_confirmed
}

export function isPaymentCancelled(p?: BuyerPayment | null | undefined): boolean {
  return !!p && p.status === 'CANCELLED'
}

export function isPaymentFailed(p?: BuyerPayment | null | undefined): boolean {
  return !!p && p.status === 'FAILED'
}

export function isPaymentPending(p?: BuyerPayment | null | undefined): boolean {
  return !!p && !isPaymentConfirmed(p) && !['CANCELLED', 'FAILED'].includes(p.status || '')
}

/** Map a real backend payment to a user-facing translation key. No frontend-only states are invented. */
export function paymentStatusKey(p?: BuyerPayment | null | undefined): TranslationKey {
  const status = p?.status || 'PENDING'
  const method = p?.payment_method || 'CASH'
  if (status === 'CANCELLED') return 'orders.paymentCancelled'
  if (status === 'FAILED') return 'orders.paymentFailed'
  if (method === 'CASH') {
    if (status === 'VERIFIED') return 'orders.paymentConfirmed'
    if (p?.buyer_confirmed && !p?.seller_confirmed) return 'orders.paymentInProgress'
    return 'orders.payAtDelivery'
  }
  if (method === 'MOBILE_ON_DELIVERY') {
    return isPaymentConfirmed(p) ? 'orders.paymentConfirmed' : 'orders.paymentPending'
  }
  return isPaymentConfirmed(p) ? 'orders.paymentConfirmed' : 'orders.paymentPending'
}

/** Method label used in the buyer order card. */
export function paymentMethodKey(method?: string | null): TranslationKey {
  if (method === 'CASH' || !method) return 'orders.cashOnDelivery'
  if (method === 'MOBILE_ON_DELIVERY') return 'orders.mobileOnDelivery'
  return 'orders.cashPayment'
}