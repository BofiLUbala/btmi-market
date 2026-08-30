package models

import (
	"testing"
	"time"
)

func ptr(t time.Time) *time.Time { return &t }

func TestPromotionPhases(t *testing.T) {
	now := time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)
	yesterday := now.Add(-24 * time.Hour)
	tomorrow := now.Add(24 * time.Hour)
	lastWeek := now.Add(-7 * 24 * time.Hour)

	cases := []struct {
		name         string
		promo        Promotion
		wantLive     bool
		wantUpcoming bool
	}{
		{
			name:         "future promotion is upcoming, not live",
			promo:        Promotion{Active: true, Type: "PERCENTAGE", Value: 20, Start: ptr(tomorrow)},
			wantLive:     false,
			wantUpcoming: true,
		},
		{
			name:     "promotion inside its window is live",
			promo:    Promotion{Active: true, Type: "PERCENTAGE", Value: 20, Start: ptr(yesterday), End: ptr(tomorrow)},
			wantLive: true,
		},
		{
			name:     "expired promotion is neither live nor upcoming",
			promo:    Promotion{Active: true, Type: "PERCENTAGE", Value: 20, Start: ptr(lastWeek), End: ptr(yesterday)},
			wantLive: false,
		},
		{
			name:     "open-ended promotion with no dates is live",
			promo:    Promotion{Active: true, Type: "PERCENTAGE", Value: 20},
			wantLive: true,
		},
		{
			name:     "promotion with no end never expires",
			promo:    Promotion{Active: true, Type: "PERCENTAGE", Value: 20, Start: ptr(lastWeek)},
			wantLive: true,
		},
		{
			name:     "inactive promotion is never live even inside its window",
			promo:    Promotion{Active: false, Type: "PERCENTAGE", Value: 20, Start: ptr(yesterday), End: ptr(tomorrow)},
			wantLive: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.promo.IsLive(now); got != tc.wantLive {
				t.Errorf("IsLive() = %v, want %v", got, tc.wantLive)
			}
			if got := tc.promo.IsUpcoming(now); got != tc.wantUpcoming {
				t.Errorf("IsUpcoming() = %v, want %v", got, tc.wantUpcoming)
			}
		})
	}
}

func TestPromotionEffectivePrice(t *testing.T) {
	now := time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)
	yesterday := now.Add(-24 * time.Hour)
	tomorrow := now.Add(24 * time.Hour)

	cases := []struct {
		name  string
		promo Promotion
		base  float64
		want  float64
	}{
		{
			name:  "percentage discount applies while live",
			promo: Promotion{Active: true, Type: "PERCENTAGE", Value: 25, Start: ptr(yesterday), End: ptr(tomorrow)},
			base:  10000,
			want:  7500,
		},
		{
			name:  "fixed discount applies while live",
			promo: Promotion{Active: true, Type: "FIXED", Value: 2500, Start: ptr(yesterday), End: ptr(tomorrow)},
			base:  10000,
			want:  7500,
		},
		{
			name:  "future promotion keeps the regular price",
			promo: Promotion{Active: true, Type: "PERCENTAGE", Value: 25, Start: ptr(tomorrow)},
			base:  10000,
			want:  10000,
		},
		{
			name:  "expired promotion reverts to the regular price",
			promo: Promotion{Active: true, Type: "PERCENTAGE", Value: 25, End: ptr(yesterday)},
			base:  10000,
			want:  10000,
		},
		{
			name:  "fixed discount larger than the price clamps at zero, never negative",
			promo: Promotion{Active: true, Type: "FIXED", Value: 15000},
			base:  10000,
			want:  0,
		},
		{
			name:  "unknown discount type leaves the price untouched",
			promo: Promotion{Active: true, Type: "MYSTERY", Value: 90},
			base:  10000,
			want:  10000,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.promo.EffectivePrice(tc.base, now); got != tc.want {
				t.Errorf("EffectivePrice(%v) = %v, want %v", tc.base, got, tc.want)
			}
		})
	}
}

// The marketplace listing and the order service must never disagree: the price
// shown on a card is the price charged at checkout. Both now call the same
// method, and this pins that they stay in step for every phase.
func TestPromotionPriceIsConsistentAcrossSurfaces(t *testing.T) {
	base := 8000.0
	phases := map[string]Promotion{
		"upcoming": {Active: true, Type: "PERCENTAGE", Value: 30, Start: ptr(time.Now().Add(48 * time.Hour))},
		"active":   {Active: true, Type: "PERCENTAGE", Value: 30, Start: ptr(time.Now().Add(-time.Hour))},
		"expired":  {Active: true, Type: "PERCENTAGE", Value: 30, End: ptr(time.Now().Add(-time.Hour))},
	}

	for name, promo := range phases {
		t.Run(name, func(t *testing.T) {
			at := time.Now()
			listing := promo.EffectivePrice(base, at)  // marketplace repository
			checkout := promo.EffectivePrice(base, at) // order / point-redemption service
			if listing != checkout {
				t.Fatalf("listing price %v != checkout price %v", listing, checkout)
			}
			if name == "active" && listing != 5600 {
				t.Errorf("active promotion price = %v, want 5600", listing)
			}
			if name != "active" && listing != base {
				t.Errorf("%s promotion price = %v, want the regular %v", name, listing, base)
			}
		})
	}
}
