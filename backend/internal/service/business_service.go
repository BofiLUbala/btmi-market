package service

import (
	"errors"
	"strings"

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

func (s *BusinessService) requireOwner(userID, businessID uuid.UUID) (*models.Business, error) {
	business, err := s.businessRepo.GetByID(businessID)
	if err != nil {
		return nil, errors.New("BUSINESS_NOT_FOUND")
	}
	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || membership == nil || membership.Role != models.MembershipRoleOwner {
		return nil, errors.New("FORBIDDEN")
	}
	return business, nil
}

func (s *BusinessService) UpdateBusiness(userID, businessID uuid.UUID, req *models.UpdateBusinessRequest) (*models.Business, error) {
	business, err := s.requireOwner(userID, businessID)
	if err != nil {
		return nil, err
	}
	if business.Status != models.BusinessStatusActive {
		return nil, errors.New("BUSINESS_NOT_ACTIVE")
	}
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return nil, errors.New("INVALID_BUSINESS_NAME")
		}
		business.Name = name
	}
	if req.BusinessType != nil {
		business.BusinessType = models.BusinessType(*req.BusinessType)
	}
	if req.Category != nil {
		business.Category = strings.TrimSpace(*req.Category)
	}
	if req.Phone != nil {
		business.Phone = strings.TrimSpace(*req.Phone)
	}
	if req.Whatsapp != nil {
		business.Whatsapp = strings.TrimSpace(*req.Whatsapp)
	}
	if req.Email != nil {
		business.Email = strings.TrimSpace(*req.Email)
	}
	if req.Country != nil {
		business.Country = strings.TrimSpace(*req.Country)
	}
	if req.City != nil {
		business.City = strings.TrimSpace(*req.City)
	}
	if req.DefaultCurrency != nil {
		business.DefaultCurrency = *req.DefaultCurrency
	}
	_, err = s.db.Exec(`UPDATE businesses SET name=$2, business_type=$3, category=$4, phone=$5, whatsapp=$6, email=$7, country=$8, city=$9, default_currency=$10, updated_at=NOW() WHERE id=$1`, business.ID, business.Name, business.BusinessType, business.Category, business.Phone, business.Whatsapp, business.Email, business.Country, business.City, business.DefaultCurrency)
	if err != nil {
		return nil, err
	}
	return s.businessRepo.GetByID(businessID)
}

func (s *BusinessService) lifecycleSummary(db *database.DB, businessID uuid.UUID) (*models.BusinessLifecycleSummary, error) {
	result := &models.BusinessLifecycleSummary{ShopSummaries: []models.BusinessShopSummary{}}
	err := db.QueryRow(`SELECT
		(SELECT COUNT(*) FROM shops WHERE business_id=$1 AND status='ACTIVE'),
		(SELECT COUNT(*) FROM products WHERE business_id=$1 AND status='ACTIVE'),
		(SELECT COUNT(*) FROM employees WHERE business_id=$1 AND status='ACTIVE'),
		(SELECT COALESCE(SUM(i.quantity),0) FROM inventory i JOIN shops s ON s.id=i.shop_id WHERE s.business_id=$1 AND s.status='ACTIVE'),
		(SELECT COUNT(*) FROM orders WHERE business_id=$1 AND status NOT IN ('COMPLETED','CANCELLED','REJECTED')),
		(SELECT COUNT(*) FROM orders WHERE business_id=$1),
		(SELECT COUNT(*) FROM buyer_payments WHERE business_id=$1 AND status NOT IN ('VERIFIED','CANCELLED'))`, businessID).Scan(&result.Shops, &result.Products, &result.Employees, &result.InventoryUnits, &result.ActiveOrders, &result.HistoricalOrders, &result.UnresolvedPayments)
	if err != nil {
		return nil, err
	}
	rows, err := db.Query(`SELECT s.id,s.name,s.status,COUNT(DISTINCT i.product_id) FROM shops s LEFT JOIN inventory i ON i.shop_id=s.id WHERE s.business_id=$1 AND s.status='ACTIVE' GROUP BY s.id ORDER BY s.created_at`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var item models.BusinessShopSummary
		if err := rows.Scan(&item.ID, &item.Name, &item.Status, &item.ProductCount); err != nil {
			return nil, err
		}
		result.ShopSummaries = append(result.ShopSummaries, item)
	}
	return result, rows.Err()
}

func (s *BusinessService) GetLifecycleSummary(userID, businessID uuid.UUID) (*models.BusinessLifecycleSummary, error) {
	if _, err := s.requireOwner(userID, businessID); err != nil {
		return nil, err
	}
	return s.lifecycleSummary(s.db, businessID)
}

func (s *BusinessService) ArchiveBusiness(userID, businessID uuid.UUID, confirmName string) (*models.ArchiveBusinessResponse, error) {
	business, err := s.requireOwner(userID, businessID)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(confirmName) != business.Name {
		return nil, errors.New("BUSINESS_NAME_MISMATCH")
	}
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	db := &database.DB{Tx: tx}
	var lockedStatus string
	if err := tx.QueryRow(`SELECT status FROM businesses WHERE id=$1 FOR UPDATE`, businessID).Scan(&lockedStatus); err != nil {
		return nil, err
	}
	if lockedStatus != string(models.BusinessStatusActive) {
		return nil, errors.New("BUSINESS_NOT_ACTIVE")
	}
	summary, err := s.lifecycleSummary(db, businessID)
	if err != nil {
		return nil, err
	}
	if summary.ActiveOrders > 0 {
		return nil, errors.New("ACTIVE_ORDERS_BLOCK_ARCHIVE")
	}
	if summary.UnresolvedPayments > 0 {
		return nil, errors.New("UNRESOLVED_PAYMENTS_BLOCK_ARCHIVE")
	}
	statements := []string{
		`UPDATE businesses SET status='DEACTIVATED',updated_at=NOW() WHERE id=$1`,
		`UPDATE shops SET status='INACTIVE',updated_at=NOW() WHERE business_id=$1`,
		`UPDATE products SET status='INACTIVE',publication_status='DRAFT',updated_at=NOW() WHERE business_id=$1`,
		`UPDATE employee_shop_assignments esa SET status='INACTIVE',updated_at=NOW() FROM shops s WHERE esa.shop_id=s.id AND s.business_id=$1`,
		`UPDATE employees SET status='INACTIVE',updated_at=NOW() WHERE business_id=$1`,
		`UPDATE business_memberships SET status='REMOVED',updated_at=NOW() WHERE business_id=$1 AND role <> 'OWNER'`,
	}
	for _, statement := range statements {
		if _, err := tx.Exec(statement, businessID); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &models.ArchiveBusinessResponse{Action: "archived", Summary: *summary}, nil
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
