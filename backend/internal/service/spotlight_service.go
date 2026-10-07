package service

import (
	"context"
	"fmt"
	"log"
	"math"
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
	spotlightPoolSize = 20
	// "Nouveautés" keeps the 30 newest listings: each new one pushes the
	// oldest out (first in, first out) and the slot loops through them.
	spotlightNewestSize = 30
	// "Offres" shows every running discount (up to this many).
	spotlightOffersMax = 200
	// A product published within this window counts as a recent push.
	spotlightRecentWindow = 14 * 24 * time.Hour
	spotlightRefresh      = 2 * time.Minute
	spotlightMaxProducts  = 500
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
// background every two minutes from the whole catalogue:
//   - new: the 30 newest listings, first in first out, looped through;
//   - offer: every running discount, the deepest first;
//   - best: the products of the best-performing seller, scored from the
//     marketplace ranking (points, level, trust), the buyers' stars and
//     review count, and the products pushed recently. It stays that seller's
//     until another one overtakes them.
//
// Listings with the seller's own photo come first; there is no stock picture
// and no placeholder: an empty pool is simply not shown. Sellers are told
// when their products enter or leave a spotlight (see notifyChanges).
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
		if p.Availability != "OUT_OF_STOCK" {
			inStock = append(inStock, p)
		}
	}
	// The seller's own photo first: a listing without one only fills in
	// when nothing else qualifies (it shows its category icon, never a
	// stock picture).
	photosFirst := func(list []*models.PublicProductResponse) {
		sort.SliceStable(list, func(i, j int) bool { return hasPhoto(list[i]) && !hasPhoto(list[j]) })
	}

	// Seller performance across the whole system, per business: the
	// ranking score (points boosted by level, halved for low trust), the
	// buyers' stars weighted by how many reviews back them, and how many
	// products the seller pushed to the market recently.
	type perf struct {
		shop, stars, reviews float64
		recent               int
		trust                string
	}
	perfs := map[uuid.UUID]*perf{}
	for _, p := range inStock {
		pf := perfs[p.BusinessID]
		if pf == nil {
			shop, err := s.ranking.CalculateShopScore(p.BusinessID)
			if err != nil {
				shop = 0
			}
			pf = &perf{shop: shop, trust: p.SellerTrust}
			perfs[p.BusinessID] = pf
		}
		if p.TotalReviews > 0 {
			pf.stars += p.AverageRating * float64(p.TotalReviews)
			pf.reviews += float64(p.TotalReviews)
		}
		if now.Sub(p.CreatedAt) <= spotlightRecentWindow {
			pf.recent++
		}
	}
	scores := map[uuid.UUID]float64{}
	for id, pf := range perfs {
		if pf.trust == "LOW" || pf.trust == "SUSPENDED" {
			continue
		}
		score := pf.shop
		if pf.reviews > 0 {
			score += (pf.stars / pf.reviews) * 20 * math.Log1p(pf.reviews)
		}
		score += float64(pf.recent) * 10
		if score > 0 {
			scores[id] = score
		}
	}
	// Nouveautés: the 30 newest (the list is newest first), FIFO.
	newest := append([]*models.PublicProductResponse(nil), take(inStock, spotlightNewestSize)...)
	photosFirst(newest)

	// Offres: every running discount, the deepest first.
	var offers []*models.PublicProductResponse
	for _, p := range inStock {
		if discountRunning(p, now) {
			offers = append(offers, p)
		}
	}
	sort.SliceStable(offers, func(i, j int) bool { return discountDepth(offers[i]) > discountDepth(offers[j]) })
	photosFirst(offers)
	offers = take(offers, spotlightOffersMax)

	// Meilleures ventes: the products of the best-performing seller only. The
	// slot stays theirs until another seller's score overtakes it.
	var top uuid.UUID
	topScore := 0.0
	for id, score := range scores {
		if score > topScore {
			top, topScore = id, score
		}
	}
	var best []*models.PublicProductResponse
	for _, p := range inStock {
		if top != uuid.Nil && p.BusinessID == top {
			best = append(best, p)
		}
	}
	sort.SliceStable(best, func(i, j int) bool {
		if best[i].AverageRating != best[j].AverageRating {
			return best[i].AverageRating > best[j].AverageRating
		}
		return best[i].TotalReviews > best[j].TotalReviews
	})
	photosFirst(best)
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

// discountDepth is a discount's size as a share of the regular price, so a
// percentage and a fixed amount compare.
func discountDepth(p *models.PublicProductResponse) float64 {
	if p.BasePrice <= 0 {
		return 0
	}
	return (p.BasePrice - p.SellerSalePrice) / p.BasePrice
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
		RotateSeconds:  SpotlightRotateSeconds,
		NextRotationAt: time.Unix(int64(slot+1)*SpotlightRotateSeconds, 0).UTC(),
	}
	// Never the same product in two spotlights at once: the offer and the
	// best seller's product first, "Nouveautés" takes another new listing.
	avoid := map[uuid.UUID]bool{}
	out.Offer = pick(s.offers, slot, avoid)
	if out.Offer != nil {
		avoid[out.Offer.ID] = true
	}
	out.Best = pick(s.best, slot, avoid)
	if out.Best != nil {
		avoid[out.Best.ID] = true
	}
	out.New = pick(s.newest, slot, avoid)
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
