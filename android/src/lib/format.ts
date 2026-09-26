/** Same date formatters as web-app/src/lib/format.ts, so both apps print the
 *  same "12 Sept 2026" / "12 Sept 2026, 14:05" strings. */
export function formatDate(iso?: string | null, locale = 'en-GB'): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso?: string | null, locale = 'en-GB'): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
