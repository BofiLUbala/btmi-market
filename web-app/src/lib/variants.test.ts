import { describe, expect, it } from 'vitest'

import type { PublicVariantDetail } from '@/api/types'
import {
  bestVariantFor,
  buildAttributeGroups,
  hasRealVariants,
  optionValueState,
  resolveVariant,
  variantOptionLabel,
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

  it('does not ask the buyer to pick a characteristic every variant shares', () => {
    const variants = [
      variant('black', { Color: 'Noir', Model: 'Kivu Pro 2026' }),
      variant('white', { Color: 'Blanc', Model: 'Kivu Pro 2026' }),
    ]

    expect(buildAttributeGroups(variants)).toEqual([
      { key: 'Color', label: 'Color', values: ['Noir', 'Blanc'] },
    ])
    expect(resolveVariant(variants, { Color: 'Blanc' })?.id).toBe('white')
  })
})

describe('partial variant grids', () => {
  // A phone sold as 4 variants that do not cover every Storage × Colour pair.
  const phones = [
    variant('64-noir', { Storage: '64 Go', Color: 'Noir' }),
    variant('128-noir', { Storage: '128 Go', Color: 'Noir' }),
    variant('128-bleu', { Storage: '128 Go', Color: 'Bleu' }),
    variant('256-bleu', { Storage: '256 Go', Color: 'Bleu' }),
  ]

  it('never locks a value that another variant carries', () => {
    const selection = { Storage: '64 Go', Color: 'Noir' }
    const bleu = optionValueState(phones, selection, 'Color', 'Bleu')
    expect(bleu).toEqual({ exists: true, compatible: false, units: 10 })
    const big = optionValueState(phones, selection, 'Storage', '256 Go')
    expect(big.exists).toBe(true)
    expect(big.units).toBe(5)
    expect(optionValueState(phones, selection, 'Color', 'Rouge').exists).toBe(false)
  })

  it('reports stock with the current choices when the pair exists', () => {
    expect(optionValueState(phones, { Storage: '128 Go', Color: 'Noir' }, 'Color', 'Bleu'))
      .toEqual({ exists: true, compatible: true, units: 5 })
  })

  it('lands on the variant keeping the most other choices', () => {
    expect(bestVariantFor(phones, { Storage: '128 Go', Color: 'Noir' }, 'Color', 'Bleu')?.id).toBe('128-bleu')
    expect(bestVariantFor(phones, { Storage: '64 Go', Color: 'Noir' }, 'Storage', '256 Go')?.id).toBe('256-bleu')
  })

  it('prefers an in-stock variant when choices tie', () => {
    const grid = [
      { ...variant('a', { Size: 'M', Color: 'Noir' }), stock: 'OUT_OF_STOCK', stock_quantity: 0 },
      variant('b', { Size: 'M', Color: 'Blanc' }),
    ]
    expect(bestVariantFor(grid, { Size: 'L', Color: 'Rouge' }, 'Size', 'M')?.id).toBe('b')
  })
})

describe('variantOptionLabel', () => {
  it('drops the product name the seller form prefixes', () => {
    expect(variantOptionLabel({ name: 'Réparation d’écran — Écran premium' }, 'Réparation d’écran')).toBe('Écran premium')
  })
  it('keeps names that do not repeat the product, and falls back to the SKU', () => {
    expect(variantOptionLabel({ name: 'Pack famille' }, 'Jus de gingembre')).toBe('Pack famille')
    expect(variantOptionLabel({ name: '', sku: 'SKU-9' }, 'X')).toBe('SKU-9')
  })
})
