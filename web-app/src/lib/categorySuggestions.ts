export type AttributeClassification = 'VARIANT' | 'INFO'

export interface AttributeSuggestion {
  name: string
  recommendedType: AttributeClassification
  placeholder?: string
}

export interface CategoryAttributeRequirements {
  /** Every named attribute must be present and have a value. */
  allOf?: string[]
  /** At least one named attribute in each group must be present and have a value. */
  anyOf?: string[][]
}

export const CATEGORY_ATTRIBUTE_REQUIREMENTS: Record<string, CategoryAttributeRequirements> = {
  shoes: { allOf: ['Color', 'Shoe Size'] },
  fashion: { allOf: ['Color', 'Size'] },
  food: { allOf: ['Expiration Date'], anyOf: [['Weight', 'Volume', 'Pack Size']] },
  beauty: { anyOf: [['Shade', 'Volume', 'Scent']] },
  electronics: { allOf: ['Model'], anyOf: [['Storage', 'RAM', 'Capacity']] },
  children: { allOf: ['Age Range'], anyOf: [['Size', 'Color']] },
  home: { allOf: ['Dimensions', 'Material'] },
  sport: { anyOf: [['Size', 'Weight']] },
  automotive: { anyOf: [['Model', 'Compatibility']] },
}

export const CATEGORY_ATTRIBUTE_SUGGESTIONS: Record<string, AttributeSuggestion[]> = {
  shoes: [
    { name: 'Color', recommendedType: 'VARIANT', placeholder: 'e.g. Black, White, Red' },
    { name: 'Shoe Size', recommendedType: 'VARIANT', placeholder: 'e.g. 40, 41, 42, 43' },
    { name: 'Material', recommendedType: 'INFO', placeholder: 'e.g. Genuine Leather, Canvas' },
    { name: 'Gender', recommendedType: 'INFO', placeholder: 'e.g. Men, Women, Unisex' },
  ],
  fashion: [
    { name: 'Color', recommendedType: 'VARIANT', placeholder: 'e.g. Blue, Navy, White' },
    { name: 'Size', recommendedType: 'VARIANT', placeholder: 'e.g. S, M, L, XL' },
    { name: 'Material', recommendedType: 'INFO', placeholder: 'e.g. 100% Cotton, Silk' },
    { name: 'Fit', recommendedType: 'INFO', placeholder: 'e.g. Slim Fit, Regular Fit, Relaxed' },
  ],
  food: [
    { name: 'Flavor', recommendedType: 'VARIANT', placeholder: 'e.g. Vanilla, Chocolate, Strawberry' },
    { name: 'Weight', recommendedType: 'VARIANT', placeholder: 'e.g. 250g, 500g, 1kg' },
    { name: 'Volume', recommendedType: 'VARIANT', placeholder: 'e.g. 330ml, 500ml, 1.5L' },
    { name: 'Pack Size', recommendedType: 'VARIANT', placeholder: 'e.g. Pack of 6, Pack of 12, Single' },
    { name: 'Expiration Date', recommendedType: 'INFO', placeholder: 'e.g. 2026-12-31' },
  ],
  beauty: [
    { name: 'Shade', recommendedType: 'VARIANT', placeholder: 'e.g. Light Sand, Caramel, Mocha' },
    { name: 'Volume', recommendedType: 'VARIANT', placeholder: 'e.g. 50ml, 100ml, 200ml' },
    { name: 'Scent', recommendedType: 'VARIANT', placeholder: 'e.g. Lavender, Rose, Citrus' },
    { name: 'Skin Type', recommendedType: 'INFO', placeholder: 'e.g. All Skin Types, Sensitive, Oily' },
  ],
  electronics: [
    { name: 'Color', recommendedType: 'VARIANT', placeholder: 'e.g. Space Gray, Silver, Midnight' },
    { name: 'Storage', recommendedType: 'VARIANT', placeholder: 'e.g. 64GB, 128GB, 256GB, 512GB' },
    { name: 'RAM', recommendedType: 'VARIANT', placeholder: 'e.g. 4GB, 8GB, 16GB, 32GB' },
    { name: 'Capacity', recommendedType: 'VARIANT', placeholder: 'e.g. 10000mAh, 20000mAh' },
    { name: 'Model', recommendedType: 'INFO', placeholder: 'e.g. Pro Max 2026, Series X' },
  ],
  children: [
    { name: 'Age Range', recommendedType: 'INFO', placeholder: 'e.g. 0-6 months, 2-3 years, 6-8 years' },
    { name: 'Size', recommendedType: 'VARIANT', placeholder: 'e.g. 2T, 3T, 4T, 5-6' },
    { name: 'Color', recommendedType: 'VARIANT', placeholder: 'e.g. Blue, Pink, Yellow' },
  ],
  home: [
    { name: 'Dimensions', recommendedType: 'INFO', placeholder: 'e.g. 120cm x 60cm x 75cm' },
    { name: 'Material', recommendedType: 'INFO', placeholder: 'e.g. Solid Wood, Metal, Glass' },
    { name: 'Color', recommendedType: 'VARIANT', placeholder: 'e.g. Natural Oak, Walnut, White' },
    { name: 'Capacity', recommendedType: 'VARIANT', placeholder: 'e.g. 2-Seater, 4-Seater, 6-Seater' },
  ],
  sport: [
    { name: 'Size', recommendedType: 'VARIANT', placeholder: 'e.g. Size 5, Medium, Large' },
    { name: 'Weight', recommendedType: 'INFO', placeholder: 'e.g. 5kg, 10kg, 15kg' },
    { name: 'Color', recommendedType: 'VARIANT', placeholder: 'e.g. Red, Black, Neon Green' },
  ],
  automotive: [
    { name: 'Model', recommendedType: 'INFO', placeholder: 'e.g. Universal, Hilux, RAV4' },
    { name: 'Compatibility', recommendedType: 'INFO', placeholder: 'e.g. 2018-2024 Models, 12V Vehicles' },
    { name: 'Capacity', recommendedType: 'VARIANT', placeholder: 'e.g. 4L, 5L, 20L' },
    { name: 'Size', recommendedType: 'VARIANT', placeholder: 'e.g. 16 inch, 17 inch, 18 inch' },
  ],
}

/** Common custom characteristic suggestions across all domains */
export const POPULAR_CUSTOM_CHARACTERISTICS = [
  'Heel Height',
  'Battery Capacity',
  'Water Resistance',
  'Processor',
  'Fragrance',
  'Material',
  'Pattern',
  'Warranty',
  'Voltage',
]

/** Resolve category slug/name to suggestions */
export function getCategorySuggestions(categorySlugOrName?: string): AttributeSuggestion[] {
  return CATEGORY_ATTRIBUTE_SUGGESTIONS[resolveCategoryKey(categorySlugOrName)] || []
}

/**
 * Maps a slug or display name — in English or French — onto one of the keys
 * used by CATEGORY_ATTRIBUTE_SUGGESTIONS and CATEGORY_ATTRIBUTE_REQUIREMENTS.
 *
 * Mirrored by resolveCategoryKey in backend/internal/models/category_requirements.go;
 * keep the two in sync when categories change.
 */
export function resolveCategoryKey(categorySlugOrName?: string): string {
  if (!categorySlugOrName) return ''
  const n = categorySlugOrName.toLowerCase().trim()
  const words = n.split(/[^a-z0-9]+/).filter(Boolean)

  /** Distinctive stems: safe to match anywhere in the string. */
  const has = (...subs: string[]) => subs.some((s) => n.includes(s))
  /**
   * Short, ambiguous tokens: "car" is a substring of "scarves", "carpet" and
   * "cardigan", so it must only match as a whole word.
   */
  const hasWord = (...candidates: string[]) => words.some((w) => candidates.includes(w))

  if (has('shoe', 'chaussure', 'footwear')) return 'shoes'
  if (has('fashion', 'mode', 'clothing', 'vetement')) return 'fashion'
  if (has('food', 'aliment', 'grocery', 'epicerie', 'boisson')) return 'food'
  if (has('beauty', 'beaute', 'cosmetic', 'soin')) return 'beauty'
  if (has('electron', 'phone', 'ordinateur') || hasWord('tech')) return 'electronics'
  if (has('enfant', 'baby', 'bebe') || hasWord('child', 'children', 'kid', 'kids')) return 'children'
  if (has('maison', 'furnitur', 'meuble', 'decor') || hasWord('home')) return 'home'
  if (has('sport', 'fitness')) return 'sport'
  if (has('vehic', 'voiture', 'automo') || hasWord('auto', 'car', 'cars')) return 'automotive'
  return n
}

/**
 * Rules for a category, or an empty set when it has none.
 *
 * A subcategory rule wins over its parent's, so a narrower category can demand
 * more; when the subcategory has no rule of its own the parent's applies.
 */
export function getCategoryRequirements(
  categorySlugOrName?: string,
  subcategorySlugOrName?: string
): CategoryAttributeRequirements {
  if (subcategorySlugOrName) {
    const sub = CATEGORY_ATTRIBUTE_REQUIREMENTS[resolveCategoryKey(subcategorySlugOrName)]
    if (sub && ((sub.allOf?.length ?? 0) > 0 || (sub.anyOf?.length ?? 0) > 0)) return sub
  }
  return CATEGORY_ATTRIBUTE_REQUIREMENTS[resolveCategoryKey(categorySlugOrName)] ?? {}
}

/**
 * Names the characteristics that block publication, given those already filled
 * in. An empty result means the product satisfies its category.
 *
 * Mirrored by MissingRequiredAttributes in the backend, which is the rule of
 * record — this copy only exists to warn the seller before they submit.
 */
export function missingRequiredAttributes(
  requirements: CategoryAttributeRequirements,
  presentAttributes: string[]
): string[] {
  const present = new Set(
    presentAttributes.map((name) => name.trim().toLowerCase()).filter(Boolean)
  )
  const missing: string[] = []

  for (const name of requirements.allOf ?? []) {
    if (!present.has(name.toLowerCase())) missing.push(name)
  }
  for (const group of requirements.anyOf ?? []) {
    if (!group.some((name) => present.has(name.toLowerCase()))) {
      missing.push(`one of: ${group.join(', ')}`)
    }
  }
  return missing
}
