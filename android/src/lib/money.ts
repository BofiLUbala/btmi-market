/**
 * One money formatter for the whole app, so Android and iOS render a price the
 * same way and no screen has to remember which currency it is looking at.
 *
 * USD is the platform's selling currency and renders as $25.00 - always two
 * decimals, because a price that drops its cents reads as a different price.
 * Legacy CDF amounts keep the grouped suffix form they were always shown in.
 */
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

/** Label for a price input, e.g. "Prix (USD)". */
export function currencyLabel(currency: string = DEFAULT_CURRENCY): string {
  return (currency || DEFAULT_CURRENCY).toUpperCase() === 'CDF' ? 'FC' : 'USD'
}
