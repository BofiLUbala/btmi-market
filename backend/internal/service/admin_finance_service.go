package service

import (
	"fmt"

	"github.com/google/uuid"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
)

type AdminFinanceService struct {
	repo         *repository.AdminFinanceRepository
	auditService *AuditService
}

func NewAdminFinanceService(repo *repository.AdminFinanceRepository, auditService *AuditService) *AdminFinanceService {
	return &AdminFinanceService{
		repo:         repo,
		auditService: auditService,
	}
}

// Check RBAC permissions for Finance / Support / Trust
func (s *AdminFinanceService) checkFinanceAccess(role models.AdminRole) error {
	if role == models.AdminRoleSuperAdmin || role == models.AdminRoleFinanceSupportAdmin || role == models.AdminRoleDirectionAdmin {
		return nil
	}
	return fmt.Errorf("forbidden: role %s is not authorized to access Finance/Support/Trust resources", role)
}

func (s *AdminFinanceService) checkFinanceMutation(role models.AdminRole) error {
	if role == models.AdminRoleSuperAdmin || role == models.AdminRoleFinanceSupportAdmin {
		return nil
	}
	return fmt.Errorf("forbidden: role %s is not authorized to perform Finance/Support/Trust mutations", role)
}

// Phase 3A - Payments & Financial Summary
func (s *AdminFinanceService) GetFinancialSummary(role models.AdminRole, businessID, shopID, sellerID, dateFrom, dateTo string) (*models.AdminFinancialSummary, error) {
	if err := s.checkFinanceAccess(role); err != nil {
		return nil, err
	}
	return s.repo.GetFinancialSummary(businessID, shopID, sellerID, dateFrom, dateTo)
}

func (s *AdminFinanceService) ListPayments(role models.AdminRole, filter *models.AdminPaymentFilter) ([]models.AdminPaymentListItem, int, error) {
	if err := s.checkFinanceAccess(role); err != nil {
		return nil, 0, err
	}
	return s.repo.ListPayments(filter)
}

func (s *AdminFinanceService) GetPaymentDetail(role models.AdminRole, id uuid.UUID) (*models.AdminPaymentDetail, error) {
	if err := s.checkFinanceAccess(role); err != nil {
		return nil, err
	}
	return s.repo.GetPaymentDetail(id)
}

// Phase 3B - Buyer Points
func (s *AdminFinanceService) ListBuyerPoints(role models.AdminRole, page, limit int, search string) ([]models.AdminBuyerPointsItem, int, error) {
	if err := s.checkFinanceAccess(role); err != nil {
		return nil, 0, err
	}
	return s.repo.ListBuyerPoints(page, limit, search)
}

func (s *AdminFinanceService) GetBuyerPointHistory(role models.AdminRole, buyerID uuid.UUID) ([]models.AdminPointTransaction, error) {
	if err := s.checkFinanceAccess(role); err != nil {
		return nil, err
	}
	return s.repo.GetBuyerPointHistory(buyerID)
}

func (s *AdminFinanceService) AdjustBuyerPoints(adminID uuid.UUID, role models.AdminRole, buyerID uuid.UUID, req *models.AdminPointAdjustmentRequest, ip, userAgent string) (int, int, error) {
	if err := s.checkFinanceMutation(role); err != nil {
		return 0, 0, err
	}
	if req.Reason == "" || len(req.Reason) < 5 {
		return 0, 0, fmt.Errorf("mandatory justification reason (min 5 chars) required for point adjustment")
	}

	oldBalance, newBalance, err := s.repo.AdjustBuyerPoints(buyerID, req.Type, req.Amount, req.Reason)
	if err != nil {
		return 0, 0, err
	}

	// Audit Log
	_ = s.auditService.Record(
		adminID, role, "MANUAL_POINT_ADJUSTMENT", "BUYER_POINT_ACCOUNT", buyerID.String(), req.Reason,
		map[string]interface{}{"available_points": oldBalance},
		map[string]interface{}{"type": req.Type, "amount": req.Amount, "available_points": newBalance},
		ip, userAgent,
	)

	return oldBalance, newBalance, nil
}

// Phase 3B - Seller Growth
func (s *AdminFinanceService) ListSellerGrowth(role models.AdminRole, page, limit int, search string) ([]models.AdminSellerGrowthItem, int, error) {
	if err := s.checkFinanceAccess(role); err != nil {
		return nil, 0, err
	}
	return s.repo.ListSellerGrowth(page, limit, search)
}

// Phase 3C - Reviews Moderation
func (s *AdminFinanceService) ListProductReviews(role models.AdminRole, page, limit int, status string) ([]models.AdminProductReviewItem, int, error) {
	if err := s.checkFinanceAccess(role); err != nil {
		return nil, 0, err
	}
	return s.repo.ListProductReviews(page, limit, status)
}

func (s *AdminFinanceService) HideProductReview(adminID uuid.UUID, role models.AdminRole, reviewID uuid.UUID, reason string, ip, userAgent string) error {
	if err := s.checkFinanceMutation(role); err != nil {
		return err
	}
	if reason == "" || len(reason) < 5 {
		return fmt.Errorf("mandatory justification reason required to hide review")
	}

	if err := s.repo.ModerateProductReview(reviewID, "HIDDEN"); err != nil {
		return err
	}

	_ = s.auditService.Record(
		adminID, role, "HIDE_PRODUCT_REVIEW", "PRODUCT_REVIEW", reviewID.String(), reason,
		map[string]interface{}{"moderation_status": "VISIBLE"},
		map[string]interface{}{"moderation_status": "HIDDEN"},
		ip, userAgent,
	)
	return nil
}

func (s *AdminFinanceService) RestoreProductReview(adminID uuid.UUID, role models.AdminRole, reviewID uuid.UUID, reason string, ip, userAgent string) error {
	if err := s.checkFinanceMutation(role); err != nil {
		return err
	}

	if err := s.repo.ModerateProductReview(reviewID, "VISIBLE"); err != nil {
		return err
	}

	_ = s.auditService.Record(
		adminID, role, "RESTORE_PRODUCT_REVIEW", "PRODUCT_REVIEW", reviewID.String(), reason,
		map[string]interface{}{"moderation_status": "HIDDEN"},
		map[string]interface{}{"moderation_status": "VISIBLE"},
		ip, userAgent,
	)
	return nil
}

func (s *AdminFinanceService) ListShopReviews(role models.AdminRole, page, limit int, status string) ([]models.AdminShopReviewItem, int, error) {
	if err := s.checkFinanceAccess(role); err != nil {
		return nil, 0, err
	}
	return s.repo.ListShopReviews(page, limit, status)
}

func (s *AdminFinanceService) HideShopReview(adminID uuid.UUID, role models.AdminRole, reviewID uuid.UUID, reason string, ip, userAgent string) error {
	if err := s.checkFinanceMutation(role); err != nil {
		return err
	}
	if reason == "" || len(reason) < 5 {
		return fmt.Errorf("mandatory justification reason required to hide shop review")
	}

	if err := s.repo.ModerateShopReview(reviewID, "HIDDEN"); err != nil {
		return err
	}

	_ = s.auditService.Record(
		adminID, role, "HIDE_SHOP_REVIEW", "SHOP_REVIEW", reviewID.String(), reason,
		map[string]interface{}{"moderation_status": "VISIBLE"},
		map[string]interface{}{"moderation_status": "HIDDEN"},
		ip, userAgent,
	)
	return nil
}

func (s *AdminFinanceService) RestoreShopReview(adminID uuid.UUID, role models.AdminRole, reviewID uuid.UUID, reason string, ip, userAgent string) error {
	if err := s.checkFinanceMutation(role); err != nil {
		return err
	}

	if err := s.repo.ModerateShopReview(reviewID, "VISIBLE"); err != nil {
		return err
	}

	_ = s.auditService.Record(
		adminID, role, "RESTORE_SHOP_REVIEW", "SHOP_REVIEW", reviewID.String(), reason,
		map[string]interface{}{"moderation_status": "HIDDEN"},
		map[string]interface{}{"moderation_status": "VISIBLE"},
		ip, userAgent,
	)
	return nil
}

// Phase 3D - Cases / Disputes
func (s *AdminFinanceService) CreateCase(adminID uuid.UUID, role models.AdminRole, req *models.AdminCreateCaseRequest, ip, userAgent string) (*models.AdminCaseListItem, error) {
	if err := s.checkFinanceMutation(role); err != nil {
		return nil, err
	}
	item, err := s.repo.CreateCase(req, "ADMIN", &adminID)
	if err != nil {
		return nil, err
	}

	_ = s.auditService.Record(
		adminID, role, "CREATE_CASE", "CASE", item.ID.String(), req.Title,
		nil,
		map[string]interface{}{"case_number": item.CaseNumber, "case_type": item.CaseType},
		ip, userAgent,
	)
	return item, nil
}

func (s *AdminFinanceService) ListCases(role models.AdminRole, filter *models.AdminCaseFilter) ([]models.AdminCaseListItem, int, error) {
	if err := s.checkFinanceAccess(role); err != nil {
		return nil, 0, err
	}
	return s.repo.ListCases(filter)
}

func (s *AdminFinanceService) GetCaseDetail(role models.AdminRole, caseID uuid.UUID) (*models.AdminCaseDetail, error) {
	if err := s.checkFinanceAccess(role); err != nil {
		return nil, err
	}
	item, err := s.repo.GetCaseByID(caseID)
	if err != nil {
		return nil, err
	}

	msgs, err := s.repo.GetCaseMessages(caseID, true)
	if err != nil {
		msgs = []models.AdminCaseMessage{}
	}

	return &models.AdminCaseDetail{
		AdminCaseListItem: *item,
		Messages:          msgs,
	}, nil
}

func (s *AdminFinanceService) AssignCase(adminID uuid.UUID, role models.AdminRole, caseID uuid.UUID, targetAdminID uuid.UUID, ip, userAgent string) error {
	if err := s.checkFinanceMutation(role); err != nil {
		return err
	}
	if err := s.repo.AssignCase(caseID, targetAdminID); err != nil {
		return err
	}

	_ = s.auditService.Record(
		adminID, role, "ASSIGN_CASE", "CASE", caseID.String(), fmt.Sprintf("Assigned case to admin %s", targetAdminID),
		nil,
		map[string]interface{}{"assigned_admin_id": targetAdminID, "status": "UNDER_REVIEW"},
		ip, userAgent,
	)
	return nil
}

func (s *AdminFinanceService) ResolveCase(adminID uuid.UUID, role models.AdminRole, caseID uuid.UUID, req *models.AdminCaseResolveRequest, ip, userAgent string) error {
	if err := s.checkFinanceMutation(role); err != nil {
		return err
	}
	if req.Resolution == "" || len(req.Resolution) < 5 {
		return fmt.Errorf("mandatory resolution detail required to resolve case")
	}

	if err := s.repo.ResolveCase(caseID, req.Status, req.Resolution); err != nil {
		return err
	}

	_ = s.auditService.Record(
		adminID, role, "RESOLVE_CASE", "CASE", caseID.String(), req.Resolution,
		nil,
		map[string]interface{}{"status": req.Status, "resolution": req.Resolution},
		ip, userAgent,
	)
	return nil
}

func (s *AdminFinanceService) AddCaseMessage(adminID uuid.UUID, role models.AdminRole, caseID uuid.UUID, req *models.AdminCaseMessageRequest, ip, userAgent string) (*models.AdminCaseMessage, error) {
	if err := s.checkFinanceMutation(role); err != nil {
		return nil, err
	}
	return s.repo.AddCaseMessage(caseID, "ADMIN", &adminID, req.Visibility, req.Message)
}

// Phase 3E - Risk & Fraud
func (s *AdminFinanceService) ListRiskEvents(role models.AdminRole, page, limit int, status string) ([]models.AdminRiskEvent, int, error) {
	if err := s.checkFinanceAccess(role); err != nil {
		return nil, 0, err
	}
	return s.repo.ListRiskEvents(page, limit, status)
}

func (s *AdminFinanceService) ResolveRiskEvent(adminID uuid.UUID, role models.AdminRole, eventID uuid.UUID, req *models.AdminRiskEventResolveRequest, ip, userAgent string) error {
	if err := s.checkFinanceMutation(role); err != nil {
		return err
	}
	if err := s.repo.ResolveRiskEvent(eventID, adminID, req.Status, req.Reason); err != nil {
		return err
	}

	_ = s.auditService.Record(
		adminID, role, "RESOLVE_RISK_EVENT", "RISK_EVENT", eventID.String(), req.Reason,
		nil,
		map[string]interface{}{"status": req.Status},
		ip, userAgent,
	)
	return nil
}
