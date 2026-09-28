package search

// Ranking weights. The SQL in repository/marketplace_search.go is generated
// from these values, so this file is the single place to read or tune the
// formula:
//
//	final_score = tier + closeness + bonuses
//
// Ordering is effectively lexicographic, enforced by the magnitudes:
//
//  1. tier: which field matched and how (see the Tier* constants). Tiers are
//     MinTierGap (1000) apart.
//  2. closeness: how much of the product name the query covers, in steps of
//     ClosenessStep (100): the phone "Samsung Galaxy A15" beats the accessory
//     "Coque de protection pour Samsung Galaxy A15" for "samsung a15", even
//     though both contain every word.
//  3. bonuses: availability, quality, reviews, trust, sales, seller level...
//     all capped, and MaxBonus() < ClosenessStep.
//
// So commercial signals only order products that match the query equally
// well; TestCommercialBonusCannotCrossTier enforces this.
//
// A multi-word query takes the tier of its weakest word: "chaussure rouge"
// where "chaussure" is in the name and "rouge" only in a variant attribute
// ranks as an attribute match, below a product with both words in its name.

// Relevance tiers for products, strongest first.
const (
	TierExactName   = 12000 // normalized name == normalized query
	TierNamePrefix  = 11000 // name starts with the query
	TierNameWords   = 10000 // every word is a whole word of the name (plurals folded)
	TierSKUExact    = 9000  // query (or a word) is a product or variant SKU / barcode
	TierNamePartial = 8000  // every word appears inside the name ("phone" in "iPhone")
	TierAttributes  = 7000  // variant names / attribute values (colour, size, model...)
	TierTaxonomy    = 6000  // category or subcategory name
	TierSeller      = 5000  // shop or business name
	TierDescription = 4000  // description only
	TierSynonym     = 3000  // matched only through a synonym
	FuzzyMax        = 2000  // typo tolerance: word_similarity * FuzzyMax (fallback pass only)

	// MinTierGap is the smallest distance between two adjacent tiers.
	MinTierGap = 1000
)

// Closeness = min(floor(similarity(name, query) * ClosenessBuckets), MaxClosenessBucket)
// * ClosenessStep, where similarity is PostgreSQL trigram similarity (0..1).
// Buckets rather than the raw value, so that small textual differences do not
// matter but "the query is most of the name" clearly does.
const (
	ClosenessStep      = 100
	ClosenessBuckets   = 5
	MaxClosenessBucket = 4
)

// MaxCloseness is the largest closeness a product can receive.
func MaxCloseness() float64 { return ClosenessStep * MaxClosenessBucket }

// Bonuses. Positive ones are capped individually and in total (MaxBonus).
const (
	BonusAvailable      = 20.0 // at least one unit sellable now
	BonusQualityMax     = 12.0 // image 6, description >= 40 chars 4, category+subcategory 2
	BonusRatingMax      = 15.0 // Bayesian average of verified reviews, see RatingPrior*
	BonusTrusted        = 10.0 // seller_trust = TRUSTED
	BonusNearCity       = 10.0 // offer in the city the buyer asked to be near
	BonusSellerLevelMax = 8.0  // seller_levels.search_boost (0..1) * this; points cannot buy more
	BonusSalesMax       = 10.0 // ln(1 + units sold in 90 days) * 2.5, delivered/completed orders only
	BonusRecent         = 5.0  // created in the last 30 days

	PenaltyLowTrust       = -20.0
	PenaltySuspendedTrust = -40.0

	// Bayesian rating: a product needs several good reviews to beat the prior,
	// and an unrated product sits exactly at the prior (bonus 0).
	RatingPriorMean   = 3.5
	RatingPriorWeight = 5.0
)

// MaxBonus is the largest total positive bonus a product can receive.
func MaxBonus() float64 {
	return BonusAvailable + BonusQualityMax + BonusRatingMax + BonusTrusted +
		BonusNearCity + BonusSellerLevelMax + BonusSalesMax + BonusRecent
}

// Shop relevance tiers. Shops are ranked separately from products.
const (
	ShopTierExactName    = 1200
	ShopTierNamePrefix   = 1100
	ShopTierNameWords    = 1000
	ShopTierNamePartial  = 800
	ShopTierBusinessName = 700
	ShopTierCity         = 600
	// Shops selling matching, in-stock products: 500 + up to 40 for how many
	// (spread + ShopMaxBonus stays below the next tier).
	ShopTierProducts     = 500
	ShopProductsSpread   = 40.0
	ShopFuzzyMax         = 300.0
	ShopBonusRatingMax   = 15.0
	ShopBonusCatalogMax  = 10.0 // ln(1 + available products) * 3 + share with images * 5, capped
	ShopPenaltyCancelMax = -10.0
)

// ShopMaxBonus is the largest total positive bonus a shop can receive.
func ShopMaxBonus() float64 {
	return ShopBonusRatingMax + BonusTrusted + ShopBonusCatalogMax + BonusNearCity + BonusSellerLevelMax
}

// TierName labels a product relevance value for the explain output.
func TierName(relevance float64) string {
	switch {
	case relevance >= TierExactName:
		return "exact_name"
	case relevance >= TierNamePrefix:
		return "name_prefix"
	case relevance >= TierNameWords:
		return "name_words"
	case relevance >= TierSKUExact:
		return "sku"
	case relevance >= TierNamePartial:
		return "name_partial"
	case relevance >= TierAttributes:
		return "attributes"
	case relevance >= TierTaxonomy:
		return "category"
	case relevance >= TierSeller:
		return "seller"
	case relevance >= TierDescription:
		return "description"
	case relevance >= TierSynonym:
		return "synonym"
	case relevance > 0:
		return "approximate"
	}
	return "browse"
}

// ShopTierName labels a shop relevance value.
func ShopTierName(relevance float64) string {
	switch {
	case relevance >= ShopTierExactName:
		return "exact_name"
	case relevance >= ShopTierNamePrefix:
		return "name_prefix"
	case relevance >= ShopTierNameWords:
		return "name_words"
	case relevance >= ShopTierNamePartial:
		return "name_partial"
	case relevance >= ShopTierBusinessName:
		return "business_name"
	case relevance >= ShopTierCity:
		return "city"
	case relevance >= ShopTierProducts:
		return "products"
	case relevance > 0:
		return "approximate"
	}
	return "browse"
}
