import { describe, expect, it } from 'vitest'
import { attributeOptions, sameAttribute, splitValues, toggleValue } from './attributeOptions'

describe('attributeOptions', () => {
  it('resolves attributes by key or French/English label', () => {
    expect(attributeOptions({ key: 'Color' })?.swatch).toBe(true)
    expect(attributeOptions({ key: 'x', label_fr: 'Pointure' })?.values).toContain('42')
    expect(attributeOptions({ key: 'Weight' }, 'food')?.values).toContain('500 g')
  })

  it('adapts the list to the category', () => {
    expect(attributeOptions({ key: 'Size' }, 'fashion')?.values).toContain('XL')
    expect(attributeOptions({ key: 'Size' }, 'children')?.values).toContain('4 ans')
    expect(attributeOptions({ key: 'Capacity' }, 'electronics')?.values).toContain('5000 mAh')
    expect(attributeOptions({ key: 'Capacity' }, 'home')?.values).toContain('1 L')
  })

  it('prefers admin-configured values and keeps existing ones', () => {
    expect(attributeOptions({ key: 'Size', allowed_values: ['Unique'] })?.values).toEqual(['Unique'])
    expect(attributeOptions({ key: 'Size' }, 'fashion', ['Sur mesure'])?.values).toContain('Sur mesure')
  })

  it('leaves genuinely free-form attributes to a text field', () => {
    expect(attributeOptions({ key: 'Model' })).toBeNull()
    expect(attributeOptions({ key: 'Compatibility' })).toBeNull()
  })

  it('covers every variant attribute configured for the marketplace categories', () => {
    const variantKeys = ['Color', 'Size', 'Shoe Size', 'Storage', 'RAM', 'Capacity', 'Shade', 'Volume', 'Scent', 'Flavor', 'Weight', 'Pack Size']
    for (const key of variantKeys) expect(attributeOptions({ key }), key).not.toBeNull()
  })

  it('helpers', () => {
    expect(splitValues('Noir, Camel ,')).toEqual(['Noir', 'Camel'])
    expect(toggleValue(['Noir'], 'noir')).toEqual([])
    expect(toggleValue(['Noir'], 'Camel')).toEqual(['Noir', 'Camel'])
    expect(sameAttribute('Color', 'Couleur')).toBe(true)
    expect(sameAttribute('Size', 'Poids')).toBe(false)
  })
})
