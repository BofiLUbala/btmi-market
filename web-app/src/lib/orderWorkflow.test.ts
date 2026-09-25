import { describe, expect, it } from 'vitest'
import { courierReached, getDeliverySteps, getTrackingDisplayStatus } from './orderWorkflow'

describe('buyer tracking display status', () => {
  it('uses the granular delivery milestone while an order is active', () => {
    expect(getTrackingDisplayStatus('OUT_FOR_DELIVERY', 'COURIER_ARRIVED')).toBe('COURIER_ARRIVED')
  })

  it('shows COMPLETED instead of stopping at RECEIVED', () => {
    expect(getTrackingDisplayStatus('COMPLETED', 'RECEIVED')).toBe('COMPLETED')
  })

  it('shows cancellation even when an older delivery milestone remains', () => {
    expect(getTrackingDisplayStatus('CANCELLED', 'COURIER_ACCEPTED')).toBe('CANCELLED')
  })

  it('ends a successful TBK timeline at COMPLETED without showing FAILED', () => {
    const steps = getDeliverySteps('TBK_STANDARD', 'COMPLETED')
    expect(steps[steps.length - 1]).toBe('COMPLETED')
    expect(steps).not.toContain('FAILED')
  })

  it('shows FAILED only when the order actually failed', () => {
    const steps = getDeliverySteps('TBK_STANDARD', 'FAILED')
    expect(steps[steps.length - 1]).toBe('FAILED')
  })
})

describe('courierReached', () => {
  const at = '2026-09-25T10:00:00Z'
  it('does not treat the seller READY_FOR_PICKUP as a courier step', () => {
    const o = { status: 'READY', delivery_status: 'READY_FOR_PICKUP' }
    expect(courierReached(o, 'COURIER_ASSIGNED')).toBe(false)
    expect(courierReached(o, 'COURIER_ACCEPTED')).toBe(false)
  })
  it('keeps an accepted courier when the seller marks ready afterwards', () => {
    const o = { status: 'READY', delivery_status: 'READY_FOR_PICKUP', courier_assigned_at: at, courier_accepted_at: at }
    expect(courierReached(o, 'COURIER_ACCEPTED')).toBe(true)
    expect(courierReached(o, 'PICKED_UP')).toBe(false)
  })
  it('follows delivery_status once the courier moves', () => {
    const o = { status: 'OUT_FOR_DELIVERY', delivery_status: 'IN_TRANSIT' }
    expect(courierReached(o, 'PICKED_UP')).toBe(true)
    expect(courierReached(o, 'COURIER_ARRIVED')).toBe(false)
  })
  it('forgets a courier who rejected the mission', () => {
    expect(courierReached({ status: 'READY', delivery_status: 'COURIER_REJECTED', courier_assigned_at: at }, 'COURIER_ASSIGNED')).toBe(false)
  })
  it('counts every step done once the order is delivered', () => {
    expect(courierReached({ status: 'COMPLETED', delivery_status: 'RECEIVED' }, 'COURIER_ARRIVED')).toBe(true)
  })
})
