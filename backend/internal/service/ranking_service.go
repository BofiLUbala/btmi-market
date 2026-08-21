package service

import (
	"log"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type RankingService struct {
	pointRepo  *repository.PointAccountRepository
	levelRepo  *repository.LevelRepository
	trustRepo  *repository.SellerTrustRepository
	productRepo *repository.ProductRepository
}

func NewRankingService(
	pointRepo *repository.PointAccountRepository,
	levelRepo *repository.LevelRepository,
	trustRepo *repository.SellerTrustRepository,
	productRepo *repository.ProductRepository,
) *RankingService {
	return &RankingService{
		pointRepo:   pointRepo,
		levelRepo:   levelRepo,
		trustRepo:   trustRepo,
		productRepo: productRepo,
	}
}

func (s *RankingService) CalculateShopRankingScore(businessID uuid.UUID) (float64, error) {
	account, err := s.pointRepo.GetByOwner(models.PointOwnerTypeSellerBusiness, businessID)
	if err != nil {
		log.Printf("WARN: Failed to get point account for business %s: %v", businessID, err)
		return 0, err
	}

	points := 0
	if account != nil {
		points = account.CurrentPoints
	}

	levelName := "STARTER"
	searchBoost := 0.0
	if account != nil && account.LevelID != nil {
		level, err := s.levelRepo.GetSellerLevelByID(*account.LevelID)
		if err == nil && level != nil {
			levelName = level.Name
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

	log.Printf("Ranking score for business %s: points=%d, level=%s, trust=%s, benefit_active=%v, score=%.2f",
		businessID, points, levelName, trustStatus, benefitActive, score)

	return score, nil
}

func (s *RankingService) GetEligibleCategoriesForShop(businessID, shopID uuid.UUID) ([]uuid.UUID, error) {
	products, err := s.productRepo.GetByBusinessID(businessID)
	if err != nil {
		return nil, err
	}

	categorySet := make(map[uuid.UUID]bool)
	for _, p := range products {
		if p.PublicationStatus == models.PublicationStatusPublished &&
			p.Status == models.ProductStatusActive &&
			p.CategoryID != nil && *p.CategoryID != uuid.Nil {
			categorySet[*p.CategoryID] = true
		}
	}

	categories := make([]uuid.UUID, 0, len(categorySet))
	for catID := range categorySet {
		categories = append(categories, catID)
	}

	return categories, nil
}

func (s *RankingService) GetEligibleCategoriesForShopExcluding(businessID uuid.UUID, excludeCategoryID *uuid.UUID) ([]uuid.UUID, error) {
	products, err := s.productRepo.GetByBusinessID(businessID)
	if err != nil {
		return nil, err
	}

	categorySet := make(map[uuid.UUID]bool)
	for _, p := range products {
		if p.PublicationStatus == models.PublicationStatusPublished &&
			p.Status == models.ProductStatusActive &&
			p.CategoryID != nil && *p.CategoryID != uuid.Nil {
			if excludeCategoryID != nil && *p.CategoryID == *excludeCategoryID {
				continue
			}
			categorySet[*p.CategoryID] = true
		}
	}

	categories := make([]uuid.UUID, 0, len(categorySet))
	for catID := range categorySet {
		categories = append(categories, catID)
	}

	return categories, nil
}

func (s *RankingService) IsShopEligibleForCategory(businessID uuid.UUID, categoryID uuid.UUID) (bool, error) {
	count, err := s.productRepo.CountPublishedByBusinessAndCategory(businessID, categoryID)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
