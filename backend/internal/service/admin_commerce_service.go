package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/notify"
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
	commSvc       *CommunicationService
	notifier      *notify.Notifier
}

// SetNotifier tells sellers about moderation decisions on their shops and products.
func (s *AdminCommerceService) SetNotifier(n *notify.Notifier) { s.notifier = n }

func withReason(body, reason string) string {
	if r := strings.TrimSpace(reason); r != "" {
		return body + " Motif : " + r
	}
	return body
}

// notifyProductModeration tells the business whose product an admin took off sale.
func (s *AdminCommerceService) notifyProductModeration(prod *models.AdminProductDetail, t models.NotificationType, reason string) {
	title := "Produit retiré de la vente : " + prod.Product.Name
	body := "Un administrateur TBK a dépublié ce produit : il n'est plus visible des acheteurs."
	if t == models.NotificationTypeProductArchived {
		title = "Produit archivé : " + prod.Product.Name
		body = "Un administrateur TBK a archivé ce produit : il n'est plus visible des acheteurs."
	}
	s.notifier.ToBusiness(prod.Product.BusinessID, false, notify.Message{
		Type: t, Title: title, Body: withReason(body, reason),
		RefType: notify.RefProduct, RefID: prod.Product.ID,
		Meta: map[string]interface{}{"product_id": prod.Product.ID.String(), "reason": reason},
	})
}

// notifyEntityStatus tells a business's managers that TBK suspended or
// reactivated it (or one of its shops).
func (s *AdminCommerceService) notifyEntityStatus(kind string, id uuid.UUID, old, status, reason string) {
	if s.notifier == nil || old == status {
		return
	}
	var businessID uuid.UUID
	var name string
	if kind == "SHOP" {
		if err := s.db.QueryRow(`SELECT business_id, name FROM shops WHERE id = $1`, id).Scan(&businessID, &name); err != nil {
			return
		}
	} else {
		businessID = id
		_ = s.db.QueryRow(`SELECT name FROM businesses WHERE id = $1`, id).Scan(&name)
	}
	var m notify.Message
	switch {
	case kind == "SHOP" && status == "SUSPENDED":
		m = notify.Message{Type: models.NotificationTypeShopSuspended, Title: "Boutique suspendue : " + name,
			Body: withReason("TBK a suspendu cette boutique : elle n'apparaît plus sur la marketplace.", reason), RefType: notify.RefShop}
	case kind == "SHOP" && status == "ACTIVE":
		m = notify.Message{Type: models.NotificationTypeShopReactivated, Title: "Boutique réactivée : " + name,
			Body: "Votre boutique est de nouveau visible sur la marketplace.", RefType: notify.RefShop}
	case kind == "BUSINESS" && (status == "SUSPENDED" || status == "DEACTIVATED"):
		m = notify.Message{Type: models.NotificationTypeBusinessSuspended, Title: "Entreprise suspendue : " + name,
			Body: withReason("TBK a suspendu votre entreprise : ses boutiques n'apparaissent plus sur la marketplace.", reason), RefType: notify.RefBusiness}
	case kind == "BUSINESS" && status == "ACTIVE":
		m = notify.Message{Type: models.NotificationTypeBusinessReactivated, Title: "Entreprise réactivée : " + name,
			Body: "Votre entreprise et ses boutiques sont de nouveau actives.", RefType: notify.RefBusiness}
	default:
		return
	}
	m.RefID = id
	m.Meta = map[string]interface{}{"reason": reason, "status": status}
	s.notifier.ToBusiness(businessID, true, m)
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

func (s *AdminCommerceService) SetCommunicationService(commSvc *CommunicationService) {
	s.commSvc = commSvc
}

// 1. Overview
func (s *AdminCommerceService) GetOverview(ctx context.Context) (*models.CommerceOverviewStats, error) {
	return s.commerceRepo.GetOverview()
}

func (s *AdminCommerceService) ListOperationalUsers(search, accountType, status string, limit, offset int) ([]*models.AdminUserListItem, int, error) {
	if accountType != "SELLER" && accountType != "EMPLOYEE" {
		return nil, 0, errors.New("account_type must be SELLER or EMPLOYEE")
	}
	return s.commerceRepo.ListOperationalUsers(search, accountType, status, limit, offset)
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
	s.notifyProductModeration(prod, models.NotificationTypeProductUnpublished, reason)

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

func (s *AdminCommerceService) ArchiveProduct(adminID uuid.UUID, adminRole models.AdminRole, productID uuid.UUID, reason, ip, userAgent string) error {
	prod, err := s.commerceRepo.GetProductDetail(productID)
	if err != nil {
		return errors.New("PRODUCT_NOT_FOUND")
	}

	oldPub := prod.Product.PublicationStatus
	if err := s.commerceRepo.UpdateProductPublication(productID, models.PublicationStatusArchived); err != nil {
		return fmt.Errorf("failed to archive product: %w", err)
	}
	if oldPub != models.PublicationStatusArchived {
		s.notifyProductModeration(prod, models.NotificationTypeProductArchived, reason)
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

// GetAttributeSuggestions returns the attribute definitions stored per category
// (category_attribute_definitions): the same ones the seller product form enforces.
func (s *AdminCommerceService) GetAttributeSuggestions() (map[string][]models.AdminCategoryAttribute, error) {
	return s.commerceRepo.ListCategoryAttributes()
}

// 4. Inventory & Safe Stock Adjustment
func (s *AdminCommerceService) ListInventory(businessID, shopID, search, stockStatus string, limit, offset int) ([]*models.AdminInventoryItem, int, error) {
	return s.commerceRepo.ListInventory(businessID, shopID, search, stockStatus, limit, offset)
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
		Notes:            fmt.Sprintf("Ajustement de stock par l’administration (%s) : %s", adminRoleLabel(adminRole), req.Reason),
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
func (s *AdminCommerceService) ListOrders(status, deliveryMethod, shopID, businessID, search, period string, limit, offset int) ([]*models.AdminOrderItem, int, error) {
	items, total, err := s.commerceRepo.ListOrders(status, deliveryMethod, shopID, businessID, search, period, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	for _, item := range items {
		s.attachCancellation(item)
	}
	return items, total, nil
}

func (s *AdminCommerceService) GetOrderDetail(id uuid.UUID) (*models.AdminOrderDetail, error) {
	detail, err := s.commerceRepo.GetOrderDetail(id)
	if err != nil || detail == nil {
		return detail, err
	}
	s.attachCancellation(&detail.Order)
	return detail, nil
}

// attachCancellation adds who cancelled a cancelled order, and why.
func (s *AdminCommerceService) attachCancellation(item *models.AdminOrderItem) {
	if item == nil || (item.Status != string(models.OrderStatusCancelled) && item.Status != string(models.OrderStatusRejected)) {
		return
	}
	if c, err := repository.NewOrderRepository(s.db).GetCancellation(item.ID); err == nil {
		item.Cancellation = c
	}
}

func (s *AdminCommerceService) AssignCourier(adminID uuid.UUID, adminRole models.AdminRole, orderID uuid.UUID, courierID uuid.UUID, notes, ip, userAgent string) error {
	orderRepo := repository.NewOrderRepository(s.db)
	order, err := orderRepo.GetByID(orderID)
	if err != nil {
		return err
	}

	// The orders table FK references users(id), so resolve courier_id -> user_id
	courierRepo := repository.NewCourierRepository(s.db)
	courier, err := courierRepo.GetByID(courierID)
	if err != nil || courier == nil {
		// Older admin clients listed operational users and therefore sent users.id.
		// Accept that identity during rolling deployments, but always persist users.id.
		courier, err = courierRepo.GetByUserID(courierID)
	}
	if err != nil || courier == nil {
		return errors.New("COURIER_NOT_FOUND")
	}
	// Admin dispatch is authoritative: any ACTIVE courier can receive a mission
	// and accept or refuse it from the courier app. Availability is only the
	// courier's own "on shift" toggle, and new accounts start UNAVAILABLE, so
	// gating on it made freshly activated couriers impossible to assign.
	if courier.Status != models.CourierStatusActive {
		return errors.New("COURIER_NOT_AVAILABLE")
	}

	if err := s.assignCourierTx(orderID, courier.UserID, notes); err != nil {
		return err
	}

	oldCourier := ""
	if order.AssignedCourierID != nil {
		oldCourier = order.AssignedCourierID.String()
	}
	oldRaw, _ := json.Marshal(map[string]string{"assigned_courier_id": oldCourier, "delivery_status": order.DeliveryStatus})
	newRaw, _ := json.Marshal(map[string]string{
		"assigned_courier_id": courier.UserID.String(),
		"courier_profile_id":  courier.ID.String(),
		"delivery_status":     models.DeliveryStatusCourierAssigned,
	})
	oldJson := json.RawMessage(oldRaw)
	newJson := json.RawMessage(newRaw)

	_ = s.auditRepo.Record(&models.AdminAuditLog{
		ActorAdminID: adminID,
		ActorRole:    adminRole,
		Action:       "COURIER_ASSIGNED",
		TargetType:   "ORDER",
		TargetID:     orderID.String(),
		Reason:       notes,
		OldValue:     &oldJson,
		NewValue:     &newJson,
		IPAddress:    &ip,
		UserAgent:    &userAgent,
	})

	if s.commSvc != nil {
		_ = s.commSvc.TriggerOrderEventNotification(orderID, models.NotificationTypeCourierAssigned, map[string]interface{}{
			"assigned_courier_id": courier.UserID.String(),
			"courier_profile_id":  courier.ID.String(),
			"notes":               notes,
		})
	}

	return nil
}

// assignCourierTx dispatches a courier only while the dispatch step is still open: a TBK
// delivery whose checkout is complete, not closed, and whose parcel has not yet left the
// seller. Reassigning after pickup would reset the handover chain mid-route.
func (s *AdminCommerceService) assignCourierTx(orderID, courierUserID uuid.UUID, notes string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var status models.OrderStatus
	var method, deliveryStatus, previous sql.NullString
	if err := tx.QueryRow(`SELECT status, delivery_method, delivery_status, assigned_courier_id::text FROM orders WHERE id = $1 FOR UPDATE`, orderID).
		Scan(&status, &method, &deliveryStatus, &previous); err != nil {
		return mapOrderNotFoundErr(err)
	}
	switch status {
	case models.OrderStatusPending, models.OrderStatusAccepted, models.OrderStatusPreparing, models.OrderStatusReady:
	default:
		return errors.New("ORDER_NOT_ASSIGNABLE")
	}
	if !isTBKDeliveryMethod(method.String) {
		return errors.New("NOT_TBK_DELIVERY")
	}
	switch deliveryStatus.String {
	case "", models.DeliveryStatusPendingTBK, models.DeliveryStatusCourierAssigned, "COURIER_REJECTED", "COURIER_ACCEPTED", models.DeliveryStatusReadyForPickup:
	default:
		return errors.New("DELIVERY_ALREADY_STARTED")
	}
	if err := requireCheckoutCompleteTx(tx, orderID, method.String); err != nil {
		return err
	}

	if _, err := tx.Exec(`
		UPDATE orders
		SET assigned_courier_id = $2, delivery_status = 'COURIER_ASSIGNED', courier_assigned_at = NOW(), courier_notes = $3, updated_at = NOW()
		WHERE id = $1`, orderID, courierUserID, notes); err != nil {
		return err
	}
	if previous.Valid && previous.String != courierUserID.String() {
		if prevID, perr := uuid.Parse(previous.String); perr == nil {
			if err := releaseCourierIfIdleTx(tx, prevID); err != nil {
				return err
			}
		}
	}
	return tx.Commit()
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
// 11. Marketplace Ranking Inspection
func (s *AdminCommerceService) GetMarketplaceRanking() (*models.AdminMarketplaceRanking, error) {
	ranking, err := s.commerceRepo.GetMarketplaceRanking()
	if err == nil && ranking != nil {
		ranking.SearchRanking = SearchRankingRule()
	}
	return ranking, err
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

func (s *AdminCommerceService) ListBusinesses(search, status string, limit, offset int) ([]*models.AdminBusinessListItem, int, error) {
	return s.commerceRepo.ListBusinesses(search, status, limit, offset)
}

func (s *AdminCommerceService) ListShops(search, status, businessID string, limit, offset int) ([]*models.AdminShopListItem, int, error) {
	return s.commerceRepo.ListShops(search, status, businessID, limit, offset)
}

var businessStatuses = map[string]bool{"ACTIVE": true, "SUSPENDED": true, "DEACTIVATED": true}
var shopStatuses = map[string]bool{"ACTIVE": true, "INACTIVE": true, "SUSPENDED": true}

// SetEntityStatus suspends or reactivates a business or a shop. A suspended
// business or shop disappears from the marketplace because every public
// listing already filters on status = 'ACTIVE'.
func (s *AdminCommerceService) SetEntityStatus(adminID uuid.UUID, adminRole models.AdminRole, kind string, id uuid.UUID, status, reason, ip, userAgent string) error {
	status = strings.ToUpper(strings.TrimSpace(status))
	if len(strings.TrimSpace(reason)) < 5 {
		return errors.New("REASON_REQUIRED")
	}
	var old string
	var err error
	switch kind {
	case "BUSINESS":
		if !businessStatuses[status] {
			return errors.New("INVALID_STATUS")
		}
		old, err = s.commerceRepo.SetBusinessStatus(id, status)
	case "SHOP":
		if !shopStatuses[status] {
			return errors.New("INVALID_STATUS")
		}
		old, err = s.commerceRepo.SetShopStatus(id, status)
	default:
		return errors.New("INVALID_KIND")
	}
	if err != nil {
		return err
	}
	s.notifyEntityStatus(kind, id, old, status, reason)
	oldRaw := json.RawMessage(fmt.Sprintf(`{"status": %q}`, old))
	newRaw := json.RawMessage(fmt.Sprintf(`{"status": %q}`, status))
	_ = s.auditRepo.Record(&models.AdminAuditLog{
		ActorAdminID: adminID,
		ActorRole:    adminRole,
		Action:       kind + "_STATUS_" + status,
		TargetType:   kind,
		TargetID:     id.String(),
		Reason:       reason,
		OldValue:     &oldRaw,
		NewValue:     &newRaw,
		IPAddress:    &ip,
		UserAgent:    &userAgent,
	})
	return nil
}

// adminRoleLabel names an admin role in stock-movement notes shown to sellers and admins.
func adminRoleLabel(role models.AdminRole) string {
	switch role {
	case models.AdminRoleSuperAdmin:
		return "super admin"
	case models.AdminRoleCommerceAdmin:
		return "admin commerce"
	case models.AdminRoleFinanceSupportAdmin:
		return "admin finance"
	case models.AdminRoleTechnicalAdmin:
		return "admin technique"
	case models.AdminRoleDirectionAdmin:
		return "admin direction"
	}
	return string(role)
}
