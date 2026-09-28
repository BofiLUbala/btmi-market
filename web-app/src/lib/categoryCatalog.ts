/**
 * The categories the marketplace knows how to present.
 *
 * Admins no longer type a free name/slug: they pick from this list, so every
 * category that exists in the database has a translated label, an icon and a
 * category-aware product description template (see productDescription.ts).
 * Names are the English names the backend stores; the UI translates them by
 * slug through categoryLabels.ts.
 */

export interface CatalogSubcategory {
  slug: string
  name: string
}

export interface CatalogCategory {
  slug: string
  name: string
  subcategories: CatalogSubcategory[]
}

const sub = (slug: string, name: string): CatalogSubcategory => ({ slug, name })

export const CATEGORY_CATALOG: CatalogCategory[] = [
  { slug: 'fashion', name: 'Fashion', subcategories: [sub('shoes', 'Shoes'), sub('clothing', 'Clothing'), sub('bags', 'Bags'), sub('accessories', 'Accessories')] },
  { slug: 'shoes', name: 'Shoes', subcategories: [] },
  { slug: 'children', name: 'Children', subcategories: [sub('clothing', 'Clothing'), sub('toys', 'Toys'), sub('school', 'School'), sub('baby-products', 'Baby Products')] },
  { slug: 'electronics', name: 'Electronics', subcategories: [sub('phones', 'Phones'), sub('computers', 'Computers'), sub('tvs', 'TVs'), sub('accessories', 'Accessories')] },
  { slug: 'home', name: 'Home', subcategories: [sub('furniture', 'Furniture'), sub('kitchen', 'Kitchen'), sub('decoration', 'Decoration')] },
  { slug: 'beauty', name: 'Beauty', subcategories: [sub('skincare', 'Skincare'), sub('makeup', 'Makeup'), sub('haircare', 'Haircare')] },
  { slug: 'food', name: 'Food', subcategories: [sub('beverages', 'Beverages'), sub('snacks', 'Snacks'), sub('bakery', 'Bakery')] },
  { slug: 'sport', name: 'Sport', subcategories: [sub('fitness', 'Fitness'), sub('outdoor', 'Outdoor'), sub('team-sports', 'Team Sports')] },
  { slug: 'automotive', name: 'Automotive', subcategories: [sub('parts', 'Parts'), sub('tires', 'Tires'), sub('accessories', 'Accessories')] },
  { slug: 'services', name: 'Services', subcategories: [sub('repair', 'Repair'), sub('consulting', 'Consulting'), sub('delivery', 'Delivery')] },
  { slug: 'books', name: 'Books', subcategories: [sub('novels', 'Novels'), sub('textbooks', 'Textbooks'), sub('comics', 'Comics')] },
  { slug: 'jewelry', name: 'Jewelry & Watches', subcategories: [sub('necklaces', 'Necklaces'), sub('rings', 'Rings'), sub('watches', 'Watches')] },
  { slug: 'health', name: 'Health', subcategories: [sub('supplements', 'Supplements'), sub('medical-devices', 'Medical Devices'), sub('hygiene', 'Hygiene')] },
  { slug: 'pets', name: 'Pets', subcategories: [sub('pet-food', 'Pet Food'), sub('pet-accessories', 'Pet Accessories')] },
  { slug: 'stationery', name: 'Office & Stationery', subcategories: [sub('office-supplies', 'Office Supplies'), sub('paper', 'Paper & Notebooks'), sub('printing', 'Printing')] },
  { slug: 'garden', name: 'Garden', subcategories: [sub('plants', 'Plants'), sub('garden-tools', 'Garden Tools'), sub('outdoor-furniture', 'Outdoor Furniture')] },
  { slug: 'music', name: 'Music & Instruments', subcategories: [sub('instruments', 'Instruments'), sub('audio-gear', 'Audio Gear')] },
  { slug: 'hardware', name: 'DIY & Tools', subcategories: [sub('power-tools', 'Power Tools'), sub('hand-tools', 'Hand Tools'), sub('building-materials', 'Building Materials')] },
]

/** Catalogue entries whose slug is not in the database yet. */
export function missingCatalogCategories(existingSlugs: Iterable<string>): CatalogCategory[] {
  const taken = new Set(Array.from(existingSlugs, (slug) => slug.toLowerCase()))
  return CATEGORY_CATALOG.filter((c) => !taken.has(c.slug))
}
