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
  FAILED: 'status.failed',
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
  // TBK delivery movement shows in the buyer tracking timeline.
  PENDING_TBK_ASSIGNMENT: 'delivery.status.PENDING_TBK_ASSIGNMENT',
  COURIER_ASSIGNED: 'delivery.status.COURIER_ASSIGNED',
  COURIER_ACCEPTED: 'delivery.status.COURIER_ACCEPTED',
  COURIER_REJECTED: 'delivery.status.COURIER_REJECTED',
  PICKED_UP: 'delivery.status.PICKED_UP',
  IN_TRANSIT: 'delivery.status.IN_TRANSIT',
  COURIER_ARRIVED: 'delivery.status.COURIER_ARRIVED',
  DELIVERY_SCAN_SUCCESS: 'delivery.status.DELIVERY_SCAN_SUCCESS',
  AWAITING_BUYER_CONFIRMATION: 'delivery.status.AWAITING_BUYER_CONFIRMATION',
  RETURNING_TO_SELLER: 'delivery.status.RETURNING_TO_SELLER',
  RETURNED_TO_SELLER: 'delivery.status.RETURNED_TO_SELLER',
}

export function statusLabel(t: Translate, value: string | null | undefined): string {
  if (!value) return ''
  const normalized = value.trim().toUpperCase()
  const key = STATUS_KEYS[normalized]
  return key ? t(key) : value.replaceAll('_', ' ')
}
