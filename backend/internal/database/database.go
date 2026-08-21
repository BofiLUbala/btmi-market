package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

type DB struct {
	*sql.DB
	Tx *sql.Tx
}

func Connect(host, port, name, user, password string) (*DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, name,
	)

	var db *sql.DB
	var err error

	for i := 0; i < 30; i++ {
		db, err = sql.Open("postgres", dsn)
		if err != nil {
			log.Printf("Attempt %d: Failed to open database: %v", i+1, err)
			time.Sleep(2 * time.Second)
			continue
		}

		err = db.Ping()
		if err == nil {
			break
		}
		log.Printf("Attempt %d: Database not ready: %v", i+1, err)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to connect to database after retries: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	log.Println("Database connected successfully")
	return &DB{DB: db}, nil
}

func (d *DB) Exec(query string, args ...interface{}) (sql.Result, error) {
	if d.Tx != nil {
		return d.Tx.Exec(query, args...)
	}
	return d.DB.Exec(query, args...)
}

func (d *DB) Query(query string, args ...interface{}) (*sql.Rows, error) {
	if d.Tx != nil {
		return d.Tx.Query(query, args...)
	}
	return d.DB.Query(query, args...)
}

func (d *DB) QueryRow(query string, args ...interface{}) *sql.Row {
	if d.Tx != nil {
		return d.Tx.QueryRow(query, args...)
	}
	return d.DB.QueryRow(query, args...)
}

func (d *DB) Begin() (*sql.Tx, error) {
	return d.DB.Begin()
}

func (d *DB) Close() error {
	if d.DB != nil {
		return d.DB.Close()
	}
	return nil
}

func (db *DB) RunMigrations(migrationsDir string) error {
	_, err := db.DB.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMP DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	var files []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			files = append(files, entry.Name())
		}
	}
	sort.Strings(files)

	applied, err := db.getAppliedMigrations()
	if err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}

	for _, file := range files {
		if applied[file] {
			continue
		}

		log.Printf("Applying migration: %s", file)

		content, err := os.ReadFile(filepath.Join(migrationsDir, file))
		if err != nil {
			return fmt.Errorf("failed to read migration %s: %w", file, err)
		}

		tx, err := db.DB.Begin()
		if err != nil {
			return fmt.Errorf("failed to begin transaction for %s: %w", file, err)
		}

		if _, err := tx.Exec(string(content)); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to apply migration %s: %w", file, err)
		}

		if _, err := tx.Exec("INSERT INTO schema_migrations (version) VALUES ($1)", file); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to record migration %s: %w", file, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit migration %s: %w", file, err)
		}

		log.Printf("Migration applied: %s", file)
	}

	log.Println("All migrations applied successfully")
	return nil
}

func (db *DB) getAppliedMigrations() (map[string]bool, error) {
	applied := make(map[string]bool)

	rows, err := db.DB.Query("SELECT version FROM schema_migrations")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return nil, err
		}
		applied[version] = true
	}

	return applied, rows.Err()
}
