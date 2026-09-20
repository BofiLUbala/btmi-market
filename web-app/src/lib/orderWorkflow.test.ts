import { describe, expect, it } from 'vitest'
import { getDeliverySteps, getTrackingDisplayStatus } from './orderWorkflow'

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
