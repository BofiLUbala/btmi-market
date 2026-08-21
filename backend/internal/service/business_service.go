package service

import (
	"errors"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type BusinessService struct {
	userRepo       *repository.UserRepository
	businessRepo   *repository.BusinessRepository
	membershipRepo *repository.MembershipRepository
	db             *database.DB
}

func NewBusinessService(
	userRepo *repository.UserRepository,
	businessRepo *repository.BusinessRepository,
	membershipRepo *repository.MembershipRepository,
	db *database.DB,
) *BusinessService {
	return &BusinessService{
		userRepo:       userRepo,
		businessRepo:   businessRepo,
		membershipRepo: membershipRepo,
		db:             db,
	}
}

func (s *BusinessService) CreateBusiness(userID uuid.UUID, req *models.CreateBusinessRequest) (*models.Business, error) {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, errors.New("USER_NOT_FOUND")
	}

	if user.Status != models.UserStatusActive || !user.EmailVerified {
		return nil, errors.New("ACCOUNT_NOT_ACTIVATED")
	}

	if user.AccountType != models.AccountTypeSeller {
		return nil, errors.New("FORBIDDEN")
	}

	business := &models.Business{
		Name:            req.Name,
		BusinessType:    models.BusinessType(req.BusinessType),
		Category:        req.Category,
		Phone:           req.Phone,
		Whatsapp:        req.Whatsapp,
		Email:           req.Email,
		Country:         req.Country,
		City:            req.City,
		DefaultCurrency: req.DefaultCurrency,
		Status:          models.BusinessStatusActive,
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	businessRepo := repository.NewBusinessRepository(&database.DB{Tx: tx})
	membershipRepo := repository.NewMembershipRepository(&database.DB{Tx: tx})

	if err := businessRepo.Create(business); err != nil {
		return nil, err
	}

	membership := &models.BusinessMembership{
		UserID:     userID,
		BusinessID: business.ID,
		Role:       models.MembershipRoleOwner,
		Status:     models.MembershipStatusActive,
	}

	if err := membershipRepo.Create(membership); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return business, nil
}

func (s *BusinessService) GetUserBusinesses(userID uuid.UUID) ([]*models.Business, error) {
	return s.businessRepo.GetByUserID(userID)
}

func (s *BusinessService) GetBusinessByID(userID, businessID uuid.UUID) (*models.Business, error) {
	business, err := s.businessRepo.GetByID(businessID)
	if err != nil {
		return nil, errors.New("BUSINESS_NOT_FOUND")
	}

	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil {
		return nil, errors.New("FORBIDDEN")
	}

	if membership == nil {
		return nil, errors.New("FORBIDDEN")
	}

	return business, nil
}
