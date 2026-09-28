package service

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	searchutil "github.com/btmi-ai-market/backend/internal/search"
	"github.com/google/uuid"
)

// synonymCacheTTL is how long an admin edit of search_synonyms can take to
// reach search.
const synonymCacheTTL = 5 * time.Minute

// Request limits. Anything above maxRawQueryBytes is rejected outright; a
// shorter query is truncated to searchutil.MaxQueryRunes.
const (
	maxRawQueryBytes = 1000
	maxSearchPage    = 100
	maxSearchLimit   = 50
	maxSlugLength    = 100
	maxSuggestLimit  = 8
)

// SearchValidationError is a client error the handler returns as HTTP 400.
type SearchValidationError struct {
	Code    string
	Message string
}

func (e *SearchValidationError) Error() string { return e.Code }

func invalid(code, message string) error { return &SearchValidationError{Code: code, Message: message} }

// parseQuery validates and analyses a raw query string.
func (s *MarketplaceService) parseQuery(raw string) (searchutil.Query, error) {
	if len(raw) > maxRawQueryBytes {
		return searchutil.Query{}, invalid("QUERY_TOO_LONG", "The search query is too long.")
	}
	return searchutil.Parse(raw, searchutil.DefaultLanguage, s.synonyms.Get()), nil
}

func normalizeSearchParams(p *models.MarketplaceSearchParams) error {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.Page > maxSearchPage {
		return invalid("INVALID_PAGE", "Page is out of range.")
	}
	if p.Limit <= 0 || p.Limit > maxSearchLimit {
		p.Limit = 20
	}
	if (p.Page-1)*p.Limit >= searchutil.MaxResultDepth {
		return invalid("INVALID_PAGE", "Page is out of range.")
	}
	switch p.Sort {
	case "", "relevance":
		p.Sort = "relevance"
	case "price_asc", "price_desc", "seller_level":
	default:
		p.Sort = "relevance"
	}
	for _, id := range []string{p.ShopID, p.BusinessID} {
		if id != "" {
			if _, err := uuid.Parse(id); err != nil {
				return invalid("INVALID_FILTER", "shop_id and business_id must be UUIDs.")
			}
		}
	}
	if len(p.CategorySlug) > maxSlugLength || len(p.SubcategorySlug) > maxSlugLength {
		return invalid("INVALID_FILTER", "Category filter is too long.")
	}
	if p.MinPrice < 0 {
		p.MinPrice = 0
	}
	if p.MaxPrice < 0 {
		p.MaxPrice = 0
	}
	if p.MaxPrice > 0 && p.MinPrice > p.MaxPrice {
		p.MinPrice, p.MaxPrice = p.MaxPrice, p.MinPrice
	}
	p.City = searchutil.Normalize(searchutil.Truncate(p.City))
	p.NearCity = searchutil.Normalize(searchutil.Truncate(p.NearCity))
	return nil
}

// runProductSearch runs the exact pass and, only when it finds nothing for a
// non-empty query, the typo-tolerant pass.
func (s *MarketplaceService) runProductSearch(ctx context.Context, q searchutil.Query, p *models.MarketplaceSearchParams) (*models.MarketplaceSearchResult, error) {
	res, err := s.marketplaceRepo.SearchProductsRanked(ctx, q, p, false)
	if err != nil || q.Empty() || res.Pagination.Total > 0 {
		return res, err
	}
	return s.marketplaceRepo.SearchProductsRanked(ctx, q, p, true)
}

// SearchProducts is the full search page. Browsing (empty query) is not
// logged: it is not a search the buyer typed.
func (s *MarketplaceService) SearchProducts(ctx context.Context, params *models.MarketplaceSearchParams) (*models.MarketplaceSearchResult, error) {
	if err := normalizeSearchParams(params); err != nil {
		return nil, err
	}
	q, err := s.parseQuery(params.Query)
	if err != nil {
		return nil, err
	}
	started := time.Now()
	res, err := s.runProductSearch(ctx, q, params)
	if !q.Empty() {
		entry := repository.SearchLogEntry{
			Query: q.Raw, NormalizedQuery: q.Normalized, SearchType: "TEXT",
			Filters: searchFilters(params), Session: parseSession(params.Session),
			Duration: time.Since(started), Err: err,
		}
		if res != nil {
			entry.ResultsCount = res.Pagination.Total
			entry.MatchMode = res.MatchMode
			for _, p := range res.Products {
				entry.ResultIDs = append(entry.ResultIDs, p.ID)
			}
		}
		if id := s.marketplaceRepo.LogSearch(entry); id != uuid.Nil && res != nil {
			res.SearchID = &id
		}
	}
	if err != nil {
		return nil, err
	}
	s.attachImages(res.Products)
	return res, nil
}

// ListShops searches / lists public shops with the shop ranking.
func (s *MarketplaceService) ListShops(ctx context.Context, query, city, nearCity string, page, limit int) ([]*models.PublicShopResponse, int, error) {
	if page <= 0 {
		page = 1
	}
	if page > maxSearchPage {
		return nil, 0, invalid("INVALID_PAGE", "Page is out of range.")
	}
	if limit <= 0 || limit > maxSearchLimit {
		limit = 20
	}
	q, err := s.parseQuery(query)
	if err != nil {
		return nil, 0, err
	}
	city = searchutil.Normalize(searchutil.Truncate(city))
	nearCity = searchutil.Normalize(searchutil.Truncate(nearCity))
	return s.marketplaceRepo.SearchShopsRanked(ctx, q, city, nearCity, page, limit)
}

// Suggest powers autocomplete: products, shops, categories and subcategories
// from one request, ranked by the same engine as the search page so the
// suggestions never contradict the full results. Nothing is logged here (one
// request per keystroke); a chosen suggestion is logged via RecordSearchEvent.
func (s *MarketplaceService) Suggest(ctx context.Context, raw string, limit int) (*models.SearchSuggestions, error) {
	if limit <= 0 || limit > maxSuggestLimit {
		limit = 5
	}
	q, err := s.parseQuery(raw)
	if err != nil {
		return nil, err
	}
	out := &models.SearchSuggestions{
		Query:    q.Normalized,
		Products: []*models.PublicProductResponse{}, Shops: []*models.PublicShopResponse{},
		Categories: []*models.TaxonomySuggestion{}, Subcategories: []*models.TaxonomySuggestion{},
	}
	if len([]rune(q.Normalized)) < 2 {
		return out, nil
	}

	var wg sync.WaitGroup
	var productErr, shopErr, taxErr error
	wg.Add(3)
	go func() {
		defer wg.Done()
		params := &models.MarketplaceSearchParams{Page: 1, Limit: limit, Sort: "relevance"}
		res, err := s.runProductSearch(ctx, q, params)
		if err != nil {
			productErr = err
			return
		}
		out.Products = res.Products
	}()
	go func() {
		defer wg.Done()
		shops, _, err := s.marketplaceRepo.SearchShopsRanked(ctx, q, "", "", 1, 3)
		if err != nil {
			shopErr = err
			return
		}
		out.Shops = shops
	}()
	go func() {
		defer wg.Done()
		cats, subs, err := s.marketplaceRepo.SuggestTaxonomy(ctx, q, 3)
		if err != nil {
			taxErr = err
			return
		}
		out.Categories, out.Subcategories = cats, subs
	}()
	wg.Wait()
	// A partial answer is more useful than none; fail only if every group did.
	if productErr != nil && shopErr != nil && taxErr != nil {
		return nil, productErr
	}
	s.attachImages(out.Products)
	return out, nil
}

var (
	searchEventTypes  = map[string]bool{"CLICK": true, "ADD_TO_CART": true}
	searchResultTypes = map[string]bool{"PRODUCT": true, "SHOP": true, "CATEGORY": true, "SUBCATEGORY": true}
)

// RecordSearchEvent stores a click or add-to-cart attributed to a search. A
// click on an autocomplete suggestion has no search id yet, so it is logged
// as a SUGGEST search first.
func (s *MarketplaceService) RecordSearchEvent(req *models.SearchEventRequest) (bool, error) {
	eventType := strings.ToUpper(req.EventType)
	resultType := strings.ToUpper(req.ResultType)
	if !searchEventTypes[eventType] || !searchResultTypes[resultType] {
		return false, invalid("INVALID_EVENT", "Unknown event or result type.")
	}
	resultID, err := uuid.Parse(req.ResultID)
	if err != nil {
		return false, invalid("INVALID_EVENT", "result_id must be a UUID.")
	}
	if req.Position != nil && (*req.Position < 0 || *req.Position > 1000) {
		req.Position = nil
	}
	var searchID uuid.UUID
	if req.SearchID != "" {
		if searchID, err = uuid.Parse(req.SearchID); err != nil {
			return false, invalid("INVALID_EVENT", "search_id must be a UUID.")
		}
	} else {
		if eventType != "CLICK" {
			return false, invalid("INVALID_EVENT", "search_id is required.")
		}
		q, err := s.parseQuery(req.Query)
		if err != nil {
			return false, err
		}
		if q.Empty() {
			return false, invalid("INVALID_EVENT", "search_id or query is required.")
		}
		searchID = s.marketplaceRepo.LogSearch(repository.SearchLogEntry{
			Query: q.Raw, NormalizedQuery: q.Normalized, SearchType: "SUGGEST",
			ResultsCount: 1, ResultIDs: []uuid.UUID{resultID}, Session: parseSession(req.Session),
		})
		if searchID == uuid.Nil {
			return false, nil
		}
	}
	return s.marketplaceRepo.RecordSearchEvent(searchID, eventType, resultType, resultID, req.Position)
}

func parseSession(value string) *uuid.UUID {
	id, err := uuid.Parse(value)
	if err != nil {
		return nil
	}
	return &id
}

// searchFilters keeps only the filters worth aggregating; ids of a specific
// shop or business are reduced to a flag.
func searchFilters(p *models.MarketplaceSearchParams) map[string]interface{} {
	f := map[string]interface{}{"sort": p.Sort, "page": p.Page}
	if p.City != "" {
		f["city"] = p.City
	}
	if p.CategorySlug != "" {
		f["category"] = p.CategorySlug
	}
	if p.SubcategorySlug != "" {
		f["subcategory"] = p.SubcategorySlug
	}
	if p.MinPrice > 0 {
		f["min_price"] = p.MinPrice
	}
	if p.MaxPrice > 0 {
		f["max_price"] = p.MaxPrice
	}
	if p.MinRating > 0 {
		f["min_rating"] = p.MinRating
	}
	if p.ShopID != "" || p.BusinessID != "" {
		f["scoped_to_seller"] = true
	}
	return f
}
