import type { TranslationKey } from '../store/i18n'

/** Signature-compatible with the i18n hook's `t`, so it can be passed in. */
export type Translator = (key: TranslationKey, vars?: Record<string, string | number>) => string

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

/**
 * Port of web-app/src/lib/categorySuggestions.ts, itself mirrored by
 * backend/internal/models/category_requirements.go -- the backend copy is the
 * rule of record. All three must stay in sync when categories change; this one
 * exists so the seller sees what a category demands before submitting, instead
 * of discovering it as a rejected publish.
 */
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
    { name: 'Color', recommendedType: 'VARIANT', placeholder: 'Noir, Blanc, Rouge' },
    { name: 'Shoe Size', recommendedType: 'VARIANT', placeholder: '40, 41, 42, 43' },
    { name: 'Material', recommendedType: 'INFO', placeholder: 'Cuir veritable, Toile' },
    { name: 'Gender', recommendedType: 'INFO', placeholder: 'Homme, Femme, Unisexe' },
  ],
  fashion: [
    { name: 'Color', recommendedType: 'VARIANT', placeholder: 'Bleu, Marine, Blanc' },
    { name: 'Size', recommendedType: 'VARIANT', placeholder: 'S, M, L, XL' },
    { name: 'Material', recommendedType: 'INFO', placeholder: '100% coton, Soie' },
    { name: 'Fit', recommendedType: 'INFO', placeholder: 'Slim, Regular, Ample' },
  ],
  food: [
    { name: 'Flavor', recommendedType: 'VARIANT', placeholder: 'Vanille, Chocolat, Fraise' },
    { name: 'Weight', recommendedType: 'VARIANT', placeholder: '250g, 500g, 1kg' },
    { name: 'Volume', recommendedType: 'VARIANT', placeholder: '330ml, 500ml, 1.5L' },
    { name: 'Pack Size', recommendedType: 'VARIANT', placeholder: 'Pack de 6, Pack de 12, Unite' },
    { name: 'Expiration Date', recommendedType: 'INFO', placeholder: '2026-12-31' },
  ],
  beauty: [
    { name: 'Shade', recommendedType: 'VARIANT', placeholder: 'Sable clair, Caramel, Moka' },
    { name: 'Volume', recommendedType: 'VARIANT', placeholder: '50ml, 100ml, 200ml' },
    { name: 'Scent', recommendedType: 'VARIANT', placeholder: 'Lavande, Rose, Agrumes' },
    { name: 'Skin Type', recommendedType: 'INFO', placeholder: 'Tous types, Sensible, Grasse' },
  ],
  electronics: [
    { name: 'Color', recommendedType: 'VARIANT', placeholder: 'Gris sideral, Argent, Minuit' },
    { name: 'Storage', recommendedType: 'VARIANT', placeholder: '64GB, 128GB, 256GB' },
    { name: 'RAM', recommendedType: 'VARIANT', placeholder: '4GB, 8GB, 16GB' },
    { name: 'Capacity', recommendedType: 'VARIANT', placeholder: '10000mAh, 20000mAh' },
    { name: 'Model', recommendedType: 'INFO', placeholder: 'Pro Max 2026, Series X' },
  ],
  children: [
    { name: 'Age Range', recommendedType: 'INFO', placeholder: '0-6 mois, 2-3 ans, 6-8 ans' },
    { name: 'Size', recommendedType: 'VARIANT', placeholder: '2A, 3A, 4A, 5-6A' },
    { name: 'Color', recommendedType: 'VARIANT', placeholder: 'Bleu, Rose, Jaune' },
  ],
  home: [
    { name: 'Dimensions', recommendedType: 'INFO', placeholder: '120cm x 60cm x 75cm' },
    { name: 'Material', recommendedType: 'INFO', placeholder: 'Bois massif, Metal, Verre' },
    { name: 'Color', recommendedType: 'VARIANT', placeholder: 'Chene naturel, Noyer, Blanc' },
    { name: 'Capacity', recommendedType: 'VARIANT', placeholder: '2 places, 4 places, 6 places' },
  ],
  sport: [
    { name: 'Size', recommendedType: 'VARIANT', placeholder: 'Taille 5, Moyen, Grand' },
    { name: 'Weight', recommendedType: 'INFO', placeholder: '5kg, 10kg, 15kg' },
    { name: 'Color', recommendedType: 'VARIANT', placeholder: 'Rouge, Noir, Vert fluo' },
  ],
  automotive: [
    { name: 'Model', recommendedType: 'INFO', placeholder: 'Universel, Hilux, RAV4' },
    { name: 'Compatibility', recommendedType: 'INFO', placeholder: 'Modeles 2018-2024, Vehicules 12V' },
    { name: 'Capacity', recommendedType: 'VARIANT', placeholder: '4L, 5L, 20L' },
    { name: 'Size', recommendedType: 'VARIANT', placeholder: '16 pouces, 17 pouces, 18 pouces' },
  ],
}

/** Common custom characteristic suggestions across all domains. */
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

/** Resolve a category slug/name to its suggested characteristics. */
export function getCategorySuggestions(categorySlugOrName?: string): AttributeSuggestion[] {
  return CATEGORY_ATTRIBUTE_SUGGESTIONS[resolveCategoryKey(categorySlugOrName)] || []
}

/**
 * Maps a slug or display name -- in English or French -- onto one of the keys
 * used by the tables above. Mirrors resolveCategoryKey in the web app and in
 * backend/internal/models/category_requirements.go.
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
 * record -- this copy only exists to warn the seller before they submit.
 */
export function missingRequiredAttributes(
  requirements: CategoryAttributeRequirements,
  presentAttributes: string[],
  t?: Translator
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
      missing.push(
        t ? t('category.anyOfMissing', { names: group.join(', ') }) : `one of: ${group.join(', ')}`
      )
    }
  }
  return missing
}
