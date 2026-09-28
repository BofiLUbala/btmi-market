export type CategoryTone = 'fashion' | 'shoes' | 'children' | 'electronics' | 'home' | 'beauty' | 'food' | 'sport' | 'automotive' | 'services'
  | 'books' | 'jewelry' | 'health' | 'pets' | 'stationery' | 'garden' | 'music' | 'hardware' | 'default'

export interface CategoryVisual { image: string; background: string; accent: string }

const visuals: Record<CategoryTone, CategoryVisual> = {
  fashion: { image: '/assets/categories/fashion.webp', background: '#fdf2f8', accent: '#9d174d' },
  shoes: { image: '/assets/categories/shoes.webp', background: '#fff7ed', accent: '#9a3412' },
  children: { image: '/assets/categories/children.webp', background: '#eff6ff', accent: '#1d4ed8' },
  electronics: { image: '/assets/categories/electronics.webp', background: '#f1f5f9', accent: '#334155' },
  home: { image: '/assets/categories/home.webp', background: '#f0fdf4', accent: '#166534' },
  beauty: { image: '/assets/categories/beauty.webp', background: '#fff1f2', accent: '#9f1239' },
  food: { image: '/assets/categories/food.webp', background: '#fefce8', accent: '#854d0e' },
  sport: { image: '/assets/categories/sport.webp', background: '#ecfdf5', accent: '#065f46' },
  automotive: { image: '/assets/categories/automotive.webp', background: '#f8fafc', accent: '#334155' },
  services: { image: '/assets/categories/services.webp', background: '#faf5ff', accent: '#6b21a8' },
  books: { image: '/assets/categories/default.webp', background: '#fef3c7', accent: '#92400e' },
  jewelry: { image: '/assets/categories/default.webp', background: '#fdf4ff', accent: '#86198f' },
  health: { image: '/assets/categories/default.webp', background: '#ecfeff', accent: '#0e7490' },
  pets: { image: '/assets/categories/default.webp', background: '#fff7ed', accent: '#c2410c' },
  stationery: { image: '/assets/categories/default.webp', background: '#eef2ff', accent: '#3730a3' },
  garden: { image: '/assets/categories/default.webp', background: '#f7fee7', accent: '#3f6212' },
  music: { image: '/assets/categories/default.webp', background: '#fdf2f8', accent: '#831843' },
  hardware: { image: '/assets/categories/default.webp', background: '#fafaf9', accent: '#44403c' },
  default: { image: '/assets/categories/default.webp', background: '#f8fafc', accent: '#475569' },
}

const slugToTone: Record<string, CategoryTone> = {
  fashion: 'fashion', shoes: 'shoes', footwear: 'shoes', children: 'children', kids: 'children', baby: 'children',
  electronics: 'electronics', technology: 'electronics', home: 'home', furniture: 'home', decor: 'home',
  beauty: 'beauty', cosmetics: 'beauty', 'personal-care': 'beauty', food: 'food', grocery: 'food', restaurant: 'food',
  sport: 'sport', sports: 'sport', fitness: 'sport', automotive: 'automotive', auto: 'automotive', car: 'automotive',
  vehicle: 'automotive', services: 'services', service: 'services',
  books: 'books', jewelry: 'jewelry', health: 'health', pets: 'pets', stationery: 'stationery',
  garden: 'garden', music: 'music', hardware: 'hardware',
}

export function getCategoryVisual(slug: string): CategoryVisual {
  return visuals[slugToTone[slug.toLowerCase()] ?? 'default']
}
