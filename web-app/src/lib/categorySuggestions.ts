export type AttributeClassification = 'VARIANT' | 'INFO'

export interface AttributeSuggestion {
  name: string
  recommendedType: AttributeClassification
  placeholder?: string
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
  if (!categorySlugOrName) return []
  const normalized = categorySlugOrName.toLowerCase().trim()
  
  if (normalized.includes('shoe') || normalized.includes('chaussure') || normalized.includes('footwear')) {
    return CATEGORY_ATTRIBUTE_SUGGESTIONS.shoes
  }
  if (normalized.includes('fashion') || normalized.includes('mode') || normalized.includes('clothing') || normalized.includes('vetement')) {
    return CATEGORY_ATTRIBUTE_SUGGESTIONS.fashion
  }
  if (normalized.includes('food') || normalized.includes('aliment') || normalized.includes('grocery') || normalized.includes('epicerie') || normalized.includes('boisson')) {
    return CATEGORY_ATTRIBUTE_SUGGESTIONS.food
  }
  if (normalized.includes('beauty') || normalized.includes('beaute') || normalized.includes('cosmetic') || normalized.includes('soin')) {
    return CATEGORY_ATTRIBUTE_SUGGESTIONS.beauty
  }
  if (normalized.includes('electron') || normalized.includes('tech') || normalized.includes('phone') || normalized.includes('ordinateur')) {
    return CATEGORY_ATTRIBUTE_SUGGESTIONS.electronics
  }
  if (normalized.includes('child') || normalized.includes('enfant') || normalized.includes('baby') || normalized.includes('bebe') || normalized.includes('kid')) {
    return CATEGORY_ATTRIBUTE_SUGGESTIONS.children
  }
  if (normalized.includes('home') || normalized.includes('maison') || normalized.includes('furnitur') || normalized.includes('meuble') || normalized.includes('decor')) {
    return CATEGORY_ATTRIBUTE_SUGGESTIONS.home
  }
  if (normalized.includes('sport') || normalized.includes('fitness')) {
    return CATEGORY_ATTRIBUTE_SUGGESTIONS.sport
  }
  if (normalized.includes('auto') || normalized.includes('vehic') || normalized.includes('car') || normalized.includes('voiture')) {
    return CATEGORY_ATTRIBUTE_SUGGESTIONS.automotive
  }

  return CATEGORY_ATTRIBUTE_SUGGESTIONS[normalized] || []
}
