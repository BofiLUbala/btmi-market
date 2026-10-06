package service

import (
	"context"
	"log"
	"sort"
	"sync"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

// SpotlightRotateSeconds is how long one product stays in a home spotlight.
const SpotlightRotateSeconds = 30

const (
	spotlightPoolSize    = 20
	spotlightRefresh     = 5 * time.Minute
	spotlightMaxProducts = 500
)

// Spotlights is what GET /marketplace/spotlights returns: one product per
// slot (nil when no listing qualifies) and when the next one is due.
type Spotlights struct {
	New            *models.PublicProductResponse `json:"new"`
	Offer          *models.PublicProductResponse `json:"offer"`
	Best           *models.PublicProductResponse `json:"best"`
	RotateSeconds  int                           `json:"rotate_seconds"`
	NextRotationAt time.Time                     `json:"next_rotation_at"`
}

// SpotlightService keeps three candidate pools in memory, rebuilt in the
// background: the newest listings, listings with a running discount, and the
// listings of the best-performing sellers. "Best" uses the same seller score
// as the category ranking (CategoryRankingService.CalculateShopScore: points
// boosted by level, halved for LOW/SUSPENDED trust), so the home spotlight
// follows the marketplace's own performance algorithm.
//
// Every caller in the same 30-second slot gets the same product, and the
// slot index walks through each pool, so the spotlights change on their own.
type SpotlightService struct {
	repo    *repository.MarketplaceRepository
	ranking *CategoryRankingService

	mu     sync.RWMutex
	newest []*models.PublicProductResponse
	offers []*models.PublicProductResponse
	best   []*models.PublicProductResponse
	built  time.Time
}

func NewSpotlightService(repo *repository.MarketplaceRepository, ranking *CategoryRankingService) *SpotlightService {
	return &SpotlightService{repo: repo, ranking: ranking}
}

// Run rebuilds the pools now and then every few minutes until ctx ends.
func (s *SpotlightService) Run(ctx context.Context) {
	s.refresh()
	ticker := time.NewTicker(spotlightRefresh)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.refresh()
		}
	}
}

func (s *SpotlightService) refresh() {
	var all []*models.PublicProductResponse
	for page := 1; len(all) < spotlightMaxProducts; page++ {
		items, total, err := s.repo.ListPublicProducts(uuid.Nil, page, 50, "newest")
		if err != nil {
			log.Printf("spotlights: list products: %v", err)
			return
		}
		all = append(all, items...)
		if len(items) == 0 || len(all) >= total {
			break
		}
	}

	now := time.Now()
	inStock := make([]*models.PublicProductResponse, 0, len(all))
	for _, p := range all {
		if p.Availability != "OUT_OF_STOCK" {
			inStock = append(inStock, p)
		}
	}

	// Seller performance score, computed once per business.
	scores := map[uuid.UUID]float64{}
	for _, p := range inStock {
		if _, ok := scores[p.BusinessID]; ok {
			continue
		}
		score, err := s.ranking.CalculateShopScore(p.BusinessID)
		if err != nil {
			score = 0
		}
		scores[p.BusinessID] = score
	}
	byPerformance := func(list []*models.PublicProductResponse) {
		sort.SliceStable(list, func(i, j int) bool {
			return scores[list[i].BusinessID] > scores[list[j].BusinessID]
		})
	}

	newest := take(inStock, spotlightPoolSize) // already newest first

	var offers []*models.PublicProductResponse
	for _, p := range inStock {
		if discountRunning(p, now) {
			offers = append(offers, p)
		}
	}
	byPerformance(offers)
	offers = take(offers, spotlightPoolSize)

	best := append([]*models.PublicProductResponse(nil), inStock...)
	byPerformance(best)
	best = take(best, spotlightPoolSize)

	s.mu.Lock()
	s.newest, s.offers, s.best, s.built = newest, offers, best, now
	s.mu.Unlock()
}

// Current returns the product each slot shows right now.
func (s *SpotlightService) Current(now time.Time) Spotlights {
	s.mu.RLock()
	built := s.built
	s.mu.RUnlock()
	if built.IsZero() {
		s.refresh() // first request before the background build finished
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	slot := int(now.Unix() / SpotlightRotateSeconds)
	out := Spotlights{
		New:            pick(s.newest, slot, nil),
		Offer:          pick(s.offers, slot, nil),
		RotateSeconds:  SpotlightRotateSeconds,
		NextRotationAt: time.Unix(int64(slot+1)*SpotlightRotateSeconds, 0).UTC(),
	}
	// Never the same product in two spotlights at once.
	avoid := map[uuid.UUID]bool{}
	if out.New != nil {
		avoid[out.New.ID] = true
	}
	if out.Offer != nil {
		avoid[out.Offer.ID] = true
	}
	out.Best = pick(s.best, slot, avoid)
	return out
}

func pick(pool []*models.PublicProductResponse, slot int, avoid map[uuid.UUID]bool) *models.PublicProductResponse {
	n := len(pool)
	for i := 0; i < n; i++ {
		p := pool[(slot+i)%n]
		if !avoid[p.ID] {
			return p
		}
	}
	return nil
}

func take(list []*models.PublicProductResponse, n int) []*models.PublicProductResponse {
	if len(list) > n {
		return list[:n]
	}
	return list
}

func discountRunning(p *models.PublicProductResponse, now time.Time) bool {
	if !p.DiscountActive || p.DiscountValue <= 0 {
		return false
	}
	if p.DiscountStart != nil && now.Before(*p.DiscountStart) {
		return false
	}
	if p.DiscountEnd != nil && !now.Before(*p.DiscountEnd) {
		return false
	}
	return true
}
