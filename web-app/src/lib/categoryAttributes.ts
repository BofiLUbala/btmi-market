export type AttributeDefLike = {
  key: string
  label_en?: string
  label_fr?: string
  required?: boolean
  variant_attribute?: boolean
}

export function attributeAliases(def: AttributeDefLike): string[] {
  return [def.key, def.label_en, def.label_fr]
    .map((value) => (value || '').trim())
    .filter(Boolean)
}

export function matchesAttributeName(name: string, def: AttributeDefLike): boolean {
  const needle = name.trim().toLowerCase()
  if (!needle) return false
  return attributeAliases(def).some((alias) => alias.toLowerCase() === needle)
}

export function getAttributeValue(
  attributes: Record<string, string> | null | undefined,
  def: AttributeDefLike
): string {
  if (!attributes) return ''
  const aliases = new Set(attributeAliases(def).map((alias) => alias.toLowerCase()))
  let canonical = ''
  for (const [key, value] of Object.entries(attributes)) {
    if (!aliases.has(key.trim().toLowerCase())) continue
    const trimmed = String(value ?? '').trim()
    if (!trimmed) continue
    if (key.trim() === def.key) return trimmed
    if (!canonical) canonical = trimmed
  }
  return canonical
}

export function variantHasAttribute(
  attributes: Record<string, string> | null | undefined,
  def: AttributeDefLike
): boolean {
  return getAttributeValue(attributes, def) !== ''
}

/** Rewrite alias keys (Couleur, Pointure, …) onto the definition's canonical key. */
export function canonicalizeAttributes(
  attributes: Record<string, string> | null | undefined,
  defs: AttributeDefLike[]
): Record<string, string> {
  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(attributes || {})) {
    if (key.trim()) next[key] = value
  }

  for (const def of defs) {
    if (!def.key?.trim()) continue
    const aliases = new Set(attributeAliases(def).map((alias) => alias.toLowerCase()))
    let value = ''
    const matchedKeys: string[] = []
    for (const [key, raw] of Object.entries(next)) {
      if (!aliases.has(key.trim().toLowerCase())) continue
      matchedKeys.push(key)
      const trimmed = String(raw ?? '').trim()
      if (!trimmed) continue
      if (key.trim() === def.key || !value) value = trimmed
    }
    for (const key of matchedKeys) delete next[key]
    if (value) next[def.key] = value
  }

  return next
}

export function attributeLabel(def: AttributeDefLike, locale = 'fr'): string {
  if (locale.startsWith('fr')) return def.label_fr || def.label_en || def.key
  return def.label_en || def.label_fr || def.key
}

export function variantDisplayLabel(
  attributes: Record<string, string> | null | undefined,
  defs: AttributeDefLike[],
  fallback: string
): string {
  const parts = defs
    .filter((def) => def.variant_attribute)
    .map((def) => getAttributeValue(attributes, def))
    .filter(Boolean)
  return parts.length > 0 ? parts.join(' / ') : fallback
}
