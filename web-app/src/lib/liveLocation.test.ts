import { describe, expect, it } from 'vitest'
import {
  LOCATION_POLL_MS, accuracyRing, currentAgeSeconds, destinationPoint, freshnessFor, freshnessText, shouldShowLiveMap,
} from './liveLocation'
import { eventMatches, type OrderEvent } from './orderEvents'

const t = (key: string, vars?: Record<string, string | number>) => (vars ? `${key}:${JSON.stringify(vars)}` : key)

describe('live map visibility', () => {
  it('shows the map only while the parcel is IN_TRANSIT', () => {
    expect(shouldShowLiveMap({ delivery_status: 'IN_TRANSIT' })).toBe(true)
    expect(shouldShowLiveMap({ delivery_status: 'PICKED_UP', live_tracking_active: true })).toBe(true)
    for (const status of ['PICKED_UP', 'COURIER_ARRIVED', 'FAILED', 'CANCELLED', 'RETURNING_TO_SELLER', 'DELIVERED', '']) {
      expect(shouldShowLiveMap({ delivery_status: status, live_tracking_active: false })).toBe(false)
    }
    expect(shouldShowLiveMap(null)).toBe(false)
  })
})

describe('stale location UX', () => {
  it('uses the 30 s / 2 min thresholds', () => {
    expect(freshnessFor(0)).toBe('LIVE')
    expect(freshnessFor(29)).toBe('LIVE')
    expect(freshnessFor(30)).toBe('RECENT')
    expect(freshnessFor(120)).toBe('RECENT')
    expect(freshnessFor(121)).toBe('STALE')
    expect(freshnessFor(null)).toBe('UNAVAILABLE')
  })

  it('words each state as specified', () => {
    expect(freshnessText(5, t)).toBe('liveMap.live')
    expect(freshnessText(45, t)).toBe('liveMap.lastSeen:{"count":45}')
    expect(freshnessText(300, t)).toBe('liveMap.unavailable')
    expect(freshnessText(null, t)).toBe('liveMap.unavailable')
  })

  it('ages the point from the server measure, not the local clock', () => {
    const fetchedAt = 1_000_000
    expect(currentAgeSeconds({ age_seconds: 10 }, fetchedAt, fetchedAt + 25_000)).toBe(35)
    expect(currentAgeSeconds({ age_seconds: null }, fetchedAt, fetchedAt)).toBeNull()
    expect(currentAgeSeconds({ age_seconds: 3 }, fetchedAt, fetchedAt - 60_000)).toBe(0)
  })

  it('polls every ~10 s as a fallback', () => {
    expect(LOCATION_POLL_MS).toBe(10_000)
  })
})

describe('destination', () => {
  it('draws a destination only when coordinates exist', () => {
    expect(destinationPoint({ delivery_latitude: -4.3, delivery_longitude: 15.3 })).toEqual([15.3, -4.3])
    expect(destinationPoint({ delivery_latitude: null, delivery_longitude: null })).toBeNull()
    expect(destinationPoint({ delivery_latitude: -4.3, delivery_longitude: null })).toBeNull()
    expect(destinationPoint(null)).toBeNull()
  })

  it('builds a closed accuracy ring of the right size', () => {
    const ring = accuracyRing(15.3, -4.3, 100)
    expect(ring[0]).toEqual(ring[ring.length - 1])
    const dLatM = Math.abs(ring[12][1] - -4.3) * 111_320
    expect(dLatM).toBeGreaterThan(95)
    expect(dLatM).toBeLessThan(105)
  })
})

describe('location SSE events', () => {
  const order = 'order-1'
  const location = (id: string): OrderEvent => ({ kind: 'location', order_id: id })

  it('refetch only for the order shown', () => {
    const kinds: OrderEvent['kind'][] = ['location', 'order', 'resync']
    expect(eventMatches(location(order), kinds, order)).toBe(true)
    expect(eventMatches(location('order-2'), kinds, order)).toBe(false)
    expect(eventMatches({ kind: 'resync' }, kinds, order)).toBe(true)
  })

  it('never reach pages that did not ask for them (no full-page reloads)', () => {
    expect(eventMatches(location(order))).toBe(false)
    expect(eventMatches(location(order), undefined, order)).toBe(false)
    expect(eventMatches({ kind: 'order', order_id: order })).toBe(true)
  })
})
