import type { PublicVariantDetail } from '@/api/types'

export interface AttributeGroup {
  key: string
  label: string
  values: string[]
}

export type VariantSelection = Record<string, string>

function titleCase(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Derive attribute groups from real variant attributes.
 * Works for any attribute names (Color, Size, Storage, RAM, Flavor, Voltage…).
 * Key order follows first appearance across variants.
 */
export function buildAttributeGroups(variants: PublicVariantDetail[]): AttributeGroup[] {
  const order: string[] = []
  const values = new Map<string, LinkedSet>()
  for (const v of variants) {
    const attrs = v.attributes ?? {}
    for (const key of Object.keys(attrs)) {
      if (!values.has(key)) {
        values.set(key, new LinkedSet())
        order.push(key)
      }
      values.get(key)!.add(attrs[key])
    }
  }
  // Only selectable dimensions have >1 distinct value.
  // Single-value attributes are product specifications, not variant selectors.
  return order
    .filter((key) => (values.get(key)?.toArray().length ?? 0) > 1)
    .map((key) => ({
      key,
      label: titleCase(key),
      values: values.get(key)!.toArray()
    }))
}

/** Preserves first-seen order without duplicates. */
class LinkedSet {
  private items: string[] = []
  private seen = new Set<string>()
  add(v: string) {
    if (!this.seen.has(v)) {
      this.seen.add(v)
      this.items.push(v)
    }
  }
  toArray() {
    return [...this.items]
  }
}

function matches(variant: PublicVariantDetail, selection: VariantSelection): boolean {
  return Object.entries(selection).every(
    ([k, val]) => (variant.attributes ?? {})[k] === val
  )
}

export function resolveVariant(
  variants: PublicVariantDetail[],
  selection: VariantSelection
): PublicVariantDetail | null {
  return variants.find((v) => matches(v, selection)) ?? null
}

/**
 * A value is selectable when at least one variant matches the current
 * selection on every OTHER attribute with this value on `key`.
 * `ignoreKey` lets each selector evaluate availability independently.
 */
export function isValueAvailable(
  variants: PublicVariantDetail[],
  selection: VariantSelection,
  key: string,
  value: string,
  requireStock: boolean
): boolean {
  const partial: VariantSelection = {}
  for (const [k, v] of Object.entries(selection)) {
    if (k !== key) partial[k] = v
  }
  return variants.some(
    (v) =>
      (v.attributes ?? {})[key] === value &&
      matches(v, partial) &&
      (!requireStock || v.stock !== 'OUT_OF_STOCK')
  )
}

/** True when variants carry no meaningful choice (0 or 1 effective option). */
export function hasRealVariants(variants: PublicVariantDetail[]): boolean {
  return buildAttributeGroups(variants).length > 0 && variants.length > 1
}

export function describeAttributes(variant: PublicVariantDetail): string {
  const attrs = variant.attributes ?? {}
  const vals = Object.values(attrs)
  if (vals.length === 0) return variant.name || variant.sku
  return vals.join(' / ')
}

export interface ProductSpecification {
  key: string
  label: string
  value: string
}

/**
 * Extract fixed specifications (attributes that have a single constant value across variants,
 * or specifications configured for the product).
 */
export function extractSpecifications(variants: PublicVariantDetail[]): ProductSpecification[] {
  if (!variants || variants.length === 0) return []
  const allKeys = new Set<string>()
  variants.forEach((v) => {
    Object.keys(v.attributes ?? {}).forEach((k) => allKeys.add(k))
  })

  const specs: ProductSpecification[] = []
  for (const key of allKeys) {
    const uniqueValues = Array.from(
      new Set(variants.map((v) => (v.attributes ?? {})[key]).filter(Boolean))
    )
    if (uniqueValues.length === 1) {
      specs.push({
        key,
        label: titleCase(key),
        value: uniqueValues[0],
      })
    }
  }
  return specs
}

export { titleCase }

