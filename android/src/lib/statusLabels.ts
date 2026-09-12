import type { TranslationKey } from '../store/i18n'

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string

const STATUS_KEYS: Record<string, TranslationKey> = {
  PENDING: 'status.pending',
  ACCEPTED: 'status.accepted',
  REJECTED: 'status.rejected',
  PREPARING: 'status.preparing',
  READY: 'status.ready',
  READY_FOR_PICKUP: 'status.readyForPickup',
  OUT_FOR_DELIVERY: 'status.outForDelivery',
  HANDED_TO_PARTNER: 'status.handedToPartner',
  DELIVERED: 'status.delivered',
  RECEIVED: 'status.received',
  COMPLETED: 'status.completed',
  CANCELLED: 'status.cancelled',
  CONFIRMED: 'status.confirmed',
  VERIFIED: 'status.verified',
  REFUNDED: 'status.refunded',
  ACTIVE: 'status.active',
  INACTIVE: 'status.inactive',
  OPEN: 'status.open',
  CLOSED: 'status.closed',
  RECONCILED: 'status.reconciled',
  DUE: 'status.due',
  COLLECTED: 'status.collected',
}

export function statusLabel(t: Translate, value: string | null | undefined): string {
  if (!value) return ''
  const normalized = value.trim().toUpperCase()
  const key = STATUS_KEYS[normalized]
  return key ? t(key) : value.replaceAll('_', ' ')
}
