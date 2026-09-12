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

const TAXONOMY_ALIASES: Record<string, string> = {
  mode: 'fashion', enfants: 'children', enfant: 'children', electronique: 'electronics',
  maison: 'home', beaute: 'beauty', alimentation: 'food', automobile: 'automotive',
  chaussures: 'shoes', vetements: 'clothing', vetement: 'clothing', sacs: 'bags',
  accessoires: 'accessories', telephones: 'phones', telephone: 'phones',
  ordinateurs: 'computers', ordinateur: 'computers', televiseurs: 'tvs', meubles: 'furniture',
  cuisine: 'kitchen', decoration: 'decoration', jouets: 'toys', ecole: 'school',
  'produits-pour-bebe': 'baby-products', 'plein-air': 'outdoor',
  'sports-d-equipe': 'team-sports', 'soins-de-la-peau': 'skincare', maquillage: 'makeup',
  'soins-capillaires': 'haircare', boissons: 'beverages', collations: 'snacks',
  boulangerie: 'bakery', 'pieces-detachees': 'parts', pneus: 'tires',
  reparation: 'repair', conseil: 'consulting', livraison: 'delivery',
}

function normalizeTaxonomyValue(value: string | null | undefined): string {
  const normalized = (value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return TAXONOMY_ALIASES[normalized] || normalized
}

function resolveKey(keys: Record<string, TranslationKey>, slug?: string | null, fallbackName?: string | null) {
  return keys[normalizeTaxonomyValue(slug)] || keys[normalizeTaxonomyValue(fallbackName)]
}

export function categoryLabel(t: Translate, slug: string | null | undefined, fallbackName: string | null | undefined): string {
  const key = resolveKey(CATEGORY_KEYS, slug, fallbackName)
  return key ? t(key) : fallbackName ?? slug ?? ''
}

export function subcategoryLabel(t: Translate, slug: string | null | undefined, fallbackName: string | null | undefined): string {
  const key = resolveKey(SUBCATEGORY_KEYS, slug, fallbackName)
  return key ? t(key) : fallbackName ?? slug ?? ''
}
