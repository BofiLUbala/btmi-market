import { describe, expect, it } from 'vitest'
import { formatDistance, formatDuration, parseCoordinates } from './liveLocation'

describe('route figures', () => {
  it('formats distances in metres then kilometres', () => {
    expect(formatDistance(847)).toBe('850 m')
    expect(formatDistance(2036)).toBe('2,0 km')
    expect(formatDistance(2036, 'en')).toBe('2.0 km')
    expect(formatDistance(12_400)).toBe('12 km')
    expect(formatDistance(null)).toBe('—')
  })
  it('formats durations', () => {
    expect(formatDuration(318)).toBe('5 min')
    expect(formatDuration(20)).toBe('1 min')
    expect(formatDuration(3900)).toBe('1 h 05')
  })
  it('parses typed coordinates, refusing 0,0 and out-of-range values', () => {
    expect(parseCoordinates('-4.3035', '15.3065')).toEqual([15.3065, -4.3035])
    expect(parseCoordinates('-4,3035', '15,3065')).toEqual([15.3065, -4.3035])
    expect(parseCoordinates('0', '0')).toBeNull()
    expect(parseCoordinates('95', '15')).toBeNull()
    expect(parseCoordinates('', '15')).toBeNull()
    expect(parseCoordinates('abc', '15')).toBeNull()
  })
})
