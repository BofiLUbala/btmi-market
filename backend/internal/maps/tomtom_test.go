package maps

import "testing"

func TestRouteLanguage(t *testing.T) {
	for in, want := range map[string]string{
		"": "fr-FR", "fr": "fr-FR", "FR-fr": "fr-FR", "de": "fr-FR",
		"en": "en-GB", "EN": "en-GB", " en-US ": "en-GB",
	} {
		if got := RouteLanguage(in); got != want {
			t.Errorf("RouteLanguage(%q) = %q, want %q", in, got, want)
		}
	}
}
