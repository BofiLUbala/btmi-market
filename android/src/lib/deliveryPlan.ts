import type { DeliveryPlan } from '../types'
import type { TranslationKey } from '../locales/fr'

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string

export const DELIVERY_SLOTS = ['MORNING', 'AFTERNOON', 'EVENING'] as const

// The courier holds the parcel: cancelling now sends it back to the seller.
export const PARCEL_WITH_COURIER = ['PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED']
const HANDED_OVER = ['DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION', 'RECEIVED']
const CLOSED_ORDER = ['CANCELLED', 'REJECTED', 'DELIVERED', 'RECEIVED', 'COMPLETED']
const SETTLED_PAYMENT = ['PAID', 'VERIFIED', 'REFUNDED', 'PROCESSING']

/** Mirrors the server rule; the server still decides. */
export function buyerCanCancel(status: string, deliveryStatus?: string, paymentStatus?: string): boolean {
  if (CLOSED_ORDER.includes(status) || HANDED_OVER.includes(deliveryStatus || '')) return false
  return !SETTLED_PAYMENT.includes(paymentStatus || '')
}

export function isPaidBeforeHandover(status: string, deliveryStatus?: string, paymentStatus?: string): boolean {
  return !CLOSED_ORDER.includes(status) && !HANDED_OVER.includes(deliveryStatus || '') && SETTLED_PAYMENT.includes(paymentStatus || '')
}

const locale = (lang: string) => (lang === 'en' ? 'en-US' : 'fr-FR')

export function formatDeliveryDay(date: string, lang: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale(lang), { weekday: 'long', day: 'numeric', month: 'long' })
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

export function returnedText(plan: DeliveryPlan, t: Translate, lang: string): string | null {
  return plan.returned_to_seller_at
    ? t('deliveryPlan.returned', { date: new Date(plan.returned_to_seller_at).toLocaleString(locale(lang), { dateStyle: 'medium', timeStyle: 'short' }) })
    : null
}

/** Days the courier may pick, today (Kinshasa) to two weeks ahead, as YYYY-MM-DD. */
export function deliveryDays(count = 15): string[] {
  const base = Date.now() + 3600_000
  return Array.from({ length: count }, (_, i) => new Date(base + i * 86_400_000).toISOString().slice(0, 10))
}
