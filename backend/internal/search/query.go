package search

import (
	"errors"
	"sort"
	"strings"
)

// MaxTerms caps how many required terms one query can produce. Each term adds
// an index condition, so an unbounded list would let a single request build an
// arbitrarily expensive plan.
const MaxTerms = 6

// MaxResultDepth is how many results of one query can be paged through.
// Ranking is computed over at most this many candidates (the best by
// relevance), which bounds the cost of very broad queries such as a seller
// name matching a whole catalog.
const MaxResultDepth = 2000

// ErrQueryTooLong is returned when the raw query exceeds MaxQueryRunes.
var ErrQueryTooLong = errors.New("SEARCH_QUERY_TOO_LONG")

// Term is one word of the query. A document matches the term when it contains
// any of Exact (the word and its singular form) or, with a lower score, any
// Synonym.
type Term struct {
	Token    string   `json:"token"`
	Exact    []string `json:"exact"`
	Synonyms []string `json:"synonyms,omitempty"`
}

// All returns Exact followed by Synonyms.
func (t Term) All() []string { return append(append([]string{}, t.Exact...), t.Synonyms...) }

// Query is an analysed search query.
type Query struct {
	Raw        string `json:"raw"`
	Normalized string `json:"normalized"`
	Terms      []Term `json:"terms"`
}

// Empty reports a query that constrains nothing (blank, or only punctuation).
func (q Query) Empty() bool { return q.Normalized == "" }

// Parse analyses raw with the given language and synonym set. It never
// fails: over-long input is truncated (the service decides whether that is an
// error) and a nil synonym set simply disables synonyms.
func Parse(raw, language string, synonyms *SynonymSet) Query {
	raw = Truncate(strings.TrimSpace(raw))
	q := Query{Raw: raw, Normalized: Normalize(raw)}
	if q.Normalized == "" {
		return q
	}
	a := AnalyzerFor(language)
	words := strings.Fields(q.Normalized)
	seen := map[string]bool{}
	var required []string
	for _, w := range words {
		if seen[w] || a.IsStopWord(w) {
			continue
		}
		seen[w] = true
		required = append(required, w)
	}
	// A query made only of stop words or single letters still has to match
	// something, so fall back to the raw words.
	if len(required) == 0 {
		required = words
	}
	var terms []Term
	for _, w := range required {
		// Single characters cannot use the trigram index and match almost
		// everything; keep them only if the query has nothing else.
		if len([]rune(w)) < 2 && len(required) > 1 {
			continue
		}
		terms = append(terms, buildTerm(w, a, synonyms))
		if len(terms) == MaxTerms {
			break
		}
	}
	q.Terms = terms
	return q
}

func buildTerm(word string, a Analyzer, synonyms *SynonymSet) Term {
	t := Term{Token: word, Exact: []string{word}}
	if stem := a.Stem(word); stem != word {
		t.Exact = append(t.Exact, stem)
	}
	if synonyms != nil {
		set := map[string]bool{}
		for _, e := range t.Exact {
			for _, s := range synonyms.Expand(e) {
				set[s] = true
			}
		}
		for _, e := range t.Exact {
			delete(set, e)
		}
		for s := range set {
			t.Synonyms = append(t.Synonyms, s)
		}
		sort.Strings(t.Synonyms)
	}
	return t
}
