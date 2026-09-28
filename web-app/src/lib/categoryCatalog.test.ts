import { describe, expect, it } from 'vitest'
import { CATEGORY_CATALOG, missingCatalogCategories } from './categoryCatalog'
import { descriptionTemplateFor } from './productDescription'
import { fr } from '@/locales/fr'

describe('category catalogue', () => {
  it('gives every catalogue category its own product description template', () => {
    for (const entry of CATEGORY_CATALOG) {
      expect(descriptionTemplateFor(entry.slug).tone, entry.slug).not.toBe('default')
    }
  })

  it('has a French label for every category and subcategory', () => {
    const keys = fr as Record<string, string>
    for (const entry of CATEGORY_CATALOG) {
      const categoryKey = `categories.slug.${entry.slug}`
      expect(keys[categoryKey] ?? keys[`subcategories.slug.${entry.slug}`], categoryKey).toBeTruthy()
      for (const sub of entry.subcategories) {
        expect(keys[`subcategories.slug.${sub.slug}`], sub.slug).toBeTruthy()
      }
    }
  })

  it('only offers categories that are not in the database yet', () => {
    const missing = missingCatalogCategories(['fashion', 'Books']).map((c) => c.slug)
    expect(missing).not.toContain('fashion')
    expect(missing).not.toContain('books')
    expect(missing).toContain('pets')
  })
})
