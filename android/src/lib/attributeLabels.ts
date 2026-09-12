import type { TranslationKey } from '../store/i18n'

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string

const ATTRIBUTE_KEYS: Record<string, TranslationKey> = {
  color: 'attributes.color',
  colour: 'attributes.color',
  'shoe size': 'attributes.shoeSize',
  size: 'attributes.size',
  material: 'attributes.material',
  gender: 'attributes.gender',
  fit: 'attributes.fit',
  'age range': 'attributes.ageRange',
  storage: 'attributes.storage',
  ram: 'attributes.ram',
  capacity: 'attributes.capacity',
  model: 'attributes.model',
  dimensions: 'attributes.dimensions',
  flavor: 'attributes.flavor',
  weight: 'attributes.weight',
  volume: 'attributes.volume',
  'pack size': 'attributes.packSize',
  'expiration date': 'attributes.expirationDate',
  shade: 'attributes.shade',
  scent: 'attributes.scent',
  'skin type': 'attributes.skinType',
  compatibility: 'attributes.compatibility',
}

export function attributeLabel(t: Translate, value: string): string {
  const key = ATTRIBUTE_KEYS[value.trim().toLowerCase()]
  return key ? t(key) : value
}
