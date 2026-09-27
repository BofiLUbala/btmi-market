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
/**
 * A key that several variants carry with one and the same value (e.g. the
 * product-level "Model" copied onto every variant) is a shared characteristic,
 * shown with the specifications — not a choice the buyer has to make.
 */
function isSharedCharacteristic(variants: { attributes?: Record<string, string> | null }[], key: string): boolean {
  const carried = variants.map((v) => (v.attributes ?? {})[key]?.trim()).filter(Boolean)
  return carried.length >= 2 && new Set(carried).size === 1
}

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

  // Keep dimensions with one known value too. Some migrated products still
  // contain an empty legacy/default variant alongside attributed variants;
  // dropping single-value dimensions would hide Color/Size entirely and make
  // the buyer fall back to opaque variant names.
  return order
    .filter((key) => (values.get(key)?.length ?? 0) > 0 && !isSharedCharacteristic(variants, key))
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
 * Bleu), and locking left the buyer unable to reach whole variants. Picking an
 * incompatible value drops the choices it rules out (see the product screen).
 */
export function optionValueState(
  variants: PublicVariant[],
  selection: VariantSelection,
  key: string,
  value: string
): OptionValueState {
  const stockOf = (v: PublicVariant) => v.stock_quantity ?? v.available_stock ?? v.stock_available ?? 0
  const carrying = variants.filter((v) => (v.attributes ?? {})[key] === value)
  const partial: VariantSelection = {}
  for (const [k, v] of Object.entries(selection)) {
    if (k !== key) partial[k] = v
  }
  const compatible = carrying.filter((v) => matches(v, partial))
  const pool = compatible.length > 0 ? compatible : carrying
  return {
    exists: carrying.length > 0,
    compatible: compatible.length > 0,
    units: pool.reduce((sum, v) => sum + Math.max(0, stockOf(v)), 0),
  }
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

/**
 * The variant closest to the buyer's current choices that carries
 * `key = value`: most other choices kept, in stock first.
 */
export function bestVariantFor(
  variants: PublicVariant[],
  selection: VariantSelection,
  key: string,
  value: string
): PublicVariant | null {
  let best: PublicVariant | null = null
  let bestScore = -1
  for (const v of variants) {
    const attrs = v.attributes ?? {}
    if (attrs[key] !== value) continue
    let score = 0
    for (const [k, chosen] of Object.entries(selection)) {
      if (k !== key && attrs[k] === chosen) score += 2
    }
    if ((v.stock_quantity ?? v.available_stock ?? v.stock_available ?? 0) > 0) score += 1
    if (score > bestScore) {
      best = v
      bestScore = score
    }
  }
  return best
}

/**
 * Selection after the buyer picks `key = value`: earlier choices survive when
 * the closest variant agrees with them, the rest are cleared for the buyer to
 * choose again. Nothing is filled in on the buyer's behalf.
 */
export function selectOptionValue(
  variants: PublicVariant[],
  selection: VariantSelection,
  key: string,
  value: string
): VariantSelection {
  const best = bestVariantFor(variants, selection, key, value)
  const next: VariantSelection = { [key]: value }
  const attrs = best?.attributes ?? {}
  for (const [k, chosen] of Object.entries(selection)) {
    if (k !== key && attrs[k] === chosen) next[k] = chosen
  }
  return next
}
