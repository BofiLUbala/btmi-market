package service

import (
	"encoding/json"
	"errors"

	"github.com/btmi-ai-market/backend/internal/models"
	searchutil "github.com/btmi-ai-market/backend/internal/search"
	"github.com/google/uuid"
)

// ErrInvalidSynonym is returned for an empty or over-long synonym.
var ErrInvalidSynonym = errors.New("INVALID_SYNONYM")

func (s *AdminCommerceService) GetSearchAnalytics() (*models.AdminSearchAnalytics, error) {
	return s.commerceRepo.GetSearchAnalytics()
}

func (s *AdminCommerceService) ListSearchQueries(limit, offset int) ([]*models.AdminSearchQueryLog, int, error) {
	return s.commerceRepo.ListSearchQueries(limit, offset)
}

func (s *AdminCommerceService) ListSearchSynonyms() ([]models.AdminSearchSynonym, error) {
	return s.commerceRepo.ListSearchSynonyms()
}

// UpsertSearchSynonym normalizes and stores a synonym. The marketplace picks
// the change up within its synonym cache TTL (5 minutes).
func (s *AdminCommerceService) UpsertSearchSynonym(adminID uuid.UUID, adminRole models.AdminRole, req *models.UpsertSearchSynonymRequest, ip, userAgent string) (*models.AdminSearchSynonym, error) {
	term := searchutil.Normalize(req.Term)
	canonical := searchutil.Normalize(req.CanonicalTerm)
	if term == "" || canonical == "" || len([]rune(term)) > 60 || len([]rune(canonical)) > 60 {
		return nil, ErrInvalidSynonym
	}
	lang := req.LanguageCode
	if lang == "" {
		lang = searchutil.DefaultLanguage
	}
	if len(lang) > 12 {
		return nil, ErrInvalidSynonym
	}
	active := true
	if req.Active != nil {
		active = *req.Active
	}
	syn := models.AdminSearchSynonym{Term: term, CanonicalTerm: canonical, LanguageCode: lang, Active: active}
	prev, err := s.commerceRepo.UpsertSearchSynonym(syn)
	if err != nil {
		return nil, err
	}
	entry := &models.AdminAuditLog{
		ActorAdminID: adminID, ActorRole: adminRole,
		Action: "SEARCH_SYNONYM_UPSERT", TargetType: "SEARCH_SYNONYM", TargetID: term,
		Reason: "Search synonym edited", IPAddress: &ip, UserAgent: &userAgent,
	}
	newBytes, _ := json.Marshal(syn)
	newRaw := json.RawMessage(newBytes)
	entry.NewValue = &newRaw
	if prev != nil {
		oldBytes, _ := json.Marshal(prev)
		oldRaw := json.RawMessage(oldBytes)
		entry.OldValue = &oldRaw
	}
	_ = s.auditRepo.Record(entry)
	return &syn, nil
}

func (s *AdminCommerceService) DeleteSearchSynonym(adminID uuid.UUID, adminRole models.AdminRole, term, ip, userAgent string) (bool, error) {
	term = searchutil.Normalize(term)
	deleted, err := s.commerceRepo.DeleteSearchSynonym(term)
	if err != nil || !deleted {
		return deleted, err
	}
	_ = s.auditRepo.Record(&models.AdminAuditLog{
		ActorAdminID: adminID, ActorRole: adminRole,
		Action: "SEARCH_SYNONYM_DELETE", TargetType: "SEARCH_SYNONYM", TargetID: term,
		Reason: "Search synonym removed", IPAddress: &ip, UserAgent: &userAgent,
	})
	return true, nil
}

// SearchRankingRule describes the product search formula from the constants
// the engine actually uses.
func SearchRankingRule() *models.AdminSearchRankingRule {
	item := func(k string, v float64) models.AdminRankingItem { return models.AdminRankingItem{Key: k, Value: v} }
	return &models.AdminSearchRankingRule{
		Formula: "final_score = relevance_tier + closeness + bonuses (bonuses capped; relevance always dominates)",
		Tiers: []models.AdminRankingItem{
			item("exact_name", searchutil.TierExactName), item("name_prefix", searchutil.TierNamePrefix),
			item("name_words", searchutil.TierNameWords), item("sku", searchutil.TierSKUExact),
			item("name_partial", searchutil.TierNamePartial), item("attributes", searchutil.TierAttributes),
			item("category", searchutil.TierTaxonomy), item("seller", searchutil.TierSeller),
			item("description", searchutil.TierDescription), item("synonym", searchutil.TierSynonym),
			item("approximate_max", searchutil.FuzzyMax), item("closeness_step", searchutil.ClosenessStep),
		},
		Bonuses: []models.AdminRankingItem{
			item("available", searchutil.BonusAvailable), item("listing_quality_max", searchutil.BonusQualityMax),
			item("reviews_max", searchutil.BonusRatingMax), item("trusted_seller", searchutil.BonusTrusted),
			item("near_city", searchutil.BonusNearCity), item("seller_level_max", searchutil.BonusSellerLevelMax),
			item("sales_max", searchutil.BonusSalesMax), item("recent", searchutil.BonusRecent),
			item("low_trust_penalty", searchutil.PenaltyLowTrust), item("suspended_trust_penalty", searchutil.PenaltySuspendedTrust),
		},
		MaxBonus: searchutil.MaxBonus(),
		TierGap:  searchutil.MinTierGap,
		Notes: []string{
			"Seller level (points) is at most a small capped bonus and never outranks a better text match.",
			"Out-of-stock products stay visible but rank after equally relevant products in stock.",
			"No sponsored placement exists; see docs/search-ranking.md for the integration point.",
		},
	}
}
