//go:build ignore

package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		getenv("DB_HOST", "localhost"), getenv("DB_PORT", "5432"),
		getenv("DB_USER", "btmi_user"), getenv("DB_PASSWORD", "btmi_secret_password"),
		getenv("DB_NAME", "btmi_market"))

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	hash, err := bcrypt.GenerateFromPassword([]byte("TestAdmin@2025!"), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal(err)
	}

	admins := []struct{ email, role string }{
		{"commerce.test@tbkmarket.com", "COMMERCE_ADMIN"},
		{"finance.test@tbkmarket.com", "FINANCE_SUPPORT_ADMIN"},
		{"technical.test@tbkmarket.com", "TECHNICAL_ADMIN"},
		{"direction.test@tbkmarket.com", "DIRECTION_ADMIN"},
	}

	for _, a := range admins {
		_, err := db.Exec(`
			INSERT INTO admin_users (first_name, last_name, email, password_hash, role, status, mfa_enabled)
			VALUES ($1, 'TestAccount', $2, $3, $4, 'ACTIVE', false)
			ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, status = 'ACTIVE'
		`, a.role, a.email, string(hash), a.role)
		if err != nil {
			log.Fatalf("insert %s: %v", a.email, err)
		}
		fmt.Printf("seeded %s (%s)\n", a.email, a.role)
	}
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
