package search

import (
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestNormalize(t *testing.T) {
	tests := map[string]string{
		"Téléphone":               "telephone",
		"  SAMSUNG   A15 ":        "samsung a15",
		"TV/PC (promo!)":          "tv pc promo",
		"ÉLÈVE":                   "eleve",
		"Œuf & cœur":              "oeuf coeur",
		"l'ordinateur":            "l ordinateur",
		"%_' OR 1=1; --":          "or 1 1",
		"   ":                     "",
		"iPhone 15 Pro-Max 256Go": "iphone 15 pro max 256go",
	}
	for input, want := range tests {
		if got := Normalize(input); got != want {
			t.Errorf("Normalize(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestTruncateUnicode(t *testing.T) {
	input := strings.Repeat("é", MaxQueryRunes+5)
	if got := len([]rune(Truncate(input))); got != MaxQueryRunes {
		t.Fatalf("got %d runes", got)
	}
}

func TestFrenchStem(t *testing.T) {
	a := AnalyzerFor("fr")
	tests := map[string]string{
		"chaussures": "chaussure",
		"phones":     "phone",
		"bateaux":    "bateau",
		"journaux":   "journal",
		"jeux":       "jeu",
		"tapis":      "tapis",
		"bus":        "bus",
		"a15s":       "a15s", // model names keep their digits intact
		"tvs":        "tvs",  // too short to fold safely
		"chaussure":  "chaussure",
	}
	for in, want := range tests {
		if got := a.Stem(in); got != want {
			t.Errorf("Stem(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestUnknownLanguageFallsBackToFrench(t *testing.T) {
	if AnalyzerFor("ln").Stem("chaussures") != "chaussure" {
		t.Fatal("expected French fallback")
	}
}

func testSynonyms() *SynonymSet {
	return NewSynonymSet([]SynonymEntry{
		{"telephone", "telephone"}, {"smartphone", "telephone"}, {"portable", "telephone"},
		{"chaussure", "chaussure"}, {"basket", "chaussure"}, {"sneaker", "chaussure"},
		{"tv", "television"}, {"televiseur", "television"}, // canonical not listed as a term
	})
}

func TestParseTermsStemsAndSynonyms(t *testing.T) {
	q := Parse("  Chaussures de SPORT ", "fr", testSynonyms())
	if q.Normalized != "chaussures de sport" {
		t.Fatalf("normalized = %q", q.Normalized)
	}
	if len(q.Terms) != 2 {
		t.Fatalf("stop word should be dropped, got %+v", q.Terms)
	}
	if !reflect.DeepEqual(q.Terms[0].Exact, []string{"chaussures", "chaussure"}) {
		t.Errorf("exact = %v", q.Terms[0].Exact)
	}
	if !reflect.DeepEqual(q.Terms[0].Synonyms, []string{"basket", "sneaker"}) {
		t.Errorf("synonyms = %v", q.Terms[0].Synonyms)
	}
	if q.Terms[1].Token != "sport" || len(q.Terms[1].Synonyms) != 0 {
		t.Errorf("term 2 = %+v", q.Terms[1])
	}
}

func TestParseCanonicalOnlyGroup(t *testing.T) {
	q := Parse("télévision", "fr", testSynonyms())
	if !reflect.DeepEqual(q.Terms[0].Synonyms, []string{"televiseur", "tv"}) {
		t.Errorf("synonyms = %v", q.Terms[0].Synonyms)
	}
}

func TestParseEdgeCases(t *testing.T) {
	if q := Parse("   ", "fr", nil); !q.Empty() || len(q.Terms) != 0 {
		t.Errorf("blank query: %+v", q)
	}
	if q := Parse("!!! ??? %%%", "fr", nil); !q.Empty() {
		t.Errorf("punctuation-only query should be empty: %+v", q)
	}
	// Only stop words: still searchable rather than silently empty.
	if q := Parse("le la", "fr", nil); len(q.Terms) != 2 {
		t.Errorf("stop-word-only query: %+v", q)
	}
	// Single letters are dropped when there is something better to match.
	if q := Parse("samsung a 15", "fr", nil); len(q.Terms) != 2 || q.Terms[1].Token != "15" {
		t.Errorf("single letter: %+v", q.Terms)
	}
	// Duplicate words count once.
	if q := Parse("samsung SAMSUNG", "fr", nil); len(q.Terms) != 1 {
		t.Errorf("duplicates: %+v", q.Terms)
	}
	long := strings.Repeat("mot ", 100)
	q := Parse(long, "fr", nil)
	if len([]rune(q.Raw)) > MaxQueryRunes {
		t.Errorf("raw not truncated: %d", len([]rune(q.Raw)))
	}
	many := Parse("un deux trois quatre cinq six sept huit neuf dix", "fr", nil)
	if len(many.Terms) != MaxTerms {
		t.Errorf("terms = %d, want %d", len(many.Terms), MaxTerms)
	}
}

// Every generated LIKE pattern is built from normalized tokens, which contain
// only letters, digits and spaces: user input can never inject % or _.
func TestTermsContainNoLikeWildcards(t *testing.T) {
	q := Parse(`50% _off_ \ 'quote' "x"`, "fr", nil)
	for _, term := range q.Terms {
		for _, alt := range term.All() {
			if strings.ContainsAny(alt, `%_\'"`) {
				t.Errorf("unsafe alternative %q", alt)
			}
		}
	}
}

func TestCommercialBonusCannotCrossTier(t *testing.T) {
	if MaxBonus() >= ClosenessStep {
		t.Fatalf("bonuses (%v) can outweigh one closeness step (%d)", MaxBonus(), ClosenessStep)
	}
	if MaxCloseness()+MaxBonus() >= MinTierGap {
		t.Fatalf("closeness+bonus (%v) can cross a tier (%d)", MaxCloseness()+MaxBonus(), MinTierGap)
	}
	tiers := []int{TierExactName, TierNamePrefix, TierNameWords, TierSKUExact, TierNamePartial,
		TierAttributes, TierTaxonomy, TierSeller, TierDescription, TierSynonym}
	for i := 1; i < len(tiers); i++ {
		if tiers[i-1]-tiers[i] < MinTierGap {
			t.Errorf("tiers %d and %d are closer than %d", tiers[i-1], tiers[i], MinTierGap)
		}
	}
	// The worst penalty must not push a product below the next tier either.
	if -PenaltySuspendedTrust >= MinTierGap {
		t.Errorf("trust penalty crosses a tier")
	}
	if FuzzyMax+MaxCloseness()+MaxBonus() >= TierSynonym {
		t.Errorf("an approximate match can outrank a synonym match")
	}
	if ShopProductsSpread+ShopMaxBonus() >= 100 {
		t.Errorf("shop bonuses cross a shop tier")
	}
}

func TestTierNames(t *testing.T) {
	if TierName(TierNameWords+MaxCloseness()+50) != "name_words" {
		t.Error("closeness must not change the tier label")
	}
	if TierName(0) != "browse" || TierName(1500) != "approximate" {
		t.Error("unexpected low-tier labels")
	}
}

func TestSynonymCacheKeepsLastGoodSetOnError(t *testing.T) {
	calls := 0
	fail := false
	c := NewSynonymCache(func() ([]SynonymEntry, error) {
		calls++
		if fail {
			return nil, errors.New("db down")
		}
		return []SynonymEntry{{"tv", "television"}}, nil
	}, time.Hour)
	if got := c.Get().Expand("tv"); len(got) != 2 {
		t.Fatalf("expand = %v", got)
	}
	c.Get()
	if calls != 1 {
		t.Fatalf("expected cached set, loader called %d times", calls)
	}
	fail = true
	c.Invalidate()
	if got := c.Get().Expand("tv"); len(got) != 2 {
		t.Fatalf("lost synonyms after failed reload: %v", got)
	}
}
