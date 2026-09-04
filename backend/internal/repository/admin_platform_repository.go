package repository

import (
	"context"
	"database/sql"

	"github.com/btmi-ai-market/backend/internal/models"

	"github.com/google/uuid"
)

// AdminPlatformRepository backs Phase 5A: feature flags and global
// configuration. It also implements FeatureFlagChecker so non-admin
// request handlers (review submission, seller registration, ...) can
// perform a lightweight enabled check without depending on the admin
// service layer.
type AdminPlatformRepository interface {
	ListFeatureFlags(ctx context.Context) ([]models.FeatureFlag, error)
	GetFeatureFlag(ctx context.Context, key string) (*models.FeatureFlag, error)
	UpdateFeatureFlag(ctx context.Context, key string, enabled bool, updatedBy uuid.UUID) error
	ListGlobalConfigs(ctx context.Context) ([]models.GlobalConfig, error)
	GetGlobalConfig(ctx context.Context, key string) (*models.GlobalConfig, error)
	UpdateGlobalConfig(ctx context.Context, key, value string, updatedBy uuid.UUID) error

	// IsEnabled reports the current state of a flag. found is false if no
	// such flag exists, in which case callers should treat the feature as
	// enabled (fail-open, since flags default to on and absence must not
	// silently disable a feature that predates flags).
	IsEnabled(ctx context.Context, key string) (enabled bool, found bool, err error)
}

type adminPlatformRepository struct {
	db *sql.DB
}

func NewAdminPlatformRepository(db *sql.DB) AdminPlatformRepository {
	return &adminPlatformRepository{db: db}
}

func (r *adminPlatformRepository) ListFeatureFlags(ctx context.Context) ([]models.FeatureFlag, error) {
	query := `
		SELECT id, key, description, enabled, scope, category, is_high_risk, environment, updated_by, created_at, updated_at
		FROM feature_flags
		ORDER BY category ASC, key ASC
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	flags := []models.FeatureFlag{}
	for rows.Next() {
		f, err := scanFeatureFlag(rows)
		if err != nil {
			return nil, err
		}
		flags = append(flags, f)
	}
	return flags, nil
}

func (r *adminPlatformRepository) GetFeatureFlag(ctx context.Context, key string) (*models.FeatureFlag, error) {
	query := `
		SELECT id, key, description, enabled, scope, category, is_high_risk, environment, updated_by, created_at, updated_at
		FROM feature_flags
		WHERE key = $1
	`
	f, err := scanFeatureFlag(r.db.QueryRowContext(ctx, query, key))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func (r *adminPlatformRepository) UpdateFeatureFlag(ctx context.Context, key string, enabled bool, updatedBy uuid.UUID) error {
	query := `
		UPDATE feature_flags
		SET enabled = $1, updated_by = $2, updated_at = NOW()
		WHERE key = $3
	`
	res, err := r.db.ExecContext(ctx, query, enabled, updatedBy, key)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *adminPlatformRepository) ListGlobalConfigs(ctx context.Context) ([]models.GlobalConfig, error) {
	query := `
		SELECT id, key, description, value_type, value, category, updated_by, created_at, updated_at
		FROM global_configs
		ORDER BY category ASC, key ASC
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	configs := []models.GlobalConfig{}
	for rows.Next() {
		cfg, err := scanGlobalConfig(rows)
		if err != nil {
			return nil, err
		}
		configs = append(configs, cfg)
	}
	return configs, nil
}

func (r *adminPlatformRepository) GetGlobalConfig(ctx context.Context, key string) (*models.GlobalConfig, error) {
	query := `
		SELECT id, key, description, value_type, value, category, updated_by, created_at, updated_at
		FROM global_configs
		WHERE key = $1
	`
	cfg, err := scanGlobalConfig(r.db.QueryRowContext(ctx, query, key))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (r *adminPlatformRepository) UpdateGlobalConfig(ctx context.Context, key, value string, updatedBy uuid.UUID) error {
	query := `
		UPDATE global_configs
		SET value = $1, updated_by = $2, updated_at = NOW()
		WHERE key = $3
	`
	res, err := r.db.ExecContext(ctx, query, value, updatedBy, key)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *adminPlatformRepository) IsEnabled(ctx context.Context, key string) (bool, bool, error) {
	var enabled bool
	err := r.db.QueryRowContext(ctx, `SELECT enabled FROM feature_flags WHERE key = $1`, key).Scan(&enabled)
	if err == sql.ErrNoRows {
		return true, false, nil
	}
	if err != nil {
		return true, false, err
	}
	return enabled, true, nil
}

// rowScanner abstracts *sql.Row / *sql.Rows for shared scan helpers.
type rowScanner interface {
	Scan(dest ...interface{}) error
}

func scanFeatureFlag(row rowScanner) (models.FeatureFlag, error) {
	var f models.FeatureFlag
	var updatedBy sql.NullString
	err := row.Scan(
		&f.ID, &f.Key, &f.Description, &f.Enabled, &f.Scope, &f.Category,
		&f.IsHighRisk, &f.Environment, &updatedBy, &f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		return f, err
	}
	if updatedBy.Valid {
		u, _ := uuid.Parse(updatedBy.String)
		f.UpdatedBy = &u
	}
	return f, nil
}

func scanGlobalConfig(row rowScanner) (models.GlobalConfig, error) {
	var cfg models.GlobalConfig
	var updatedBy sql.NullString
	err := row.Scan(
		&cfg.ID, &cfg.Key, &cfg.Description, &cfg.ValueType, &cfg.Value, &cfg.Category,
		&updatedBy, &cfg.CreatedAt, &cfg.UpdatedAt,
	)
	if err != nil {
		return cfg, err
	}
	if updatedBy.Valid {
		u, _ := uuid.Parse(updatedBy.String)
		cfg.UpdatedBy = &u
	}
	return cfg, nil
}
