package search

import "strings"

// Analyzer turns normalized text into the tokens a query must match. One
// analyzer exists per language so local languages (Lingala, Swahili, ...) can
// be added later by registering another implementation; nothing else in the
// search pipeline is language specific.
type Analyzer interface {
	// IsStopWord reports words too common to be required in a match.
	IsStopWord(token string) bool
	// Stem returns a singular/base form of token, or token itself. The stem is
	// only ever used as an additional alternative, never as a replacement, so a
	// stem that is slightly wrong can widen recall but never lose a match.
	Stem(token string) string
}

var analyzers = map[string]Analyzer{"fr": frenchAnalyzer{}}

// DefaultLanguage is the marketplace's primary language.
const DefaultLanguage = "fr"

// RegisterAnalyzer adds or replaces the analyzer for a language code.
func RegisterAnalyzer(language string, a Analyzer) { analyzers[language] = a }

// AnalyzerFor returns the analyzer for language, falling back to French.
func AnalyzerFor(language string) Analyzer {
	if a, ok := analyzers[language]; ok {
		return a
	}
	return analyzers[DefaultLanguage]
}

// frenchAnalyzer covers French and the English words sellers commonly use in
// product names (the category taxonomy itself is stored in English).
type frenchAnalyzer struct{}

var frenchStopWords = map[string]struct{}{
	"le": {}, "la": {}, "les": {}, "l": {}, "un": {}, "une": {}, "des": {}, "de": {}, "du": {}, "d": {},
	"et": {}, "ou": {}, "a": {}, "au": {}, "aux": {}, "en": {}, "pour": {}, "avec": {}, "sans": {}, "sur": {},
	"the": {}, "and": {}, "for": {}, "with": {}, "of": {},
}

func (frenchAnalyzer) IsStopWord(token string) bool {
	_, ok := frenchStopWords[token]
	return ok
}

// Stem handles regular French/English plurals only. Anything smarter (a
// Snowball stemmer) would mangle brand and model names such as "A15" or
// "Airpods", which matter more on a marketplace than verb conjugations.
func (frenchAnalyzer) Stem(token string) string {
	n := len(token)
	switch {
	case n < 4 || hasDigit(token):
		return token
	case strings.HasSuffix(token, "eaux"):
		return token[:n-1] // bateaux -> bateau
	case strings.HasSuffix(token, "aux") && n > 5:
		return token[:n-3] + "al" // journaux -> journal
	case strings.HasSuffix(token, "eux"):
		return token[:n-1] // jeux -> jeu
	case strings.HasSuffix(token, "ss") || strings.HasSuffix(token, "us") || strings.HasSuffix(token, "is"):
		return token // bus, tapis, dress
	case strings.HasSuffix(token, "s"):
		return token[:n-1] // chaussures -> chaussure, phones -> phone
	}
	return token
}

func hasDigit(s string) bool {
	for _, r := range s {
		if r >= '0' && r <= '9' {
			return true
		}
	}
	return false
}
