package repository

import "testing"

func TestNullableEmailBlankBecomesNull(t *testing.T) {
	// A phone-only account must store NULL: '' is a value, so the second
	// such account would collide on the unique index (migration 118).
	for _, blank := range []string{"", " ", "\t\n"} {
		if got := nullableEmail(blank); got != nil {
			t.Errorf("nullableEmail(%q) = %v, want nil", blank, got)
		}
	}
	if got := nullableEmail("buyer@example.com"); got != "buyer@example.com" {
		t.Errorf("nullableEmail kept %v, want the address unchanged", got)
	}
}
