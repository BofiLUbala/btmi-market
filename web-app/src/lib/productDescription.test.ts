import { describe, expect, it } from 'vitest'
import {
  composeDescription,
  descriptionTemplateFor,
  draftFromDescription,
  parseDescription,
} from './productDescription'

describe('productDescription', () => {
  it('parses a legacy description as a single intro', () => {
    const parsed = parseDescription('Un joli produit.\nTrès solide.')
    expect(parsed.intro).toBe('Un joli produit.\nTrès solide.')
    expect(parsed.sections).toEqual([])
  })

  it('round-trips a structured fashion description', () => {
    const template = descriptionTemplateFor('fashion')
    const text = composeDescription(
      { intro: 'Manteau en laine.', values: { materials: '70 % laine', fit: 'Taille normalement' }, extra: [] },
      template,
      'fr'
    )
    expect(text).toBe('Manteau en laine.\n\n## Matières & entretien\n70 % laine\n\n## Coupe & taille\nTaille normalement')
    const draft = draftFromDescription(text, template)
    expect(draft.intro).toBe('Manteau en laine.')
    expect(draft.values).toEqual({ materials: '70 % laine', fit: 'Taille normalement' })
    expect(draft.extra).toEqual([])
  })

  it('matches headings in the other language and keeps unknown sections', () => {
    const template = descriptionTemplateFor('electronics')
    const draft = draftFromDescription("Intro\n\n## What’s in the box\nCable\n\n## Notes\nFragile", template)
    expect(draft.values.box).toBe('Cable')
    expect(draft.extra).toEqual([{ heading: 'Notes', body: 'Fragile' }])
    expect(composeDescription(draft, template, 'fr')).toContain('## Notes\nFragile')
  })

  it('falls back to the default template for unknown categories', () => {
    expect(descriptionTemplateFor('unknown').tone).toBe('default')
    expect(descriptionTemplateFor(undefined).tone).toBe('default')
  })

  it('gives every marketplace category its own layout', () => {
    const slugs = ['fashion', 'shoes', 'children', 'electronics', 'home', 'beauty', 'food', 'sport', 'automotive', 'services']
    const tones = slugs.map((slug) => descriptionTemplateFor(slug).tone)
    expect(tones).toEqual(slugs)
    for (const slug of slugs) {
      const template = descriptionTemplateFor(slug)
      expect(template.sections.length).toBeGreaterThanOrEqual(2)
      for (const section of template.sections) {
        expect(section.label.fr && section.label.en && section.placeholder.fr && section.placeholder.en).toBeTruthy()
      }
    }
  })
})
