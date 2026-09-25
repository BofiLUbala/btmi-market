import { describe, expect, it } from 'vitest'

import type { PublicVariantDetail } from '@/api/types'
import {
  buildAttributeGroups,
  hasRealVariants,
  resolveVariant,
} from './variants'

function variant(
  id: string,
  attributes: Record<string, string>,
): PublicVariantDetail {
  return {
    id,
    sku: id,
    name: id,
    attributes,
    unit_price: 10,
    base_price: 10,
    stock: 'AVAILABLE',
    stock_quantity: 5,
  }
}

describe('marketplace variant selection', () => {
  it('keeps category attributes visible beside an empty legacy variant', () => {
    const variants = [
      variant('legacy', {}),
      variant('black-40', { Color: 'Black', Size: '40' }),
    ]

    expect(buildAttributeGroups(variants)).toEqual([
      { key: 'Color', label: 'Color', values: ['Black'] },
      { key: 'Size', label: 'Size', values: ['40'] },
    ])
    expect(hasRealVariants(variants)).toBe(true)
    expect(resolveVariant(variants, { Color: 'Black', Size: '40' })?.id).toBe('black-40')
  })

  it('exposes every color and size combination supplied by the category variants', () => {
    const variants = [
      variant('black-40', { Color: 'Black', Size: '40' }),
      variant('black-41', { Color: 'Black', Size: '41' }),
      variant('red-40', { Color: 'Red', Size: '40' }),
    ]

    expect(buildAttributeGroups(variants)).toEqual([
      { key: 'Color', label: 'Color', values: ['Black', 'Red'] },
      { key: 'Size', label: 'Size', values: ['40', '41'] },
    ])
  })
})
