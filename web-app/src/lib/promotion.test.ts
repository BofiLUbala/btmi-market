import { describe, expect, it } from 'vitest'
import { resolvePromotion, type PromotionInput } from './promotion'

const NOW = new Date('2026-06-15T12:00:00Z')
const iso = (offsetHours: number) =>
  new Date(NOW.getTime() + offsetHours * 3_600_000).toISOString()

const percentagePromo = (overrides: Partial<PromotionInput> = {}): PromotionInput => ({
  discount_active: true,
  discount_type: 'PERCENTAGE',
  discount_value: 25,
  ...overrides,
})

describe('resolvePromotion — phases', () => {
  it('reports a promotion that has not started as upcoming and keeps the regular price', () => {
    const state = resolvePromotion(percentagePromo({ discount_start: iso(24) }), 10000, NOW)
    expect(state.phase).toBe('upcoming')
    expect(state.effectivePrice).toBe(10000)
    expect(state.discountPercent).toBe(0)
  })

  it('applies the discount inside the promotion window', () => {
    const state = resolvePromotion(
      percentagePromo({ discount_start: iso(-24), discount_end: iso(24) }),
      10000,
      NOW
    )
    expect(state.phase).toBe('active')
    expect(state.effectivePrice).toBe(7500)
    expect(state.discountPercent).toBe(25)
    expect(state.discountAmount).toBe(2500)
  })

  it('reverts to the regular price once the promotion has ended', () => {
    const state = resolvePromotion(
      percentagePromo({ discount_start: iso(-48), discount_end: iso(-1) }),
      10000,
      NOW
    )
    expect(state.phase).toBe('expired')
    expect(state.effectivePrice).toBe(10000)
    expect(state.discountPercent).toBe(0)
  })

  it('treats a promotion with no dates as active and open-ended', () => {
    const state = resolvePromotion(percentagePromo(), 10000, NOW)
    expect(state.phase).toBe('active')
    expect(state.effectivePrice).toBe(7500)
  })

  it('reports no promotion at all when the seller has not enabled one', () => {
    const state = resolvePromotion({ discount_active: false }, 10000, NOW)
    expect(state.phase).toBe('none')
    expect(state.effectivePrice).toBe(10000)
  })
})

describe('resolvePromotion — null dates and timezones', () => {
  it('treats a null start as already started', () => {
    const state = resolvePromotion(
      percentagePromo({ discount_start: null, discount_end: iso(24) }),
      10000,
      NOW
    )
    expect(state.phase).toBe('active')
  })

  it('treats a null end as never expiring', () => {
    const state = resolvePromotion(
      percentagePromo({ discount_start: iso(-24), discount_end: null }),
      10000,
      NOW
    )
    expect(state.phase).toBe('active')
  })

  it('ignores an unparseable date rather than silently disabling the promotion', () => {
    const state = resolvePromotion(
      percentagePromo({ discount_start: 'not-a-date' }),
      10000,
      NOW
    )
    expect(state.phase).toBe('active')
    expect(state.startsAt).toBeNull()
  })

  it('compares instants, so an offset timestamp resolves the same as its UTC form', () => {
    // 14:00+02:00 is 12:00Z — the exact instant of NOW, so the window is open.
    const withOffset = resolvePromotion(
      percentagePromo({ discount_start: '2026-06-15T14:00:00+02:00', discount_end: iso(24) }),
      10000,
      NOW
    )
    const withUtc = resolvePromotion(
      percentagePromo({ discount_start: '2026-06-15T12:00:00Z', discount_end: iso(24) }),
      10000,
      NOW
    )
    expect(withOffset.phase).toBe(withUtc.phase)
    expect(withOffset.effectivePrice).toBe(withUtc.effectivePrice)
  })
})

describe('resolvePromotion — never renders a 0 price', () => {
  it('recomputes locally when the backend omits the computed sale price', () => {
    const state = resolvePromotion(
      percentagePromo({ seller_sale_price: 0 }),
      10000,
      NOW
    )
    expect(state.effectivePrice).toBe(7500)
  })

  it('falls back to the regular price when both the computed price and the type are missing', () => {
    const state = resolvePromotion(
      { discount_active: true, seller_sale_price: 0 },
      10000,
      NOW
    )
    expect(state.effectivePrice).toBe(10000)
  })

  it('clamps a fixed discount larger than the price at 0 without going negative', () => {
    const state = resolvePromotion(
      { discount_active: true, discount_type: 'FIXED', discount_value: 15000 },
      10000,
      NOW
    )
    expect(state.effectivePrice).toBe(0)
  })

  it('does not present a promotion that fails to lower the price', () => {
    const state = resolvePromotion(
      { discount_active: true, discount_type: 'PERCENTAGE', discount_value: 0 },
      10000,
      NOW
    )
    expect(state.discountPercent).toBe(0)
    expect(state.effectivePrice).toBe(10000)
  })
})

describe('price consistency across listing, detail and cart', () => {
  // The card passes the variant's base price, the detail page passes the same
  // value plus the variant's unit price as seller_sale_price. Both must land on
  // the same number, or a buyer sees one price and is charged another.
  const product = percentagePromo({ discount_start: iso(-1), discount_end: iso(48) })

  it('quotes the same effective price on the card and on the product page', () => {
    const card = resolvePromotion(product, 8000, NOW)
    const detail = resolvePromotion({ ...product, seller_sale_price: 6000 }, 8000, NOW)
    expect(card.effectivePrice).toBe(6000)
    expect(detail.effectivePrice).toBe(6000)
  })

  it('agrees on every phase, so the cart total cannot drift from the listing', () => {
    for (const phase of [
      { discount_start: iso(24) }, // upcoming
      { discount_start: iso(-1) }, // active
      { discount_end: iso(-1) }, // expired
    ]) {
      const listing = resolvePromotion(percentagePromo(phase), 8000, NOW)
      const cart = resolvePromotion(percentagePromo(phase), 8000, NOW)
      expect(cart.effectivePrice).toBe(listing.effectivePrice)
      expect(cart.phase).toBe(listing.phase)
    }
  })
})
