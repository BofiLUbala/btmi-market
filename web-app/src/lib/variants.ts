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
/**
 * A key that several variants carry with one and the same value (e.g. the
 * product-level "Model" copied onto every variant) is a shared characteristic,
 * shown with the specifications — not a choice the buyer has to make.
 */
function isSharedCharacteristic(variants: { attributes?: Record<string, string> | null }[], key: string): boolean {
  const carried = variants.map((v) => (v.attributes ?? {})[key]?.trim()).filter(Boolean)
  return carried.length >= 2 && new Set(carried).size === 1
}

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
      const value = attrs[key]?.trim()
      if (value) values.get(key)!.add(value)
    }
  }
  // Keep dimensions with one known value too. Some migrated products still
  // contain an empty legacy/default variant alongside attributed variants;
  // dropping single-value dimensions would hide Color/Size entirely and make
  // the buyer fall back to opaque variant names.
  return order
    .filter((key) => (values.get(key)?.toArray().length ?? 0) > 0 && !isSharedCharacteristic(variants, key))
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

export interface OptionValueState {
  /** Some variant carries this value — the only reason to disable it. */
  exists: boolean
  /** A variant pairs this value with every other option already chosen. */
  compatible: boolean
  /** Units behind the value: with the current choices when compatible,
   *  otherwise across every variant that carries it. */
  units: number
}

/**
 * State of one option value for the buyer. Unlike `isValueAvailable`, a value
 * is never locked just because it doesn't pair with the current choices:
 * variants rarely cover every combination (64 Go only in Noir, 256 Go only in
 * Bleu), and locking left the buyer unable to reach whole variants.
 */
export function optionValueState(
  variants: PublicVariantDetail[],
  selection: VariantSelection,
  key: string,
  value: string
): OptionValueState {
  const carrying = variants.filter((v) => (v.attributes ?? {})[key] === value)
  const partial: VariantSelection = {}
  for (const [k, v] of Object.entries(selection)) {
    if (k !== key && k !== '__variant_id') partial[k] = v
  }
  const compatible = carrying.filter((v) => matches(v, partial))
  const pool = compatible.length > 0 ? compatible : carrying
  return {
    exists: carrying.length > 0,
    compatible: compatible.length > 0,
    units: pool.reduce((sum, v) => sum + Math.max(0, v.stock_quantity ?? 0), 0),
  }
}

/**
 * The variant a click on `key = value` should land on: the one keeping the
 * most of the buyer's other choices, in stock first.
 */
export function bestVariantFor(
  variants: PublicVariantDetail[],
  selection: VariantSelection,
  key: string,
  value: string
): PublicVariantDetail | null {
  let best: PublicVariantDetail | null = null
  let bestScore = -1
  for (const v of variants) {
    const attrs = v.attributes ?? {}
    if (attrs[key] !== value) continue
    let score = 0
    for (const [k, chosen] of Object.entries(selection)) {
      if (k !== key && attrs[k] === chosen) score += 2
    }
    if (v.stock !== 'OUT_OF_STOCK') score += 1
    if (score > bestScore) {
      best = v
      bestScore = score
    }
  }
  return best
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

/**
 * What tells a nameless-dimension variant apart. The seller form stores names
 * as "<product> — <label>", so every option used to repeat the product name
 * (and truncated to identical text on a phone). Keep only the label.
 */
export function variantOptionLabel(variant: { name?: string; sku?: string }, productName?: string): string {
  const name = (variant.name || '').trim()
  const product = (productName || '').trim()
  if (name && product && name.toLowerCase().startsWith(product.toLowerCase())) {
    const rest = name.slice(product.length).replace(/^\s*[—–\-:|/]\s*/, '').trim()
    if (rest) return rest
  }
  return name || variant.sku || ''
}
