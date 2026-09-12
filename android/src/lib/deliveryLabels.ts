import type { TranslationKey } from '../store/i18n'

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string

const DELIVERY_KEYS: Record<string, TranslationKey> = {
  PICKUP: 'orders.deliveryPickup',
  SHOP_DELIVERY: 'orders.deliveryShop',
  PARTNER: 'orders.deliveryPartner',
}

export function deliveryLabel(t: Translate, value: string | null | undefined): string {
  if (!value) return ''
  const normalized = value.trim().toUpperCase()
  const key = DELIVERY_KEYS[normalized]
  return key ? t(key) : value.replaceAll('_', ' ')
}
