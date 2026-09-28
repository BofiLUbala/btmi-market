import { describe, expect, it } from 'vitest'
import { highlightParts, normalizeSearch } from './searchNormalization'

describe('normalizeSearch', () => {
  // Same cases as TestNormalize in backend/internal/search/normalize_test.go.
  it.each([
    ['Téléphone', 'telephone'],
    ['  SAMSUNG   A15 ', 'samsung a15'],
    ['TV/PC (promo!)', 'tv pc promo'],
    ['ÉLÈVE', 'eleve'],
    ['Œuf & cœur', 'oeuf coeur'],
    ["l'ordinateur", 'l ordinateur'],
    ["%_' OR 1=1; --", 'or 1 1'],
    ['   ', ''],
    ['iPhone 15 Pro-Max 256Go', 'iphone 15 pro max 256go'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeSearch(input)).toBe(expected)
  })
})

describe('highlightParts', () => {
  const marked = (label: string, query: string) =>
    highlightParts(label, query).filter((p) => p.match).map((p) => p.text)

  it('ignores accents and case but keeps the original text', () => {
    expect(marked('Téléphone portable', 'TELEP')).toEqual(['Télép'])
  })

  it('marks every query word', () => {
    expect(marked('Samsung Galaxy A15', 'samsung a15')).toEqual(['Samsung', 'A15'])
  })

  it('handles ligatures without shifting offsets', () => {
    expect(marked('Crème pour cœur', 'coeur')).toEqual(['cœur'])
  })

  it('ignores one-letter words and empty queries', () => {
    expect(marked('Samsung A15', 'a')).toEqual([])
    expect(highlightParts('Samsung', '')).toEqual([{ text: 'Samsung', match: false }])
  })

  it('rebuilds the label exactly', () => {
    const label = 'Réfrigérateur LG — 300 L'
    expect(highlightParts(label, 'refri 300').map((p) => p.text).join('')).toBe(label)
  })
})
