import type { DeliveryPlan } from '../types'

/** The courier's side of a TBK delivery, in the order it happens. */
export const COURIER_FLOW = ['COURIER_ASSIGNED', 'COURIER_ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION', 'RECEIVED'] as const
export type CourierStep = (typeof COURIER_FLOW)[number]

const ORDER_STAGES = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RECEIVED', 'COMPLETED']
const STEP_DATE: Partial<Record<CourierStep, keyof DeliveryPlan>> = {
  COURIER_ASSIGNED: 'courier_assigned_at',
  COURIER_ACCEPTED: 'courier_accepted_at',
  PICKED_UP: 'pickup_verified_at',
  IN_TRANSIT: 'courier_started_at',
  COURIER_ARRIVED: 'courier_arrived_at',
}
// No courier holds the order in these states, whatever was dated before.
const UNASSIGNED = ['PENDING_TBK_ASSIGNMENT', 'COURIER_REJECTED']

/**
 * Whether the courier has reached a step, same rule as the web app. delivery_status
 * alone cannot say: the seller's READY_FOR_PICKUP is written before or after the
 * courier is assigned or accepts. So a step counts once it is dated, once
 * delivery_status is at or past it, or once the order itself is delivered.
 */
export function courierReached(o: DeliveryPlan & { status: string; delivery_status?: string | null }, step: string): boolean {
  const flowIndex = COURIER_FLOW.indexOf(step as CourierStep)
  if (flowIndex < 0) return false
  const ds = o.delivery_status || ''
  if (COURIER_FLOW.indexOf(ds as CourierStep) >= flowIndex) return true
  if (ORDER_STAGES.indexOf(o.status) >= ORDER_STAGES.indexOf('DELIVERED')) return true
  const dateKey = STEP_DATE[step as CourierStep]
  return !!dateKey && !!o[dateKey] && !UNASSIGNED.includes(ds)
}
