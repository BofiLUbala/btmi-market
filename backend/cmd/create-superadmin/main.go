package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/btmi-ai-market/backend/internal/service"
)

func getMigrationsDir() string {
	if dir := os.Getenv("MIGRATIONS_DIR"); dir != "" {
		return dir
	}
	candidates := []string{
		"./migrations",
		"../migrations",
		"../../migrations",
	}
	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && fi.IsDir() {
			return c
		}
	}
	execPath, err := os.Executable()
	if err == nil {
		p := filepath.Join(filepath.Dir(execPath), "migrations")
		if fi, err := os.Stat(p); err == nil && fi.IsDir() {
			return p
		}
	}
	return "./migrations"
}

func main() {
	log.SetFlags(log.Ldate | log.Ltime | log.Lmsgprefix)
	log.SetPrefix("[SUPER_ADMIN_BOOTSTRAP] ")

	name := strings.TrimSpace(os.Getenv("SUPER_ADMIN_NAME"))
	email := strings.TrimSpace(os.Getenv("SUPER_ADMIN_EMAIL"))
	password := os.Getenv("SUPER_ADMIN_PASSWORD")

	if email == "" {
		fmt.Fprintln(os.Stderr, "[ERROR] SUPER_ADMIN_EMAIL is required")
		os.Exit(1)
	}

	if password == "" {
		fmt.Fprintln(os.Stderr, "[ERROR] SUPER_ADMIN_PASSWORD is required")
		os.Exit(1)
	}

	cfg := config.Load()

	db, err := database.Connect(
		cfg.DBHost, cfg.DBPort, cfg.DBName,
		cfg.DBUser, cfg.DBPassword,
	)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[ERROR] Failed to connect to database (%s:%s/%s): %v\n", cfg.DBHost, cfg.DBPort, cfg.DBName, err)
		os.Exit(1)
	}
	defer db.Close()

	migrationsDir := getMigrationsDir()
	if fi, err := os.Stat(migrationsDir); err == nil && fi.IsDir() {
		if err := db.RunMigrations(migrationsDir); err != nil {
			fmt.Fprintf(os.Stderr, "[ERROR] Failed to run migrations: %v\n", err)
			os.Exit(1)
		}
	}

	adminRepo := repository.NewAdminRepository(db)
	auditRepo := repository.NewAuditRepository(db)
	bootstrapService := service.NewAdminBootstrapService(adminRepo, auditRepo)

	result, err := bootstrapService.BootstrapSuperAdmin(name, email, password)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[ERROR] Bootstrap failed: %v\n", err)
		os.Exit(1)
	}

	if !result.Created {
		log.Printf("[INFO] %s\n", result.Message)
		os.Exit(0)
	}

	log.Printf("[SUCCESS] %s\n", result.Message)
}
