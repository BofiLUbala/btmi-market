import { describe, expect, it } from 'vitest'
import { resolveCategoryKey } from './categorySuggestions'

describe('resolveCategoryKey', () => {
  it('matches English slugs and French display names alike', () => {
    expect(resolveCategoryKey('shoes')).toBe('shoes')
    expect(resolveCategoryKey('Chaussures')).toBe('shoes')
    expect(resolveCategoryKey("Men's Footwear")).toBe('shoes')
  })

  // "car" is a substring of scarves/carpet/cardigan, so matching it anywhere
  // in the string misfiled all of them as automotive.
  it('does not misfile words that merely contain "car" as automotive', () => {
    expect(resolveCategoryKey('Scarves')).not.toBe('automotive')
    expect(resolveCategoryKey('Carpet')).not.toBe('automotive')
    expect(resolveCategoryKey('Cardigan')).not.toBe('automotive')
  })

  it('still matches "car" when it stands as its own word', () => {
    expect(resolveCategoryKey('Car Parts')).toBe('automotive')
    expect(resolveCategoryKey('car')).toBe('automotive')
    expect(resolveCategoryKey('Voiture')).toBe('automotive')
  })

  it('returns an empty key for a missing category', () => {
    expect(resolveCategoryKey(undefined)).toBe('')
    expect(resolveCategoryKey('')).toBe('')
  })
})
