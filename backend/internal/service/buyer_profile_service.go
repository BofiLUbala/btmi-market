package service

import (
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

var profilePhonePattern = regexp.MustCompile(`^\+?[0-9 ()-]+$`)

var drcProfileCities = map[string]bool{
	"Kinshasa": true, "Bandundu": true, "Baraka": true, "Beni": true, "Boende": true,
	"Bukavu": true, "Bunia": true, "Bumba": true, "Buta": true, "Butembo": true,
	"Gbadolite": true, "Gemena": true, "Goma": true, "Inongo": true, "Isiro": true,
	"Kabinda": true, "Kalemie": true, "Kamina": true, "Kananga": true, "Kenge": true,
	"Kikwit": true, "Kindu": true, "Kisangani": true, "Kolwezi": true, "Likasi": true,
	"Lisala": true, "Lodja": true, "Lubumbashi": true, "Lusambo": true, "Matadi": true,
	"Mbandaka": true, "Mbuji-Mayi": true, "Muanda": true, "Tshikapa": true, "Uvira": true, "Zongo": true,
}

var kinshasaProfileCommunes = map[string]bool{
	"Bandalungwa": true, "Barumbu": true, "Bumbu": true, "Gombe": true, "Kalamu": true,
	"Kasa-Vubu": true, "Kimbanseke": true, "Kinshasa": true, "Kintambo": true, "Kisenso": true,
	"Lemba": true, "Limete": true, "Lingwala": true, "Makala": true, "Maluku": true,
	"Masina": true, "Matete": true, "Mont-Ngafula": true, "N'Djili": true, "N'Sele": true,
	"Ngaba": true, "Ngaliema": true, "Ngiri-Ngiri": true, "Selembao": true,
}

func canonicalPhone(value string) string {
	digits := regexp.MustCompile(`\D`).ReplaceAllString(value, "")
	if len(digits) == 10 && strings.HasPrefix(digits, "0") {
		return "243" + digits[1:]
	}
	return digits
}

func validateProfileContact(phone, backup, address, city, commune string) error {
	validPhone := func(value string) bool {
		digits := canonicalPhone(value)
		return profilePhonePattern.MatchString(strings.TrimSpace(value)) && len(digits) >= 9 && len(digits) <= 15
	}
	if !validPhone(phone) {
		return errors.New("INVALID_PHONE")
	}
	if strings.TrimSpace(backup) != "" {
		if !validPhone(backup) {
			return errors.New("INVALID_BACKUP_PHONE")
		}
		if canonicalPhone(phone) == canonicalPhone(backup) {
			return errors.New("BACKUP_PHONE_SAME_AS_PRIMARY")
		}
	}
	if len(strings.TrimSpace(address)) > 500 {
		return errors.New("ADDRESS_TOO_LONG")
	}
	if city != "" && !drcProfileCities[city] {
		return errors.New("INVALID_CITY")
	}
	if city == "Kinshasa" {
		if commune != "" && !kinshasaProfileCommunes[commune] {
			return errors.New("INVALID_COMMUNE")
		}
	} else if commune != "" {
		return errors.New("INVALID_COMMUNE")
	}
	return nil
}

type BuyerProfileService struct {
	buyerRepo *repository.BuyerProfileRepository
	userRepo  *repository.UserRepository
	pointRepo *repository.PointAccountRepository
	levelRepo *repository.LevelRepository
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
	if err := validateProfileContact(req.Phone, req.BackupPhone, req.Address, req.City, req.Commune); err != nil {
		return nil, err
	}
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

	country := req.Country
	if country == "" {
		country = "DRC"
	}

	profile := &models.BuyerProfile{
		UserID:      userID,
		FirstName:   req.FirstName,
		LastName:    req.LastName,
		Phone:       req.Phone,
		BackupPhone: req.BackupPhone,
		Address:     req.Address,
		Email:       req.Email,
		City:        req.City,
		Commune:     req.Commune,
		Country:     country,
		Latitude:    req.Latitude,
		Longitude:   req.Longitude,
		Status:      models.BuyerProfileStatusActive,
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
		ID:          profile.ID,
		UserID:      profile.UserID,
		FirstName:   profile.FirstName,
		LastName:    profile.LastName,
		Phone:       profile.Phone,
		BackupPhone: profile.BackupPhone,
		Address:     profile.Address,
		Email:       profile.Email,
		City:        profile.City,
		Commune:     profile.Commune,
		Country:     profile.Country,
		Latitude:    profile.Latitude,
		Longitude:   profile.Longitude,
		Status:      string(profile.Status),
		CreatedAt:   profile.CreatedAt,
		UpdatedAt:   profile.UpdatedAt,
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
			ID:          profile.ID,
			UserID:      profile.UserID,
			FirstName:   profile.FirstName,
			LastName:    profile.LastName,
			Phone:       profile.Phone,
			BackupPhone: profile.BackupPhone,
			Address:     profile.Address,
			Email:       profile.Email,
			City:        profile.City,
			Commune:     profile.Commune,
			Country:     profile.Country,
			Latitude:    profile.Latitude,
			Longitude:   profile.Longitude,
			Status:      string(profile.Status),
			CreatedAt:   profile.CreatedAt,
			UpdatedAt:   profile.UpdatedAt,
		},
		CurrentPoints:     currentPoints,
		LifetimePoints:    lifetimePoints,
		CurrentLevel:      currentLevel,
		ProgressToNext:    progressToNext,
		VerifiedPurchases: verifiedPurchases,
		PurchaseHistory:   allPurchases,
		AvailableBenefits: benefits,
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
	phone, backup, address, city, commune := profile.Phone, profile.BackupPhone, profile.Address, profile.City, profile.Commune
	if req.Phone != nil {
		phone = strings.TrimSpace(*req.Phone)
	}
	if req.BackupPhone != nil {
		backup = strings.TrimSpace(*req.BackupPhone)
	}
	if req.Address != nil {
		address = strings.TrimSpace(*req.Address)
	}
	if req.City != nil {
		city = strings.TrimSpace(*req.City)
	}
	if req.Commune != nil {
		commune = strings.TrimSpace(*req.Commune)
	}
	if err := validateProfileContact(phone, backup, address, city, commune); err != nil {
		return nil, err
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
		ID:          profile.ID,
		UserID:      profile.UserID,
		FirstName:   profile.FirstName,
		LastName:    profile.LastName,
		Phone:       profile.Phone,
		BackupPhone: profile.BackupPhone,
		Address:     profile.Address,
		Email:       profile.Email,
		City:        profile.City,
		Commune:     profile.Commune,
		Country:     profile.Country,
		Latitude:    profile.Latitude,
		Longitude:   profile.Longitude,
		Status:      string(profile.Status),
		CreatedAt:   profile.CreatedAt,
		UpdatedAt:   profile.UpdatedAt,
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
		Country:   "DRC",
		Status:    models.BuyerProfileStatusActive,
	}

	if err := s.buyerRepo.Create(newProfile); err != nil {
		return nil, fmt.Errorf("failed to auto-create buyer profile: %w", err)
	}

	return newProfile, nil
}
