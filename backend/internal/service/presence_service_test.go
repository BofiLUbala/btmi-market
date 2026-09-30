package service

import "testing"

// Query strings and fragments can carry activation or reset tokens: they must
// never reach the monitoring view.
func TestPresencePathDropsQueryAndFragment(t *testing.T) {
	cases := map[string]string{
		"/activate?token=secret-123":    "/activate",
		"/reset-password?t=abc#x":       "/reset-password",
		"/products/42#reviews":          "/products/42",
		"":                              "/",
		"javascript:alert(1)":           "/",
		"/" + string(make([]byte, 300)): "/" + string(make([]byte, 199)),
	}
	for in, want := range cases {
		if got := cleanPath(in); got != want {
			t.Errorf("cleanPath(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestPresencePageGroups(t *testing.T) {
	cases := map[string]string{
		"/": "home", "/products/1": "product", "/shops/9": "shop", "/search": "browse",
		"/categories/tv": "browse", "/checkout/payment": "checkout", "/orders/1": "account",
		"/seller/stock": "seller", "/livreur": "courier", "/login": "auth", "/politique": "other",
	}
	for in, want := range cases {
		if got := pageGroup(in); got != want {
			t.Errorf("pageGroup(%q) = %q, want %q", in, got, want)
		}
	}
}
