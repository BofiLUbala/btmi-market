package service

import (
	"errors"
	"fmt"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type BuyerProfileService struct {
	buyerRepo   *repository.BuyerProfileRepository
	userRepo    *repository.UserRepository
	pointRepo   *repository.PointAccountRepository
	levelRepo   *repository.LevelRepository
}

func NewBuyerProfileService(
	buyerRepo *repository.BuyerProfileRepository,
	userRepo *repository.UserRepository,
	pointRepo *repository.PointAccountRepository,
	levelRepo *repository.LevelRepository,
) *BuyerProfileService {
	return &BuyerProfileService{
		buyerRepo: buyerRepo,
		userRepo:  userRepo,
		pointRepo: pointRepo,
		levelRepo: levelRepo,
	}
}

func (s *BuyerProfileService) CreateProfile(userID uuid.UUID, req *models.CreateBuyerProfileRequest) (*models.BuyerProfileResponse, error) {
	existing, err := s.buyerRepo.GetByUserID(userID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, errors.New("BUYER_PROFILE_EXISTS")
	}

	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, errors.New("USER_NOT_FOUND")
	}

	profile := &models.BuyerProfile{
		UserID:    userID,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Phone:     req.Phone,
		Email:     req.Email,
		City:      req.City,
		Commune:   req.Commune,
		Status:    models.BuyerProfileStatusActive,
	}

	if err := s.buyerRepo.Create(profile); err != nil {
		return nil, fmt.Errorf("failed to create buyer profile: %w", err)
	}

	// Auto-create point account with buyer level
	buyerLevel, _ := s.levelRepo.GetBuyerLevelByName("BRONZE")
	account := &models.PointAccount{
		OwnerType: models.PointOwnerTypeBuyer,
		OwnerID:   profile.ID,
		LevelID:   &buyerLevel.ID,
	}
	_ = s.pointRepo.CreateOrUpdate(account)

	_ = user // suppress unused

	return &models.BuyerProfileResponse{
		ID:        profile.ID,
		UserID:    profile.UserID,
		FirstName: profile.FirstName,
		LastName:  profile.LastName,
		Phone:     profile.Phone,
		Email:     profile.Email,
		City:      profile.City,
		Commune:   profile.Commune,
		Status:    string(profile.Status),
		CreatedAt: profile.CreatedAt,
		UpdatedAt: profile.UpdatedAt,
	}, nil
}

func (s *BuyerProfileService) GetProfile(userID uuid.UUID) (*models.BuyerProfileViewResponse, error) {
	profile, err := s.buyerRepo.GetByUserID(userID)
	if err != nil {
		return nil, errors.New("BUYER_PROFILE_NOT_FOUND")
	}
	if profile == nil {
		return nil, errors.New("BUYER_PROFILE_NOT_FOUND")
	}

	account, _ := s.pointRepo.GetByOwner(models.PointOwnerTypeBuyer, profile.ID)
	
	currentPoints := 0
	lifetimePoints := 0
	currentLevel := "BRONZE"
	progressToNext := 0.0

	if account != nil {
		currentPoints = account.CurrentPoints
		lifetimePoints = account.LifetimePoints

		if account.LevelID != nil {
			level, _ := s.levelRepo.GetBuyerLevelByID(*account.LevelID)
			if level != nil {
				currentLevel = level.Name
			}
		}

		buyerLevel, _ := s.levelRepo.GetBuyerLevelByPoints(lifetimePoints)
		if buyerLevel != nil {
			currentLevel = buyerLevel.Name
		}

		nextLevel, _ := s.levelRepo.GetBuyerNextLevel(lifetimePoints)
		if nextLevel != nil {
			progressToNext = float64(lifetimePoints-nextLevel.MinPoints) / float64(nextLevel.MaxPoints-nextLevel.MinPoints+1) * 100
		}
	}

	verifiedPurchases, _ := s.buyerRepo.CountVerifiedPurchases(profile.ID)
	allPurchases, _ := s.buyerRepo.CountAllPurchases(profile.ID)

	buyerLevel, _ := s.levelRepo.GetBuyerLevelByName(currentLevel)
	var benefits []models.LevelBenefitInfo
	if buyerLevel != nil {
		levelBenefits, _ := s.levelRepo.GetBenefitsByLevel("BUYER", currentLevel)
		for _, b := range levelBenefits {
			benefits = append(benefits, models.LevelBenefitInfo{
				BenefitType:  b.BenefitType,
				BenefitValue: b.BenefitValue,
			})
		}
	}

	return &models.BuyerProfileViewResponse{
		Profile: models.BuyerProfileResponse{
			ID:        profile.ID,
			UserID:    profile.UserID,
			FirstName: profile.FirstName,
			LastName:  profile.LastName,
			Phone:     profile.Phone,
			Email:     profile.Email,
			City:      profile.City,
			Commune:   profile.Commune,
			Status:    string(profile.Status),
			CreatedAt: profile.CreatedAt,
			UpdatedAt: profile.UpdatedAt,
		},
		CurrentPoints:      currentPoints,
		LifetimePoints:     lifetimePoints,
		CurrentLevel:       currentLevel,
		ProgressToNext:     progressToNext,
		VerifiedPurchases:  verifiedPurchases,
		PurchaseHistory:    allPurchases,
		AvailableBenefits:  benefits,
	}, nil
}

func (s *BuyerProfileService) UpdateProfile(userID uuid.UUID, req *models.UpdateBuyerProfileRequest) (*models.BuyerProfileResponse, error) {
	profile, err := s.buyerRepo.GetByUserID(userID)
	if err != nil {
		return nil, errors.New("BUYER_PROFILE_NOT_FOUND")
	}
	if profile == nil {
		return nil, errors.New("BUYER_PROFILE_NOT_FOUND")
	}

	if err := s.buyerRepo.UpdateFromRequest(userID, req); err != nil {
		return nil, fmt.Errorf("failed to update buyer profile: %w", err)
	}

	// Re-fetch to get updated values
	profile, err = s.buyerRepo.GetByUserID(userID)
	if err != nil {
		return nil, err
	}

	return &models.BuyerProfileResponse{
		ID:        profile.ID,
		UserID:    profile.UserID,
		FirstName: profile.FirstName,
		LastName:  profile.LastName,
		Phone:     profile.Phone,
		Email:     profile.Email,
		City:      profile.City,
		Commune:   profile.Commune,
		Status:    string(profile.Status),
		CreatedAt: profile.CreatedAt,
		UpdatedAt: profile.UpdatedAt,
	}, nil
}

func (s *BuyerProfileService) GetProfileByID(buyerProfileID uuid.UUID) (*models.BuyerProfile, error) {
	return s.buyerRepo.GetByID(buyerProfileID)
}

func (s *BuyerProfileService) GetProfileByIDFromUser(userID uuid.UUID) (*models.BuyerProfile, error) {
	return s.buyerRepo.GetByUserID(userID)
}

func (s *BuyerProfileService) GetOrCreateByUserID(userID uuid.UUID) (*models.BuyerProfile, error) {
	profile, err := s.buyerRepo.GetByUserID(userID)
	if err != nil {
		return nil, err
	}
	if profile != nil {
		return profile, nil
	}

	// Auto-create from user data
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, errors.New("USER_NOT_FOUND")
	}

	newProfile := &models.BuyerProfile{
		UserID:    userID,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Phone:     user.Phone,
		Email:     user.Email,
		City:      "",
		Commune:   "",
		Status:    models.BuyerProfileStatusActive,
	}

	if err := s.buyerRepo.Create(newProfile); err != nil {
		return nil, fmt.Errorf("failed to auto-create buyer profile: %w", err)
	}

	return newProfile, nil
}
