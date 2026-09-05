import type { TranslationKey } from '@/store/i18n'

/**
 * Category/subcategory names come from the backend's controlled taxonomy
 * (see backend/migrations/019_add_categories_and_publication.sql) and are
 * stored in English only. The slugs are stable, so known ones are translated
 * client-side; anything the backend adds later falls back to its raw name
 * rather than showing a missing translation.
 */
const CATEGORY_KEYS: Record<string, TranslationKey> = {
  fashion: 'categories.slug.fashion',
  children: 'categories.slug.children',
  electronics: 'categories.slug.electronics',
  home: 'categories.slug.home',
  beauty: 'categories.slug.beauty',
  food: 'categories.slug.food',
  sport: 'categories.slug.sport',
  automotive: 'categories.slug.automotive',
  services: 'categories.slug.services',
}

const SUBCATEGORY_KEYS: Record<string, TranslationKey> = {
  shoes: 'subcategories.slug.shoes',
  clothing: 'subcategories.slug.clothing',
  bags: 'subcategories.slug.bags',
  accessories: 'subcategories.slug.accessories',
  phones: 'subcategories.slug.phones',
  computers: 'subcategories.slug.computers',
  tvs: 'subcategories.slug.tvs',
  furniture: 'subcategories.slug.furniture',
  kitchen: 'subcategories.slug.kitchen',
  decoration: 'subcategories.slug.decoration',
  toys: 'subcategories.slug.toys',
  school: 'subcategories.slug.school',
  'baby-products': 'subcategories.slug.baby-products',
  fitness: 'subcategories.slug.fitness',
  outdoor: 'subcategories.slug.outdoor',
  'team-sports': 'subcategories.slug.team-sports',
  skincare: 'subcategories.slug.skincare',
  makeup: 'subcategories.slug.makeup',
  haircare: 'subcategories.slug.haircare',
  beverages: 'subcategories.slug.beverages',
  snacks: 'subcategories.slug.snacks',
  bakery: 'subcategories.slug.bakery',
  parts: 'subcategories.slug.parts',
  tires: 'subcategories.slug.tires',
  repair: 'subcategories.slug.repair',
  consulting: 'subcategories.slug.consulting',
  delivery: 'subcategories.slug.delivery',
}

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string

export function categoryLabel(t: Translate, slug: string | null | undefined, fallbackName: string | null | undefined): string {
  const key = slug ? CATEGORY_KEYS[slug.toLowerCase()] : undefined
  return key ? t(key) : fallbackName ?? slug ?? ''
}

export function subcategoryLabel(t: Translate, slug: string | null | undefined, fallbackName: string | null | undefined): string {
  const key = slug ? SUBCATEGORY_KEYS[slug.toLowerCase()] : undefined
  return key ? t(key) : fallbackName ?? slug ?? ''
}
