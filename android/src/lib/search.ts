import { idempotencyKey } from './idempotency'

// Same rules as search.Normalize() in backend/internal/search/normalize.go and
// web-app/src/lib/searchNormalization.ts.
const LIGATURES: Record<string, string> = { œ: 'oe', Œ: 'oe', æ: 'ae', Æ: 'ae', ß: 'ss' }

export function normalizeSearch(value: string) {
  return Array.from(value)
    .map((ch) => (LIGATURES[ch] ?? ch).normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase())
    .join('')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

// Anonymous id for this app session only (never stored, never linked to the
// account); it lets the back office spot quickly reformulated queries.
let session: string | undefined
export function searchSession() {
  session ??= idempotencyKey()
  return session
}
