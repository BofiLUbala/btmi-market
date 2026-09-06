package orders_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/database"
	adminhandlers "github.com/btmi-ai-market/backend/internal/handlers/admin"
	orderhandlers "github.com/btmi-ai-market/backend/internal/handlers/orders"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
)

func TestTBKCentralizedDeliveryFlow(t *testing.T) {
	cfg := config.Load()
	db, err := database.Connect(
		cfg.DBHost, cfg.DBPort, cfg.DBName,
		cfg.DBUser, cfg.DBPassword,
	)
	if err != nil {
		t.Skipf("Skipping real DB test: database connection failed: %v", err)
	}
	defer db.Close()

	// Ensure migration 047 is applied
	if err := db.RunMigrations("../../../migrations"); err != nil {
		t.Logf("migrations warning: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	orderRepo := repository.NewOrderRepository(db)
	shopRepo := repository.NewShopRepository(db)
	inventoryRepo := repository.NewInventoryRepository(db)
	stockMovementRepo := repository.NewStockMovementRepository(db)
	productRepo := repository.NewProductRepository(db)
	variantRepo := repository.NewVariantRepository(db)
	assignmentRepo := repository.NewAssignmentRepository(db)
	membershipRepo := repository.NewMembershipRepository(db)
	employeeRepo := repository.NewEmployeeRepository(db)
	customerRepo := repository.NewCustomerRepository(db)
	cashRepo := repository.NewCashRepository(db)
	buyerProfileRepo := repository.NewBuyerProfileRepository(db)
	buyerPaymentRepo := repository.NewBuyerPaymentRepository(db)
	pointAccountRepo := repository.NewPointAccountRepository(db)
	pointTxnRepo := repository.NewPointTransactionRepository(db)
	levelRepo := repository.NewLevelRepository(db)
	pointConfigRepo := repository.NewPointConfigRepository(db)
	adminPlatformRepo := repository.NewAdminPlatformRepository(db.DB)
	verifiedTxnRepo := repository.NewVerifiedTransactionRepository(db)
	trustRepo := repository.NewSellerTrustRepository(db)
	auditRepo := repository.NewAuditRepository(db)
	adminRepo := repository.NewAdminRepository(db)

	asynqClient := asynq.NewClient(asynq.RedisClientOpt{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})
	defer asynqClient.Close()

	pointRedemptionService := service.NewPointRedemptionService(
		pointAccountRepo, pointTxnRepo, levelRepo, productRepo,
		variantRepo, inventoryRepo, shopRepo, buyerProfileRepo, pointConfigRepo,
	)
	pointService := service.NewPointService(pointAccountRepo, pointTxnRepo, levelRepo, buyerProfileRepo, adminPlatformRepo)
	buyerProfileService := service.NewBuyerProfileService(buyerProfileRepo, userRepo, pointAccountRepo, levelRepo)
	orderService := service.NewOrderService(
		orderRepo, inventoryRepo, stockMovementRepo, shopRepo, productRepo,
		variantRepo, assignmentRepo, membershipRepo, employeeRepo, customerRepo,
		cashRepo, buyerProfileRepo, buyerPaymentRepo, pointRedemptionService, db,
	)
	paymentService := service.NewPaymentService(
		buyerPaymentRepo, orderRepo, shopRepo, pointAccountRepo, pointTxnRepo,
		levelRepo, buyerProfileRepo, pointConfigRepo, pointRedemptionService,
		pointService, verifiedTxnRepo, trustRepo, membershipRepo, employeeRepo,
		assignmentRepo, asynqClient, db,
	)
	adminCommerceRepo := repository.NewAdminCommerceRepository(db)
	adminCommerceService := service.NewAdminCommerceService(db, adminCommerceRepo, productRepo, inventoryRepo, stockMovementRepo, auditRepo)

	orderHandler := orderhandlers.NewHandler(orderService, pointRedemptionService, buyerProfileService, paymentService)
	adminCommerceHandler := adminhandlers.NewCommerceHandler(adminCommerceService)

	// Create test buyer user & profile
	buyerUserID := uuid.New()
	buyerEmail := "tbk_buyer_" + buyerUserID.String()[:8] + "@example.com"
	buyerPhone := "+243" + buyerUserID.String()[:8]
	_, err = db.Exec(`INSERT INTO users (id, email, password_hash, first_name, last_name, phone, status, account_type) 
		VALUES ($1, $2, 'hash', 'Digital', 'Myla', $3, 'ACTIVE', 'BUYER')`,
		buyerUserID, buyerEmail, buyerPhone)
	if err != nil {
		t.Fatalf("failed to create buyer user: %v", err)
	}

	buyerProfile := &models.BuyerProfile{
		ID:        uuid.New(),
		UserID:    buyerUserID,
		FirstName: "Digital",
		LastName:  "Myla",
		Email:     buyerEmail,
		Phone:     "989805612",
		Address:   "Masina",
		Commune:   "Masina",
		City:      "Kinshasa",
		Country:   "DRC",
		Status:    "ACTIVE",
	}
	if err := buyerProfileRepo.Create(buyerProfile); err != nil {
		t.Fatalf("failed to create buyer profile: %v", err)
	}

	// Create point account for the buyer
	_ = pointAccountRepo.CreateOrUpdate(&models.PointAccount{
		ID:             uuid.New(),
		OwnerType:      models.PointOwnerTypeBuyer,
		OwnerID:        buyerProfile.ID,
		CurrentPoints:  5000,
		LifetimePoints: 5000,
		Status:         "ACTIVE",
	})

	// Create test business & shop (Shop without shop delivery configured to test centralized TBK delivery availability)
	bizID := uuid.New()
	_, err = db.Exec(`INSERT INTO businesses (id, name, business_type, category, phone, whatsapp, email, country, city, default_currency, status) 
		VALUES ($1, 'TBK Test Biz', 'RETAIL', 'GENERAL', '123456789', '123456789', 'tbk@test.com', 'DRC', 'Kinshasa', 'CDF', 'ACTIVE')`, bizID)
	if err != nil {
		t.Fatalf("failed to insert test business: %v", err)
	}

	shopID := uuid.New()
	_, err = db.Exec(`INSERT INTO shops (id, business_id, name, type, city, address, phone, status, supports_shop_delivery, shop_delivery_fee) 
		VALUES ($1, $2, 'TBK Test Shop', 'PHYSICAL', 'Kinshasa', 'Centre-ville', '123456789', 'ACTIVE', FALSE, 2500)`, shopID, bizID)
	if err != nil {
		t.Fatalf("failed to insert test shop: %v", err)
	}

	// Create a test order
	orderID := uuid.New()
	order := &models.Order{
		ID:             orderID,
		BusinessID:     bizID,
		ShopID:         shopID,
		BuyerProfileID: &buyerProfile.ID,
		Status:         models.OrderStatusPending,
		TotalItems:     1,
		BaseTotal:      50000,
		FinalTotal:     50000,
	}
	if err := orderRepo.Create(order); err != nil {
		t.Fatalf("failed to create order: %v", err)
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Buyer auth mock middleware
	buyerAuth := func(c *gin.Context) {
		c.Set("user_id", buyerUserID)
		c.Set("buyer_profile_id", buyerProfile.ID)
		c.Next()
	}

	// Admin auth mock middleware
	superAdmin, _ := adminRepo.GetFirstSuperAdmin()
	adminAuth := func(c *gin.Context) {
		if superAdmin != nil {
			c.Set("admin_id", superAdmin.ID)
			c.Set("admin_role", superAdmin.Role)
		} else {
			c.Set("admin_id", uuid.New())
			c.Set("admin_role", models.AdminRoleSuperAdmin)
		}
		c.Next()
	}

	buyerGroup := router.Group("/api/v1/buyer")
	buyerGroup.Use(buyerAuth)
	{
		buyerGroup.GET("/orders/:order_id/delivery-options", orderHandler.GetDeliveryOptions)
		buyerGroup.POST("/orders/:order_id/delivery", orderHandler.SelectDelivery)
	}

	adminGroup := router.Group("/api/v1/admin/commerce")
	adminGroup.Use(adminAuth)
	{
		adminGroup.POST("/orders/:id/assign-courier", adminCommerceHandler.AssignCourier)
	}

	// 1. Test GET /delivery-options returns single TBK Delivery option
	t.Run("GET delivery-options returns canonical TBK delivery", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/buyer/orders/"+orderID.String()+"/delivery-options", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp struct {
			Data models.DeliveryOptionsResponse `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to unmarshal: %v", err)
		}

		if len(resp.Data.Options) != 1 {
			t.Fatalf("expected exactly 1 TBK delivery option, got %d", len(resp.Data.Options))
		}
		opt := resp.Data.Options[0]
		if opt.Method != models.DeliveryMethodTBK {
			t.Errorf("expected method %s, got %s", models.DeliveryMethodTBK, opt.Method)
		}
		if opt.Provider != "TBK" {
			t.Errorf("expected provider TBK, got %s", opt.Provider)
		}
		if !opt.Available {
			t.Errorf("expected delivery option to be available")
		}
	})

	// 2. Test direct backend validations for empty fields
	t.Run("Validation failure for missing address or contact", func(t *testing.T) {
		// Missing address
		payload := models.SelectDeliveryRequest{
			ContactName: "Digital Myla",
			Phone:       "989805612",
			Address:     "",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/buyer/orders/"+orderID.String()+"/delivery", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request, got %d", w.Code)
		}
	})

	// 3. Test successful delivery save with TBK Centralized Delivery
	t.Run("Save TBK delivery without method selection required", func(t *testing.T) {
		payload := models.SelectDeliveryRequest{
			ContactName: "Digital Myla",
			Phone:       "989805612",
			Address:     "Masina, Kinshasa",
			Notes:       "Appeler à l'arrivée",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/buyer/orders/"+orderID.String()+"/delivery", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}

		var resp struct {
			Data models.DeliverySelectResponse `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to unmarshal response: %v", err)
		}

		if resp.Data.Delivery.Method != models.DeliveryMethodTBK {
			t.Errorf("expected method %s, got %s", models.DeliveryMethodTBK, resp.Data.Delivery.Method)
		}
		if resp.Data.Delivery.Status != models.DeliveryStatusPendingTBK {
			t.Errorf("expected status %s, got %s", models.DeliveryStatusPendingTBK, resp.Data.Delivery.Status)
		}
		if resp.Data.Delivery.Address != "Masina, Kinshasa" {
			t.Errorf("expected address 'Masina, Kinshasa', got '%s'", resp.Data.Delivery.Address)
		}

		// Verify database persistence
		saved, err := orderRepo.GetByID(orderID)
		if err != nil {
			t.Fatalf("failed to fetch saved order: %v", err)
		}
		if saved.DeliveryMethod != models.DeliveryMethodTBK {
			t.Errorf("persisted delivery method mismatch: got %s, want %s", saved.DeliveryMethod, models.DeliveryMethodTBK)
		}
		if saved.DeliveryStatus != models.DeliveryStatusPendingTBK {
			t.Errorf("persisted delivery status mismatch: got %s, want %s", saved.DeliveryStatus, models.DeliveryStatusPendingTBK)
		}
		if saved.DeliveryContactName != "Digital Myla" {
			t.Errorf("persisted contact name mismatch: %s", saved.DeliveryContactName)
		}
	})

	// 4. Test Payment continuation is unblocked
	t.Run("Payment continuation works once delivery is saved", func(t *testing.T) {
		payment, err := paymentService.CreatePayment(buyerProfile.ID, orderID)
		if err != nil {
			t.Fatalf("payment creation failed: %v", err)
		}
		if payment == nil || payment.OrderID != orderID {
			t.Fatalf("invalid payment returned: %+v", payment)
		}
		if payment.CashDue <= 0 {
			t.Errorf("expected positive cash due, got %f", payment.CashDue)
		}
	})

	// 5. Test Authorized TBK Admin assigns courier
	t.Run("TBK Admin assigns courier", func(t *testing.T) {
		courierUserID := uuid.New()
		courierEmail := "courier_" + courierUserID.String()[:8] + "@tbk.cd"
		courierPhone := "+243" + courierUserID.String()[:8]
		_, err = db.Exec(`INSERT INTO users (id, email, password_hash, first_name, last_name, phone, status, account_type) 
			VALUES ($1, $2, 'hash', 'TBK', 'Courier', $3, 'ACTIVE', 'SELLER')`,
			courierUserID, courierEmail, courierPhone)
		if err != nil {
			t.Fatalf("failed to create courier user: %v", err)
		}

		assignPayload := models.AssignCourierRequest{
			CourierID: courierUserID,
			Notes:     "Assigned to TBK Courier Express",
		}
		body, _ := json.Marshal(assignPayload)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/commerce/orders/"+orderID.String()+"/assign-courier", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200 OK for admin courier assignment, got %d: %s", w.Code, w.Body.String())
		}

		// Verify order in database
		updated, err := orderRepo.GetByID(orderID)
		if err != nil {
			t.Fatalf("failed to fetch updated order: %v", err)
		}
		if updated.AssignedCourierID == nil || *updated.AssignedCourierID != courierUserID {
			t.Errorf("courier not assigned in DB")
		}
		if updated.DeliveryStatus != models.DeliveryStatusCourierAssigned {
			t.Errorf("expected delivery status %s, got %s", models.DeliveryStatusCourierAssigned, updated.DeliveryStatus)
		}
		if updated.CourierAssignedAt == nil || updated.CourierAssignedAt.IsZero() {
			t.Errorf("courier_assigned_at timestamp not set")
		}
	})

	// Clean up test data
	_, _ = db.Exec("DELETE FROM buyer_payments WHERE order_id = $1", orderID)
	_, _ = db.Exec("DELETE FROM orders WHERE id = $1", orderID)
	_, _ = db.Exec("DELETE FROM shops WHERE id = $1", shopID)
	_, _ = db.Exec("DELETE FROM businesses WHERE id = $1", bizID)
	_, _ = db.Exec("DELETE FROM buyer_profiles WHERE id = $1", buyerProfile.ID)
	_, _ = db.Exec("DELETE FROM users WHERE id IN ($1, $2)", buyerUserID, buyerUserID)
	time.Sleep(10 * time.Millisecond)
}
