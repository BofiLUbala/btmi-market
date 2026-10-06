package service

import (
	"context"
	"fmt"
	"log"
	"sort"
	"sync"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/notify"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

// SpotlightRotateSeconds is how long one product stays in a home spotlight.
const SpotlightRotateSeconds = 30

const (
	spotlightPoolSize    = 20
	spotlightRefresh     = 2 * time.Minute
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
// Only listings with a real seller photo qualify: the home never shows a stock
// picture in place of the product. The pools are re-evaluated every two
// minutes, so a seller whose performance rises or falls, or who changes a
// discount, moves in or out of the spotlights on the next pass, and the
// seller is told about each change (see notifyChanges).
//
// Every caller in the same 30-second slot gets the same product, and the
// slot index walks through each pool, so the spotlights change on their own.
type SpotlightService struct {
	repo     *repository.MarketplaceRepository
	ranking  *CategoryRankingService
	notifier *notify.Notifier
	images   *repository.ProductImageRepository

	mu     sync.RWMutex
	newest []*models.PublicProductResponse
	offers []*models.PublicProductResponse
	best   []*models.PublicProductResponse
	built  time.Time

	// What each pool held on the previous pass (product -> discount
	// signature), to notify sellers only about changes. nil until the first
	// pass, which seeds it without notifying anyone.
	seen map[spotlightKind]map[uuid.UUID]string
}

type spotlightKind string

const (
	spotlightNew   spotlightKind = "NEW"
	spotlightOffer spotlightKind = "OFFER"
	spotlightBest  spotlightKind = "BEST"
)

func NewSpotlightService(repo *repository.MarketplaceRepository, ranking *CategoryRankingService) *SpotlightService {
	return &SpotlightService{repo: repo, ranking: ranking}
}

// SetImageRepo gives the spotlights the sellers' photos (the product list
// query does not carry them).
func (s *SpotlightService) SetImageRepo(r *repository.ProductImageRepository) { s.images = r }

// SetNotifier tells sellers when their products enter or leave a spotlight.
func (s *SpotlightService) SetNotifier(n *notify.Notifier) { s.notifier = n }

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

	if err := s.attachPhotos(all); err != nil {
		log.Printf("spotlights: product photos: %v", err)
		return
	}

	now := time.Now()
	inStock := make([]*models.PublicProductResponse, 0, len(all))
	for _, p := range all {
		if p.Availability != "OUT_OF_STOCK" && hasPhoto(p) {
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

	// "Best" is earned: a seller with no performance score yet, or whose
	// trust is LOW/SUSPENDED, is never featured there.
	var best []*models.PublicProductResponse
	for _, p := range inStock {
		if scores[p.BusinessID] > 0 && p.SellerTrust != "LOW" && p.SellerTrust != "SUSPENDED" {
			best = append(best, p)
		}
	}
	byPerformance(best)
	best = take(best, spotlightPoolSize)

	s.mu.Lock()
	s.newest, s.offers, s.best, s.built = newest, offers, best, now
	s.mu.Unlock()

	s.notifyChanges(map[spotlightKind][]*models.PublicProductResponse{
		spotlightNew: newest, spotlightOffer: offers, spotlightBest: best,
	})
}

// notifyChanges compares the pools with the previous pass and tells each
// seller what happened to their products: featured, no longer featured, or
// featured with a new promotional price.
func (s *SpotlightService) notifyChanges(pools map[spotlightKind][]*models.PublicProductResponse) {
	next := map[spotlightKind]map[uuid.UUID]string{}
	byID := map[uuid.UUID]*models.PublicProductResponse{}
	for kind, pool := range pools {
		next[kind] = map[uuid.UUID]string{}
		for _, p := range pool {
			next[kind][p.ID] = discountSignature(p)
			byID[p.ID] = p
		}
	}
	prev := s.seen
	s.seen = next
	if prev == nil || s.notifier == nil {
		return
	}
	for kind, now := range next {
		for id, sig := range now {
			p := byID[id]
			old, was := prev[kind][id]
			switch {
			case !was:
				s.send(p, models.NotificationTypeProductSpotlighted, kind,
					"Produit mis en avant ("+spotlightLabel(kind)+") : "+p.Name, spotlightEnterBody(kind))
			case kind == spotlightOffer && old != sig:
				s.send(p, models.NotificationTypeSpotlightPriceUpdated, kind,
					"Prix promo mis à jour : "+p.Name,
					"Votre nouveau prix promotionnel est affiché dans la vedette « Offres » de l'accueil.")
			}
		}
	}
	// Leaving "Nouveautés" is only the product getting older: not worth a message.
	for _, kind := range []spotlightKind{spotlightOffer, spotlightBest} {
		for id := range prev[kind] {
			if _, still := next[kind][id]; still {
				continue
			}
			p, ok := byID[id]
			if !ok {
				if p = s.lookup(id); p == nil {
					continue
				}
			}
			s.send(p, models.NotificationTypeProductSpotlightEnded, kind,
				"Produit retiré de la vedette « "+spotlightLabel(kind)+" » : "+p.Name, spotlightLeaveBody(kind))
		}
	}
}

func (s *SpotlightService) send(p *models.PublicProductResponse, t models.NotificationType, kind spotlightKind, title, body string) {
	s.notifier.ToBusiness(p.BusinessID, false, notify.Message{
		Type: t, Title: title, Body: body,
		RefType: notify.RefProduct, RefID: p.ID,
		Meta: map[string]interface{}{"product_id": p.ID.String(), "spotlight": string(kind)},
	})
}

// lookup finds a product that left every pool (unpublished, out of stock,
// photo removed) so its seller can still be told.
func (s *SpotlightService) lookup(id uuid.UUID) *models.PublicProductResponse {
	p, err := s.repo.GetPublicProductByID(id)
	if err != nil {
		return nil
	}
	return p
}

func spotlightLabel(kind spotlightKind) string {
	switch kind {
	case spotlightOffer:
		return "Offres"
	case spotlightBest:
		return "Meilleures ventes"
	}
	return "Nouveautés"
}

func spotlightEnterBody(kind spotlightKind) string {
	switch kind {
	case spotlightOffer:
		return "Votre promotion est affichée dans la vedette « Offres » de l'accueil TBK."
	case spotlightBest:
		return "Grâce à la performance et à la confiance de votre boutique, ce produit est affiché dans la vedette « Meilleures ventes » de l'accueil TBK."
	}
	return "Ce nouveau produit est affiché dans la vedette « Nouveautés » de l'accueil TBK."
}

func spotlightLeaveBody(kind spotlightKind) string {
	if kind == spotlightOffer {
		return "Ce produit n'est plus dans la vedette « Offres » : la promotion est terminée, le stock est épuisé ou d'autres offres sont mieux classées."
	}
	return "Ce produit n'est plus dans la vedette « Meilleures ventes » : d'autres boutiques ont une meilleure performance, ou le produit n'est plus disponible. Améliorez vos ventes et vos avis pour y revenir."
}

// attachPhotos loads each product's photos, primary first.
func (s *SpotlightService) attachPhotos(products []*models.PublicProductResponse) error {
	if s.images == nil || len(products) == 0 {
		return nil
	}
	ids := make([]uuid.UUID, 0, len(products))
	for _, p := range products {
		ids = append(ids, p.ID)
	}
	byProduct, err := s.images.ListByProductIDs(ids)
	if err != nil {
		return err
	}
	for _, p := range products {
		p.Images = p.Images[:0]
		for _, img := range byProduct[p.ID] {
			p.Images = append(p.Images, models.ProductImageResponse{
				ID: img.ID, ProductID: img.ProductID, VariantID: img.VariantID, URL: img.URL,
				FileName: img.FileName, SortOrder: img.SortOrder, IsPrimary: img.IsPrimary, CreatedAt: img.CreatedAt,
			})
		}
	}
	return nil
}

func hasPhoto(p *models.PublicProductResponse) bool {
	for _, img := range p.Images {
		if img.URL != "" {
			return true
		}
	}
	return false
}

func discountSignature(p *models.PublicProductResponse) string {
	if !p.DiscountActive {
		return ""
	}
	return fmt.Sprintf("%s:%.2f:%.2f", p.DiscountType, p.DiscountValue, p.SellerSalePrice)
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
