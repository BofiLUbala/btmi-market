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

func derefOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func canonicalPhone(value string) string {
	digits := regexp.MustCompile(`\D`).ReplaceAllString(value, "")
	if len(digits) == 10 && strings.HasPrefix(digits, "0") {
		return "243" + digits[1:]
	}
	return digits
}

func validateProfileContact(phone, backup, address string) error {
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
	return nil
}

type BuyerProfileService struct {
	buyerRepo    *repository.BuyerProfileRepository
	userRepo     *repository.UserRepository
	pointRepo    *repository.PointAccountRepository
	levelRepo    *repository.LevelRepository
	locationRepo *repository.LocationRepository
}

// SetLocationRepository injects the RDC hierarchy. A profile address is
// validated against the same PostgreSQL rows as a checkout address, so the two
// can never disagree about which communes exist.
func (s *BuyerProfileService) SetLocationRepository(locationRepo *repository.LocationRepository) {
	s.locationRepo = locationRepo
}

// resolveProfileLocation accepts ids first and names as a fallback, and returns
// nil when the caller sent no location at all (the address stays untouched).
func (s *BuyerProfileService) resolveProfileLocation(provinceID, cityID, communeID, province, city, commune string) (*models.ResolvedAddress, error) {
	if s.locationRepo == nil {
		return nil, errors.New("LOCATION_HIERARCHY_UNAVAILABLE")
	}
	pid, errProvince := uuid.Parse(strings.TrimSpace(provinceID))
	cid, errCity := uuid.Parse(strings.TrimSpace(cityID))
	mid, errCommune := uuid.Parse(strings.TrimSpace(communeID))
	if errProvince == nil && errCity == nil && errCommune == nil {
		resolved, err := s.locationRepo.Resolve(pid, cid, mid)
		if err == repository.ErrLocationNotFound {
			return nil, errors.New("INVALID_ADDRESS_LOCATION")
		}
		return resolved, err
	}
	if strings.TrimSpace(city) == "" && strings.TrimSpace(commune) == "" {
		return nil, nil
	}
	if strings.TrimSpace(city) == "" || strings.TrimSpace(commune) == "" {
		return nil, errors.New("INVALID_ADDRESS_LOCATION")
	}
	resolved, err := s.locationRepo.ResolveByNames(strings.TrimSpace(province), strings.TrimSpace(city), strings.TrimSpace(commune))
	if err == repository.ErrLocationNotFound {
		return nil, errors.New("INVALID_ADDRESS_LOCATION")
	}
	return resolved, err
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
	if err := validateProfileContact(req.Phone, req.BackupPhone, req.Address); err != nil {
		return nil, err
	}
	resolved, err := s.resolveProfileLocation(req.ProvinceID, req.CityID, req.CommuneID, req.Province, req.City, req.Commune)
	if err != nil {
		return nil, err
	}
	existing, existingErr := s.buyerRepo.GetByUserID(userID)
	if existingErr != nil {
		return nil, existingErr
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
		Province:    req.Province, Street: req.Street, BuildingNumber: req.BuildingNumber, Landmark: req.Landmark,
		Email:     req.Email,
		City:      req.City,
		Commune:   req.Commune,
		Country:   country,
		Latitude:  req.Latitude,
		Longitude: req.Longitude,
		Status:    models.BuyerProfileStatusActive,
	}
	if resolved != nil {
		profile.Province, profile.City, profile.Commune = resolved.Province.Name, resolved.City.Name, resolved.Commune.Name
		provinceID, cityID, communeID := resolved.Province.ID, resolved.City.ID, resolved.Commune.ID
		profile.ProvinceID, profile.CityID, profile.CommuneID = &provinceID, &cityID, &communeID
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
		Province:    profile.Province, Street: profile.Street, BuildingNumber: profile.BuildingNumber, Landmark: profile.Landmark,
		Email:      profile.Email,
		City:       profile.City,
		Commune:    profile.Commune,
		ProvinceID: profile.ProvinceID,
		CityID:     profile.CityID,
		CommuneID:  profile.CommuneID,
		Country:    profile.Country,
		Latitude:   profile.Latitude,
		Longitude:  profile.Longitude,
		Status:     string(profile.Status),
		CreatedAt:  profile.CreatedAt,
		UpdatedAt:  profile.UpdatedAt,
	}, nil
}

func (s *BuyerProfileService) GetProfile(userID uuid.UUID) (*models.BuyerProfileViewResponse, error) {
	// Registration best-effort creates the profile row; auto-heal here for the
	// accounts where that failed silently, instead of 404ing forever with no
	// way for the client to ever recover.
	profile, err := s.GetOrCreateByUserID(userID)
	if err != nil {
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
			Province:    profile.Province, Street: profile.Street, BuildingNumber: profile.BuildingNumber, Landmark: profile.Landmark,
			Email:      profile.Email,
			City:       profile.City,
			Commune:    profile.Commune,
			ProvinceID: profile.ProvinceID,
			CityID:     profile.CityID,
			CommuneID:  profile.CommuneID,
			Country:    profile.Country,
			Latitude:   profile.Latitude,
			Longitude:  profile.Longitude,
			Status:     string(profile.Status),
			CreatedAt:  profile.CreatedAt,
			UpdatedAt:  profile.UpdatedAt,
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
	profile, err := s.GetOrCreateByUserID(userID)
	if err != nil {
		return nil, errors.New("BUYER_PROFILE_NOT_FOUND")
	}
	phone, backup, address := profile.Phone, profile.BackupPhone, profile.Address
	province, city, commune := profile.Province, profile.City, profile.Commune
	provinceID, cityID, communeID := "", "", ""
	if profile.ProvinceID != nil {
		provinceID, cityID, communeID = profile.ProvinceID.String(), "", ""
	}
	if profile.CityID != nil {
		cityID = profile.CityID.String()
	}
	if profile.CommuneID != nil {
		communeID = profile.CommuneID.String()
	}
	if req.Phone != nil {
		phone = strings.TrimSpace(*req.Phone)
	}
	if req.BackupPhone != nil {
		backup = strings.TrimSpace(*req.BackupPhone)
	}
	if req.Address != nil {
		address = strings.TrimSpace(*req.Address)
	}
	if req.Province != nil {
		province = strings.TrimSpace(*req.Province)
	}
	if req.City != nil {
		city = strings.TrimSpace(*req.City)
	}
	if req.Commune != nil {
		commune = strings.TrimSpace(*req.Commune)
	}
	// A changed level invalidates the ids the profile already had, so only the
	// ids sent with this request are trusted.
	if req.ProvinceID != nil || req.CityID != nil || req.CommuneID != nil {
		provinceID, cityID, communeID = derefOrEmpty(req.ProvinceID), derefOrEmpty(req.CityID), derefOrEmpty(req.CommuneID)
	} else if req.Province != nil || req.City != nil || req.Commune != nil {
		provinceID, cityID, communeID = "", "", ""
	}
	if err := validateProfileContact(phone, backup, address); err != nil {
		return nil, err
	}
	resolved, err := s.resolveProfileLocation(provinceID, cityID, communeID, province, city, commune)
	if err != nil {
		return nil, err
	}
	// Names are rewritten from the hierarchy so a stale client label cannot
	// disagree with the id it was resolved from.
	if resolved != nil {
		resolvedProvince, resolvedCity, resolvedCommune := resolved.Province.Name, resolved.City.Name, resolved.Commune.Name
		resolvedProvinceID, resolvedCityID, resolvedCommuneID := resolved.Province.ID.String(), resolved.City.ID.String(), resolved.Commune.ID.String()
		req.Province, req.City, req.Commune = &resolvedProvince, &resolvedCity, &resolvedCommune
		req.ProvinceID, req.CityID, req.CommuneID = &resolvedProvinceID, &resolvedCityID, &resolvedCommuneID
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
		Province:    profile.Province, Street: profile.Street, BuildingNumber: profile.BuildingNumber, Landmark: profile.Landmark,
		Email:      profile.Email,
		City:       profile.City,
		Commune:    profile.Commune,
		ProvinceID: profile.ProvinceID,
		CityID:     profile.CityID,
		CommuneID:  profile.CommuneID,
		Country:    profile.Country,
		Latitude:   profile.Latitude,
		Longitude:  profile.Longitude,
		Status:     string(profile.Status),
		CreatedAt:  profile.CreatedAt,
		UpdatedAt:  profile.UpdatedAt,
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
