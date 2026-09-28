// Same rules as search.Normalize() in backend/internal/search/normalize.go and
// btmi_normalize_search() in PostgreSQL, so the client highlights exactly what
// the server matched.
const LIGATURES: Record<string, string> = { œ: 'oe', Œ: 'oe', æ: 'ae', Æ: 'ae', ß: 'ss' }

/** Folds one character: accents removed, lower case, ligatures expanded. */
function foldChar(ch: string) {
  return (LIGATURES[ch] ?? ch).normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase()
}

export function normalizeSearch(value: string) {
  return Array.from(value)
    .map(foldChar)
    .join('')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export type HighlightPart = { text: string; match: boolean }

/**
 * Splits `label` into parts, marking every place where a word of `query`
 * appears, ignoring case and accents: "Téléphone" is highlighted for "telep".
 * Offsets map back to the original string, so the label keeps its accents.
 */
export function highlightParts(label: string, query: string): HighlightPart[] {
  const words = normalizeSearch(query).split(' ').filter((w) => w.length >= 2)
  if (!label || words.length === 0) return [{ text: label, match: false }]

  // Folded text plus, for each folded character, the index of the original
  // character it came from.
  const chars = Array.from(label)
  let folded = ''
  const origin: number[] = []
  chars.forEach((ch, i) => {
    const f = foldChar(ch)
    for (let k = 0; k < f.length; k++) origin.push(i)
    folded += f
  })

  const marked = new Array<boolean>(chars.length).fill(false)
  for (const word of words) {
    let from = folded.indexOf(word)
    while (from !== -1) {
      for (let k = from; k < from + word.length; k++) marked[origin[k]] = true
      from = folded.indexOf(word, from + word.length)
    }
  }

  const parts: HighlightPart[] = []
  chars.forEach((ch, i) => {
    const last = parts[parts.length - 1]
    if (last && last.match === marked[i]) last.text += ch
    else parts.push({ text: ch, match: marked[i] })
  })
  return parts
}
