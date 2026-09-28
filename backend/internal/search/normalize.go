// Package search holds the language-aware query analysis and the ranking
// weights used by the marketplace search. The SQL side lives in
// repository/marketplace_search.go; everything tunable is defined here so the
// ranking is explainable from one file.
package search

import (
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

// MaxQueryRunes bounds what a client can make the database chew on.
const MaxQueryRunes = 120

// ligatures that NFD does not decompose but PostgreSQL's unaccent does.
var ligatures = strings.NewReplacer("œ", "oe", "Œ", "oe", "æ", "ae", "Æ", "ae", "ß", "ss")

// Normalize produces the same output as btmi_normalize_search() in migration
// 104: lower case, accents removed, every run of non letters/digits collapsed
// to one space. The database copy is what indexed documents use; this one
// shapes the query before it is sent, so both sides must stay in sync.
func Normalize(value string) string {
	value = norm.NFD.String(strings.ToLower(ligatures.Replace(strings.TrimSpace(value))))
	var b strings.Builder
	space := true
	for _, r := range value {
		if unicode.Is(unicode.Mn, r) {
			continue
		}
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
			space = false
		} else if !space {
			b.WriteByte(' ')
			space = true
		}
	}
	return strings.TrimSpace(b.String())
}

// Truncate cuts value to MaxQueryRunes without splitting a multi-byte rune.
func Truncate(value string) string {
	runes := []rune(value)
	if len(runes) <= MaxQueryRunes {
		return value
	}
	return string(runes[:MaxQueryRunes])
}
