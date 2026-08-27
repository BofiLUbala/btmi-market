import type Ionicons from '@expo/vector-icons/Ionicons'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

/**
 * Category slug -> icon.
 *
 * Icons used to be picked with `index % 3`, so the same category showed a
 * different icon depending on its position in the list and Food could end up
 * with a phone. Mirrors the slug mapping the web app already uses.
 */
const bySlug: Record<string, IoniconName> = {
  fashion: 'shirt-outline',
  clothing: 'shirt-outline',
  shoes: 'footsteps-outline',
  footwear: 'footsteps-outline',
  children: 'happy-outline',
  kids: 'happy-outline',
  baby: 'happy-outline',
  electronics: 'phone-portrait-outline',
  technology: 'phone-portrait-outline',
  home: 'bed-outline',
  furniture: 'bed-outline',
  decor: 'bed-outline',
  beauty: 'sparkles-outline',
  cosmetics: 'sparkles-outline',
  food: 'fast-food-outline',
  grocery: 'basket-outline',
  restaurant: 'restaurant-outline',
  sport: 'basketball-outline',
  sports: 'basketball-outline',
  fitness: 'barbell-outline',
  automotive: 'car-outline',
  auto: 'car-outline',
  car: 'car-outline',
  services: 'construct-outline',
  service: 'construct-outline',
}

export function categoryIcon(slug?: string, name?: string): IoniconName {
  const key = (slug || name || '').toLowerCase().trim()
  if (bySlug[key]) return bySlug[key]
  // Fall back to a partial match so "mens-shoes" still resolves to shoes.
  for (const [candidate, icon] of Object.entries(bySlug)) {
    if (key.includes(candidate)) return icon
  }
  return 'pricetag-outline'
}
