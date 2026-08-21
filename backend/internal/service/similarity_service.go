package service

import (
	"context"
	"math"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type SimilarityService struct {
	productRepo  *repository.ProductRepository
	marketplaceRepo *repository.MarketplaceRepository
	categoryRepo *repository.CategoryRepository
	pointRepo    *repository.PointAccountRepository
	levelRepo    *repository.LevelRepository
	trustRepo    *repository.SellerTrustRepository
}

func NewSimilarityService(
	productRepo *repository.ProductRepository,
	marketplaceRepo *repository.MarketplaceRepository,
	categoryRepo *repository.CategoryRepository,
	pointRepo *repository.PointAccountRepository,
	levelRepo *repository.LevelRepository,
	trustRepo *repository.SellerTrustRepository,
) *SimilarityService {
	return &SimilarityService{
		productRepo:      productRepo,
		marketplaceRepo:  marketplaceRepo,
		categoryRepo:     categoryRepo,
		pointRepo:        pointRepo,
		levelRepo:        levelRepo,
		trustRepo:        trustRepo,
	}
}

func (s *SimilarityService) CalculateProductSimilarity(ctx context.Context, productID uuid.UUID, limit int) ([]*SimilarProductResult, error) {
	sourceProduct, err := s.productRepo.GetByID(productID)
	if err != nil {
		return nil, err
	}
	if sourceProduct == nil {
		return nil, nil
	}

	candidates, err := s.getSimilarityCandidates(ctx, sourceProduct)
	if err != nil {
		return nil, err
	}

	if len(candidates) == 0 {
		return []*SimilarProductResult{}, nil
	}

	var results []*SimilarProductResult
	for _, candidate := range candidates {
		if candidate.ID == productID {
			continue
		}

		similarityScore := s.calculateSimilarityScore(sourceProduct, candidate)
		if similarityScore < 10 {
			continue
		}

		sellerScore := s.calculateSellerRankingScore(candidate.BusinessID)
		finalScore := similarityScore*0.7 + sellerScore*0.3

		price := candidate.UnitPrice
		availability := "OUT_OF_STOCK"
		if candidate.Variants != nil {
			for _, v := range candidate.Variants {
				if v.Stock == "AVAILABLE" || v.Stock == "LOW_STOCK" {
					availability = v.Stock
					break
				}
			}
		}

		results = append(results, &SimilarProductResult{
			ProductID:       candidate.ID,
			ProductName:     candidate.Name,
			ShopID:          candidate.ShopID,
			ShopName:        candidate.ShopName,
			CategoryID:      candidate.CategoryID,
			SubcategoryID:   candidate.SubcategoryID,
			BasePrice:       price,
			Availability:    availability,
			SellerLevel:     candidate.SellerLevel,
			SellerTrust:     candidate.SellerTrust,
			SimilarityScore: similarityScore,
			SellerScore:     sellerScore,
			FinalScore:      finalScore,
		})
	}

	for i := range results {
		for j := i + 1; j < len(results); j++ {
			if results[i].FinalScore < results[j].FinalScore {
				results[i], results[j] = results[j], results[i]
			}
		}
	}

	if limit > 0 && len(results) > limit {
		results = results[:limit]
	}

	return results, nil
}

func (s *SimilarityService) getSimilarityCandidates(ctx context.Context, source *models.Product) ([]*CandidateProduct, error) {
	query := `
		SELECT p.id, p.business_id, p.name, p.sku, p.description, p.unit_price, p.unit,
		       p.category_id, p.subcategory_id, p.publication_status, p.status,
		       s.id as shop_id, s.name as shop_name,
		       b.name as business_name,
		       COALESCE(sl.name, 'STARTER') as seller_level,
		       COALESCE(st.trust_status, 'NORMAL') as seller_trust
		FROM products p
		JOIN businesses b ON b.id = p.business_id
		JOIN shops s ON s.business_id = b.id AND s.status = 'ACTIVE'
		LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = b.id
		LEFT JOIN seller_levels sl ON sl.id = pa.level_id
		LEFT JOIN seller_trust st ON st.business_id = b.id
		WHERE p.publication_status = 'PUBLISHED' AND p.status = 'ACTIVE'
		AND p.category_id = $1
		AND p.id != $2
		LIMIT 500
	`

	rows, err := s.productRepo.GetDB().Query(query, source.CategoryID, source.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var candidates []*CandidateProduct
	for rows.Next() {
		c := &CandidateProduct{}
		err := rows.Scan(
			&c.ID, &c.BusinessID, &c.Name, &c.SKU, &c.Description,
			&c.UnitPrice, &c.Unit, &c.CategoryID, &c.SubcategoryID,
			&c.PublicationStatus, &c.Status,
			&c.ShopID, &c.ShopName, &c.BusinessName,
			&c.SellerLevel, &c.SellerTrust,
		)
		if err != nil {
			return nil, err
		}
		candidates = append(candidates, c)
	}

	for _, c := range candidates {
		variants, err := s.marketplaceRepo.GetVariantsForProduct(c.ID)
		if err == nil {
			c.Variants = variants
		}
	}

	return candidates, rows.Err()
}

type CandidateProduct struct {
	ID                uuid.UUID
	BusinessID        uuid.UUID
	Name              string
	SKU               string
	Description       string
	UnitPrice         float64
	Unit              string
	CategoryID        *uuid.UUID
	SubcategoryID     *uuid.UUID
	PublicationStatus string
	Status            string
	ShopID            uuid.UUID
	ShopName          string
	BusinessName      string
	SellerLevel       string
	SellerTrust       string
	Variants          []models.PublicVariantResponse
}

type SimilarProductResult struct {
	ProductID       uuid.UUID `json:"product_id"`
	ProductName     string    `json:"name"`
	ShopID          uuid.UUID `json:"shop_id"`
	ShopName        string    `json:"shop_name"`
	CategoryID      *uuid.UUID `json:"category_id,omitempty"`
	SubcategoryID   *uuid.UUID `json:"subcategory_id,omitempty"`
	BasePrice       float64   `json:"base_price"`
	Availability    string    `json:"availability"`
	SellerLevel     string    `json:"seller_level"`
	SellerTrust     string    `json:"seller_trust"`
	SimilarityScore float64   `json:"similarity_score"`
	SellerScore     float64   `json:"seller_score"`
	FinalScore      float64   `json:"final_score"`
}

func (s *SimilarityService) calculateSimilarityScore(source *models.Product, candidate *CandidateProduct) float64 {
	score := 0.0

	if source.CategoryID != nil && candidate.CategoryID != nil && *source.CategoryID == *candidate.CategoryID {
		score += 40
	}

	if source.SubcategoryID != nil && candidate.SubcategoryID != nil && *source.SubcategoryID == *candidate.SubcategoryID {
		score += 30
	}

	nameScore := s.calculateNameSimilarity(source.Name, candidate.Name)
	score += nameScore * 0.3

	attrScore := s.calculateAttributeSimilarity(source, candidate)
	score += attrScore * 0.15

	priceScore := s.calculatePriceSimilarity(source.UnitPrice, candidate.UnitPrice)
	score += priceScore * 0.15

	return score
}

func (s *SimilarityService) calculateNameSimilarity(a, b string) float64 {
	a = strings.ToLower(a)
	b = strings.ToLower(b)

	if a == b {
		return 100
	}

	if strings.Contains(a, b) || strings.Contains(b, a) {
		return 80
	}

	wordsA := strings.Fields(a)
	wordsB := strings.Fields(b)

	common := 0
	for _, wa := range wordsA {
		for _, wb := range wordsB {
			if wa == wb {
				common++
				break
			}
		}
	}

	if len(wordsA) == 0 || len(wordsB) == 0 {
		return 0
	}

	ratio := float64(common) / float64(max(len(wordsA), len(wordsB)))
	return ratio * 50
}

func (s *SimilarityService) calculateAttributeSimilarity(source *models.Product, candidate *CandidateProduct) float64 {
	return 50
}

func (s *SimilarityService) calculatePriceSimilarity(a, b float64) float64 {
	if a == 0 && b == 0 {
		return 100
	}
	if a == 0 || b == 0 {
		return 0
	}

	ratio := math.Min(a, b) / math.Max(a, b)
	if ratio > 0.7 {
		return 100
	}
	if ratio > 0.5 {
		return 60
	}
	if ratio > 0.3 {
		return 30
	}
	return 10
}

func (s *SimilarityService) calculateSellerRankingScore(businessID uuid.UUID) float64 {
	account, err := s.pointRepo.GetByOwner(models.PointOwnerTypeSellerBusiness, businessID)
	if err != nil || account == nil {
		return 0
	}

	points := account.CurrentPoints
	searchBoost := 0.0

	if account.LevelID != nil {
		level, err := s.levelRepo.GetSellerLevelByID(*account.LevelID)
		if err == nil && level != nil {
			searchBoost = level.SearchBoost
		}
	}

	fallbackLevel, _ := s.levelRepo.GetSellerLevelByPoints(points)
	if fallbackLevel != nil {
		searchBoost = fallbackLevel.SearchBoost
	}

	trust, _ := s.trustRepo.GetByBusinessID(businessID)
	trustStatus := "NORMAL"
	if trust != nil {
		trustStatus = trust.TrustStatus
	}

	benefitActive := true
	if trustStatus == "LOW" || trustStatus == "SUSPENDED" {
		benefitActive = false
	}

	score := float64(points) * (1 + searchBoost/100.0)

	if !benefitActive {
		score = float64(points) * 0.5
	}

	normalizedScore := math.Min(score/10000.0*100, 100)
	return normalizedScore
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}