/**
 * One money formatter for the whole app, so Android and iOS render a price the
 * same way and no screen has to remember which currency it is looking at.
 *
 * USD is the platform's selling currency and renders as $25.00 - always two
 * decimals, because a price that drops its cents reads as a different price.
 * Legacy CDF amounts keep the grouped suffix form they were always shown in.
 */
export const DEFAULT_CURRENCY = 'USD'

export function formatMoney(amount: number | null | undefined, currency: string = DEFAULT_CURRENCY): string {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase()
  const safe = amount === null || amount === undefined || Number.isNaN(Number(amount)) ? 0 : Number(amount)
  const rounded = Math.round(safe * 100) / 100

  if (code === 'USD') {
    const negative = rounded < 0
    const [int, frac] = Math.abs(rounded).toFixed(2).split('.')
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return `${negative ? '-' : ''}$${grouped}.${frac}`
  }

  const label = code === 'CDF' ? 'FC' : code
  const isWhole = rounded % 1 === 0
  const digits = isWhole ? rounded.toFixed(0) : rounded.toFixed(2)
  const [int, frac] = digits.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return frac ? `${grouped}.${frac} ${label}` : `${grouped} ${label}`
}

/** Label for a price input, e.g. "Prix (USD)". */
export function currencyLabel(currency: string = DEFAULT_CURRENCY): string {
  return (currency || DEFAULT_CURRENCY).toUpperCase() === 'CDF' ? 'FC' : 'USD'
}
