package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	redislib "github.com/btmi-ai-market/backend/internal/redis"
	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/email"
	"github.com/btmi-ai-market/backend/internal/handlers/auth"
	"github.com/btmi-ai-market/backend/internal/handlers/buyer"
	"github.com/btmi-ai-market/backend/internal/handlers/businesses"
	"github.com/btmi-ai-market/backend/internal/handlers/cash"
	"github.com/btmi-ai-market/backend/internal/handlers/categories"
	"github.com/btmi-ai-market/backend/internal/handlers/customers"
	"github.com/btmi-ai-market/backend/internal/handlers/employees"
	"github.com/btmi-ai-market/backend/internal/handlers/growth"
	"github.com/btmi-ai-market/backend/internal/handlers/inventory"
	"github.com/btmi-ai-market/backend/internal/handlers/marketplace"
	"github.com/btmi-ai-market/backend/internal/handlers/orders"
	"github.com/btmi-ai-market/backend/internal/handlers/shops"
	"github.com/btmi-ai-market/backend/internal/middleware"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/hibiken/asynq"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	migrationsDir := getMigrationsDir()

	db, err := database.Connect(
		cfg.DBHost, cfg.DBPort, cfg.DBName,
		cfg.DBUser, cfg.DBPassword,
	)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.RunMigrations(migrationsDir); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	activationRepo := repository.NewActivationTokenRepository(db)
	refreshTokenRepo := repository.NewRefreshTokenRepository(db)
	businessRepo := repository.NewBusinessRepository(db)
	membershipRepo := repository.NewMembershipRepository(db)
	shopRepo := repository.NewShopRepository(db)
	employeeRepo := repository.NewEmployeeRepository(db)
	assignmentRepo := repository.NewAssignmentRepository(db)
	productRepo := repository.NewProductRepository(db)
	variantRepo := repository.NewVariantRepository(db)
	inventoryRepo := repository.NewInventoryRepository(db)
	stockMovementRepo := repository.NewStockMovementRepository(db)
	receiptRepo := repository.NewReceiptRepository(db)
	orderRepo := repository.NewOrderRepository(db)
	customerRepo := repository.NewCustomerRepository(db)
	cashRepo := repository.NewCashRepository(db)
	buyerProfileRepo := repository.NewBuyerProfileRepository(db)
	pointAccountRepo := repository.NewPointAccountRepository(db)
	pointTxnRepo := repository.NewPointTransactionRepository(db)
	levelRepo := repository.NewLevelRepository(db)
	verifiedTxnRepo := repository.NewVerifiedTransactionRepository(db)
	confirmRepo := repository.NewPurchaseConfirmationRepository(db)
	trustRepo := repository.NewSellerTrustRepository(db)
	marketplaceRepo := repository.NewMarketplaceRepository(db, productRepo)
	categoryRepo := repository.NewCategoryRepository(db)
	pointConfigRepo := repository.NewPointConfigRepository(db)
	buyerPaymentRepo := repository.NewBuyerPaymentRepository(db)
	reviewRepo := repository.NewReviewRepository(db)
	employeeInvitationRepo := repository.NewEmployeeInvitationRepository(db)
	employeeActivationTokenRepo := repository.NewEmployeeActivationTokenRepository(db)

	redisClient := redislib.NewClient(cfg)
	asynqClient := asynq.NewClient(asynq.RedisClientOpt{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})
	defer asynqClient.Close()

	rankRepo := repository.NewRankingRepository(redisClient, marketplaceRepo)
	categoryRankingService := service.NewCategoryRankingService(redisClient, rankRepo, marketplaceRepo, categoryRepo, pointAccountRepo, levelRepo, trustRepo)

	_ = repository.NewSimilarityRepository(redisClient, marketplaceRepo, productRepo)
	similarityService := service.NewSimilarityService(productRepo, marketplaceRepo, categoryRepo, pointAccountRepo, levelRepo, trustRepo)

	pointRedemptionService := service.NewPointRedemptionService(pointAccountRepo, pointTxnRepo, levelRepo, productRepo, variantRepo, inventoryRepo, shopRepo, buyerProfileRepo, pointConfigRepo)

	emailService := email.NewService(cfg)
	authService := service.NewAuthService(userRepo, activationRepo, refreshTokenRepo, emailService, cfg)
	businessService := service.NewBusinessService(userRepo, businessRepo, membershipRepo, db)
	shopService := service.NewShopService(shopRepo, membershipRepo, db)
	employeeService := service.NewEmployeeService(
		employeeRepo, assignmentRepo, shopRepo, membershipRepo,
		employeeInvitationRepo, employeeActivationTokenRepo,
		userRepo, emailService, cfg, db)
	inventoryService := service.NewInventoryService(inventoryRepo, stockMovementRepo, shopRepo, productRepo, variantRepo, receiptRepo, assignmentRepo, membershipRepo, employeeRepo, categoryRepo, db, asynqClient)
	orderService := service.NewOrderService(orderRepo, inventoryRepo, stockMovementRepo, shopRepo, productRepo, variantRepo, assignmentRepo, membershipRepo, employeeRepo, customerRepo, cashRepo, buyerProfileRepo, buyerPaymentRepo, pointRedemptionService, db)
	customerService := service.NewCustomerService(customerRepo, shopRepo, membershipRepo, db)
	cashService := service.NewCashService(cashRepo, shopRepo, employeeRepo, assignmentRepo, membershipRepo, db)
	buyerProfileService := service.NewBuyerProfileService(buyerProfileRepo, userRepo, pointAccountRepo, levelRepo)
	pointService := service.NewPointService(pointAccountRepo, pointTxnRepo, levelRepo, buyerProfileRepo)
	purchaseConfirmationService := service.NewPurchaseConfirmationService(confirmRepo, verifiedTxnRepo, orderRepo, shopRepo, cashRepo, pointService, trustRepo, asynqClient)
	paymentService := service.NewPaymentService(buyerPaymentRepo, orderRepo, shopRepo, pointAccountRepo, pointTxnRepo, levelRepo, buyerProfileRepo, pointConfigRepo, pointRedemptionService, pointService, verifiedTxnRepo, trustRepo, membershipRepo, employeeRepo, assignmentRepo, asynqClient, db)
	marketplaceService := service.NewMarketplaceService(marketplaceRepo, pointService)
	categoryService := service.NewCategoryService(categoryRepo)
	sellerGrowthService := service.NewSellerGrowthService(pointAccountRepo, levelRepo, trustRepo)
	reviewService := service.NewReviewService(reviewRepo, trustRepo, categoryRankingService, asynqClient)

	// Start background job to rebuild rankings on startup
	go func() {
		time.Sleep(10 * time.Second)
		if err := categoryRankingService.RebuildAllCategories(context.Background()); err != nil {
			log.Printf("Initial ranking rebuild failed: %v", err)
		} else {
			log.Println("Initial ranking rebuild completed")
		}
	}()

	authHandler := auth.NewHandler(authService, employeeService)
	businessHandler := businesses.NewHandler(businessService)
	shopHandler := shops.NewHandler(shopService)
	employeeHandler := employees.NewHandler(employeeService)
	inventoryHandler := inventory.NewHandler(inventoryService)
	orderHandler := orders.NewHandler(orderService, pointRedemptionService, buyerProfileService, paymentService)
	reviewHandler := orders.NewReviewHandler(reviewService, buyerProfileService)
	customerHandler := customers.NewHandler(customerService)
	cashHandler := cash.NewHandler(cashService)
	buyerHandler := buyer.NewHandler(buyerProfileService, pointService, purchaseConfirmationService)
	marketplaceHandler := marketplace.NewHandler(marketplaceService, categoryRankingService, similarityService, pointService, buyerProfileService, categoryService)
	marketplaceReviewHandler := marketplace.NewReviewHandler(reviewService)
	categoryHandler := categories.NewHandler(categoryService)
	growthHandler := growth.NewHandler(sellerGrowthService, pointService, membershipRepo)

	router := gin.Default()

	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	router.GET("/swagger/doc.json", func(c *gin.Context) {
		c.File(filepath.Join(getDocsDir(), "swagger.json"))
	})

	router.GET("/swagger", func(c *gin.Context) {
		c.Header("Content-Type", "text/html; charset=utf-8")
		c.String(http.StatusOK, swaggerUIHTML)
	})

	router.GET("/swagger/index.html", func(c *gin.Context) {
		c.Header("Content-Type", "text/html; charset=utf-8")
		c.String(http.StatusOK, swaggerUIHTML)
	})

	api := router.Group("/api/v1")
	{
authGroup := api.Group("/auth")
	{
		authGroup.POST("/register", authHandler.Register)
		authGroup.POST("/register/seller", authHandler.RegisterSeller)
		authGroup.GET("/activate", authHandler.Activate)
		authGroup.POST("/resend-activation", authHandler.ResendActivation)
		authGroup.POST("/login", authHandler.Login)
		authGroup.POST("/refresh", authHandler.Refresh)
		authGroup.POST("/logout", authHandler.Logout)
		authGroup.POST("/employee/invite/accept", authHandler.AcceptEmployeeInvitation)
		authGroup.GET("/me", middleware.AuthMiddleware(authService), authHandler.Me)
	}

		businessesGroup := api.Group("/businesses")
		businessesGroup.Use(middleware.AuthMiddleware(authService))
		{
			businessesGroup.POST("", businessHandler.Create)
			businessesGroup.GET("", businessHandler.List)
			businessesGroup.GET("/:business_id", businessHandler.Get)

			businessesGroup.POST("/:business_id/shops", shopHandler.Create)
			businessesGroup.GET("/:business_id/shops", shopHandler.List)

			businessesGroup.POST("/:business_id/employees", employeeHandler.Create)
			businessesGroup.GET("/:business_id/employees", employeeHandler.List)

			businessesGroup.POST("/:business_id/products", inventoryHandler.CreateProduct)
			businessesGroup.GET("/:business_id/products", inventoryHandler.ListProducts)
			businessesGroup.GET("/:business_id/products/:product_id", inventoryHandler.GetProduct)
			businessesGroup.PATCH("/:business_id/products/:product_id", inventoryHandler.UpdateProduct)

			businessesGroup.POST("/:business_id/products/:product_id/variants", inventoryHandler.CreateVariant)
			businessesGroup.GET("/:business_id/products/:product_id/variants", inventoryHandler.ListVariants)

			businessesGroup.POST("/:business_id/receipts", inventoryHandler.ReceiveStock)
			businessesGroup.GET("/:business_id/receipts", inventoryHandler.ListReceipts)

			businessesGroup.GET("/:business_id/stock/history", inventoryHandler.GetBusinessStockHistory)

			businessesGroup.GET("/:business_id/orders", orderHandler.ListBusinessOrders)

			businessesGroup.POST("/:business_id/customers", customerHandler.CreateCustomer)
			businessesGroup.GET("/:business_id/customers", customerHandler.ListBusinessCustomers)

			businessesGroup.GET("/:business_id/cash-sessions", cashHandler.ListBusinessSessions)
			businessesGroup.GET("/:business_id/cash-summary", cashHandler.GetBusinessCashSummary)

			businessesGroup.GET("/:business_id/growth/points", growthHandler.GetPoints)
			businessesGroup.GET("/:business_id/growth/level", growthHandler.GetLevel)
			businessesGroup.GET("/:business_id/growth/benefits", growthHandler.GetBenefits)
			businessesGroup.GET("/:business_id/growth/history", growthHandler.GetHistory)
		}

		customersGroup := api.Group("/customers")
		customersGroup.Use(middleware.AuthMiddleware(authService))
		{
			customersGroup.GET("/:customer_id", customerHandler.GetCustomer)
			customersGroup.PATCH("/:customer_id", customerHandler.UpdateCustomer)
			customersGroup.GET("/:customer_id/orders", customerHandler.GetCustomerOrders)
		}

		shopsGroup := api.Group("/shops")
		shopsGroup.Use(middleware.AuthMiddleware(authService))
		{
			shopsGroup.GET("/:shop_id", shopHandler.Get)
			shopsGroup.PATCH("/:shop_id", shopHandler.Update)

			shopsGroup.POST("/:shop_id/stock", inventoryHandler.AddStock)
			shopsGroup.POST("/:shop_id/sales", inventoryHandler.RecordSale)
			shopsGroup.GET("/:shop_id/inventory", inventoryHandler.GetShopInventory)
			shopsGroup.GET("/:shop_id/movements", inventoryHandler.GetStockMovements)
			shopsGroup.GET("/:shop_id/stock/history", inventoryHandler.GetShopStockHistory)
			shopsGroup.GET("/:shop_id/employees", employeeHandler.ListShopEmployees)

			shopsGroup.POST("/:shop_id/reserve", inventoryHandler.ReserveStock)
			shopsGroup.POST("/:shop_id/release", inventoryHandler.ReleaseStock)

			shopsGroup.POST("/:shop_id/orders", orderHandler.CreateOrder)
			shopsGroup.GET("/:shop_id/orders", orderHandler.ListShopOrders)

			shopsGroup.POST("/:shop_id/cash-sessions/open", cashHandler.OpenCashSession)
			shopsGroup.GET("/:shop_id/cash-sessions", cashHandler.ListShopSessions)
			shopsGroup.GET("/:shop_id/cash-sessions/open", cashHandler.GetOpenSession)
			shopsGroup.GET("/:shop_id/cash-summary", cashHandler.GetShopCashSummary)
			shopsGroup.GET("/:shop_id/cash-payments", cashHandler.ListShopPayments)
		}

		ordersGroup := api.Group("/orders")
		ordersGroup.Use(middleware.AuthMiddleware(authService))
		{
			ordersGroup.GET("/:order_id", orderHandler.GetOrder)
			ordersGroup.POST("/:order_id/accept", orderHandler.AcceptOrder)
			ordersGroup.POST("/:order_id/reject", orderHandler.RejectOrder)
			ordersGroup.POST("/:order_id/prepare", orderHandler.PrepareOrder)
			ordersGroup.POST("/:order_id/complete", orderHandler.CompleteOrder)
			ordersGroup.POST("/:order_id/cancel", orderHandler.CancelOrder)
			ordersGroup.POST("/:order_id/tracking/status", orderHandler.SellerTransitionOrder)
		}

		variantsGroup := api.Group("/variants")
		variantsGroup.Use(middleware.AuthMiddleware(authService))
		{
			variantsGroup.GET("/:variant_id", inventoryHandler.GetVariant)
			variantsGroup.PATCH("/:variant_id", inventoryHandler.UpdateVariant)
			variantsGroup.GET("/:variant_id/inventory", inventoryHandler.GetVariantInventory)
			variantsGroup.GET("/:variant_id/stock/history", inventoryHandler.GetVariantStockHistory)
		}

		receiptsGroup := api.Group("/receipts")
		receiptsGroup.Use(middleware.AuthMiddleware(authService))
		{
			receiptsGroup.GET("/:receipt_id", inventoryHandler.GetReceipt)
		}

		employeesGroup := api.Group("/employees")
		employeesGroup.Use(middleware.AuthMiddleware(authService))
		{
			employeesGroup.GET("/me", employeeHandler.Me)
			employeesGroup.GET("/:employee_id", employeeHandler.Get)
			employeesGroup.PATCH("/:employee_id", employeeHandler.Update)
			employeesGroup.POST("/:employee_id/shops", employeeHandler.AssignToShop)
			employeesGroup.DELETE("/:employee_id/shops/:shop_id", employeeHandler.RemoveFromShop)
			employeesGroup.GET("/:employee_id/shops", employeeHandler.ListEmployeeShops)
			employeesGroup.GET("/:employee_id/cash-sessions", cashHandler.ListEmployeeSessions)
			employeesGroup.POST("/:employee_id/invite", employeeHandler.CreateInvitation)
		}

		cashSessionsGroup := api.Group("/cash-sessions")
		cashSessionsGroup.Use(middleware.AuthMiddleware(authService))
		{
			cashSessionsGroup.GET("/:session_id", cashHandler.GetSession)
			cashSessionsGroup.POST("/:session_id/close", cashHandler.CloseSession)
			cashSessionsGroup.POST("/:session_id/reconcile", cashHandler.ReconcileSession)
			cashSessionsGroup.GET("/:session_id/payments", cashHandler.GetSessionPayments)
		}

		cashPaymentsGroup := api.Group("/cash-payments")
		cashPaymentsGroup.Use(middleware.AuthMiddleware(authService))
		{
			cashPaymentsGroup.GET("/:payment_id", cashHandler.GetPayment)
		}

		paymentsGroup := api.Group("/payments")
		paymentsGroup.Use(middleware.AuthMiddleware(authService))
		{
			paymentsGroup.POST("/:payment_id/seller-confirm", orderHandler.SellerConfirmPayment)
		}

buyerGroup := api.Group("/buyer")
buyerGroup.Use(middleware.AuthMiddleware(authService))
{
	buyerGroup.POST("/profile", buyerHandler.CreateProfile)
	buyerGroup.GET("/profile", buyerHandler.GetProfile)
	buyerGroup.PATCH("/profile", buyerHandler.UpdateProfile)
	buyerGroup.GET("/points", buyerHandler.GetPoints)
	buyerGroup.GET("/points/history", buyerHandler.GetPointsHistory)
	buyerGroup.GET("/purchases/pending", buyerHandler.GetPendingPurchases)
	buyerGroup.POST("/purchases/:purchase_id/confirm", buyerHandler.ConfirmPurchase)

	// Buyer order endpoints
	buyerGroup.POST("/orders/preview", orderHandler.PreviewOrder)
	buyerGroup.POST("/orders", orderHandler.CreateBuyerOrder)
	buyerGroup.GET("/orders", orderHandler.ListBuyerOrders)
	buyerGroup.GET("/orders/:order_id", orderHandler.GetBuyerOrder)
	buyerGroup.GET("/orders/:order_id/delivery-options", orderHandler.GetDeliveryOptions)
	buyerGroup.POST("/orders/:order_id/delivery", orderHandler.SelectDelivery)
	buyerGroup.POST("/orders/:order_id/delivery-points-preview", orderHandler.DeliveryPointsPreview)
	buyerGroup.POST("/orders/:order_id/points-preview", orderHandler.OrderPointsPreview)
	buyerGroup.POST("/orders/:order_id/payment", orderHandler.CreateBuyerPayment)
	buyerGroup.GET("/orders/:order_id/payment", orderHandler.GetBuyerPayment)
	buyerGroup.POST("/payments/:payment_id/buyer-confirm", orderHandler.BuyerConfirmPayment)
	buyerGroup.POST("/orders/:order_id/cancel", orderHandler.CancelBuyerOrder)
	buyerGroup.POST("/orders/:order_id/received", orderHandler.ConfirmBuyerReceived)
	buyerGroup.GET("/orders/:order_id/tracking", orderHandler.GetOrderTracking)
	buyerGroup.GET("/orders/:order_id/review-eligibility", reviewHandler.GetReviewEligibility)
	buyerGroup.POST("/orders/:order_id/review", reviewHandler.CreateReview)
	buyerGroup.PATCH("/reviews/:review_id", reviewHandler.UpdateReview)
	buyerGroup.DELETE("/reviews/:review_id", reviewHandler.WithdrawReview)
	buyerGroup.GET("/reviews", reviewHandler.ListBuyerReviews)
}

		marketplaceGroup := api.Group("/marketplace")
		marketplaceGroup.Use(middleware.OptionalAuthMiddleware(authService))
		{
			marketplaceGroup.GET("/shops", marketplaceHandler.ListShops)
			marketplaceGroup.GET("/shops/:shop_id", marketplaceHandler.GetShop)
			marketplaceGroup.GET("/shops/:shop_id/detail", marketplaceHandler.GetShopDetail)
			marketplaceGroup.GET("/shops/:shop_id/products", marketplaceHandler.ListShopProducts)
			marketplaceGroup.GET("/products", marketplaceHandler.ListProducts)
			marketplaceGroup.GET("/products/:product_id", marketplaceHandler.GetProduct)
			marketplaceGroup.GET("/products/:product_id/detail", marketplaceHandler.GetProductDetail)
			marketplaceGroup.GET("/products/:product_id/price", marketplaceHandler.GetProductPrice)
			marketplaceGroup.GET("/products/:product_id/similar", marketplaceHandler.GetSimilarProducts)
			marketplaceGroup.GET("/search", marketplaceHandler.SearchProducts)
			marketplaceGroup.GET("/categories", marketplaceHandler.ListCategories)
			marketplaceGroup.GET("/categories/:category_slug/subcategories", marketplaceHandler.ListSubcategories)
			marketplaceGroup.GET("/categories/:category_slug/products", marketplaceHandler.ListProductsByCategory)
		marketplaceGroup.GET("/categories/:category_slug/shops", marketplaceHandler.ListCategoryTopShops)
		marketplaceGroup.GET("/shops/:shop_id/reviews", marketplaceReviewHandler.GetShopReviews)
	}

		// Category endpoints for sellers (public read for dropdowns)
		categoriesGroup := api.Group("/categories")
		categoriesGroup.Use(middleware.OptionalAuthMiddleware(authService))
		{
			categoriesGroup.GET("", categoryHandler.ListCategories)
			categoriesGroup.GET("/:category_id/subcategories", categoryHandler.ListSubcategories)
		}

		eventsGroup := api.Group("/events")
		eventsGroup.Use(middleware.AuthMiddleware(authService))
		{
			eventsGroup.GET("/stock", inventoryHandler.GetStockEvents)
		}
	}

	addr := fmt.Sprintf(":%s", cfg.APIPort)
	log.Printf("Server starting on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

const swaggerUIHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>BTMI Market API Documentation</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css">
    <style>
        html { box-sizing: border-box; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin: 0; background: #fafafa; }
        .topbar { display: none; }
        .info .title { font-size: 1.5em; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: "/swagger/doc.json",
                dom_id: '#swagger-ui',
                deepLinking: true,
                filter: true,
                tryItOutEnabled: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout"
            });
            window.ui = ui;
        };
    </script>
</body>
</html>`

func getDocsDir() string {
	if dir := os.Getenv("DOCS_DIR"); dir != "" {
		return dir
	}
	return "./docs"
}

func getMigrationsDir() string {
	if dir := os.Getenv("MIGRATIONS_DIR"); dir != "" {
		return dir
	}

	execPath, err := os.Executable()
	if err != nil {
		return "./migrations"
	}

	return filepath.Join(filepath.Dir(execPath), "migrations")
}
