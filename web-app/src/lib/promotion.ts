/**
 * Promotion pricing, shared by the product card, the product page and the
 * cart so all three agree on what a product costs right now.
 *
 * Mirrors models.Promotion in backend/internal/models/pricing.go. The backend
 * is the source of truth for the amount actually charged; this module exists so
 * the UI can decide what to *display* (struck-through price, "coming soon"
 * badge, promotion window) without each screen re-deriving the rule.
 */

export type PromotionPhase = 'none' | 'upcoming' | 'active' | 'expired'

export interface PromotionInput {
  discount_active?: boolean
  discount_type?: string
  discount_value?: number
  discount_start?: string | null
  discount_end?: string | null
  seller_sale_price?: number
}

export interface PromotionState {
  phase: PromotionPhase
  /** Price before any promotion. Never 0 unless the product genuinely is. */
  originalPrice: number
  /** Price to charge/display right now — equals originalPrice unless active. */
  effectivePrice: number
  /** Whole-percent saving, 0 when there is none. */
  discountPercent: number
  /** Absolute saving in currency units, 0 when there is none. */
  discountAmount: number
  startsAt: Date | null
  endsAt: Date | null
}

/**
 * Parses an API timestamp. Returns null for null/undefined/empty and for
 * unparseable values, so a malformed date is treated as "no bound" rather than
 * silently making the window NaN (which would compare false everywhere and
 * quietly disable the promotion).
 */
function parseDate(value?: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Picks the first strictly positive number.
 *
 * `??` alone is not enough: the API sends 0 for a computed price it did not
 * fill in, and 0 is a valid number that would render as "0 FC".
 */
function firstPositive(...values: Array<number | undefined | null>): number {
  return values.find((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0) ?? 0
}

/**
 * Resolves the promotion state for a product.
 *
 * `basePrice` is the regular price (variant base price, falling back to the
 * product's). `at` defaults to now and is injectable for tests.
 *
 * Dates arrive as RFC3339/ISO strings with an offset, so `new Date()` yields
 * the correct instant regardless of the viewer's timezone; comparisons are
 * done on epoch milliseconds, never on local calendar fields.
 */
export function resolvePromotion(
  product: PromotionInput,
  basePrice: number,
  at: Date = new Date()
): PromotionState {
  const originalPrice = firstPositive(basePrice)
  const startsAt = parseDate(product.discount_start)
  const endsAt = parseDate(product.discount_end)
  const now = at.getTime()

  const configured = Boolean(product.discount_active)
  // A null start means "already started"; a null end means "never ends".
  const started = !startsAt || startsAt.getTime() <= now
  const ended = Boolean(endsAt && endsAt.getTime() <= now)

  let phase: PromotionPhase = 'none'
  if (configured) {
    if (!started) phase = 'upcoming'
    else if (ended) phase = 'expired'
    else phase = 'active'
  }

  if (phase !== 'active' || originalPrice <= 0) {
    return {
      phase,
      originalPrice,
      effectivePrice: originalPrice,
      discountPercent: 0,
      discountAmount: 0,
      startsAt,
      endsAt,
    }
  }

  // Prefer the server's computed price when it actually sent one. A missing
  // field arrives as 0/undefined, which must not be mistaken for "free" — but
  // a discount that legitimately computes to 0 is kept, because that is what
  // the backend (models.Promotion.EffectivePrice) will charge.
  const value = product.discount_value ?? 0
  let effectivePrice: number
  if (typeof product.seller_sale_price === 'number' && product.seller_sale_price > 0) {
    effectivePrice = product.seller_sale_price
  } else if (product.discount_type === 'PERCENTAGE') {
    effectivePrice = Math.max(0, originalPrice * (1 - value / 100))
  } else if (product.discount_type === 'FIXED') {
    effectivePrice = Math.max(0, originalPrice - value)
  } else {
    // Unknown or absent discount type: leave the price untouched rather than
    // inventing one.
    effectivePrice = originalPrice
  }

  // A "promotion" that does not lower the price is not shown as one.
  if (effectivePrice >= originalPrice) {
    return {
      phase,
      originalPrice,
      effectivePrice: originalPrice,
      discountPercent: 0,
      discountAmount: 0,
      startsAt,
      endsAt,
    }
  }

  return {
    phase,
    originalPrice,
    effectivePrice,
    discountPercent: Math.round(((originalPrice - effectivePrice) / originalPrice) * 100),
    discountAmount: originalPrice - effectivePrice,
    startsAt,
    endsAt,
  }
}
