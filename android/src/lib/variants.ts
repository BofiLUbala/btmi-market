import type { PublicVariant } from '../types'

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
 * Derive attribute groups dynamically from backend variant attributes.
 * Never relies on hardcoded category schemas.
 */
export function buildAttributeGroups(variants: PublicVariant[]): AttributeGroup[] {
  const order: string[] = []
  const values = new Map<string, string[]>()

  for (const v of variants) {
    const attrs = v.attributes ?? {}
    for (const key of Object.keys(attrs)) {
      if (!values.has(key)) {
        values.set(key, [])
        order.push(key)
      }
      const list = values.get(key)!
      const val = attrs[key]
      if (val && !list.includes(val)) {
        list.push(val)
      }
    }
  }

  // Only return groups that actually have choices (> 1 distinct value),
  // single-value attributes become product specifications.
  return order
    .filter((key) => (values.get(key)?.length ?? 0) > 1)
    .map((key) => ({
      key,
      label: titleCase(key),
      values: values.get(key)!,
    }))
}

function matches(variant: PublicVariant, selection: VariantSelection): boolean {
  return Object.entries(selection).every(
    ([k, val]) => (variant.attributes ?? {})[k] === val
  )
}

export function isValueAvailable(
  variants: PublicVariant[],
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
      (!requireStock || (v.stock_quantity ?? v.available_stock ?? 0) > 0)
  )
}

export function resolveVariant(
  variants: PublicVariant[],
  selection: VariantSelection
): PublicVariant | null {
  return variants.find((v) => matches(v, selection)) ?? null
}

export function hasRealVariants(variants: PublicVariant[]): boolean {
  return buildAttributeGroups(variants).length > 0 && variants.length > 1
}

export function describeAttributes(variant: PublicVariant): string {
  const attrs = variant.attributes ?? {}
  const vals = Object.values(attrs)
  if (vals.length === 0) return variant.name || variant.sku || 'Option'
  return vals.join(' / ')
}

export interface ProductSpecification {
  key: string
  label: string
  value: string
}

export function extractSpecifications(variants: PublicVariant[]): ProductSpecification[] {
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
