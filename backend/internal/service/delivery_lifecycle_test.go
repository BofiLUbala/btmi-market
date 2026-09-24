package service

import (
	"testing"
	"time"
)

func TestValidateExpectedDelivery(t *testing.T) {
	// 23:30 UTC on the 24th is already the 25th in Kinshasa (UTC+1).
	now := time.Date(2026, 9, 24, 23, 30, 0, 0, time.UTC)
	cases := []struct {
		date, slot string
		ok         bool
	}{
		{"2026-09-25", "MORNING", true},
		{"2026-10-09", "EVENING", true},
		{"2026-09-24", "MORNING", false},
		{"2026-10-10", "AFTERNOON", false},
		{"2026-09-26", "NIGHT", false},
		{"26/09/2026", "MORNING", false},
	}
	for _, c := range cases {
		_, err := validateExpectedDelivery(c.date, c.slot, now)
		if (err == nil) != c.ok {
			t.Errorf("validateExpectedDelivery(%q, %q) error = %v, want ok=%v", c.date, c.slot, err, c.ok)
		}
	}
}
