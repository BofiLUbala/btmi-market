/**
 * Shared status presentation constants and helpers.
 *
 * Single source of truth for:
 * - step lists per delivery method (buyer tracking page)
 * - order lifecycle steps (order detail page)
 * - prettified labels
 * - terminal status detection (delivery-level and order-level)
 */

// ── Step lists per delivery method ──────────────────────────────────────────

export const DELIVERY_METHOD_STEPS: Record<string, string[]> = {
  PICKUP: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'RECEIVED', 'COMPLETED'],
  SHOP_DELIVERY: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RECEIVED', 'COMPLETED'],
  PARTNER: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'HANDED_TO_PARTNER', 'DELIVERED', 'RECEIVED', 'COMPLETED'],
}

export const TBK_DELIVERY_STEPS = [
  'PENDING_TBK_ASSIGNMENT',
  'COURIER_ASSIGNED',
  'COURIER_ACCEPTED',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'COURIER_ARRIVED',
  'PRODUCT_VERIFIED',
  'PAYMENT_VERIFIED',
  'DELIVERY_SCAN_SUCCESS',
  'AWAITING_BUYER_CONFIRMATION',
  'RECEIVED',
  'COMPLETED',
]

/** Step order used in the buyer's order lifecycle timeline. */
export const ORDER_LIFECYCLE_STEPS = [
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RECEIVED',
  'COMPLETED',
] as const

// ── Helpers ─────────────────────────────────────────────────────────────────

export function prettifyStatus(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Delivery status is normally the more precise live milestone for a TBK order.
 * Once the order itself is finally closed, however, COMPLETED/CANCELLED/REJECTED
 * must win so buyer tracking does not stop at an earlier delivery milestone.
 */
export function getTrackingDisplayStatus(currentStatus: string, deliveryStatus?: string | null): string {
  if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(currentStatus)) return currentStatus
  return deliveryStatus || currentStatus
}

/**
 * Build the ordered step list for a given delivery method.
 * If the current status isn't in the list, it's appended so it renders at the end.
 */
export function getDeliverySteps(deliveryMethod: string | null, currentStatus: string): string[] {
  const base =
    ['TBK_STANDARD', 'TBK_DELIVERY', 'TBK'].includes(deliveryMethod ?? '')
      ? TBK_DELIVERY_STEPS
      : (DELIVERY_METHOD_STEPS[deliveryMethod ?? ''] ?? [currentStatus])
  return base.includes(currentStatus) ? base : [...base, currentStatus]
}

/**
 * Get the index of a status within the lifecycle steps.
 * Returns -1 if the status is unknown (treated as terminal).
 */
export function lifecycleIndex(status: string): number {
  return ORDER_LIFECYCLE_STEPS.indexOf(status as (typeof ORDER_LIFECYCLE_STEPS)[number])
}

// ── Courier steps of a TBK delivery ─────────────────────────────────────────

/** The courier's side of a TBK delivery, in the order it happens. */
export const COURIER_FLOW = ['COURIER_ASSIGNED', 'COURIER_ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION', 'RECEIVED'] as const
export type CourierStep = (typeof COURIER_FLOW)[number]

/** The dated facts the API returns for the courier steps. */
export interface CourierFacts {
  status: string
  delivery_status?: string | null
  courier_assigned_at?: string | null
  courier_accepted_at?: string | null
  pickup_verified_at?: string | null
  courier_started_at?: string | null
  courier_arrived_at?: string | null
}

const STEP_DATE: Partial<Record<CourierStep, keyof CourierFacts>> = {
  COURIER_ASSIGNED: 'courier_assigned_at',
  COURIER_ACCEPTED: 'courier_accepted_at',
  PICKED_UP: 'pickup_verified_at',
  IN_TRANSIT: 'courier_started_at',
  COURIER_ARRIVED: 'courier_arrived_at',
}
// No courier holds the order in these states, whatever was dated before.
const UNASSIGNED = ['PENDING_TBK_ASSIGNMENT', 'COURIER_REJECTED']

/**
 * Whether the courier has reached a step. delivery_status alone cannot say: the
 * seller's READY_FOR_PICKUP is written before or after the courier is assigned
 * or accepts. So a step counts once it is dated, or once delivery_status is at
 * or past it, or once the order itself is delivered.
 */
export function courierReached(o: CourierFacts, step: CourierStep): boolean {
  const ds = o.delivery_status || ''
  if (COURIER_FLOW.indexOf(ds as CourierStep) >= COURIER_FLOW.indexOf(step)) return true
  if (lifecycleIndex(o.status) >= lifecycleIndex('DELIVERED')) return true
  const dateKey = STEP_DATE[step]
  return !!dateKey && !!o[dateKey] && !UNASSIGNED.includes(ds)
}
