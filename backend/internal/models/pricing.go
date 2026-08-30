package models

import "time"

// Promotion carries the discount window of a product. It exists so the single
// pricing rule below can be shared by the marketplace repository, the order
// service and the point-redemption service: those three used to each carry
// their own copy of the same condition, and any divergence would show the
// buyer one price on the listing and charge them another at checkout.
type Promotion struct {
	Active bool
	Type   string // "PERCENTAGE" or "FIXED"
	Value  float64
	Start  *time.Time
	End    *time.Time
}

// IsLive reports whether the promotion applies at instant `at`.
//
// A nil Start means "already started" and a nil End means "never ends", so an
// open-ended promotion is still honoured. Comparisons use the instants as
// given: timestamps come back from PostgreSQL as UTC (timestamptz), and `at`
// is expected to be time.Now(), so the two are directly comparable regardless
// of the server's local zone.
func (p Promotion) IsLive(at time.Time) bool {
	if !p.Active {
		return false
	}
	if p.Start != nil && at.Before(*p.Start) {
		return false
	}
	if p.End != nil && !at.Before(*p.End) {
		return false
	}
	return true
}

// IsUpcoming reports whether the promotion is configured and still ahead of
// `at`. The marketplace uses this to show "promotion coming soon" while
// keeping the regular price.
func (p Promotion) IsUpcoming(at time.Time) bool {
	return p.Active && p.Start != nil && at.Before(*p.Start)
}

// EffectivePrice applies the promotion to base, or returns base unchanged when
// the promotion is not live. The result is clamped at 0 so a FIXED discount
// larger than the price can never produce a negative amount.
func (p Promotion) EffectivePrice(base float64, at time.Time) float64 {
	if !p.IsLive(at) {
		return base
	}
	var price float64
	switch p.Type {
	case "PERCENTAGE":
		price = base * (1.0 - p.Value/100.0)
	case "FIXED":
		price = base - p.Value
	default:
		// An unknown discount type must not silently zero the price.
		return base
	}
	if price < 0 {
		return 0
	}
	return price
}
