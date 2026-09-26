import type { Dictionary } from '@/store/i18n'

/** Signature-compatible with the store's `t`, so the hook can be passed in. */
export type Translator = (key: keyof Dictionary, vars?: Record<string, string | number>) => string

/**
 * USD is the platform's selling currency, so it is the default and renders as
 * $25.00 - always two decimals, because a price that drops its cents reads as
 * a different price. Legacy CDF amounts keep the grouped suffix form they were
 * always shown in.
 */
/** The platform's selling currency: every new product, cart and order is in it. */
export const DEFAULT_CURRENCY = 'USD'

/** The language money is written in, kept in step with the i18n provider so
 *  every formatMoney call follows the language the user picked:
 *  fr → 8 520,00 $   ·   en → $8,520.00 */
let moneyLanguage: 'fr' | 'en' = 'fr'
export function setMoneyLanguage(lang: 'fr' | 'en') {
  moneyLanguage = lang
}
export function getMoneyLanguage(): 'fr' | 'en' {
  return moneyLanguage
}

// No-break spaces keep "8 520,00 $" on one line.
const NBSP = '\u00A0'

export function formatMoney(amount: number | null | undefined, currency: string = DEFAULT_CURRENCY, lang: 'fr' | 'en' = moneyLanguage): string {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase()
  const safe = amount === null || amount === undefined || Number.isNaN(Number(amount)) ? 0 : Number(amount)
  const rounded = Math.round(safe * 100) / 100
  const negative = rounded < 0
  const french = lang === 'fr'
  // USD always shows its cents; legacy CDF drops them when the amount is whole.
  const digits = code === 'USD' || rounded % 1 !== 0 ? Math.abs(rounded).toFixed(2) : Math.abs(rounded).toFixed(0)
  const [int, frac] = digits.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, french ? NBSP : ',')
  const number = frac ? `${grouped}${french ? ',' : '.'}${frac}` : grouped
  const sign = negative ? '-' : ''

  if (code === 'USD') return french ? `${sign}${number}${NBSP}$` : `${sign}$${number}`
  const label = code === 'CDF' ? 'FC' : code
  return `${sign}${number}${NBSP}${label}`
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