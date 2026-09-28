// Bulk variant creation: the seller picks several values per variant attribute
// (e.g. Pointure 36 + 42, Couleur Noir + Bleu + Vert) and gets one variant per
// combination. Same approach as cartesian() in android/app/seller/products/create.tsx.

/** Upper bound so one click cannot create an unmanageable number of variants. */
export const MAX_GENERATED_VARIANTS = 100

export interface VariantAxis {
  key: string
  values: string[]
}

/** Every combination of the axes' values; axes without values are ignored. */
export function combineVariantValues(axes: VariantAxis[]): Array<Record<string, string>> {
  const used = axes
    .map((axis) => ({ key: axis.key, values: Array.from(new Set(axis.values.map((v) => v.trim()).filter(Boolean))) }))
    .filter((axis) => axis.values.length > 0)
  if (used.length === 0) return []
  return used.reduce<Array<Record<string, string>>>(
    (acc, axis) => acc.flatMap((combo) => axis.values.map((value) => ({ ...combo, [axis.key]: value }))),
    [{}]
  )
}

/** Case-insensitive identity of a combination over the given keys. */
export function combinationSignature(attributes: Record<string, string>, keys: string[]) {
  return keys.map((key) => (attributes[key] ?? '').trim().toLowerCase()).join('\u001f')
}

/**
 * Combinations not already present among the existing variants, so generating
 * twice (or after adding some variants by hand) never creates duplicates.
 */
export function newCombinations(
  combos: Array<Record<string, string>>,
  existing: Array<Record<string, string>>,
  keys: string[]
): Array<Record<string, string>> {
  const seen = new Set(existing.map((attrs) => combinationSignature(attrs, keys)))
  const out: Array<Record<string, string>> = []
  for (const combo of combos) {
    const signature = combinationSignature(combo, keys)
    if (seen.has(signature)) continue
    seen.add(signature)
    out.push(combo)
  }
  return out
}
