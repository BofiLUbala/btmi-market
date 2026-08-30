import { describe, expect, it } from 'vitest'
import {
  getCategoryRequirements,
  missingRequiredAttributes,
  resolveCategoryKey,
} from './categorySuggestions'

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

describe('getCategoryRequirements', () => {
  it('prefers the subcategory rule when it has one', () => {
    const req = getCategoryRequirements('fashion', 'shoes')
    expect(req.allOf).toEqual(['Color', 'Shoe Size'])
  })

  it('falls back to the parent when the subcategory has no rule of its own', () => {
    const req = getCategoryRequirements('fashion', 'scarves')
    expect(req.allOf).toEqual(['Color', 'Size'])
  })

  it('returns nothing for a category with no rules, so publication is never blocked blindly', () => {
    expect(getCategoryRequirements('taxidermy')).toEqual({})
    expect(getCategoryRequirements(undefined)).toEqual({})
  })
})

describe('missingRequiredAttributes', () => {
  const shoes = getCategoryRequirements('shoes')
  const food = getCategoryRequirements('food')

  it('blocks publication when required characteristics are absent', () => {
    expect(missingRequiredAttributes(shoes, [])).toEqual(['Color', 'Shoe Size'])
    expect(missingRequiredAttributes(shoes, ['Color'])).toEqual(['Shoe Size'])
  })

  it('allows publication once every required characteristic is filled in', () => {
    expect(missingRequiredAttributes(shoes, ['Color', 'Shoe Size'])).toEqual([])
  })

  it('matches names case-insensitively and ignores surrounding spaces', () => {
    expect(missingRequiredAttributes(shoes, ['  color ', 'SHOE SIZE'])).toEqual([])
  })

  it('accepts a single member of an anyOf group', () => {
    expect(missingRequiredAttributes(food, ['Expiration Date', 'Volume'])).toEqual([])
  })

  it('still blocks when no member of an anyOf group is present', () => {
    const missing = missingRequiredAttributes(food, ['Expiration Date'])
    expect(missing).toHaveLength(1)
    expect(missing[0]).toContain('one of')
  })

  it('never blocks a category that declares no requirements', () => {
    expect(missingRequiredAttributes(getCategoryRequirements('taxidermy'), [])).toEqual([])
  })
})
