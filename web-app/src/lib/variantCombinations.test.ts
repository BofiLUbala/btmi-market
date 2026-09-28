import { describe, expect, it } from 'vitest'
import { combineVariantValues, newCombinations } from './variantCombinations'

describe('combineVariantValues', () => {
  it('builds one variant per combination (2 sizes x 3 colours = 6)', () => {
    const combos = combineVariantValues([
      { key: 'Shoe Size', values: ['36', '42'] },
      { key: 'Color', values: ['Noir', 'Bleu', 'Vert'] },
    ])
    expect(combos).toHaveLength(6)
    expect(combos).toContainEqual({ 'Shoe Size': '42', Color: 'Bleu' })
    expect(combos).toContainEqual({ 'Shoe Size': '36', Color: 'Vert' })
  })

  it('ignores empty axes, blanks and repeated values', () => {
    expect(combineVariantValues([{ key: 'Color', values: ['Noir', ' ', 'Noir'] }, { key: 'Size', values: [] }]))
      .toEqual([{ Color: 'Noir' }])
    expect(combineVariantValues([])).toEqual([])
  })
})

describe('newCombinations', () => {
  it('skips combinations the seller already has, whatever the case', () => {
    const combos = combineVariantValues([{ key: 'Color', values: ['Noir', 'Bleu'] }, { key: 'Size', values: ['42'] }])
    const fresh = newCombinations(combos, [{ Color: 'noir', Size: '42' }], ['Color', 'Size'])
    expect(fresh).toEqual([{ Color: 'Bleu', Size: '42' }])
  })

  it('generating twice adds nothing', () => {
    const combos = combineVariantValues([{ key: 'Color', values: ['Noir', 'Bleu'] }])
    expect(newCombinations(combos, combos, ['Color'])).toEqual([])
  })
})
