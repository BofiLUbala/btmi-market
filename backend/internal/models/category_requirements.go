package models

import "strings"

// CategoryAttributeRequirements describes which product characteristics a
// category demands before a product may be published.
//
// This mirrors CATEGORY_ATTRIBUTE_REQUIREMENTS in
// web-app/src/lib/categorySuggestions.ts. The frontend copy exists to give
// immediate feedback while the seller types; this one is the rule of record,
// because the frontend can be bypassed by calling the API directly. Keep the
// two in sync when categories change.
type CategoryAttributeRequirements struct {
	// AllOf lists attributes that must each be present with a value.
	AllOf []string
	// AnyOf lists groups; at least one attribute per group must be present.
	AnyOf [][]string
}

// IsEmpty reports whether the category imposes no requirement at all.
func (r CategoryAttributeRequirements) IsEmpty() bool {
	return len(r.AllOf) == 0 && len(r.AnyOf) == 0
}

var categoryAttributeRequirements = map[string]CategoryAttributeRequirements{
	"shoes":       {AllOf: []string{"Color", "Shoe Size"}},
	"fashion":     {AllOf: []string{"Color", "Size"}},
	"food":        {AllOf: []string{"Expiration Date"}, AnyOf: [][]string{{"Weight", "Volume", "Pack Size"}}},
	"beauty":      {AnyOf: [][]string{{"Shade", "Volume", "Scent"}}},
	"electronics": {AllOf: []string{"Model"}, AnyOf: [][]string{{"Storage", "RAM", "Capacity"}}},
	"children":    {AllOf: []string{"Age Range"}, AnyOf: [][]string{{"Size", "Color"}}},
	"home":        {AllOf: []string{"Dimensions", "Material"}},
	"sport":       {AnyOf: [][]string{{"Size", "Weight"}}},
	"automotive":  {AnyOf: [][]string{{"Model", "Compatibility"}}},
}

// splitWords breaks a slug or display name into lowercase word tokens, so a
// short token can be matched without hitting substrings of unrelated words.
func splitWords(n string) []string {
	return strings.FieldsFunc(n, func(r rune) bool {
		return !(r >= 'a' && r <= 'z') && !(r >= '0' && r <= '9')
	})
}

// resolveCategoryKey maps a slug or display name — in English or French — onto
// one of the keys above. Mirrors resolveCategoryKey in the frontend.
func resolveCategoryKey(slugOrName string) string {
	n := strings.ToLower(strings.TrimSpace(slugOrName))
	if n == "" {
		return ""
	}
	words := splitWords(n)

	// Distinctive stems: safe to match anywhere in the string.
	contains := func(subs ...string) bool {
		for _, s := range subs {
			if strings.Contains(n, s) {
				return true
			}
		}
		return false
	}
	// Short, ambiguous tokens ("car" is inside "scarves", "carpet",
	// "cardigan"): only match them as a whole word.
	hasWord := func(candidates ...string) bool {
		for _, w := range words {
			for _, c := range candidates {
				if w == c {
					return true
				}
			}
		}
		return false
	}

	switch {
	case contains("shoe", "chaussure", "footwear"):
		return "shoes"
	case contains("fashion", "mode", "clothing", "vetement"):
		return "fashion"
	case contains("food", "aliment", "grocery", "epicerie", "boisson"):
		return "food"
	case contains("beauty", "beaute", "cosmetic", "soin"):
		return "beauty"
	case contains("electron", "phone", "ordinateur") || hasWord("tech"):
		return "electronics"
	case contains("enfant", "baby", "bebe") || hasWord("child", "children", "kid", "kids"):
		return "children"
	case contains("maison", "furnitur", "meuble", "decor") || hasWord("home"):
		return "home"
	case contains("sport", "fitness"):
		return "sport"
	case contains("vehic", "voiture", "automo") || hasWord("auto", "car", "cars"):
		return "automotive"
	}
	return n
}

// GetCategoryRequirements returns the rules for a category, or an empty set
// when the category has none. A subcategory rule wins over its parent's, so a
// narrower category can demand more; when the subcategory has no rule of its
// own the parent's applies.
func GetCategoryRequirements(categorySlugOrName, subcategorySlugOrName string) CategoryAttributeRequirements {
	if subcategorySlugOrName != "" {
		if r, ok := categoryAttributeRequirements[resolveCategoryKey(subcategorySlugOrName)]; ok && !r.IsEmpty() {
			return r
		}
	}
	return categoryAttributeRequirements[resolveCategoryKey(categorySlugOrName)]
}

// MissingRequiredAttributes returns the human-readable reasons a product may
// not be published yet, given the attribute names it actually carries.
// An empty result means the product satisfies its category.
func MissingRequiredAttributes(req CategoryAttributeRequirements, presentAttributes []string) []string {
	present := make(map[string]bool, len(presentAttributes))
	for _, name := range presentAttributes {
		trimmed := strings.ToLower(strings.TrimSpace(name))
		if trimmed != "" {
			present[trimmed] = true
		}
	}

	var missing []string
	for _, name := range req.AllOf {
		if !present[strings.ToLower(name)] {
			missing = append(missing, name)
		}
	}
	for _, group := range req.AnyOf {
		satisfied := false
		for _, name := range group {
			if present[strings.ToLower(name)] {
				satisfied = true
				break
			}
		}
		if !satisfied {
			missing = append(missing, "one of: "+strings.Join(group, ", "))
		}
	}
	return missing
}
