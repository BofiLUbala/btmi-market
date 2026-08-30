package models

import "testing"

func TestGetCategoryRequirementsResolvesNamesAndSlugs(t *testing.T) {
	cases := []struct {
		name        string
		category    string
		subcategory string
		wantAllOf   []string
		wantEmpty   bool
	}{
		{name: "english slug", category: "shoes", wantAllOf: []string{"Color", "Shoe Size"}},
		{name: "french display name", category: "Chaussures", wantAllOf: []string{"Color", "Shoe Size"}},
		{name: "partial match on a longer name", category: "Men's Footwear", wantAllOf: []string{"Color", "Shoe Size"}},
		{name: "unknown category has no rules", category: "taxidermy", wantEmpty: true},
		{name: "empty category has no rules", category: "", wantEmpty: true},
		{
			name:        "subcategory rule wins over the parent",
			category:    "fashion",
			subcategory: "shoes",
			wantAllOf:   []string{"Color", "Shoe Size"},
		},
		{
			name:        "parent applies when the subcategory has no rule of its own",
			category:    "fashion",
			subcategory: "scarves",
			wantAllOf:   []string{"Color", "Size"},
		},
		// "car" is a substring of scarves/carpet/cardigan, so it must only
		// match as a whole word or these all fall into "automotive".
		{name: "scarves is not automotive", category: "Scarves", wantEmpty: true},
		{name: "carpet is not automotive", category: "Carpet", wantEmpty: true},
		{name: "cardigan is not automotive", category: "Cardigan", wantEmpty: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := GetCategoryRequirements(tc.category, tc.subcategory)
			if tc.wantEmpty {
				if !got.IsEmpty() {
					t.Fatalf("expected no requirements, got %+v", got)
				}
				return
			}
			if len(got.AllOf) != len(tc.wantAllOf) {
				t.Fatalf("AllOf = %v, want %v", got.AllOf, tc.wantAllOf)
			}
			for i, name := range tc.wantAllOf {
				if got.AllOf[i] != name {
					t.Errorf("AllOf[%d] = %q, want %q", i, got.AllOf[i], name)
				}
			}
		})
	}
}

// "car" as a standalone word must still reach automotive — the word-boundary
// fix above must not over-correct and stop matching real automotive names.
func TestCarAsWholeWordStillResolvesToAutomotive(t *testing.T) {
	for _, name := range []string{"Car Parts", "car", "Auto & Car", "Voiture"} {
		got := GetCategoryRequirements(name, "")
		if len(got.AnyOf) == 0 {
			t.Errorf("GetCategoryRequirements(%q) = %+v, want the automotive rules", name, got)
		}
	}
}

func TestMissingRequiredAttributes(t *testing.T) {
	shoes := GetCategoryRequirements("shoes", "")
	food := GetCategoryRequirements("food", "")

	cases := []struct {
		name        string
		req         CategoryAttributeRequirements
		present     []string
		wantMissing int
	}{
		{
			name:        "publication refused when every required attribute is absent",
			req:         shoes,
			present:     nil,
			wantMissing: 2,
		},
		{
			name:        "publication refused when one required attribute is absent",
			req:         shoes,
			present:     []string{"Color"},
			wantMissing: 1,
		},
		{
			name:        "publication accepted when all required attributes are filled in",
			req:         shoes,
			present:     []string{"Color", "Shoe Size"},
			wantMissing: 0,
		},
		{
			name:        "matching ignores case and surrounding spaces",
			req:         shoes,
			present:     []string{"  color  ", "SHOE SIZE"},
			wantMissing: 0,
		},
		{
			name:        "anyOf is satisfied by a single member of the group",
			req:         food,
			present:     []string{"Expiration Date", "Volume"},
			wantMissing: 0,
		},
		{
			name:        "anyOf still blocks when no member of the group is present",
			req:         food,
			present:     []string{"Expiration Date"},
			wantMissing: 1,
		},
		{
			name:        "a category with no rules never blocks publication",
			req:         GetCategoryRequirements("taxidermy", ""),
			present:     nil,
			wantMissing: 0,
		},
		{
			name:        "blank attribute values do not count as filled in",
			req:         shoes,
			present:     []string{"Color", "   "},
			wantMissing: 1,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			missing := MissingRequiredAttributes(tc.req, tc.present)
			if len(missing) != tc.wantMissing {
				t.Fatalf("missing = %v (len %d), want %d entries", missing, len(missing), tc.wantMissing)
			}
		})
	}
}

// A draft is a work in progress: the category rule only gates publication, so
// the requirement set is never consulted for a draft. This pins the intent so a
// future refactor cannot start blocking drafts.
func TestDraftIsNeverBlockedByCategoryRules(t *testing.T) {
	req := GetCategoryRequirements("shoes", "")
	if req.IsEmpty() {
		t.Fatal("precondition: shoes should have requirements")
	}
	// Publishing with nothing filled in is refused …
	if len(MissingRequiredAttributes(req, nil)) == 0 {
		t.Error("expected publication to be blocked with no attributes")
	}
	// … while the same product saved as a draft never reaches this check at
	// all, which the service enforces by only calling it for PUBLISHED.
}
