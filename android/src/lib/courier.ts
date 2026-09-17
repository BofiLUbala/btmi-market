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
