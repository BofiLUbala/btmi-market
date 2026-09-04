package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type AdminCommerceService struct {
	db            *database.DB
	commerceRepo  *repository.AdminCommerceRepository
	productRepo   *repository.ProductRepository
	inventoryRepo *repository.InventoryRepository
	movementRepo  *repository.StockMovementRepository
	auditRepo     *repository.AuditRepository
}

func NewAdminCommerceService(
	db *database.DB,
	commerceRepo *repository.AdminCommerceRepository,
	productRepo *repository.ProductRepository,
	inventoryRepo *repository.InventoryRepository,
	movementRepo *repository.StockMovementRepository,
	auditRepo *repository.AuditRepository,
) *AdminCommerceService {
	return &AdminCommerceService{
		db:            db,
		commerceRepo:  commerceRepo,
		productRepo:   productRepo,
		inventoryRepo: inventoryRepo,
		movementRepo:  movementRepo,
		auditRepo:     auditRepo,
	}
}

// 1. Overview
func (s *AdminCommerceService) GetOverview(ctx context.Context) (*models.CommerceOverviewStats, error) {
	return s.commerceRepo.GetOverview()
}

// 2. Products
func (s *AdminCommerceService) ListProducts(search, businessID, categoryID, subcategoryID, publicationStatus, stockStatus string, limit, offset int) ([]*models.AdminProductListItem, int, error) {
	return s.commerceRepo.ListProducts(search, businessID, categoryID, subcategoryID, publicationStatus, stockStatus, limit, offset)
}

func (s *AdminCommerceService) GetProductDetail(id uuid.UUID) (*models.AdminProductDetail, error) {
	return s.commerceRepo.GetProductDetail(id)
}

func (s *AdminCommerceService) UnpublishProduct(adminID uuid.UUID, adminRole models.AdminRole, productID uuid.UUID, reason, ip, userAgent string) error {
	prod, err := s.commerceRepo.GetProductDetail(productID)
	if err != nil {
		return errors.New("PRODUCT_NOT_FOUND")
	}

	oldPub := prod.Product.PublicationStatus
	if oldPub == models.PublicationStatusDraft {
		return errors.New("PRODUCT_ALREADY_UNPUBLISHED")
	}

	if err := s.commerceRepo.UpdateProductPublication(productID, models.PublicationStatusDraft); err != nil {
		return fmt.Errorf("failed to unpublish product: %w", err)
	}

	oldRaw := json.RawMessage(fmt.Sprintf(`{"publication_status": "%s"}`, oldPub))
	newRaw := json.RawMessage(fmt.Sprintf(`{"publication_status": "%s"}`, models.PublicationStatusDraft))

	_ = s.auditRepo.Record(&models.AdminAuditLog{
		ActorAdminID: adminID,
		ActorRole:    adminRole,
		Action:       "PRODUCT_UNPUBLISH",
		TargetType:   "PRODUCT",
		TargetID:     productID.String(),
		Reason:       reason,
		OldValue:     &oldRaw,
		NewValue:     &newRaw,
		IPAddress:    &ip,
		UserAgent:    &userAgent,
	})

	return nil
}

func (s *AdminCommerceService) PublishProduct(adminID uuid.UUID, adminRole models.AdminRole, productID uuid.UUID, reason, ip, userAgent string) error {
	prod, err := s.commerceRepo.GetProductDetail(productID)
	if err != nil {
		return errors.New("PRODUCT_NOT_FOUND")
	}
	if prod.Product.PublicationStatus == models.PublicationStatusPublished {
		return errors.New("PRODUCT_ALREADY_PUBLISHED")
	}
	if prod.Product.Status != models.ProductStatusActive {
		return errors.New("PRODUCT_NOT_ACTIVE")
	}
	if prod.Product.CategoryID == nil || prod.Product.SubcategoryID == nil {
		return errors.New("PRODUCT_TAXONOMY_REQUIRED")
	}
	if len(prod.Variants) == 0 {
		return errors.New("PRODUCT_VARIANT_REQUIRED")
	}

	oldPub := prod.Product.PublicationStatus
	if err := s.commerceRepo.UpdateProductPublication(productID, models.PublicationStatusPublished); err != nil {
		return fmt.Errorf("failed to publish product: %w", err)
	}
	oldRaw := json.RawMessage(fmt.Sprintf(`{"publication_status":"%s"}`, oldPub))
	newRaw := json.RawMessage(fmt.Sprintf(`{"publication_status":"%s"}`, models.PublicationStatusPublished))
	_ = s.auditRepo.Record(&models.AdminAuditLog{
		ActorAdminID: adminID, ActorRole: adminRole, Action: "PRODUCT_PUBLISH",
		TargetType: "PRODUCT", TargetID: productID.String(), Reason: reason,
		OldValue: &oldRaw, NewValue: &newRaw, IPAddress: &ip, UserAgent: &userAgent,
	})
	return nil
}

func (s *AdminCommerceService) ArchiveProduct(adminID uuid.UUID, adminRole models.AdminRole, productID uuid.UUID, reason, ip, userAgent string) error {
	prod, err := s.commerceRepo.GetProductDetail(productID)
	if err != nil {
		return errors.New("PRODUCT_NOT_FOUND")
	}

	oldPub := prod.Product.PublicationStatus
	if err := s.commerceRepo.UpdateProductPublication(productID, models.PublicationStatusArchived); err != nil {
		return fmt.Errorf("failed to archive product: %w", err)
	}

	oldRaw := json.RawMessage(fmt.Sprintf(`{"publication_status": "%s"}`, oldPub))
	newRaw := json.RawMessage(fmt.Sprintf(`{"publication_status": "%s"}`, models.PublicationStatusArchived))

	_ = s.auditRepo.Record(&models.AdminAuditLog{
		ActorAdminID: adminID,
		ActorRole:    adminRole,
		Action:       "PRODUCT_ARCHIVE",
		TargetType:   "PRODUCT",
		TargetID:     productID.String(),
		Reason:       reason,
		OldValue:     &oldRaw,
		NewValue:     &newRaw,
		IPAddress:    &ip,
		UserAgent:    &userAgent,
	})

	return nil
}

// 3. Category & Taxonomy
func (s *AdminCommerceService) ListCategories() ([]*models.CategoryWithSubcategories, error) {
	return s.commerceRepo.ListCategories()
}

func (s *AdminCommerceService) CreateCategory(adminID uuid.UUID, adminRole models.AdminRole, req *models.CreateCategoryRequest, ip, userAgent string) (*models.Category, error) {
	cat, err := s.commerceRepo.CreateCategory(req)
	if err != nil {
		return nil, err
	}

	newBytes, _ := json.Marshal(cat)
	newRaw := json.RawMessage(newBytes)
	_ = s.auditRepo.Record(&models.AdminAuditLog{
		ActorAdminID: adminID,
		ActorRole:    adminRole,
		Action:       "CATEGORY_CREATE",
		TargetType:   "CATEGORY",
		TargetID:     cat.ID.String(),
		Reason:       "Administrative taxonomy addition",
		NewValue:     &newRaw,
		IPAddress:    &ip,
		UserAgent:    &userAgent,
	})

	return cat, nil
}

func (s *AdminCommerceService) UpdateCategory(adminID uuid.UUID, adminRole models.AdminRole, id uuid.UUID, req *models.UpdateCategoryRequest, reason, ip, userAgent string) error {
	if err := s.commerceRepo.UpdateCategory(id, req); err != nil {
		return err
	}

	newBytes, _ := json.Marshal(req)
	newRaw := json.RawMessage(newBytes)
	_ = s.auditRepo.Record(&models.AdminAuditLog{
		ActorAdminID: adminID,
		ActorRole:    adminRole,
		Action:       "CATEGORY_UPDATE",
		TargetType:   "CATEGORY",
		TargetID:     id.String(),
		Reason:       reason,
		NewValue:     &newRaw,
		IPAddress:    &ip,
		UserAgent:    &userAgent,
	})

	return nil
}

func (s *AdminCommerceService) CreateSubcategory(adminID uuid.UUID, adminRole models.AdminRole, req *models.CreateSubcategoryRequest, ip, userAgent string) (*models.Subcategory, error) {
	sub, err := s.commerceRepo.CreateSubcategory(req)
	if err != nil {
		return nil, err
	}

	newBytes, _ := json.Marshal(sub)
	newRaw := json.RawMessage(newBytes)
	_ = s.auditRepo.Record(&models.AdminAuditLog{
		ActorAdminID: adminID,
		ActorRole:    adminRole,
		Action:       "SUBCATEGORY_CREATE",
		TargetType:   "SUBCATEGORY",
		TargetID:     sub.ID.String(),
		Reason:       "Administrative taxonomy addition",
		NewValue:     &newRaw,
		IPAddress:    &ip,
		UserAgent:    &userAgent,
	})

	return sub, nil
}

func (s *AdminCommerceService) UpdateSubcategory(adminID uuid.UUID, adminRole models.AdminRole, id uuid.UUID, req *models.UpdateSubcategoryRequest, reason, ip, userAgent string) error {
	if err := s.commerceRepo.UpdateSubcategory(id, req); err != nil {
		return err
	}

	newBytes, _ := json.Marshal(req)
	newRaw := json.RawMessage(newBytes)
	_ = s.auditRepo.Record(&models.AdminAuditLog{
		ActorAdminID: adminID,
		ActorRole:    adminRole,
		Action:       "SUBCATEGORY_UPDATE",
		TargetType:   "SUBCATEGORY",
		TargetID:     id.String(),
		Reason:       reason,
		NewValue:     &newRaw,
		IPAddress:    &ip,
		UserAgent:    &userAgent,
	})

	return nil
}

func (s *AdminCommerceService) GetAttributeSuggestions() map[string][]string {
	return map[string][]string{
		"fashion":     {"Color", "Size", "Material", "Fit"},
		"shoes":       {"Color", "Shoe Size", "Material", "Gender"},
		"food":        {"Flavor", "Weight", "Volume", "Pack Size", "Expiration Date"},
		"beauty":      {"Shade", "Volume", "Scent", "Skin Type"},
		"electronics": {"Color", "Storage", "RAM", "Capacity", "Model"},
		"children":    {"Age Range", "Size", "Color"},
		"home":        {"Dimensions", "Material", "Color", "Capacity"},
		"sport":       {"Size", "Weight", "Color"},
		"automotive":  {"Model", "Compatibility", "Capacity", "Size"},
		"services":    {},
	}
}

// 4. Inventory & Safe Stock Adjustment
func (s *AdminCommerceService) ListInventory(businessID, shopID, stockStatus string, limit, offset int) ([]*models.AdminInventoryItem, int, error) {
	return s.commerceRepo.ListInventory(businessID, shopID, stockStatus, limit, offset)
}

func (s *AdminCommerceService) ListStockAnomalies() ([]*models.StockAnomaly, error) {
	return s.commerceRepo.ListStockAnomalies()
}

func (s *AdminCommerceService) AdjustStock(adminID uuid.UUID, adminRole models.AdminRole, req *models.AdjustStockRequest, ip, userAgent string) error {
	currentInv, err := s.inventoryRepo.GetByShopAndVariant(req.ShopID, req.VariantID)
	if err != nil {
		return fmt.Errorf("INVENTORY_NOT_FOUND")
	}

	oldQty := currentInv.Quantity
	newQty := req.NewQuantity
	diff := newQty - oldQty

	if diff == 0 {
		return errors.New("NO_CHANGE_IN_STOCK")
	}

	// Update inventory row
	updateQuery := `UPDATE inventory SET quantity = $1, updated_at = NOW() WHERE id = $2`
	if _, err := s.db.Exec(updateQuery, newQty, currentInv.ID); err != nil {
		return fmt.Errorf("failed to update inventory: %w", err)
	}

	// Record stock movement
	movement := &models.StockMovement{
		ID:               uuid.New(),
		BusinessID:       currentInv.BusinessID,
		ShopID:           currentInv.ShopID,
		ProductID:        currentInv.ProductID,
		VariantID:        &currentInv.VariantID,
		MovementType:     models.StockMovementTypeAdjustment,
		Quantity:         diff,
		PreviousQuantity: oldQty,
		NewQuantity:      newQty,
		Notes:            fmt.Sprintf("Admin stock adjustment by %s: %s", adminRole, req.Reason),
		CreatedAt:        time.Now(),
	}
	_ = s.movementRepo.Create(movement)

	// Audit Log
	oldRaw := json.RawMessage(fmt.Sprintf(`{"quantity": %d, "reserved_quantity": %d}`, oldQty, currentInv.ReservedQuantity))
	newRaw := json.RawMessage(fmt.Sprintf(`{"quantity": %d, "reserved_quantity": %d}`, newQty, currentInv.ReservedQuantity))

	_ = s.auditRepo.Record(&models.AdminAuditLog{
		ActorAdminID: adminID,
		ActorRole:    adminRole,
		Action:       "STOCK_ADJUSTMENT",
		TargetType:   "INVENTORY",
		TargetID:     currentInv.ID.String(),
		Reason:       req.Reason,
		OldValue:     &oldRaw,
		NewValue:     &newRaw,
		IPAddress:    &ip,
		UserAgent:    &userAgent,
	})

	return nil
}

// 5. Orders & Stuck Orders
func (s *AdminCommerceService) ListOrders(status, deliveryMethod, shopID, businessID, search string, limit, offset int) ([]*models.AdminOrderItem, int, error) {
	return s.commerceRepo.ListOrders(status, deliveryMethod, shopID, businessID, search, limit, offset)
}

func (s *AdminCommerceService) GetOrderDetail(id uuid.UUID) (*models.AdminOrderDetail, error) {
	return s.commerceRepo.GetOrderDetail(id)
}

// 6. Employees
func (s *AdminCommerceService) ListEmployees(limit, offset int) ([]*models.AdminEmployeeItem, int, error) {
	return s.commerceRepo.ListEmployees(limit, offset)
}

func (s *AdminCommerceService) RevokeEmployeeAccess(adminID uuid.UUID, adminRole models.AdminRole, employeeID uuid.UUID, reason, ip, userAgent string) error {
	if err := s.commerceRepo.RevokeEmployeeAccess(employeeID); err != nil {
		return err
	}

	oldRaw := json.RawMessage(`{"status": "ACTIVE"}`)
	newRaw := json.RawMessage(`{"status": "INACTIVE"}`)

	_ = s.auditRepo.Record(&models.AdminAuditLog{
		ActorAdminID: adminID,
		ActorRole:    adminRole,
		Action:       "EMPLOYEE_ACCESS_REVOKED",
		TargetType:   "EMPLOYEE",
		TargetID:     employeeID.String(),
		Reason:       reason,
		OldValue:     &oldRaw,
		NewValue:     &newRaw,
		IPAddress:    &ip,
		UserAgent:    &userAgent,
	})

	return nil
}

// 7. Stock Movement History
func (s *AdminCommerceService) ListStockMovementHistory(businessID, shopID, productID, variantID, movementType, employeeID, fromDate, toDate string, limit, offset int) ([]*models.AdminStockMovementItem, int, error) {
	return s.commerceRepo.ListStockMovementHistory(businessID, shopID, productID, variantID, movementType, employeeID, fromDate, toDate, limit, offset)
}

// 8. Marketplace Visibility
func (s *AdminCommerceService) GetMarketplaceVisibility(productID uuid.UUID) (*models.AdminMarketplaceVisibility, error) {
	return s.commerceRepo.GetMarketplaceVisibility(productID)
}

// 9. Public Shop Page Control
func (s *AdminCommerceService) GetShopPageControl(shopID uuid.UUID) (*models.AdminShopPageControl, error) {
	return s.commerceRepo.GetShopPageControl(shopID)
}

// 10. Search Admin
func (s *AdminCommerceService) GetSearchAnalytics() (*models.AdminSearchAnalytics, error) {
	return s.commerceRepo.GetSearchAnalytics()
}

func (s *AdminCommerceService) ListSearchQueries(limit, offset int) ([]*models.AdminSearchQueryLog, int, error) {
	return s.commerceRepo.ListSearchQueries(limit, offset)
}

// 11. Marketplace Ranking Inspection
func (s *AdminCommerceService) GetMarketplaceRanking() (*models.AdminMarketplaceRanking, error) {
	return s.commerceRepo.GetMarketplaceRanking()
}

// 12. Product Card Quality Control
func (s *AdminCommerceService) GetProductCardQuality(productID uuid.UUID) (*models.AdminProductCardQuality, error) {
	return s.commerceRepo.GetProductCardQuality(productID)
}

// 13. Promotion Visibility
func (s *AdminCommerceService) ListPromotionVisibility(limit, offset int) ([]*models.AdminPromotionVisibility, int, error) {
	return s.commerceRepo.ListPromotionVisibility(limit, offset)
}

// 14. Seller Performance
func (s *AdminCommerceService) GetSellerPerformance(limit, offset int) ([]*models.AdminSellerPerformance, int, error) {
	return s.commerceRepo.GetSellerPerformance(limit, offset)
}

// 15. Product Performance
func (s *AdminCommerceService) GetProductPerformance(limit, offset int) ([]*models.AdminProductPerformance, int, error) {
	return s.commerceRepo.GetProductPerformance(limit, offset)
}

// 16. Category Performance
func (s *AdminCommerceService) GetCategoryPerformance() ([]*models.AdminCategoryPerformance, error) {
	return s.commerceRepo.GetCategoryPerformance()
}

// 17. Shop Performance
func (s *AdminCommerceService) GetShopPerformance(limit, offset int) ([]*models.AdminShopPerformance, int, error) {
	return s.commerceRepo.GetShopPerformance(limit, offset)
}

// 18. Employee Shop Authorization
func (s *AdminCommerceService) CheckEmployeeShopAuth(employeeID, shopID uuid.UUID) (*models.AdminEmployeeShopAuth, error) {
	return s.commerceRepo.CheckEmployeeShopAuth(employeeID, shopID)
}
