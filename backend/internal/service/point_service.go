package service

import (
	"errors"
	"fmt"
	"math"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type PointService struct {
	pointRepo *repository.PointAccountRepository
	txRepo    *repository.PointTransactionRepository
	levelRepo *repository.LevelRepository
	buyerRepo *repository.BuyerProfileRepository
}

func NewPointService(
	pointRepo *repository.PointAccountRepository,
	txRepo *repository.PointTransactionRepository,
	levelRepo *repository.LevelRepository,
	buyerRepo *repository.BuyerProfileRepository,
) *PointService {
	return &PointService{
		pointRepo: pointRepo,
		txRepo:    txRepo,
		levelRepo: levelRepo,
		buyerRepo: buyerRepo,
	}
}

const PointsPerCDF = 1000.0

func (s *PointService) AwardPoints(
	ownerType models.PointOwnerType,
	ownerID uuid.UUID,
	referenceType models.PointTransactionReferenceType,
	referenceID uuid.UUID,
	amount float64,
) (int, error) {
	return s.awardPointsAtRate(ownerType, ownerID, referenceType, referenceID, amount, PointsPerCDF)
}

// AwardPointsAtRate is the configurable variant of AwardPoints: amount / rate = points.
func (s *PointService) AwardPointsAtRate(
	ownerType models.PointOwnerType,
	ownerID uuid.UUID,
	referenceType models.PointTransactionReferenceType,
	referenceID uuid.UUID,
	amount float64,
	rate float64,
) (int, error) {
	if rate <= 0 {
		rate = PointsPerCDF
	}
	return s.awardPointsAtRate(ownerType, ownerID, referenceType, referenceID, amount, rate)
}

func (s *PointService) awardPointsAtRate(
	ownerType models.PointOwnerType,
	ownerID uuid.UUID,
	referenceType models.PointTransactionReferenceType,
	referenceID uuid.UUID,
	amount float64,
	rate float64,
) (int, error) {
	points := int(amount / rate)
	if points <= 0 {
		return 0, nil
	}

	// Get or create account
	account, err := s.pointRepo.GetByOwner(ownerType, ownerID)
	if err != nil {
		return 0, err
	}
	if account == nil {
		account = &models.PointAccount{
			OwnerType:      ownerType,
			OwnerID:        ownerID,
			CurrentPoints:  0,
			LifetimePoints: 0,
			Status:         "ACTIVE",
		}
		if err := s.pointRepo.CreateOrUpdate(account); err != nil {
			return 0, err
		}
	}

	// Idempotency check: never award twice for the same owner + transaction
	exists, err := s.txRepo.ExistsByReference(account.ID, string(referenceType), referenceID, string(models.PointTransactionTypeCredit))
	if err != nil {
		return 0, err
	}
	if exists {
		return 0, errors.New("POINTS_ALREADY_AWARDED")
	}

	previousPoints := account.CurrentPoints
	newPoints := previousPoints + points

	// Create transaction record
	txn := &models.PointTransaction{
		PointAccountID: account.ID,
		ReferenceType:  referenceType,
		ReferenceID:    referenceID,
		Type:           models.PointTransactionTypeCredit,
		PointsChange:   points,
		PreviousPoints: previousPoints,
		NewPoints:      newPoints,
	}

	if err := s.txRepo.Create(txn); err != nil {
		return 0, err
	}

	// Update account
	if err := s.pointRepo.UpdatePoints(account.ID, newPoints, account.LifetimePoints+points, account.ReservedPoints); err != nil {
		return 0, err
	}

	// Update level
	if err := s.updateLevel(ownerType, account.ID, newPoints, account.LifetimePoints+points); err != nil {
		return 0, err
	}

	return points, nil
}

func (s *PointService) DebitPoints(
	ownerType models.PointOwnerType,
	ownerID uuid.UUID,
	referenceType models.PointTransactionReferenceType,
	referenceID uuid.UUID,
	points int,
) error {
	account, err := s.pointRepo.GetByOwner(ownerType, ownerID)
	if err != nil || account == nil {
		return errors.New("NO_POINT_ACCOUNT")
	}

	previousPoints := account.CurrentPoints
	newPoints := previousPoints - points
	if newPoints < 0 {
		newPoints = 0
	}

	txn := &models.PointTransaction{
		PointAccountID: account.ID,
		ReferenceType:  referenceType,
		ReferenceID:    referenceID,
		Type:           models.PointTransactionTypeDebit,
		PointsChange:   points,
		PreviousPoints: previousPoints,
		NewPoints:      newPoints,
	}

	if err := s.txRepo.Create(txn); err != nil {
		return err
	}

	if err := s.pointRepo.UpdatePoints(account.ID, newPoints, account.LifetimePoints, account.ReservedPoints); err != nil {
		return err
	}

	if err := s.updateLevel(ownerType, account.ID, newPoints, account.LifetimePoints); err != nil {
		return err
	}

	return nil
}

func (s *PointService) GetAccount(ownerType models.PointOwnerType, ownerID uuid.UUID) (*models.PointAccount, error) {
	return s.pointRepo.GetByOwner(ownerType, ownerID)
}

func (s *PointService) GetHistory(ownerType models.PointOwnerType, ownerID uuid.UUID, page, limit int) (*models.PointHistoryResponse, error) {
	account, err := s.pointRepo.GetByOwner(ownerType, ownerID)
	if err != nil {
		return nil, err
	}
	if account == nil && ownerType == models.PointOwnerTypeBuyer {
		return &models.PointHistoryResponse{
			Account:      models.PointAccountResponse{OwnerType: string(ownerType), OwnerID: ownerID, Status: "ACTIVE"},
			Transactions: []models.PointTransactionResponse{},
			LevelName:    "BRONZE",
		}, nil
	}
	if account == nil {
		return nil, errors.New("NO_POINT_ACCOUNT")
	}

	txns, err := s.txRepo.GetByAccountID(account.ID, limit, (page-1)*limit)
	if err != nil {
		return nil, err
	}

	levelName := "BRONZE"
	var nextLevel interface{}

	if ownerType == models.PointOwnerTypeBuyer {
		bl, _ := s.levelRepo.GetBuyerLevelByPoints(account.LifetimePoints)
		if bl != nil {
			levelName = bl.Name
		}
		nl, _ := s.levelRepo.GetBuyerNextLevel(account.LifetimePoints)
		if nl != nil {
			progress := 0.0
			if nl.MaxPoints > nl.MinPoints {
				progress = float64(account.LifetimePoints-nl.MinPoints) / float64(nl.MaxPoints-nl.MinPoints) * 100
			}
			nextLevel = &models.BuyerLevelInfo{
				Name:            nl.Name,
				MinPoints:       nl.MinPoints,
				MaxPoints:       nl.MaxPoints,
				DiscountPercent: nl.DiscountPercent,
				FreeDelivery:    nl.FreeDelivery,
				ProgressToNext:  progress,
			}
		}
	} else {
		sl, _ := s.levelRepo.GetSellerLevelByPoints(account.CurrentPoints)
		if sl != nil {
			levelName = sl.Name
		}
		nl, _ := s.levelRepo.GetSellerNextLevel(account.CurrentPoints)
		if nl != nil {
			progress := 0.0
			if nl.MaxPoints > nl.MinPoints {
				progress = float64(account.CurrentPoints-nl.MinPoints) / float64(nl.MaxPoints-nl.MinPoints) * 100
			}
			nextLevel = &models.SellerLevelInfo{
				Name:                   nl.Name,
				MinPoints:              nl.MinPoints,
				MaxPoints:              nl.MaxPoints,
				SearchBoost:            nl.SearchBoost,
				RecommendationEligible: nl.RecommendationEligible,
				HighValueBuyerAccess:   nl.HighValueBuyerAccess,
				ProgressToNext:         progress,
			}
		}
	}

	var txnResponses []models.PointTransactionResponse
	for _, t := range txns {
		txnResponses = append(txnResponses, models.PointTransactionResponse{
			ID:             t.ID,
			ReferenceType:  string(t.ReferenceType),
			ReferenceID:    t.ReferenceID,
			Type:           string(t.Type),
			PointsChange:   t.PointsChange,
			PreviousPoints: t.PreviousPoints,
			NewPoints:      t.NewPoints,
			CreatedAt:      t.CreatedAt,
		})
	}

	resp := &models.PointHistoryResponse{
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
		Transactions: txnResponses,
		LevelName:    levelName,
	}

	if ownerType == models.PointOwnerTypeBuyer {
		if bl, ok := nextLevel.(*models.BuyerLevelInfo); ok {
			resp.BuyerNextLevel = bl
		}
	} else {
		if sl, ok := nextLevel.(*models.SellerLevelInfo); ok {
			resp.NextLevel = sl
		}
	}

	return resp, nil
}

func (s *PointService) updateLevel(ownerType models.PointOwnerType, accountID uuid.UUID, currentPoints int, lifetimePoints int) error {
	var levelID uuid.UUID

	if ownerType == models.PointOwnerTypeBuyer {
		level, err := s.levelRepo.GetBuyerLevelByPoints(lifetimePoints)
		if err != nil || level == nil {
			return fmt.Errorf("no buyer level found for %d lifetime points", lifetimePoints)
		}
		levelID = level.ID
	} else {
		level, err := s.levelRepo.GetSellerLevelByPoints(currentPoints)
		if err != nil || level == nil {
			return fmt.Errorf("no seller level found for %d points", currentPoints)
		}
		levelID = level.ID
	}

	return s.pointRepo.UpdateLevel(accountID, levelID)
}

func (s *PointService) GetLevelByID(levelID uuid.UUID) (*models.BuyerLevel, error) {
	return s.levelRepo.GetBuyerLevelByID(levelID)
}

func (s *PointService) GetBuyerPriceWithBenefit(basePrice float64, buyerProfileID uuid.UUID) (*models.BuyerPriceResponse, error) {
	profile, err := s.buyerRepo.GetByID(buyerProfileID)
	if err != nil {
		return nil, err
	}

	account, _ := s.pointRepo.GetByOwner(models.PointOwnerTypeBuyer, profile.ID)

	levelName := "BRONZE"
	discountPercent := 0.0
	freeDelivery := false
	deliveryDiscount := 0.0

	if account != nil {
		bl, _ := s.levelRepo.GetBuyerLevelByPoints(account.LifetimePoints)
		if bl != nil {
			levelName = bl.Name
			discountPercent = bl.DiscountPercent
			freeDelivery = bl.FreeDelivery
			deliveryDiscount = bl.DeliveryDiscountPercent
		}
	}

	discountAmount := math.Round(basePrice * discountPercent / 100)
	finalPrice := basePrice - discountAmount
	if finalPrice < 0 {
		finalPrice = 0
	}

	return &models.BuyerPriceResponse{
		BasePrice:        basePrice,
		BuyerLevel:       levelName,
		DiscountPercent:  discountPercent,
		DiscountAmount:   discountAmount,
		FinalPrice:       finalPrice,
		FreeDelivery:     freeDelivery,
		DeliveryDiscount: deliveryDiscount,
	}, nil
}
