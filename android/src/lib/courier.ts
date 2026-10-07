import { formatMoney } from './money'
import type { CourierEarnings } from '../types'
import type { QueryClient } from '@tanstack/react-query'
import type { TranslationKey, useI18n } from '../store/i18n'

type Translate = ReturnType<typeof useI18n>['t']

/** Delivery status in the courier's words; unknown statuses stay readable. */
export function courierStatusLabel(t: Translate, status?: string | null): string {
  if (!status) return '—'
  const key = `delivery.status.${status}` as TranslationKey
  const label = t(key)
  return label === key ? status.replaceAll('_', ' ') : label
}

/** Everything a courier action can change, refetched from the backend. */
export function invalidateCourierMission(queryClient: QueryClient, orderId?: string) {
  void queryClient.invalidateQueries({ queryKey: ['courier', 'missions'] })
  // Delivering an order, and taking the cash at the door, is what moves the
  // figures on "Mes gains" and adds a line to the delivered history. Without
  // these the courier finished the delivery and both screens still showed the
  // state from before it.
  void queryClient.invalidateQueries({ queryKey: ['courier', 'earnings'] })
  void queryClient.invalidateQueries({ queryKey: ['courier', 'delivered'] })
  void queryClient.invalidateQueries({ queryKey: ['courier', 'history'] })
  if (orderId) {
    void queryClient.invalidateQueries({ queryKey: ['courier', 'mission', orderId] })
    void queryClient.invalidateQueries({ queryKey: ['courier', 'handover', orderId] })
  }
}

/** A product label QR starts with `tbk.`; anything else is the printed PRD-/VAR- number. */
export function productVerificationBody(code: string): { token?: string; product_number?: string } {
  const value = code.trim()
  return value.toLowerCase().startsWith('tbk.') ? { token: value } : { product_number: value }
}

/** Today's date where the deliveries happen (YYYY-MM-DD). */
export function kinshasaToday(): string {
  // Kinshasa is UTC+1 all year (no daylight saving).
  return new Date(Date.now() + 3600_000).toISOString().slice(0, 10)
}

export function shiftDay(day: string, by: number): string {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + by)
  return d.toISOString().slice(0, 10)
}

/** "82,00 $ · 10 000 FC": one amount per currency, or 0 in the default one. */
export function cashLabel(earnings?: CourierEarnings | null): string {
  const cash = earnings?.cash_collected ?? []
  return cash.length ? cash.map((c) => formatMoney(c.amount, c.currency)).join(' · ') : formatMoney(0)
}

