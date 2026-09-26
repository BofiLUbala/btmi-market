/**
 * Selectable values for product attributes, so sellers pick sizes, colours,
 * weights… instead of typing them.
 *
 * The values are plain strings: exactly what a seller used to type, so the
 * payload sent to the API, variant matching and the buyer page are
 * unchanged. Admin-configured `allowed_values` always win; this catalogue
 * only fills the gap while those lists are empty.
 *
 * Framework-free; mirrored verbatim from web-app/src/lib/attributeOptions.ts — keep in sync.
 */

export interface AttributeLike {
  key: string
  label_fr?: string | null
  label_en?: string | null
  allowed_values?: string[] | null
}

export interface AttributeOptionSet {
  values: string[]
  /** Render as colour swatches rather than text chips. */
  swatch: boolean
}

type Kind =
  | 'color' | 'size' | 'shoeSize' | 'material' | 'fit' | 'gender' | 'age' | 'storage' | 'ram'
  | 'capacity' | 'shade' | 'volume' | 'scent' | 'skinType' | 'flavor' | 'weight' | 'pack'

const NAME_TO_KIND: Record<string, Kind> = {
  color: 'color', colour: 'color', couleur: 'color', coloris: 'color',
  size: 'size', taille: 'size', 'taille / diametre': 'size', 'taille / diamètre': 'size', diametre: 'size', diamètre: 'size',
  'shoe size': 'shoeSize', shoe_size: 'shoeSize', pointure: 'shoeSize',
  material: 'material', matiere: 'material', matière: 'material', materiau: 'material', matériau: 'material',
  fit: 'fit', coupe: 'fit',
  gender: 'gender', genre: 'gender',
  'age range': 'age', age_range: 'age', "tranche d'age": 'age', "tranche d'âge": 'age', 'tranche d’âge': 'age', age: 'age', âge: 'age',
  storage: 'storage', stockage: 'storage',
  ram: 'ram', 'memoire ram': 'ram', 'mémoire ram': 'ram',
  capacity: 'capacity', capacite: 'capacity', capacité: 'capacity',
  shade: 'shade', teinte: 'shade',
  volume: 'volume', contenance: 'volume',
  scent: 'scent', parfum: 'scent', fragrance: 'scent',
  'skin type': 'skinType', skin_type: 'skinType', 'type de peau': 'skinType',
  flavor: 'flavor', flavour: 'flavor', saveur: 'flavor', gout: 'flavor', goût: 'flavor',
  weight: 'weight', poids: 'weight',
  'pack size': 'pack', pack_size: 'pack', 'format / lot': 'pack', format: 'pack', lot: 'pack',
}

export const COLOR_VALUES = [
  'Noir', 'Blanc', 'Gris', 'Beige', 'Camel', 'Marron', 'Rouge', 'Bordeaux', 'Rose', 'Orange',
  'Jaune', 'Vert', 'Kaki', 'Bleu', 'Bleu marine', 'Bleu ciel', 'Violet', 'Doré', 'Argenté', 'Multicolore',
]

const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']
const KIDS_SIZES = ['0-3 mois', '3-6 mois', '6-12 mois', '12-18 mois', '2 ans', '3 ans', '4 ans', '6 ans', '8 ans', '10 ans', '12 ans', '14 ans']
const WHEEL_SIZES = ['13"', '14"', '15"', '16"', '17"', '18"', '19"', '20"']

const BY_KIND: Record<Kind, string[] | ((category: string) => string[])> = {
  color: COLOR_VALUES,
  size: (category) => (category === 'children' ? KIDS_SIZES : category === 'automotive' ? WHEEL_SIZES : APPAREL_SIZES),
  shoeSize: ['30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47'],
  material: (category) =>
    category === 'shoes'
      ? ['Cuir', 'Daim', 'Toile', 'Synthétique', 'Caoutchouc', 'Textile']
      : category === 'home'
        ? ['Bois', 'Métal', 'Verre', 'Plastique', 'Céramique', 'Tissu', 'Rotin']
        : ['Coton', 'Lin', 'Laine', 'Soie', 'Polyester', 'Viscose', 'Denim', 'Cuir', 'Wax'],
  fit: ['Ajustée', 'Slim', 'Droite', 'Ample', 'Oversize'],
  gender: ['Homme', 'Femme', 'Unisexe', 'Enfant'],
  age: ['0-6 mois', '6-12 mois', '1-3 ans', '3-6 ans', '6-9 ans', '9-12 ans', '12 ans et +'],
  storage: ['16 Go', '32 Go', '64 Go', '128 Go', '256 Go', '512 Go', '1 To'],
  ram: ['2 Go', '3 Go', '4 Go', '6 Go', '8 Go', '12 Go', '16 Go', '32 Go'],
  capacity: (category) =>
    category === 'electronics'
      ? ['1000 mAh', '2000 mAh', '3000 mAh', '5000 mAh', '10000 mAh', '20000 mAh']
      : category === 'automotive'
        ? ['35 Ah', '45 Ah', '60 Ah', '70 Ah', '80 Ah', '100 Ah']
        : ['0,5 L', '1 L', '1,5 L', '2 L', '3 L', '5 L', '10 L', '20 L'],
  shade: ['Très clair', 'Clair', 'Moyen', 'Caramel', 'Foncé', 'Très foncé', 'Nude', 'Rose', 'Rouge', 'Prune'],
  volume: ['30 ml', '50 ml', '100 ml', '150 ml', '200 ml', '250 ml', '330 ml', '500 ml', '1 L', '1,5 L', '2 L', '5 L'],
  scent: ['Sans parfum', 'Floral', 'Fruité', 'Boisé', 'Vanille', 'Agrumes', 'Musc', 'Coco'],
  skinType: ['Tous types', 'Normale', 'Sèche', 'Grasse', 'Mixte', 'Sensible'],
  flavor: ['Nature', 'Vanille', 'Chocolat', 'Fraise', 'Citron', 'Mangue', 'Ananas', 'Épicé', 'Salé', 'Sucré'],
  weight: (category) =>
    category === 'sport'
      ? ['1 kg', '2 kg', '5 kg', '10 kg', '15 kg', '20 kg']
      : ['100 g', '250 g', '500 g', '1 kg', '2 kg', '5 kg', '10 kg', '25 kg', '50 kg'],
  pack: ['À l’unité', 'Lot de 2', 'Lot de 3', 'Lot de 6', 'Lot de 12', 'Lot de 24', 'Carton'],
}

function norm(value?: string | null): string {
  return (value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ')
}

export function attributeKind(attr: AttributeLike): Kind | null {
  for (const name of [attr.key, attr.label_fr, attr.label_en]) {
    const kind = NAME_TO_KIND[norm(name)] ?? NAME_TO_KIND[(name ?? '').trim().toLowerCase()]
    if (kind) return kind
  }
  return null
}

/**
 * The values a seller can pick for this attribute in this category, or null
 * when the attribute is genuinely free-form (model number, compatibility…).
 * `current` values are always kept so editing an older product never hides
 * what it already has.
 */
export function attributeOptions(
  attr: AttributeLike,
  categorySlug?: string | null,
  current: string[] = []
): AttributeOptionSet | null {
  const kind = attributeKind(attr)
  const configured = (attr.allowed_values ?? []).filter(Boolean)
  let values: string[]
  if (configured.length > 0) values = configured
  else if (kind) {
    const source = BY_KIND[kind]
    values = typeof source === 'function' ? source((categorySlug ?? '').toLowerCase()) : source
  } else return null
  const extra = current.map((v) => v.trim()).filter((v) => v && !values.some((x) => x.toLowerCase() === v.toLowerCase()))
  return { values: [...values, ...extra], swatch: kind === 'color' }
}

/** Comma-joined multi-selection <-> list (the mobile form stores values that way). */
export function splitValues(text: string): string[] {
  return text.split(',').map((v) => v.trim()).filter(Boolean)
}

export function toggleValue(list: string[], value: string): string[] {
  return list.some((v) => v.toLowerCase() === value.toLowerCase())
    ? list.filter((v) => v.toLowerCase() !== value.toLowerCase())
    : [...list, value]
}

/** Variant types a seller can add with one tap (all have an option list). */
export const VARIANT_TYPE_NAMES = [
  'Couleur', 'Taille', 'Pointure', 'Poids', 'Volume', 'Capacité', 'Stockage', 'Mémoire RAM',
  'Saveur', 'Parfum', 'Teinte', 'Format / Lot', 'Matière',
]

/** True when two attribute names mean the same thing ("Color" / "Couleur"). */
export function sameAttribute(a: string, b: string): boolean {
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return true
  const ka = attributeKind({ key: a })
  return ka !== null && ka === attributeKind({ key: b })
}
