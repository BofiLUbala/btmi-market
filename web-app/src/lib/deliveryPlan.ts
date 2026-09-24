import type { DeliveryPlan } from '../api/types'
import type { TranslationKey } from '../locales/fr'

type Translate = (key: TranslationKey, vars?: Record<string, string | number | undefined | null>) => string

export const DELIVERY_SLOTS = ['MORNING', 'AFTERNOON', 'EVENING'] as const

// The courier holds the parcel: cancelling now sends it back to the seller.
export const PARCEL_WITH_COURIER = ['PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED']
// Handed over: the buyer confirms or disputes receipt instead of cancelling.
const HANDED_OVER = ['DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION', 'RECEIVED']
const CLOSED_ORDER = ['CANCELLED', 'REJECTED', 'DELIVERED', 'RECEIVED', 'COMPLETED']
const SETTLED_PAYMENT = ['PAID', 'VERIFIED', 'REFUNDED', 'PROCESSING']

/** Mirrors the server rule; the server still decides. */
export function buyerCanCancel(status: string, deliveryStatus?: string, paymentStatus?: string): boolean {
  if (CLOSED_ORDER.includes(status)) return false
  if (HANDED_OVER.includes(deliveryStatus || '')) return false
  return !SETTLED_PAYMENT.includes(paymentStatus || '')
}

export function isPaidBeforeHandover(status: string, deliveryStatus?: string, paymentStatus?: string): boolean {
  return !CLOSED_ORDER.includes(status) && !HANDED_OVER.includes(deliveryStatus || '') && SETTLED_PAYMENT.includes(paymentStatus || '')
}

export function formatDeliveryDay(date: string, lang: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** "jeudi 25 septembre · après-midi (12h–17h)", or null when not planned yet. */
export function expectedDeliveryText(plan: DeliveryPlan, t: Translate, lang: string): string | null {
  if (!plan.expected_delivery_date) return null
  const slot = plan.expected_delivery_slot ? t(`deliveryPlan.slot.${plan.expected_delivery_slot}` as TranslationKey) : ''
  return [formatDeliveryDay(plan.expected_delivery_date, lang), slot].filter(Boolean).join(' · ')
}

export function cancelStageText(plan: DeliveryPlan, t: Translate): string | null {
  return plan.cancelled_stage ? t(`deliveryPlan.stage.${plan.cancelled_stage}` as TranslationKey) : null
}

/** Today in Kinshasa, as the server validates it (YYYY-MM-DD). */
export function deliveryToday(offsetDays = 0): string {
  const now = new Date(Date.now() + 3600_000 + offsetDays * 86_400_000)
  return now.toISOString().slice(0, 10)
}
