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
  'DELIVERY_SCAN_SUCCESS',
  'RECEIVED',
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
 * Build the ordered step list for a given delivery method.
 * If the current status isn't in the list, it's appended so it renders at the end.
 */
export function getDeliverySteps(deliveryMethod: string | null, currentStatus: string): string[] {
  const base =
    deliveryMethod === 'TBK_STANDARD'
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
