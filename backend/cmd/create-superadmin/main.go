package main

import (
	"flag"
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

	resetFlag := flag.Bool("reset", false, "Reset password for an existing SUPER_ADMIN account")
	resetPassFlag := flag.Bool("reset-password", false, "Reset password for an existing SUPER_ADMIN account (alias for -reset)")
	emailFlag := flag.String("email", "", "SUPER_ADMIN email address")
	passwordFlag := flag.String("password", "", "SUPER_ADMIN password")
	nameFlag := flag.String("name", "", "SUPER_ADMIN full name")
	flag.Parse()

	isReset := *resetFlag || *resetPassFlag || strings.ToLower(os.Getenv("SUPER_ADMIN_RESET_PASSWORD")) == "true" || os.Getenv("SUPER_ADMIN_RESET_PASSWORD") == "1"

	email := strings.TrimSpace(*emailFlag)
	if email == "" {
		email = strings.TrimSpace(os.Getenv("SUPER_ADMIN_EMAIL"))
	}

	password := *passwordFlag
	if password == "" {
		password = os.Getenv("SUPER_ADMIN_PASSWORD")
	}

	name := strings.TrimSpace(*nameFlag)
	if name == "" {
		name = strings.TrimSpace(os.Getenv("SUPER_ADMIN_NAME"))
	}

	if email == "" {
		fmt.Fprintln(os.Stderr, "[ERROR] SUPER_ADMIN_EMAIL (or -email flag) is required")
		os.Exit(1)
	}

	if password == "" {
		fmt.Fprintln(os.Stderr, "[ERROR] SUPER_ADMIN_PASSWORD (or -password flag) is required")
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

	if isReset {
		admin, err := bootstrapService.ResetSuperAdminPassword(email, password)
		if err != nil {
			fmt.Fprintf(os.Stderr, "[ERROR] Password reset failed: %v\n", err)
			os.Exit(1)
		}
		log.Printf("[SUCCESS] Password successfully reset for Super Admin: %s (ID: %s)\n", admin.Email, admin.ID)
		os.Exit(0)
	}

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
