import { describe, expect, it } from 'vitest'
import { categoryLabel, subcategoryLabel } from './categoryLabels'

const labels: Record<string, string> = {
  'categories.slug.fashion': 'Mode',
  'subcategories.slug.shoes': 'Chaussures',
}
const t = (key: string) => labels[key] || key

describe('taxonomy labels', () => {
  it('uses the translated slug label instead of the backend English name', () => {
    expect(categoryLabel(t, 'fashion', 'Fashion')).toBe('Mode')
    expect(subcategoryLabel(t, 'shoes', 'Shoes')).toBe('Chaussures')
  })

  it('recovers when a missing or malformed slug requires the localized name fallback', () => {
    expect(categoryLabel(t, undefined, 'Fashion')).toBe('Mode')
    expect(categoryLabel(t, 'unknown-id', 'Mode')).toBe('Mode')
    expect(subcategoryLabel(t, undefined, 'Chaussures')).toBe('Chaussures')
  })
})
