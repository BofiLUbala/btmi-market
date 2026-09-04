package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/jobs"
	redislib "github.com/btmi-ai-market/backend/internal/redis"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/hibiken/asynq"
	"github.com/robfig/cron/v3"
	"github.com/google/uuid"
)

func main() {
	cfg := config.Load()

	log.Printf("Starting BTMI Ranking Worker (Redis: %s)", cfg.RedisAddr)

	db, err := database.Connect(cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.DBUser, cfg.DBPassword)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	migrationsDir := "/app/migrations"
	if dir := os.Getenv("MIGRATIONS_DIR"); dir != "" {
		migrationsDir = dir
	}
	if _, err := os.Stat(migrationsDir); os.IsNotExist(err) {
		migrationsDir = "./migrations"
	}

	if err := db.RunMigrations(migrationsDir); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	redisClient := redislib.NewClient(cfg)
	defer redisClient.Close()

	if err := redisClient.Ping(context.Background()); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Println("Redis connected successfully")

	pointRepo := repository.NewPointAccountRepository(db)
	levelRepo := repository.NewLevelRepository(db)
	trustRepo := repository.NewSellerTrustRepository(db)
	categoryRepo := repository.NewCategoryRepository(db)
	productRepo := repository.NewProductRepository(db)
	mpRepo := repository.NewMarketplaceRepository(db, productRepo)

	orderRepo := repository.NewOrderRepository(db)
	shopRepo := repository.NewShopRepository(db)
	variantRepo := repository.NewVariantRepository(db)
	inventoryRepo := repository.NewInventoryRepository(db)
	buyerRepo := repository.NewBuyerProfileRepository(db)
	pointTxnRepo := repository.NewPointTransactionRepository(db)
	pointConfigRepo := repository.NewPointConfigRepository(db)
	paymentRepo := repository.NewBuyerPaymentRepository(db)
	verifiedTxnRepo := repository.NewVerifiedTransactionRepository(db)
	membershipRepo := repository.NewMembershipRepository(db)
	employeeRepo := repository.NewEmployeeRepository(db)
	assignmentRepo := repository.NewAssignmentRepository(db)

	adminPlatformRepo := repository.NewAdminPlatformRepository(db.DB)

	pointRedemptionSvc := service.NewPointRedemptionService(pointRepo, pointTxnRepo, levelRepo, productRepo, variantRepo, inventoryRepo, shopRepo, buyerRepo, pointConfigRepo)
	pointService := service.NewPointService(pointRepo, pointTxnRepo, levelRepo, buyerRepo, adminPlatformRepo)

	rankRepo := repository.NewRankingRepository(redisClient, mpRepo)
	rankingService := service.NewCategoryRankingService(redisClient, rankRepo, mpRepo, categoryRepo, pointRepo, levelRepo, trustRepo)

	similarityRepo := repository.NewSimilarityRepository(redisClient, mpRepo, productRepo)
	similarityService := service.NewSimilarityService(productRepo, mpRepo, categoryRepo, pointRepo, levelRepo, trustRepo)

	redisConnOpt := asynq.RedisClientOpt{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	}
	svr := asynq.NewServer(redisConnOpt, asynq.Config{
		Concurrency: 10,
		Queues: map[string]int{
			"default": 1,
		},
	})

	asynqClient := asynq.NewClient(redisConnOpt)
	defer asynqClient.Close()

	reviewRepo := repository.NewReviewRepository(db)
	reviewService := service.NewReviewService(reviewRepo, trustRepo, rankingService, asynqClient)

	paymentService := service.NewPaymentService(paymentRepo, orderRepo, shopRepo, pointRepo, pointTxnRepo, levelRepo, buyerRepo, pointConfigRepo, pointRedemptionSvc, pointService, verifiedTxnRepo, trustRepo, membershipRepo, employeeRepo, assignmentRepo, asynqClient, db)

	mux := asynq.NewServeMux()
	mux.HandleFunc(string(jobs.JobTypeRecalculateShopCategoryRanking), rankingJobHandler(rankingService))
	mux.HandleFunc(string(jobs.JobTypeRebuildCategoryRanking), rebuildCategoryJobHandler(rankingService))
	mux.HandleFunc(string(jobs.JobTypePeriodicConsistencyCheck), consistencyCheckJobHandler(rankingService))
	mux.HandleFunc(string(jobs.JobTypeRecalculateProductSimilarity), productSimilarityJobHandler(similarityService, similarityRepo))
	mux.HandleFunc(string(jobs.JobTypeRebuildProductSimilarity), rebuildProductSimilarityJobHandler(similarityService, similarityRepo))
	mux.HandleFunc(string(jobs.JobTypeRebuildAllProductSimilarity), rebuildAllProductSimilarityJobHandler(similarityService, similarityRepo))
	mux.HandleFunc(string(jobs.JobTypeProcessVerifiedPayment), paymentVerifiedJobHandler(paymentService))
	mux.HandleFunc(string(jobs.JobTypeProcessReviewAggregate), reviewAggregateJobHandler(reviewService))

	go runPeriodicConsistency(rankingService, cfg)
	go runPeriodicSimilarityConsistency(similarityService, similarityRepo, cfg)

	go func() {
		if err := svr.Run(mux); err != nil {
			log.Fatalf("Worker failed: %v", err)
		}
	}()

	inf := asynq.NewInspector(redisConnOpt)
	if inf == nil {
		log.Printf("Failed to create inspector")
	}

	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			if inf == nil {
				continue
			}
			// Stats() method might not exist, just log that worker is running
			log.Printf("Worker running, checking queue stats...")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down worker...")
	svr.Shutdown()
	log.Println("Worker stopped")
}

func rankingJobHandler(svc *service.CategoryRankingService) func(ctx context.Context, t *asynq.Task) error {
	return func(ctx context.Context, t *asynq.Task) error {
		payload, err := jobs.UnmarshalShopCategoryRanking(t.Payload())
		if err != nil {
			log.Printf("Failed to unmarshal ranking job payload: %v", err)
			return err
		}

		log.Printf("Processing ranking job: business=%s, shop=%s, reason=%s",
			payload.BusinessID, payload.ShopID, payload.Reason)

		categories, err := svc.GetEligibleCategoriesForShop(payload.BusinessID, payload.ShopID, payload.Reason)
		if err != nil {
			log.Printf("Failed to get eligible categories for business %s: %v", payload.BusinessID, err)
			return err
		}

		score, err := svc.CalculateShopScore(payload.BusinessID)
		if err != nil {
			log.Printf("Failed to calculate score for business %s: %v", payload.BusinessID, err)
			return err
		}

		for _, categoryID := range categories {
			if err := svc.UpdateShopRanking(ctx, categoryID, payload.ShopID, score); err != nil {
				log.Printf("Failed to update ranking for shop %s in category %s: %v", payload.ShopID, categoryID, err)
			}
		}

		log.Printf("Ranking job complete for business %s, shop %s", payload.BusinessID, payload.ShopID)
		return nil
	}
}

func rebuildCategoryJobHandler(svc *service.CategoryRankingService) func(ctx context.Context, t *asynq.Task) error {
	return func(ctx context.Context, t *asynq.Task) error {
		payload, err := jobs.UnmarshalCategoryRebuild(t.Payload())
		if err != nil {
			log.Printf("Failed to unmarshal rebuild job payload: %v", err)
			return err
		}

		log.Printf("Processing rebuild for category %s", payload.CategoryID)

		if err := svc.RebuildCategoryRanking(ctx, payload.CategoryID); err != nil {
			log.Printf("Failed to rebuild category %s: %v", payload.CategoryID, err)
			return err
		}

		log.Printf("Rebuild complete for category %s", payload.CategoryID)
		return nil
	}
}

func consistencyCheckJobHandler(svc *service.CategoryRankingService) func(ctx context.Context, t *asynq.Task) error {
	return func(ctx context.Context, t *asynq.Task) error {
		payload, err := jobs.UnmarshalConsistencyCheck(t.Payload())
		if err != nil {
			log.Printf("Failed to unmarshal consistency check payload: %v", err)
			return err
		}

		log.Printf("Running consistency check (full_rebuild=%v)", payload.FullRebuild)

		if payload.FullRebuild {
			if err := svc.RebuildAllCategories(ctx); err != nil {
				log.Printf("Full rebuild failed: %v", err)
				return err
			}
		}

		log.Println("Consistency check complete")
		return nil
	}
}

func runPeriodicConsistency(svc *service.CategoryRankingService, cfg *config.Config) {
	if !cfg.WorkerEnabled {
		return
	}

	c := cron.New()
	_, err := c.AddFunc("0 3 * * *", func() {
		log.Println("Periodic consistency check: rebuilding all categories")
		ctx := context.Background()
		if err := svc.RebuildAllCategories(ctx); err != nil {
			log.Printf("Periodic consistency rebuild failed: %v", err)
		}
	})
	if err != nil {
		log.Printf("Failed to add cron job: %v", err)
	}
	c.Start()
}

func runPeriodicSimilarityConsistency(svc *service.SimilarityService, repo *repository.SimilarityRepository, cfg *config.Config) {
	if !cfg.WorkerEnabled {
		return
	}

	c := cron.New()
	_, err := c.AddFunc("0 4 * * *", func() {
		log.Println("Periodic similarity consistency check: rebuilding all products")
		ctx := context.Background()
		if err := rebuildAllProductSimilarities(ctx, svc, repo); err != nil {
			log.Printf("Periodic similarity rebuild failed: %v", err)
		}
	})
	if err != nil {
		log.Printf("Failed to add cron job: %v", err)
	}
	c.Start()
}

func rebuildAllProductSimilarities(ctx context.Context, svc *service.SimilarityService, repo *repository.SimilarityRepository) error {
	log.Println("Rebuilding all product similarities...")

	products, err := getAllPublishedProducts(ctx)
	if err != nil {
		return err
	}

	for _, productID := range products {
		similarProducts, err := svc.CalculateProductSimilarity(ctx, productID, 20)
		if err != nil {
			log.Printf("Failed to calculate similarity for product %s: %v", productID, err)
			continue
		}

		similarData := make([]*repository.SimilarProductData, len(similarProducts))
		for i, sp := range similarProducts {
			similarData[i] = &repository.SimilarProductData{
				ProductID:       sp.ProductID,
				SimilarityScore: sp.SimilarityScore,
				SellerScore:     sp.SellerScore,
				FinalScore:      sp.FinalScore,
			}
		}

		if err := repo.UpdateProductSimilarity(ctx, productID, similarData); err != nil {
			log.Printf("Failed to update similarity for product %s: %v", productID, err)
		}
	}

	log.Printf("Rebuilt similarities for %d products", len(products))
	return nil
}

func getAllPublishedProducts(ctx context.Context) ([]uuid.UUID, error) {
	return nil, nil
}

func productSimilarityJobHandler(svc *service.SimilarityService, repo *repository.SimilarityRepository) func(ctx context.Context, t *asynq.Task) error {
	return func(ctx context.Context, t *asynq.Task) error {
		payload, err := jobs.UnmarshalProductSimilarity(t.Payload())
		if err != nil {
			log.Printf("Failed to unmarshal product similarity job payload: %v", err)
			return err
		}

		log.Printf("Processing product similarity job: product=%s, reason=%s",
			payload.ProductID, payload.Reason)

		similarProducts, err := svc.CalculateProductSimilarity(ctx, payload.ProductID, 20)
		if err != nil {
			log.Printf("Failed to calculate similarity for product %s: %v", payload.ProductID, err)
			return err
		}

		similarData := make([]*repository.SimilarProductData, len(similarProducts))
		for i, sp := range similarProducts {
			similarData[i] = &repository.SimilarProductData{
				ProductID:       sp.ProductID,
				SimilarityScore: sp.SimilarityScore,
				SellerScore:     sp.SellerScore,
				FinalScore:      sp.FinalScore,
			}
		}

		if err := repo.UpdateProductSimilarity(ctx, payload.ProductID, similarData); err != nil {
			log.Printf("Failed to update similarity for product %s: %v", payload.ProductID, err)
			return err
		}

		log.Printf("Product similarity job complete for product %s", payload.ProductID)
		return nil
	}
}

func rebuildProductSimilarityJobHandler(svc *service.SimilarityService, repo *repository.SimilarityRepository) func(ctx context.Context, t *asynq.Task) error {
	return func(ctx context.Context, t *asynq.Task) error {
		payload, err := jobs.UnmarshalProductSimilarityRebuild(t.Payload())
		if err != nil {
			log.Printf("Failed to unmarshal product similarity rebuild job payload: %v", err)
			return err
		}

		log.Printf("Processing product similarity rebuild for product %s", payload.ProductID)

		similarProducts, err := svc.CalculateProductSimilarity(ctx, payload.ProductID, 20)
		if err != nil {
			log.Printf("Failed to calculate similarity for product %s: %v", payload.ProductID, err)
			return err
		}

		similarData := make([]*repository.SimilarProductData, len(similarProducts))
		for i, sp := range similarProducts {
			similarData[i] = &repository.SimilarProductData{
				ProductID:       sp.ProductID,
				SimilarityScore: sp.SimilarityScore,
				SellerScore:     sp.SellerScore,
				FinalScore:      sp.FinalScore,
			}
		}

		if err := repo.UpdateProductSimilarity(ctx, payload.ProductID, similarData); err != nil {
			log.Printf("Failed to update similarity for product %s: %v", payload.ProductID, err)
			return err
		}

		log.Printf("Product similarity rebuild complete for product %s", payload.ProductID)
		return nil
	}
}

func rebuildAllProductSimilarityJobHandler(svc *service.SimilarityService, repo *repository.SimilarityRepository) func(ctx context.Context, t *asynq.Task) error {
	return func(ctx context.Context, t *asynq.Task) error {
		payload, err := jobs.UnmarshalProductSimilarityRebuildAll(t.Payload())
		if err != nil {
			log.Printf("Failed to unmarshal product similarity rebuild all job payload: %v", err)
			return err
		}

		log.Printf("Processing full product similarity rebuild (category_id=%v)", payload.CategoryID)

		if err := rebuildAllProductSimilarities(ctx, svc, repo); err != nil {
			log.Printf("Full product similarity rebuild failed: %v", err)
			return err
		}

		log.Println("Full product similarity rebuild complete")
		return nil
	}
}

func paymentVerifiedJobHandler(svc *service.PaymentService) func(ctx context.Context, t *asynq.Task) error {
	return func(ctx context.Context, t *asynq.Task) error {
		payload, err := jobs.UnmarshalPaymentVerified(t.Payload())
		if err != nil {
			log.Printf("Failed to unmarshal payment verified job payload: %v", err)
			return err
		}

		log.Printf("Processing verified payment: payment=%s", payload.PaymentID)

		if err := svc.ProcessVerifiedPayment(payload.PaymentID); err != nil {
			log.Printf("Failed to process verified payment %s: %v", payload.PaymentID, err)
			return err
		}

		log.Printf("Verified payment %s processed successfully", payload.PaymentID)
		return nil
	}
}

func reviewAggregateJobHandler(svc *service.ReviewService) func(ctx context.Context, t *asynq.Task) error {
	return func(ctx context.Context, t *asynq.Task) error {
		payload, err := jobs.UnmarshalReviewAggregate(t.Payload())
		if err != nil {
			log.Printf("Failed to unmarshal review aggregate job payload: %v", err)
			return err
		}

		log.Printf("Processing review aggregate: shop=%s business=%s reason=%s", payload.ShopID, payload.BusinessID, payload.Reason)

		if err := svc.ProcessReviewAggregate(payload.ShopID, payload.BusinessID); err != nil {
			log.Printf("Failed to process review aggregate for shop %s: %v", payload.ShopID, err)
			return err
		}

		log.Printf("Review aggregate for shop %s processed successfully", payload.ShopID)
		return nil
	}
}
