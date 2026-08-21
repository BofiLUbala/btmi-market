package service

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type OrderService struct {
	orderRepo           *repository.OrderRepository
	inventoryRepo       *repository.InventoryRepository
	stockMovementRepo   *repository.StockMovementRepository
	shopRepo            *repository.ShopRepository
	productRepo         *repository.ProductRepository
	variantRepo         *repository.VariantRepository
	assignmentRepo      *repository.AssignmentRepository
	membershipRepo      *repository.MembershipRepository
	employeeRepo        *repository.EmployeeRepository
	customerRepo        *repository.CustomerRepository
	cashRepo            *repository.CashRepository
	buyerRepo           *repository.BuyerProfileRepository
	paymentRepo         *repository.BuyerPaymentRepository
	pointRedemptionSvc  *PointRedemptionService
	db                  *database.DB
	orderEvents         []models.OrderEvent
	eventsMutex         sync.RWMutex
}

func NewOrderService(
	orderRepo *repository.OrderRepository,
	inventoryRepo *repository.InventoryRepository,
	stockMovementRepo *repository.StockMovementRepository,
	shopRepo *repository.ShopRepository,
	productRepo *repository.ProductRepository,
	variantRepo *repository.VariantRepository,
	assignmentRepo *repository.AssignmentRepository,
	membershipRepo *repository.MembershipRepository,
	employeeRepo *repository.EmployeeRepository,
	customerRepo *repository.CustomerRepository,
	cashRepo *repository.CashRepository,
	buyerRepo *repository.BuyerProfileRepository,
	paymentRepo *repository.BuyerPaymentRepository,
	pointRedemptionSvc *PointRedemptionService,
	db *database.DB,
) *OrderService {
	return &OrderService{
		orderRepo:          orderRepo,
		inventoryRepo:      inventoryRepo,
		stockMovementRepo:  stockMovementRepo,
		shopRepo:           shopRepo,
		productRepo:        productRepo,
		variantRepo:        variantRepo,
		assignmentRepo:     assignmentRepo,
		membershipRepo:     membershipRepo,
		employeeRepo:       employeeRepo,
		customerRepo:       customerRepo,
		cashRepo:           cashRepo,
		buyerRepo:          buyerRepo,
		paymentRepo:        paymentRepo,
		pointRedemptionSvc: pointRedemptionSvc,
		db:                 db,
		orderEvents:        make([]models.OrderEvent, 0),
	}
}

func (s *OrderService) requireOwnerOrAdmin(userID, businessID uuid.UUID) error {
	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || membership == nil {
		return errors.New("FORBIDDEN")
	}
	if membership.Role != models.MembershipRoleOwner && membership.Role != models.MembershipRoleAdmin {
		return errors.New("FORBIDDEN")
	}
	return nil
}

func (s *OrderService) requireMembership(userID, businessID uuid.UUID) error {
	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || membership == nil {
		return errors.New("FORBIDDEN")
	}
	return nil
}

func (s *OrderService) RequireShopAccess(userID, shopID uuid.UUID) error {
	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return errors.New("SHOP_NOT_FOUND")
	}

	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, shop.BusinessID)
	if err != nil || membership == nil {
		return errors.New("FORBIDDEN")
	}

	if membership.Role == models.MembershipRoleOwner || membership.Role == models.MembershipRoleAdmin {
		return nil
	}

	employee, err := s.employeeRepo.GetByLinkedUserID(userID)
	if err != nil || employee == nil {
		return errors.New("FORBIDDEN")
	}

	assignment, err := s.assignmentRepo.GetByEmployeeAndShop(employee.ID, shopID)
	if err != nil || assignment == nil {
		return errors.New("FORBIDDEN")
	}

	return nil
}

// --- Point 8: State Machine ---

// allowedTransitions defines valid status transitions per delivery method.
var allowedTransitions = map[string]map[models.OrderStatus][]models.OrderStatus{
	"SHOP_DELIVERY": {
		models.OrderStatusPending:         {models.OrderStatusCancelled, models.OrderStatusAccepted},
		models.OrderStatusAccepted:        {models.OrderStatusCancelled, models.OrderStatusPreparing},
		models.OrderStatusPreparing:       {models.OrderStatusCancelled, models.OrderStatusReady},
		models.OrderStatusReady:           {models.OrderStatusCancelled, models.OrderStatusOutForDelivery},
		models.OrderStatusOutForDelivery:  {models.OrderStatusDelivered},
		models.OrderStatusDelivered:       {models.OrderStatusReceived},
		models.OrderStatusReceived:        {models.OrderStatusCompleted},
	},
	"PICKUP": {
		models.OrderStatusPending:    {models.OrderStatusCancelled, models.OrderStatusAccepted},
		models.OrderStatusAccepted:   {models.OrderStatusCancelled, models.OrderStatusPreparing},
		models.OrderStatusPreparing:  {models.OrderStatusCancelled, models.OrderStatusReadyForPickup},
		models.OrderStatusReadyForPickup: {models.OrderStatusReceived},
		models.OrderStatusReceived:   {models.OrderStatusCompleted},
	},
	"PARTNER": {
		models.OrderStatusPending:         {models.OrderStatusCancelled, models.OrderStatusAccepted},
		models.OrderStatusAccepted:        {models.OrderStatusCancelled, models.OrderStatusPreparing},
		models.OrderStatusPreparing:       {models.OrderStatusCancelled, models.OrderStatusReady},
		models.OrderStatusReady:           {models.OrderStatusHandedToPartner},
		models.OrderStatusHandedToPartner: {models.OrderStatusDelivered},
		models.OrderStatusDelivered:       {models.OrderStatusReceived},
		models.OrderStatusReceived:        {models.OrderStatusCompleted},
	},
}

// sellerAllowedStatuses are statuses a seller can transition to from PENDING.
var sellerAllowedFromPending = map[models.OrderStatus]bool{
	models.OrderStatusAccepted:  true,
	models.OrderStatusCancelled: true,
}

func canTransition(current, next models.OrderStatus, deliveryMethod string) bool {
	methodTransitions, ok := allowedTransitions[deliveryMethod]
	if !ok {
		return false
	}
	allowed, ok := methodTransitions[current]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == next {
			return true
		}
	}
	return false
}

// TransitionOrder validates and applies a status transition atomically.
func (s *OrderService) TransitionOrder(orderID, userID uuid.UUID, newStatus models.OrderStatus, notes string, actorType string) (*models.Order, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Lock the order row.
	var currentStatus models.OrderStatus
	var deliveryMethod string
	err = tx.QueryRow("SELECT status, delivery_method FROM orders WHERE id = $1 FOR UPDATE", orderID).Scan(&currentStatus, &deliveryMethod)
	if err != nil {
		return nil, errors.New("ORDER_NOT_FOUND")
	}

	if !canTransition(currentStatus, newStatus, deliveryMethod) {
		return nil, fmt.Errorf("INVALID_TRANSITION: %s → %s not allowed for %s", currentStatus, newStatus, deliveryMethod)
	}

	if actorType == "SELLER" && newStatus == models.OrderStatusReceived {
		return nil, errors.New("SELLER_CANNOT_CONFIRM_RECEIVED")
	}

	// Update status + timestamp.
	now := time.Now()
	_, err = tx.Exec(`
		UPDATE orders
		SET status = $2::order_status, updated_at = $3,
		    accepted_at = CASE WHEN $2 = 'ACCEPTED' THEN COALESCE(accepted_at, $3) ELSE accepted_at END,
		    preparing_at = CASE WHEN $2 = 'PREPARING' THEN COALESCE(preparing_at, $3) ELSE preparing_at END,
		    ready_at = CASE WHEN $2 IN ('READY', 'READY_FOR_PICKUP') THEN COALESCE(ready_at, $3) ELSE ready_at END,
		    out_for_delivery_at = CASE WHEN $2 = 'OUT_FOR_DELIVERY' THEN COALESCE(out_for_delivery_at, $3) ELSE out_for_delivery_at END,
		    delivered_at = CASE WHEN $2 = 'DELIVERED' THEN COALESCE(delivered_at, $3) ELSE delivered_at END,
		    received_at = CASE WHEN $2 = 'RECEIVED' THEN COALESCE(received_at, $3) ELSE received_at END,
		    completed_at = CASE WHEN $2 = 'COMPLETED' THEN COALESCE(completed_at, $3) ELSE completed_at END
		WHERE id = $1
	`, orderID, newStatus, now)
	if err != nil {
		return nil, err
	}

	// Insert status history.
	var changedBy interface{}
	if userID != uuid.Nil {
		changedBy = userID
	}
	_, err = tx.Exec(
		`INSERT INTO order_status_history (id, order_id, status, changed_by, notes) VALUES ($1, $2, $3, $4, $5)`,
		uuid.New(), orderID, newStatus, changedBy, notes,
	)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.orderRepo.GetByID(orderID)
}

// TransitionOrderNoAuth validates and applies a status transition without actor auth (for system/buyer).
func (s *OrderService) TransitionOrderNoAuth(orderID uuid.UUID, newStatus models.OrderStatus, notes string, actorType string) (*models.Order, error) {
	return s.TransitionOrder(orderID, uuid.Nil, newStatus, notes, actorType)
}

// GetOrderTracking returns tracking info with history for a buyer order.
func (s *OrderService) GetOrderTracking(orderID, buyerProfileID uuid.UUID) (*models.TrackingResponse, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, errors.New("ORDER_NOT_FOUND")
	}

	if order.BuyerProfileID == nil || *order.BuyerProfileID != buyerProfileID {
		return nil, errors.New("FORBIDDEN")
	}

	history, err := s.orderRepo.GetHistoryWithActor(orderID)
	if err != nil {
		return nil, err
	}

	tracking := &models.TrackingResponse{
		OrderID:        order.ID,
		OrderNumber:    order.OrderNumber,
		CurrentStatus:  string(order.Status),
		DeliveryMethod: order.DeliveryMethod,
		PaymentStatus:  "PENDING",
	}

	// Determine latest update from timestamps.
	type tsPair struct {
		status string
		time   *time.Time
	}
	pairs := []tsPair{
		{"ACCEPTED", order.AcceptedAt},
		{"PREPARING", order.PreparingAt},
		{"READY", order.ReadyAt},
		{"OUT_FOR_DELIVERY", order.OutForDeliveryAt},
		{"DELIVERED", order.DeliveredAt},
		{"RECEIVED", order.ReceivedAt},
		{"COMPLETED", order.CompletedAt},
	}
	var latestTime *time.Time
	for _, p := range pairs {
		if p.time != nil && (latestTime == nil || p.time.After(*latestTime)) {
			latestTime = p.time
			tracking.LatestUpdate = p.status
			tracking.LatestUpdateAt = p.time
		}
	}

	// Map history entries.
	tracking.History = make([]models.OrderStatusHistoryResponse, 0, len(history))
	for _, h := range history {
		entry := models.OrderStatusHistoryResponse{
			ID:        h["id"].(uuid.UUID),
			OrderID:   h["order_id"].(uuid.UUID),
			Status:    h["status"].(string),
			ActorType: h["actor_type"].(string),
			Notes:     h["notes"].(string),
			CreatedAt: h["created_at"].(time.Time),
		}
		if cb, ok := h["changed_by"].(*uuid.UUID); ok {
			entry.ChangedBy = cb
		}
		tracking.History = append(tracking.History, entry)
	}

	return tracking, nil
}

func (s *OrderService) getBusinessIDFromShop(shopID uuid.UUID) (uuid.UUID, error) {
	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return uuid.Nil, errors.New("SHOP_NOT_FOUND")
	}
	return shop.BusinessID, nil
}

func (s *OrderService) CreateOrder(userID uuid.UUID, req *models.CreateOrderRequest) (*models.OrderWithLinesResponse, error) {
	shopID, err := uuid.Parse(req.ShopID)
	if err != nil {
		return nil, errors.New("INVALID_SHOP_ID")
	}

	if err := s.RequireShopAccess(userID, shopID); err != nil {
		return nil, err
	}

	businessID, err := s.getBusinessIDFromShop(shopID)
	if err != nil {
		return nil, err
	}

	var customerID *uuid.UUID
	if req.CustomerID != nil && *req.CustomerID != "" {
		cid, err := uuid.Parse(*req.CustomerID)
		if err != nil {
			return nil, errors.New("INVALID_CUSTOMER_ID")
		}
		customer, err := s.customerRepo.GetByID(cid)
		if err != nil {
			return nil, errors.New("CUSTOMER_NOT_FOUND")
		}
		if customer.BusinessID != businessID {
			return nil, errors.New("FORBIDDEN")
		}
		customerID = &cid
	} else if req.CustomerPhone != "" || req.CustomerEmail != "" {
		customer, err := s.customerRepo.FindOrCreateByPhone(businessID, req.CustomerPhone, req.CustomerName, "")
		if err != nil {
			customer, err = s.customerRepo.GetByBusinessAndEmail(businessID, req.CustomerEmail)
			if err == nil && customer != nil {
				customerID = &customer.ID
			}
		} else {
			customerID = &customer.ID
		}
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	orderRepo := repository.NewOrderRepository(&database.DB{Tx: tx})
	inventoryRepo := repository.NewInventoryRepository(&database.DB{Tx: tx})

	order := &models.Order{
		BusinessID: businessID,
		ShopID:     shopID,
		CustomerID: customerID,
		Status:     models.OrderStatusPending,
		Notes:      req.Notes,
		CreatedBy:  &userID,
	}

	if err := orderRepo.Create(order); err != nil {
		return nil, err
	}

	totalItems := 0
	lines := make([]*models.OrderLine, 0, len(req.Lines))

	for _, lineInput := range req.Lines {
		productID, err := uuid.Parse(lineInput.ProductID)
		if err != nil {
			return nil, errors.New("INVALID_PRODUCT_ID")
		}

		variantID, err := uuid.Parse(lineInput.VariantID)
		if err != nil {
			return nil, errors.New("INVALID_VARIANT_ID")
		}

		product, err := s.productRepo.GetByID(productID)
		if err != nil {
			return nil, errors.New("PRODUCT_NOT_FOUND")
		}
		if product.BusinessID != businessID {
			return nil, errors.New("FORBIDDEN")
		}

		variant, err := s.variantRepo.GetByID(variantID)
		if err != nil {
			return nil, errors.New("VARIANT_NOT_FOUND")
		}
		if variant.ProductID != productID {
			return nil, errors.New("VARIANT_NOT_PRODUCT")
		}

		line := &models.OrderLine{
			OrderID:   order.ID,
			ProductID: productID,
			VariantID: variantID,
			Quantity:  lineInput.Quantity,
			UnitPrice: variant.SalePrice,
		}
		if err := orderRepo.CreateLine(line); err != nil {
			return nil, err
		}
		lines = append(lines, line)
		totalItems += lineInput.Quantity
	}

	for _, line := range lines {
		inv, err := inventoryRepo.GetByShopAndVariant(shopID, line.VariantID)
		if err != nil {
			return nil, errors.New("INVENTORY_NOT_FOUND")
		}

		available := inv.Quantity - inv.ReservedQuantity
		if available < line.Quantity {
			return nil, fmt.Errorf("INSUFFICIENT_STOCK")
		}

		_, err = inventoryRepo.ReserveAtomic(shopID, line.VariantID, line.Quantity)
		if err != nil {
			if err.Error() == "insufficient_stock" {
				return nil, errors.New("INSUFFICIENT_STOCK")
			}
			return nil, err
		}

		history := &models.OrderStatusHistory{
			OrderID:   order.ID,
			Status:    models.OrderStatusPending,
			ChangedBy: &userID,
			Notes:     "Order created",
		}
		if err := orderRepo.CreateStatusHistory(history); err != nil {
			return nil, err
		}
	}

	if err := orderRepo.UpdateTotalItems(order.ID, totalItems); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	order.TotalItems = totalItems

	lineResponses := make([]models.OrderLineResponse, len(lines))
	for i, l := range lines {
		lineResponses[i] = models.OrderLineResponse{
			ID:        l.ID,
			OrderID:   l.OrderID,
			ProductID: l.ProductID,
			VariantID: l.VariantID,
			Quantity:  l.Quantity,
			UnitPrice: l.UnitPrice,
			CreatedAt: l.CreatedAt,
		}
	}

	return &models.OrderWithLinesResponse{
		Order: s.toOrderResponse(order),
		Lines: lineResponses,
	}, nil
}

// CreateBuyerOrder creates an order from a buyer with optional point redemption
func (s *OrderService) CreateBuyerOrder(buyerProfileID uuid.UUID, req *models.BuyerCreateOrderRequest) (*models.OrderWithLinesResponse, error) {
	shopID, err := uuid.Parse(req.ShopID)
	if err != nil {
		return nil, errors.New("INVALID_SHOP_ID")
	}

	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return nil, errors.New("SHOP_NOT_FOUND")
	}
	if shop.Status != "ACTIVE" {
		return nil, errors.New("SHOP_NOT_ACTIVE")
	}

	businessID := shop.BusinessID

	buyerProfile, err := s.buyerRepo.GetByID(buyerProfileID)
	if err != nil {
		return nil, errors.New("BUYER_PROFILE_NOT_FOUND")
	}
	if buyerProfile == nil {
		return nil, errors.New("BUYER_PROFILE_NOT_FOUND")
	}

	// Idempotency check
	if req.IdempotencyKey != nil && *req.IdempotencyKey != "" {
		existing, err := s.orderRepo.GetByBuyerAndIdempotencyKey(buyerProfileID, *req.IdempotencyKey)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return nil, errors.New("DUPLICATE_ORDER")
		}
	}

	baseTotal, err := s.pointRedemptionSvc.CalculateOrderTotals(req.Items, shopID)
	if err != nil {
		return nil, err
	}

	var pointsToUse int
	var pointsDiscountAmount float64
	var finalTotal float64

	if req.UsePoints {
		preview, err := s.pointRedemptionSvc.GetRedemptionPreview(buyerProfileID, shopID, req.Items, true)
		if err != nil {
			return nil, err
		}
		pointsToUse = preview.MaximumUsablePoints
		pointsDiscountAmount = preview.PointsDiscountAmount
		finalTotal = preview.FinalTotal
	} else {
		finalTotal = baseTotal
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	txOrderRepo := repository.NewOrderRepository(&database.DB{Tx: tx})
	txInventoryRepo := repository.NewInventoryRepository(&database.DB{Tx: tx})

	order := &models.Order{
		BusinessID:           businessID,
		ShopID:               shopID,
		CustomerID:           nil,
		BuyerProfileID:       &buyerProfileID,
		Status:               models.OrderStatusPending,
		Notes:                "",
		CreatedBy:            nil,
		BaseTotal:            baseTotal,
		PointsUsed:           pointsToUse,
		PointsDiscountAmount: pointsDiscountAmount,
		FinalTotal:           finalTotal,
		IdempotencyKey:       req.IdempotencyKey,
	}

	if err := txOrderRepo.Create(order); err != nil {
		return nil, err
	}

	totalItems := 0
	lines := make([]*models.OrderLine, 0, len(req.Items))

	for _, lineInput := range req.Items {
		productID, err := uuid.Parse(lineInput.ProductID)
		if err != nil {
			return nil, errors.New("INVALID_PRODUCT_ID")
		}

		variantID, err := uuid.Parse(lineInput.VariantID)
		if err != nil {
			return nil, errors.New("INVALID_VARIANT_ID")
		}

		variant, err := s.variantRepo.GetByID(variantID)
		if err != nil {
			return nil, errors.New("VARIANT_NOT_FOUND")
		}
		if variant.ProductID != productID {
			return nil, errors.New("VARIANT_NOT_PRODUCT")
		}

		var pointsDiscountPerUnit float64
		var finalUnitPrice float64
		if req.UsePoints && pointsToUse > 0 {
			pointsDiscountPerUnit = (pointsDiscountAmount / baseTotal) * variant.SalePrice
			finalUnitPrice = variant.SalePrice - pointsDiscountPerUnit
			if finalUnitPrice < 0 {
				finalUnitPrice = 0
			}
		} else {
			finalUnitPrice = variant.SalePrice
		}

		line := &models.OrderLine{
			OrderID:               order.ID,
			ProductID:             productID,
			VariantID:             variantID,
			Quantity:              lineInput.Quantity,
			UnitPrice:             variant.SalePrice,
			BaseUnitPrice:         variant.SalePrice,
			PointsDiscountPerUnit: pointsDiscountPerUnit,
			FinalUnitPrice:        finalUnitPrice,
		}
		if err := txOrderRepo.CreateLine(line); err != nil {
			return nil, err
		}
		lines = append(lines, line)
		totalItems += lineInput.Quantity
	}

	for _, line := range lines {
		inv, err := txInventoryRepo.GetByShopAndVariant(shopID, line.VariantID)
		if err != nil {
			return nil, errors.New("INVENTORY_NOT_FOUND")
		}

		available := inv.Quantity - inv.ReservedQuantity
		if available < line.Quantity {
			return nil, errors.New("INSUFFICIENT_STOCK")
		}

		_, err = txInventoryRepo.ReserveAtomic(shopID, line.VariantID, line.Quantity)
		if err != nil {
			if err.Error() == "insufficient_stock" {
				return nil, errors.New("INSUFFICIENT_STOCK")
			}
			return nil, err
		}
	}

	// Reserve points atomically within the same transaction
	if req.UsePoints && pointsToUse > 0 {
		if err := s.pointRedemptionSvc.ReservePointsForOrder(buyerProfileID, order.ID, pointsToUse, models.PointTransactionRefRedemptionProduct, &database.DB{Tx: tx}); err != nil {
			return nil, err
		}
	}

	history := &models.OrderStatusHistory{
		OrderID:   order.ID,
		Status:    models.OrderStatusPending,
		ChangedBy: nil,
		Notes:     "Buyer order created",
	}
	if err := txOrderRepo.CreateStatusHistory(history); err != nil {
		return nil, err
	}

	if err := txOrderRepo.UpdateTotalItems(order.ID, totalItems); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	order.TotalItems = totalItems

	lineResponses := make([]models.OrderLineResponse, len(lines))
	for i, l := range lines {
		lineResponses[i] = models.OrderLineResponse{
			ID:                    l.ID,
			OrderID:               l.OrderID,
			ProductID:             l.ProductID,
			VariantID:             l.VariantID,
			Quantity:              l.Quantity,
			UnitPrice:             l.UnitPrice,
			BaseUnitPrice:         l.BaseUnitPrice,
			PointsDiscountPerUnit: l.PointsDiscountPerUnit,
			FinalUnitPrice:        l.FinalUnitPrice,
			CreatedAt:             l.CreatedAt,
		}
	}

	orderResp := s.toOrderResponse(order)
	orderResp.BaseTotal = baseTotal
	orderResp.PointsUsed = pointsToUse
	orderResp.PointsDiscountAmount = pointsDiscountAmount
	orderResp.FinalTotal = finalTotal

	return &models.OrderWithLinesResponse{
		Order:   orderResp,
		Lines:   lineResponses,
		History: nil,
	}, nil
}

func (s *OrderService) getBuyerOrder(buyerProfileID, orderID uuid.UUID) (*models.Order, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, errors.New("ORDER_NOT_FOUND")
	}
	if order.BuyerProfileID == nil || *order.BuyerProfileID != buyerProfileID {
		return nil, errors.New("FORBIDDEN")
	}
	return order, nil
}

func deliveryFeeForMethod(shop *models.Shop, method string) (float64, error) {
	switch method {
	case models.DeliveryMethodPickup:
		return 0, nil
	case models.DeliveryMethodShopDelivery:
		if !shop.SupportsShopDelivery {
			return 0, errors.New("DELIVERY_NOT_AVAILABLE")
		}
		return shop.ShopDeliveryFee, nil
	case models.DeliveryMethodPartner:
		if !shop.SupportsPartnerDelivery || shop.PartnerDeliveryProvider == "" {
			return 0, errors.New("DELIVERY_NOT_AVAILABLE")
		}
		return shop.PartnerDeliveryFee, nil
	}
	return 0, errors.New("INVALID_DELIVERY_METHOD")
}

// GetDeliveryOptions returns the available delivery options for a buyer order.
func (s *OrderService) GetDeliveryOptions(buyerProfileID, orderID uuid.UUID) (*models.DeliveryOptionsResponse, error) {
	order, err := s.getBuyerOrder(buyerProfileID, orderID)
	if err != nil {
		return nil, err
	}

	shop, err := s.shopRepo.GetByID(order.ShopID)
	if err != nil {
		return nil, errors.New("SHOP_NOT_FOUND")
	}

	options := []models.DeliveryOption{
		{Method: models.DeliveryMethodPickup, Label: "Retrait au magasin", Fee: 0, Available: true},
	}
	if shop.SupportsShopDelivery {
		options = append(options, models.DeliveryOption{
			Method: models.DeliveryMethodShopDelivery, Label: "Livraison par le magasin", Fee: shop.ShopDeliveryFee, Available: true,
		})
	}
	if shop.SupportsPartnerDelivery && shop.PartnerDeliveryProvider != "" {
		options = append(options, models.DeliveryOption{
			Method: models.DeliveryMethodPartner, Label: "Livraison par partenaire", Fee: shop.PartnerDeliveryFee, Provider: shop.PartnerDeliveryProvider, Available: true,
		})
	}

	return &models.DeliveryOptionsResponse{
		OrderID: order.ID,
		ShopID:  order.ShopID,
		Options: options,
		Current: order.DeliveryMethod,
	}, nil
}

// SelectDelivery sets the delivery method + address on an order and reserves
// delivery points when requested. Changing delivery before a payment is created
// releases the previous delivery point reservation and recalculates.
func (s *OrderService) SelectDelivery(buyerProfileID, orderID uuid.UUID, req *models.SelectDeliveryRequest) (*models.DeliverySelectResponse, error) {
	order, err := s.getBuyerOrder(buyerProfileID, orderID)
	if err != nil {
		return nil, err
	}
	if order.Status != models.OrderStatusPending && order.Status != models.OrderStatusAccepted {
		return nil, errors.New("INVALID_STATUS_TRANSITION")
	}

	method := req.Method
	if method != models.DeliveryMethodPickup && method != models.DeliveryMethodShopDelivery && method != models.DeliveryMethodPartner {
		return nil, errors.New("INVALID_DELIVERY_METHOD")
	}

	hasPayment, err := s.paymentRepo.ExistsByOrderID(orderID)
	if err != nil {
		return nil, err
	}
	if hasPayment {
		return nil, errors.New("PAYMENT_ALREADY_CREATED")
	}

	shop, err := s.shopRepo.GetByID(order.ShopID)
	if err != nil {
		return nil, errors.New("SHOP_NOT_FOUND")
	}

	feeBase, err := deliveryFeeForMethod(shop, method)
	if err != nil {
		return nil, err
	}

	if method != models.DeliveryMethodPickup && strings.TrimSpace(req.Address) == "" {
		return nil, errors.New("DELIVERY_ADDRESS_REQUIRED")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	txOrderRepo := repository.NewOrderRepository(&database.DB{Tx: tx})

	// Release previous delivery point reservation if any
	if order.DeliveryMethod != "" && order.DeliveryPointsUsed > 0 {
		if err := s.pointRedemptionSvc.ReleaseReservedPoints(buyerProfileID, orderID, order.DeliveryPointsUsed, models.PointTransactionRefRedemptionDelivery, &database.DB{Tx: tx}); err != nil {
			return nil, err
		}
	}

	used, discount, feeFinal, _, err := s.pointRedemptionSvc.CalculateDeliveryPointsSelection(buyerProfileID, feeBase, req.UsePointsForDelivery)
	if err != nil {
		return nil, err
	}

	if used > 0 {
		if err := s.pointRedemptionSvc.ReservePointsForOrder(buyerProfileID, orderID, used, models.PointTransactionRefRedemptionDelivery, &database.DB{Tx: tx}); err != nil {
			return nil, err
		}
	}

	delivery := *order
	delivery.DeliveryMethod = method
	delivery.DeliveryFeeBase = feeBase
	delivery.DeliveryPointsUsed = used
	delivery.DeliveryPointsDiscount = discount
	delivery.DeliveryFeeFinal = feeFinal
	delivery.DeliveryContactName = req.ContactName
	delivery.DeliveryPhone = req.Phone
	delivery.DeliveryAddress = req.Address
	delivery.DeliveryNotes = req.Notes

	if err := txOrderRepo.UpdateDelivery(orderID, &delivery); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &models.DeliverySelectResponse{
		OrderID:       order.ID,
		ProductsTotal: order.FinalTotal,
		Delivery: models.DeliverySummary{
			Method:      method,
			FeeBase:     feeBase,
			PointsUsed:  used,
			PointsDiscount: discount,
			FeeFinal:    feeFinal,
			ContactName: req.ContactName,
			Phone:       req.Phone,
			Address:     req.Address,
			Notes:       req.Notes,
		},
		TotalDue: order.FinalTotal + feeFinal,
	}, nil
}

// GetDeliveryPointsPreview returns a non-spending preview of delivery point use.
func (s *OrderService) GetDeliveryPointsPreview(buyerProfileID, orderID uuid.UUID, req *models.DeliveryPointsPreviewRequest) (*models.DeliveryPointsPreviewResponse, error) {
	order, err := s.getBuyerOrder(buyerProfileID, orderID)
	if err != nil {
		return nil, err
	}
	if order.DeliveryMethod == "" {
		return nil, errors.New("DELIVERY_NOT_SELECTED")
	}

	resp, err := s.pointRedemptionSvc.GetDeliveryPointsPreview(buyerProfileID, order.DeliveryFeeBase, req.UsePointsForDelivery)
	if err != nil {
		return nil, err
	}
	resp.Method = order.DeliveryMethod
	return resp, nil
}

// GetOrderPointsPreview returns the product point redemption preview for an
// existing buyer order. It never spends points.
func (s *OrderService) GetOrderPointsPreview(buyerProfileID, orderID uuid.UUID, req *models.OrderPointsPreviewRequest) (*models.PointRedemptionPreviewResponse, error) {
	order, err := s.getBuyerOrder(buyerProfileID, orderID)
	if err != nil {
		return nil, err
	}

	lines, err := s.orderRepo.GetLinesByOrderID(orderID)
	if err != nil {
		return nil, err
	}

	items := make([]models.OrderLineInput, 0, len(lines))
	for _, l := range lines {
		items = append(items, models.OrderLineInput{
			ProductID: l.ProductID.String(),
			VariantID: l.VariantID.String(),
			Quantity:  l.Quantity,
		})
	}

	return s.pointRedemptionSvc.GetRedemptionPreview(buyerProfileID, order.ShopID, items, req.UsePoints)
}

// GetOrderRaw returns an order without access checks (for internal use).
func (s *OrderService) GetOrderRaw(orderID uuid.UUID) (*models.Order, error) {
	return s.orderRepo.GetByID(orderID)
}

func (s *OrderService) GetOrderByID(userID, orderID uuid.UUID) (*models.OrderWithLinesResponse, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, errors.New("ORDER_NOT_FOUND")
	}

	if err := s.RequireShopAccess(userID, order.ShopID); err != nil {
		return nil, err
	}

	lines, err := s.orderRepo.GetLinesByOrderID(orderID)
	if err != nil {
		return nil, err
	}

	history, err := s.orderRepo.GetHistoryByOrderID(orderID)
	if err != nil {
		return nil, err
	}

	lineResponses := make([]models.OrderLineResponse, len(lines))
	for i, l := range lines {
		lineResponses[i] = models.OrderLineResponse{
			ID:        l.ID,
			OrderID:   l.OrderID,
			ProductID: l.ProductID,
			VariantID: l.VariantID,
			Quantity:  l.Quantity,
			UnitPrice: l.UnitPrice,
			CreatedAt: l.CreatedAt,
		}
	}

	historyResponses := make([]models.OrderStatusHistoryResponse, len(history))
	for i, h := range history {
		historyResponses[i] = models.OrderStatusHistoryResponse{
			ID:        h.ID,
			OrderID:   h.OrderID,
			Status:    string(h.Status),
			ChangedBy: h.ChangedBy,
			Notes:     h.Notes,
			CreatedAt: h.CreatedAt,
		}
	}

	return &models.OrderWithLinesResponse{
		Order:   s.toOrderResponse(order),
		Lines:   lineResponses,
		History: historyResponses,
	}, nil
}

func (s *OrderService) ListShopOrders(userID, shopID uuid.UUID) ([]*models.Order, error) {
	if err := s.RequireShopAccess(userID, shopID); err != nil {
		return nil, err
	}

	return s.orderRepo.GetByShopID(shopID)
}

func (s *OrderService) ListBusinessOrders(userID, businessID uuid.UUID) ([]*models.Order, error) {
	if err := s.requireMembership(userID, businessID); err != nil {
		return nil, err
	}

	return s.orderRepo.GetByBusinessID(businessID)
}

func (s *OrderService) ListBuyerOrders(buyerProfileID uuid.UUID) ([]*models.Order, error) {
	return s.orderRepo.GetByBuyerProfileID(buyerProfileID)
}

func (s *OrderService) GetBuyerOrderByID(buyerProfileID, orderID uuid.UUID) (*models.OrderWithLinesResponse, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, errors.New("ORDER_NOT_FOUND")
	}

	if order.BuyerProfileID == nil || *order.BuyerProfileID != buyerProfileID {
		return nil, errors.New("FORBIDDEN")
	}

	lines, err := s.orderRepo.GetLinesByOrderID(orderID)
	if err != nil {
		return nil, err
	}

	history, err := s.orderRepo.GetHistoryByOrderID(orderID)
	if err != nil {
		return nil, err
	}

	lineResponses := make([]models.OrderLineResponse, len(lines))
	for i, l := range lines {
		lineResponses[i] = models.OrderLineResponse{
			ID:                    l.ID,
			OrderID:               l.OrderID,
			ProductID:             l.ProductID,
			VariantID:             l.VariantID,
			Quantity:              l.Quantity,
			UnitPrice:             l.UnitPrice,
			BaseUnitPrice:         l.BaseUnitPrice,
			PointsDiscountPerUnit: l.PointsDiscountPerUnit,
			FinalUnitPrice:        l.FinalUnitPrice,
			CreatedAt:             l.CreatedAt,
		}
	}

	historyResponses := make([]models.OrderStatusHistoryResponse, len(history))
	for i, h := range history {
		historyResponses[i] = models.OrderStatusHistoryResponse{
			ID:        h.ID,
			OrderID:   h.OrderID,
			Status:    string(h.Status),
			ChangedBy: h.ChangedBy,
			Notes:     h.Notes,
			CreatedAt: h.CreatedAt,
		}
	}

	orderResp := s.toOrderResponse(order)
	orderResp.BaseTotal = order.BaseTotal
	orderResp.PointsUsed = order.PointsUsed
	orderResp.PointsDiscountAmount = order.PointsDiscountAmount
	orderResp.FinalTotal = order.FinalTotal

	return &models.OrderWithLinesResponse{
		Order:   orderResp,
		Lines:   lineResponses,
		History: historyResponses,
	}, nil
}

func (s *OrderService) AcceptOrder(userID, orderID uuid.UUID) (*models.Order, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, errors.New("ORDER_NOT_FOUND")
	}

	if order.Status != models.OrderStatusPending {
		return nil, errors.New("INVALID_STATUS_TRANSITION")
	}

	if err := s.RequireShopAccess(userID, order.ShopID); err != nil {
		return nil, err
	}

	employee, _ := s.employeeRepo.GetByLinkedUserID(userID)
	changedBy := &userID
	if employee != nil {
		changedBy = &employee.ID
	}

	history := &models.OrderStatusHistory{
		OrderID:   orderID,
		Status:    models.OrderStatusAccepted,
		ChangedBy: changedBy,
		Notes:     "Order accepted",
	}
	if err := s.orderRepo.CreateStatusHistory(history); err != nil {
		return nil, err
	}

	updatedOrder, err := s.orderRepo.UpdateStatus(orderID, models.OrderStatusAccepted)
	if err != nil {
		return nil, err
	}

	return updatedOrder, nil
}

func (s *OrderService) RejectOrder(userID, orderID uuid.UUID) (*models.Order, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, errors.New("ORDER_NOT_FOUND")
	}

	if order.Status != models.OrderStatusPending {
		return nil, errors.New("INVALID_STATUS_TRANSITION")
	}

	if err := s.RequireShopAccess(userID, order.ShopID); err != nil {
		return nil, err
	}

	employee, _ := s.employeeRepo.GetByLinkedUserID(userID)
	changedBy := &userID
	if employee != nil {
		changedBy = &employee.ID
	}

	history := &models.OrderStatusHistory{
		OrderID:   orderID,
		Status:    models.OrderStatusRejected,
		ChangedBy: changedBy,
		Notes:     "Order rejected",
	}
	if err := s.orderRepo.CreateStatusHistory(history); err != nil {
		return nil, err
	}

	lines, err := s.orderRepo.GetLinesByOrderID(orderID)
	if err != nil {
		return nil, err
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	inventoryRepo := repository.NewInventoryRepository(&database.DB{Tx: tx})

	for _, line := range lines {
		_, err := inventoryRepo.ReleaseAtomic(order.ShopID, line.VariantID, line.Quantity)
		if err != nil {
			return nil, err
		}
	}

	// Release reserved points if this was a buyer order with points
	if order.BuyerProfileID != nil && order.PointsUsed > 0 {
		if err := s.pointRedemptionSvc.ReleaseReservedPoints(*order.BuyerProfileID, orderID, order.PointsUsed, models.PointTransactionRefRedemptionProduct, &database.DB{Tx: tx}); err != nil {
			return nil, err
		}
	}
	// Release reserved delivery points if any
	if order.BuyerProfileID != nil && order.DeliveryPointsUsed > 0 {
		if err := s.pointRedemptionSvc.ReleaseReservedPoints(*order.BuyerProfileID, orderID, order.DeliveryPointsUsed, models.PointTransactionRefRedemptionDelivery, &database.DB{Tx: tx}); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	updatedOrder, err := s.orderRepo.UpdateStatus(orderID, models.OrderStatusRejected)
	if err != nil {
		return nil, err
	}

	return updatedOrder, nil
}

func (s *OrderService) PrepareOrder(userID, orderID uuid.UUID) (*models.Order, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, errors.New("ORDER_NOT_FOUND")
	}

	if order.Status != models.OrderStatusAccepted {
		return nil, errors.New("INVALID_STATUS_TRANSITION")
	}

	if err := s.RequireShopAccess(userID, order.ShopID); err != nil {
		return nil, err
	}

	employee, _ := s.employeeRepo.GetByLinkedUserID(userID)
	changedBy := &userID
	if employee != nil {
		changedBy = &employee.ID
	}

	history := &models.OrderStatusHistory{
		OrderID:   orderID,
		Status:    models.OrderStatusPreparing,
		ChangedBy: changedBy,
		Notes:     "Order being prepared",
	}
	if err := s.orderRepo.CreateStatusHistory(history); err != nil {
		return nil, err
	}

	updatedOrder, err := s.orderRepo.UpdateStatus(orderID, models.OrderStatusPreparing)
	if err != nil {
		return nil, err
	}

	return updatedOrder, nil
}

func (s *OrderService) CompleteOrder(userID, orderID uuid.UUID) (*models.Order, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, errors.New("ORDER_NOT_FOUND")
	}

	if order.Status != models.OrderStatusPreparing {
		return nil, errors.New("INVALID_STATUS_TRANSITION")
	}

	if err := s.RequireShopAccess(userID, order.ShopID); err != nil {
		return nil, err
	}

	employee, _ := s.employeeRepo.GetByLinkedUserID(userID)
	changedBy := &userID
	if employee != nil {
		changedBy = &employee.ID
	}

	history := &models.OrderStatusHistory{
		OrderID:   orderID,
		Status:    models.OrderStatusCompleted,
		ChangedBy: changedBy,
		Notes:     "Order completed",
	}
	if err := s.orderRepo.CreateStatusHistory(history); err != nil {
		return nil, err
	}

	lines, err := s.orderRepo.GetLinesByOrderID(orderID)
	if err != nil {
		return nil, err
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	inventoryRepo := repository.NewInventoryRepository(&database.DB{Tx: tx})
	stockMovementRepo := repository.NewStockMovementRepository(&database.DB{Tx: tx})

	for _, line := range lines {
		inv, err := inventoryRepo.ClaimReservedAtomic(order.ShopID, line.VariantID, line.Quantity)
		if err != nil {
			return nil, err
		}

		stockMovement := models.StockMovement{
			BusinessID:       order.BusinessID,
			ShopID:           order.ShopID,
			ProductID:        line.ProductID,
			VariantID:        &line.VariantID,
			MovementType:     models.StockMovementTypeSaleOnline,
			Quantity:         -line.Quantity,
			PreviousQuantity: inv.Quantity + line.Quantity,
			NewQuantity:      inv.Quantity,
			Notes:            fmt.Sprintf("Order %s completed", order.ID.String()),
			PerformedBy:      &userID,
		}
		if err := stockMovementRepo.Create(&stockMovement); err != nil {
			return nil, err
		}
	}

	// Consume reserved points if this was a buyer order with points and the
	// payment-verification worker has not already finalized them.
	if order.BuyerProfileID != nil && order.PointsUsed > 0 && !order.PointsFinalized {
		if err := s.pointRedemptionSvc.ConsumeReservedPoints(*order.BuyerProfileID, orderID, order.PointsUsed, models.PointTransactionRefRedemptionProduct, &database.DB{Tx: tx}); err != nil {
			return nil, err
		}
	}
	if order.BuyerProfileID != nil && order.DeliveryPointsUsed > 0 && !order.PointsFinalized {
		if err := s.pointRedemptionSvc.ConsumeReservedPoints(*order.BuyerProfileID, orderID, order.DeliveryPointsUsed, models.PointTransactionRefRedemptionDelivery, &database.DB{Tx: tx}); err != nil {
			return nil, err
		}
	}
	if !order.PointsFinalized {
		if err := repository.NewOrderRepository(&database.DB{Tx: tx}).SetPointsFinalized(orderID); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	updatedOrder, err := s.orderRepo.UpdateStatus(orderID, models.OrderStatusCompleted)
	if err != nil {
		return nil, err
	}

	var employeeID *uuid.UUID
	if employee != nil {
		employeeID = &employee.ID
	}

	s.createCashPaymentFromOrder(order, lines, employeeID)

	return updatedOrder, nil
}

func (s *OrderService) createCashPaymentFromOrder(order *models.Order, lines []*models.OrderLine, employeeID *uuid.UUID) (*models.CashPayment, error) {
	var totalAmount float64
	for _, line := range lines {
		totalAmount += line.UnitPrice * float64(line.Quantity)
	}

	if totalAmount <= 0 {
		return nil, nil
	}

	var openSession *models.CashSession
	if employeeID != nil {
		openSession, _ = s.cashRepo.GetOpenSessionByEmployeeShop(employeeID, order.ShopID)
	} else {
		openSession, _ = s.cashRepo.GetOpenSessionByShop(order.ShopID)
	}

	payment := &models.CashPayment{
		BusinessID:    order.BusinessID,
		ShopID:        order.ShopID,
		EmployeeID:    employeeID,
		CustomerID:    order.CustomerID,
		ReferenceType: models.CashReferenceTypeOrder,
		ReferenceID:   order.ID,
		Amount:        totalAmount,
		Currency:      "USD",
		Status:        models.CashPaymentStatusConfirmed,
	}

	if openSession != nil {
		payment.CashSessionID = &openSession.ID
	}

	if err := s.cashRepo.CreatePayment(payment); err != nil {
		return nil, err
	}

	if openSession != nil {
		_ = s.cashRepo.UpdateSessionSalesTotal(openSession.ID)
		_ = s.cashRepo.RecalculateExpected(openSession.ID)
	}

	return payment, nil
}

func (s *OrderService) CancelOrder(userID, orderID uuid.UUID) (*models.Order, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, errors.New("ORDER_NOT_FOUND")
	}

	if order.Status != models.OrderStatusPending && order.Status != models.OrderStatusAccepted {
		return nil, errors.New("INVALID_STATUS_TRANSITION")
	}

	if err := s.RequireShopAccess(userID, order.ShopID); err != nil {
		return nil, err
	}

	employee, _ := s.employeeRepo.GetByLinkedUserID(userID)
	changedBy := &userID
	if employee != nil {
		changedBy = &employee.ID
	}

	history := &models.OrderStatusHistory{
		OrderID:   orderID,
		Status:    models.OrderStatusCancelled,
		ChangedBy: changedBy,
		Notes:     "Order cancelled",
	}
	if err := s.orderRepo.CreateStatusHistory(history); err != nil {
		return nil, err
	}

	lines, err := s.orderRepo.GetLinesByOrderID(orderID)
	if err != nil {
		return nil, err
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	inventoryRepo := repository.NewInventoryRepository(&database.DB{Tx: tx})

	for _, line := range lines {
		_, err := inventoryRepo.ReleaseAtomic(order.ShopID, line.VariantID, line.Quantity)
		if err != nil {
			return nil, err
		}
	}

	// Release reserved points if this was a buyer order with points
	if order.BuyerProfileID != nil && order.PointsUsed > 0 {
		if err := s.pointRedemptionSvc.ReleaseReservedPoints(*order.BuyerProfileID, orderID, order.PointsUsed, models.PointTransactionRefRedemptionProduct, &database.DB{Tx: tx}); err != nil {
			return nil, err
		}
	}
	// Release reserved delivery points if any
	if order.BuyerProfileID != nil && order.DeliveryPointsUsed > 0 {
		if err := s.pointRedemptionSvc.ReleaseReservedPoints(*order.BuyerProfileID, orderID, order.DeliveryPointsUsed, models.PointTransactionRefRedemptionDelivery, &database.DB{Tx: tx}); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	updatedOrder, err := s.orderRepo.UpdateStatus(orderID, models.OrderStatusCancelled)
	if err != nil {
		return nil, err
	}

	return updatedOrder, nil
}

// CancelBuyerOrder allows a buyer to cancel their own PENDING/ACCEPTED order.
func (s *OrderService) CancelBuyerOrder(buyerProfileID, orderID uuid.UUID) (*models.Order, error) {
	order, err := s.getBuyerOrder(buyerProfileID, orderID)
	if err != nil {
		return nil, err
	}
	if order.Status != models.OrderStatusPending && order.Status != models.OrderStatusAccepted {
		return nil, errors.New("INVALID_STATUS_TRANSITION")
	}

	history := &models.OrderStatusHistory{
		OrderID: orderID,
		Status:  models.OrderStatusCancelled,
		Notes:   "Order cancelled by buyer",
	}
	if err := s.orderRepo.CreateStatusHistory(history); err != nil {
		return nil, err
	}

	lines, err := s.orderRepo.GetLinesByOrderID(orderID)
	if err != nil {
		return nil, err
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	inventoryRepo := repository.NewInventoryRepository(&database.DB{Tx: tx})

	for _, line := range lines {
		_, err := inventoryRepo.ReleaseAtomic(order.ShopID, line.VariantID, line.Quantity)
		if err != nil {
			return nil, err
		}
	}

	if order.PointsUsed > 0 {
		if err := s.pointRedemptionSvc.ReleaseReservedPoints(buyerProfileID, orderID, order.PointsUsed, models.PointTransactionRefRedemptionProduct, &database.DB{Tx: tx}); err != nil {
			return nil, err
		}
	}
	if order.DeliveryPointsUsed > 0 {
		if err := s.pointRedemptionSvc.ReleaseReservedPoints(buyerProfileID, orderID, order.DeliveryPointsUsed, models.PointTransactionRefRedemptionDelivery, &database.DB{Tx: tx}); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	updatedOrder, err := s.orderRepo.UpdateStatus(orderID, models.OrderStatusCancelled)
	if err != nil {
		return nil, err
	}

	return updatedOrder, nil
}

func (s *OrderService) toOrderResponse(order *models.Order) models.OrderResponse {
	return models.OrderResponse{
		ID:                    order.ID,
		BusinessID:            order.BusinessID,
		ShopID:                order.ShopID,
		CustomerID:            order.CustomerID,
		BuyerProfileID:        order.BuyerProfileID,
		Status:                string(order.Status),
		TotalItems:            order.TotalItems,
		Notes:                 order.Notes,
		CreatedBy:             order.CreatedBy,
		BaseTotal:             order.BaseTotal,
		PointsUsed:            order.PointsUsed,
		PointsDiscountAmount:  order.PointsDiscountAmount,
		FinalTotal:            order.FinalTotal,
		IdempotencyKey:        order.IdempotencyKey,
		OrderNumber:           order.OrderNumber,
		DeliveryMethod:        order.DeliveryMethod,
		DeliveryFeeBase:       order.DeliveryFeeBase,
		DeliveryPointsUsed:    order.DeliveryPointsUsed,
		DeliveryPointsDiscount: order.DeliveryPointsDiscount,
		DeliveryFeeFinal:      order.DeliveryFeeFinal,
		DeliveryContactName:   order.DeliveryContactName,
		DeliveryPhone:         order.DeliveryPhone,
		DeliveryAddress:       order.DeliveryAddress,
		DeliveryNotes:         order.DeliveryNotes,
		PointsFinalized:       order.PointsFinalized,
		AcceptedAt:            order.AcceptedAt,
		PreparingAt:           order.PreparingAt,
		ReadyAt:               order.ReadyAt,
		OutForDeliveryAt:      order.OutForDeliveryAt,
		DeliveredAt:           order.DeliveredAt,
		ReceivedAt:            order.ReceivedAt,
		CompletedAt:           order.CompletedAt,
		CreatedAt:             order.CreatedAt,
		UpdatedAt:             order.UpdatedAt,
	}
}

func (s *OrderService) GetOrderEvents() []models.OrderEvent {
	s.eventsMutex.RLock()
	defer s.eventsMutex.RUnlock()

	events := make([]models.OrderEvent, len(s.orderEvents))
	copy(events, s.orderEvents)
	return events
}

func (s *OrderService) emitEvent(event models.OrderEvent) {
	s.eventsMutex.Lock()
	s.orderEvents = append(s.orderEvents, event)
	s.eventsMutex.Unlock()
}
