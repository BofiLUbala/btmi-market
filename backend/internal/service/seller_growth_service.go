package service

import (
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type SellerGrowthService struct {
	pointRepo  *repository.PointAccountRepository
	levelRepo  *repository.LevelRepository
	trustRepo  *repository.SellerTrustRepository
	benefitRepo *repository.LevelRepository
}

func NewSellerGrowthService(
	pointRepo *repository.PointAccountRepository,
	levelRepo *repository.LevelRepository,
	trustRepo *repository.SellerTrustRepository,
) *SellerGrowthService {
	return &SellerGrowthService{
		pointRepo:  pointRepo,
		levelRepo:  levelRepo,
		trustRepo:  trustRepo,
		benefitRepo: levelRepo,
	}
}

func (s *SellerGrowthService) GetGrowthData(businessID uuid.UUID) (*models.SellerGrowthResponse, error) {
	account, err := s.pointRepo.GetByOwner(models.PointOwnerTypeSellerBusiness, businessID)
	if err != nil {
		return nil, err
	}

	// Create default if doesn't exist
	if account == nil {
		defaultLevel, _ := s.levelRepo.GetSellerLevelByName("STARTER")
		account = &models.PointAccount{
			OwnerType:      models.PointOwnerTypeSellerBusiness,
			OwnerID:        businessID,
			CurrentPoints:  0,
			LifetimePoints: 0,
			Status:         "ACTIVE",
		}
		if defaultLevel != nil {
			account.LevelID = &defaultLevel.ID
		}
		_ = s.pointRepo.CreateOrUpdate(account)
	}

	// Get level info
	currentLevel := "STARTER"
	var levelInfo *models.SellerLevel
	if account.LevelID != nil {
		levelInfo, _ = s.levelRepo.GetSellerLevelByID(*account.LevelID)
		if levelInfo != nil {
			currentLevel = levelInfo.Name
		}
	}

	// Calculate progress to next
	progressToNext := 0.0
	nextLevel, _ := s.levelRepo.GetSellerNextLevel(account.CurrentPoints)
	if nextLevel != nil && nextLevel.MaxPoints > nextLevel.MinPoints {
		progressToNext = float64(account.CurrentPoints-nextLevel.MinPoints) / float64(nextLevel.MaxPoints-nextLevel.MinPoints) * 100
		if progressToNext > 100 {
			progressToNext = 100
		}
	}

	if levelInfo == nil {
		levelInfo = &models.SellerLevel{
			Name:                   "STARTER",
			MinPoints:              0,
			MaxPoints:              499,
			SearchBoost:            0,
			RecommendationEligible: false,
			HighValueBuyerAccess:   false,
			Description:            "Normal marketplace presence",
		}
	}

	// Get trust
	trust, _ := s.trustRepo.GetByBusinessID(businessID)
	if trust == nil {
		trust, _ = s.trustRepo.RecalculateTrust(businessID)
	}
	trustInfo := models.SellerTrustInfo{
		TrustStatus:              "NORMAL",
		VerifiedSalesCount:       0,
		OrderCompletionRate:      100,
		CancellationRate:         0,
		PurchaseConfirmationRate: 0,
		StockReliabilityRate:     100,
	}
	if trust != nil {
		trustInfo.TrustStatus = trust.TrustStatus
		trustInfo.VerifiedSalesCount = trust.VerifiedSalesCount
		trustInfo.OrderCompletionRate = trust.OrderCompletionRate
		trustInfo.CancellationRate = trust.CancellationRate
		trustInfo.PurchaseConfirmationRate = trust.PurchaseConfirmationRate
		trustInfo.StockReliabilityRate = trust.StockReliabilityRate
	}

	// Get benefits
	var benefits []models.LevelBenefitInfo
	levelBenefits, _ := s.benefitRepo.GetBenefitsByLevel("SELLER", currentLevel)
	for _, b := range levelBenefits {
		benefits = append(benefits, models.LevelBenefitInfo{
			BenefitType:  b.BenefitType,
			BenefitValue: b.BenefitValue,
		})
	}

	// Check if benefits are suspended due to trust
	highValueBuyerEligible := levelInfo.HighValueBuyerAccess
	if trust != nil && trust.TrustStatus == "LOW" || trust != nil && trust.TrustStatus == "SUSPENDED" {
		highValueBuyerEligible = false
	}

	return &models.SellerGrowthResponse{
		Points: models.PointAccountResponse{
			ID:             account.ID,
			OwnerType:      string(account.OwnerType),
			OwnerID:        account.OwnerID,
			CurrentPoints:  account.CurrentPoints,
			LifetimePoints: account.LifetimePoints,
			LevelID:        account.LevelID,
			Status:         account.Status,
			UpdatedAt:      account.UpdatedAt,
		},
		Level: models.SellerLevelInfo{
			Name:                   currentLevel,
			MinPoints:              levelInfo.MinPoints,
			MaxPoints:              levelInfo.MaxPoints,
			SearchBoost:            levelInfo.SearchBoost,
			RecommendationEligible: levelInfo.RecommendationEligible,
			HighValueBuyerAccess:   highValueBuyerEligible,
			ProgressToNext:         progressToNext,
			Description:            levelInfo.Description,
		},
		Trust: trustInfo,
		Benefits: benefits,
		HighValueBuyerEligible: highValueBuyerEligible,
	}, nil
}

func (s *SellerGrowthService) GetPointsHistory(businessID uuid.UUID, page, limit int) (*models.PointHistoryResponse, error) {
	account, err := s.pointRepo.GetByOwner(models.PointOwnerTypeSellerBusiness, businessID)
	if err != nil || account == nil {
		return nil, err
	}

	// Reuse point service logic
	levelName := "STARTER"
	if account.LevelID != nil {
		level, _ := s.levelRepo.GetSellerLevelByID(*account.LevelID)
		if level != nil {
			levelName = level.Name
		}
	}

	return &models.PointHistoryResponse{
		Account: models.PointAccountResponse{
			ID:             account.ID,
			OwnerType:      string(account.OwnerType),
			OwnerID:        account.OwnerID,
			CurrentPoints:  account.CurrentPoints,
			LifetimePoints: account.LifetimePoints,
			LevelID:        account.LevelID,
			Status:         account.Status,
			UpdatedAt:      account.UpdatedAt,
		},
		LevelName: levelName,
	}, nil
}
