package main

import (
	"log"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/database"
)

func main() {
	cfg := config.Load()
	db, err := database.Connect(cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.DBUser, cfg.DBPassword)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.RunMigrations("migrations"); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}
	log.Println("All migrations applied successfully")
}
