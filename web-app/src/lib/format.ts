import type { Dictionary } from '@/store/i18n'

/** Signature-compatible with the store's `t`, so the hook can be passed in. */
export type Translator = (key: keyof Dictionary, vars?: Record<string, string | number>) => string

export function formatMoney(amount: number, currency = 'FC'): string {
  if (amount === null || amount === undefined || isNaN(amount)) return `0 ${currency}`
  const rounded = Math.round(amount * 100) / 100
  const isWhole = rounded % 1 === 0
  const digits = isWhole ? rounded.toFixed(0) : rounded.toFixed(2)
  const [int, frac] = digits.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')
  return frac ? `${grouped}.${frac}\u00A0${currency}` : `${grouped}\u00A0${currency}`
}

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
    minute: '2-digit'
  })
}

export function timeAgo(iso?: string | null, t?: Translator): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t ? t('time.justNow') : 'just now'
  if (mins < 60) return t ? t('time.minutesAgo', { count: mins }) : `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t ? t('time.hoursAgo', { count: hrs }) : `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return t ? t('time.daysAgo', { count: days }) : `${days}d ago`
  return formatDate(iso)
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function asArray<T>(v: T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : []
}