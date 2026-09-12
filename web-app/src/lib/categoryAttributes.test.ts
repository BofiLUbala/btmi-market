import { describe, expect, it } from 'vitest'
import {
  canonicalizeAttributes,
  getAttributeValue,
  variantDisplayLabel,
  variantHasAttribute,
} from './categoryAttributes'

const color = { key: 'Color', label_en: 'Color', label_fr: 'Couleur', required: true, variant_attribute: true }
const size = { key: 'Shoe Size', label_en: 'Shoe Size', label_fr: 'Pointure', required: true, variant_attribute: true }

describe('categoryAttributes', () => {
  it('reads values stored under a localized label', () => {
    expect(getAttributeValue({ Couleur: 'Bleu', Pointure: '36' }, color)).toBe('Bleu')
    expect(getAttributeValue({ Couleur: 'Bleu', Pointure: '36' }, size)).toBe('36')
    expect(variantHasAttribute({ COLOR: 'Noir' }, color)).toBe(true)
    expect(variantHasAttribute({ color: '  ' }, color)).toBe(false)
  })

  it('canonicalizes French labels onto definition keys', () => {
    expect(canonicalizeAttributes({ Couleur: 'Bleu', Pointure: '36' }, [color, size])).toEqual({
      Color: 'Bleu',
      'Shoe Size': '36',
    })
  })

  it('prefers the canonical key when both alias and key are present', () => {
    expect(
      canonicalizeAttributes({ Color: 'Noir', Couleur: 'Bleu', Pointure: '40' }, [color, size])
    ).toEqual({
      Color: 'Noir',
      'Shoe Size': '40',
    })
  })

  it('builds a variant label from canonical or aliased values', () => {
    expect(variantDisplayLabel({ Couleur: 'Noir', Pointure: '40' }, [color, size], 'Variante 1')).toBe(
      'Noir / 40'
    )
  })
})
