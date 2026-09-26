/**
 * Maps a free-text colour value (as typed by sellers, FR or EN) to a CSS colour
 * so variant pickers can show a swatch. Unknown names return null and the UI
 * falls back to a text pill — the value itself is never altered.
 *
 * Mirrored in android/src/lib/colorSwatch.ts.
 */
const NAMED: Record<string, string> = {
  noir: '#1c1c1a', black: '#1c1c1a',
  blanc: '#ffffff', white: '#ffffff',
  ecru: '#efe8d8', 'écru': '#efe8d8', ivoire: '#f4efe1', ivory: '#f4efe1', creme: '#f3ead7', 'crème': '#f3ead7', cream: '#f3ead7',
  beige: '#d9c7a7', camel: '#b98a55', sable: '#d6c1a0', sand: '#d6c1a0', taupe: '#8b7d6b',
  marron: '#6b4226', brown: '#6b4226', chocolat: '#4a2c1d', chocolate: '#4a2c1d', cognac: '#9a4f23',
  gris: '#8d8d8a', gray: '#8d8d8a', grey: '#8d8d8a', anthracite: '#3b3d40', charcoal: '#3b3d40', argent: '#c0c0c0', silver: '#c0c0c0',
  rouge: '#b3261e', red: '#b3261e', bordeaux: '#6d1a2a', burgundy: '#6d1a2a', rose: '#e8a0b4', pink: '#e8a0b4', fuchsia: '#c2185b',
  orange: '#e07a1f', corail: '#f07f6a', coral: '#f07f6a', jaune: '#e9c23b', yellow: '#e9c23b', moutarde: '#c79a2a', mustard: '#c79a2a', or: '#c9a449', gold: '#c9a449',
  vert: '#2f7d4a', green: '#2f7d4a', kaki: '#6b6b3a', khaki: '#6b6b3a', olive: '#6b6b3a', menthe: '#9fd8c0', mint: '#9fd8c0', sauge: '#9caf88', sage: '#9caf88',
  bleu: '#2f5aa8', blue: '#2f5aa8', marine: '#1f2a44', navy: '#1f2a44', ciel: '#8cc4ec', sky: '#8cc4ec', turquoise: '#2bb3b1', denim: '#4a6a8f',
  violet: '#6d3fa0', purple: '#6d3fa0', lilas: '#b9a2d6', lilac: '#b9a2d6', mauve: '#a07aa8',
  'doré': '#c9a449', dore: '#c9a449', 'argenté': '#c0c0c0', argente: '#c0c0c0',
}

export function colorSwatch(value: string): string | null {
  const v = value.trim().toLowerCase()
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(v)) return v
  if (NAMED[v]) return NAMED[v]
  // "Bleu marine", "Navy blue": try each word, most specific (last) first.
  const words = v.split(/[\s/-]+/).reverse()
  for (const w of words) if (NAMED[w]) return NAMED[w]
  return null
}

const COLOR_KEYS = /^(colou?r|couleur|coloris|teinte|shade)$/i
const SIZE_KEYS = /^(size|taille|pointure|shoe_size|dimension)$/i

export function isColorAttribute(key: string, label = ''): boolean {
  return COLOR_KEYS.test(key.trim()) || COLOR_KEYS.test(label.trim())
}

export function isSizeAttribute(key: string, label = ''): boolean {
  return SIZE_KEYS.test(key.trim()) || SIZE_KEYS.test(label.trim())
}
