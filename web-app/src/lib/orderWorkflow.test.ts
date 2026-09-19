import { describe, expect, it } from 'vitest'
import { getTrackingDisplayStatus } from './orderWorkflow'

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
})
