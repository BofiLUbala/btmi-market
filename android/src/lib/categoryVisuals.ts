/**
 * Category slug -> bundled image, mirroring web-app/src/lib/categoryVisuals.ts
 * so both platforms show the same artwork for a category.
 *
 * `require` is used deliberately: Metro resolves these at build time and
 * bundles the files, which a dynamic path string cannot do.
 */
const images = {
  fashion: require('../../assets/categories/fashion.webp'),
  shoes: require('../../assets/categories/shoes.webp'),
  children: require('../../assets/categories/children.webp'),
  electronics: require('../../assets/categories/electronics.webp'),
  home: require('../../assets/categories/home.webp'),
  beauty: require('../../assets/categories/beauty.webp'),
  food: require('../../assets/categories/food.webp'),
  sport: require('../../assets/categories/sport.webp'),
  automotive: require('../../assets/categories/automotive.webp'),
  services: require('../../assets/categories/services.webp'),
  default: require('../../assets/categories/default.webp'),
} as const

type Tone = keyof typeof images

const slugToTone: Record<string, Tone> = {
  fashion: 'fashion', clothing: 'fashion',
  shoes: 'shoes', footwear: 'shoes',
  children: 'children', kids: 'children', baby: 'children',
  electronics: 'electronics', technology: 'electronics',
  home: 'home', furniture: 'home', decor: 'home',
  beauty: 'beauty', cosmetics: 'beauty', 'personal-care': 'beauty',
  food: 'food', grocery: 'food', restaurant: 'food',
  sport: 'sport', sports: 'sport', fitness: 'sport',
  automotive: 'automotive', auto: 'automotive', car: 'automotive', vehicle: 'automotive',
  services: 'services', service: 'services',
}

export function categoryImage(slug?: string, name?: string) {
  const key = (slug || name || '').toLowerCase().trim()
  if (slugToTone[key]) return images[slugToTone[key]]
  // Partial match so "mens-shoes" still resolves to the shoes artwork.
  for (const [candidate, tone] of Object.entries(slugToTone)) {
    if (key.includes(candidate)) return images[tone]
  }
  return images.default
}
