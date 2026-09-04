package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

var (
	ErrHighRiskConfirmRequired = errors.New("confirm required: changing this high-risk flag may impact critical business flows")
	ErrInvalidConfigValue      = errors.New("invalid configuration value")
)

type AdminPlatformService struct {
	repo         repository.AdminPlatformRepository
	auditService *AuditService
}

func NewAdminPlatformService(repo repository.AdminPlatformRepository, auditService *AuditService) *AdminPlatformService {
	return &AdminPlatformService{repo: repo, auditService: auditService}
}

// ─── FEATURE FLAGS ────────────────────────────────────────────────────────────

func (s *AdminPlatformService) ListFeatureFlags(ctx context.Context, role models.AdminRole) ([]models.FeatureFlag, error) {
	if !models.HasPermission(role, models.ConfigCategoryGeneral, models.PermissionFeatureFlagRead) {
		return nil, errors.New("forbidden: missing FEATURE_FLAG_READ permission")
	}
	flags, err := s.repo.ListFeatureFlags(ctx)
	if err != nil {
		return nil, err
	}
	for i := range flags {
		flags[i].CanWrite = models.HasPermission(role, flags[i].Category, models.PermissionFeatureFlagWrite)
	}
	return flags, nil
}

func (s *AdminPlatformService) GetFeatureFlag(ctx context.Context, role models.AdminRole, key string) (*models.FeatureFlag, error) {
	if !models.HasPermission(role, models.ConfigCategoryGeneral, models.PermissionFeatureFlagRead) {
		return nil, errors.New("forbidden: missing FEATURE_FLAG_READ permission")
	}
	flag, err := s.repo.GetFeatureFlag(ctx, key)
	if err != nil {
		return nil, err
	}
	if flag == nil {
		return nil, errors.New("feature flag not found")
	}
	flag.CanWrite = models.HasPermission(role, flag.Category, models.PermissionFeatureFlagWrite)
	return flag, nil
}

func (s *AdminPlatformService) UpdateFeatureFlag(ctx context.Context, actorID uuid.UUID, role models.AdminRole, key string, req *models.UpdateFeatureFlagRequest) error {
	if req.Reason == "" {
		return errors.New("reason required for feature flag change")
	}

	current, err := s.repo.GetFeatureFlag(ctx, key)
	if err != nil {
		return err
	}
	if current == nil {
		return errors.New("feature flag not found")
	}

	if !models.HasPermission(role, current.Category, models.PermissionFeatureFlagWrite) {
		return errors.New("forbidden: role does not have write access to this flag's category")
	}

	if current.IsHighRisk {
		if !models.CanWriteHighRisk(role) {
			return errors.New("forbidden: DIRECTION_ADMIN may only write GENERAL low-risk configuration and cannot modify high-risk flags")
		}
		// Confirmation is required for any change to a high-risk flag in
		// either direction (enable or disable), not just disabling it.
		if req.Enabled != current.Enabled && !req.Confirm {
			return ErrHighRiskConfirmRequired
		}
	}

	if err := s.repo.UpdateFeatureFlag(ctx, key, req.Enabled, actorID); err != nil {
		return err
	}

	_ = s.auditService.Record(
		actorID, role,
		"FEATURE_FLAG_UPDATE", "feature_flag", key, req.Reason,
		map[string]interface{}{"enabled": current.Enabled},
		map[string]interface{}{"enabled": req.Enabled},
		"", "",
	)
	return nil
}

// ─── GLOBAL CONFIG ────────────────────────────────────────────────────────────

func (s *AdminPlatformService) ListGlobalConfigs(ctx context.Context, role models.AdminRole) ([]models.GlobalConfig, error) {
	if !models.HasPermission(role, models.ConfigCategoryGeneral, models.PermissionGlobalConfigRead) {
		return nil, errors.New("forbidden: missing GLOBAL_CONFIG_READ permission")
	}
	configs, err := s.repo.ListGlobalConfigs(ctx)
	if err != nil {
		return nil, err
	}
	for i := range configs {
		configs[i].CanWrite = models.HasPermission(role, configs[i].Category, models.PermissionGlobalConfigWrite)
	}
	return configs, nil
}

func (s *AdminPlatformService) GetGlobalConfig(ctx context.Context, role models.AdminRole, key string) (*models.GlobalConfig, error) {
	if !models.HasPermission(role, models.ConfigCategoryGeneral, models.PermissionGlobalConfigRead) {
		return nil, errors.New("forbidden: missing GLOBAL_CONFIG_READ permission")
	}
	cfg, err := s.repo.GetGlobalConfig(ctx, key)
	if err != nil {
		return nil, err
	}
	if cfg == nil {
		return nil, errors.New("global config not found")
	}
	cfg.CanWrite = models.HasPermission(role, cfg.Category, models.PermissionGlobalConfigWrite)
	return cfg, nil
}

func (s *AdminPlatformService) UpdateGlobalConfig(ctx context.Context, actorID uuid.UUID, role models.AdminRole, key string, req *models.UpdateGlobalConfigRequest) error {
	if req.Reason == "" {
		return errors.New("reason required for global config change")
	}

	current, err := s.repo.GetGlobalConfig(ctx, key)
	if err != nil {
		return err
	}
	if current == nil {
		return errors.New("global config not found")
	}

	if !models.HasPermission(role, current.Category, models.PermissionGlobalConfigWrite) {
		return errors.New("forbidden: role does not have write access to this config's category")
	}

	if err := validateConfigValue(current.Key, current.ValueType, req.Value); err != nil {
		return err
	}

	if err := s.repo.UpdateGlobalConfig(ctx, key, req.Value, actorID); err != nil {
		return err
	}

	_ = s.auditService.Record(
		actorID, role,
		"GLOBAL_CONFIG_UPDATE", "global_config", key, req.Reason,
		map[string]interface{}{"value": current.Value},
		map[string]interface{}{"value": req.Value},
		"", "",
	)
	return nil
}

// configBounds holds business-rule lower/upper bounds for NUMBER configs,
// keyed by config key. A zero upper bound means "no upper bound".
var configBounds = map[string]struct{ min, max float64 }{
	"POINTS_CONVERSION_RATE":      {min: 0.000001},    // must be > 0
	"STUCK_ORDER_THRESHOLD_HOURS": {min: 0.000001},    // must be > 0
	"DEFAULT_DISPUTE_THRESHOLD":   {min: 0},           // must be >= 0
	"RISK_ALERT_THRESHOLD":        {min: 0, max: 100}, // percentage-like score
}

// validateConfigValue enforces the declared value_type server-side and, for
// NUMBER configs with a known business rule, the bound in configBounds.
// STRING values are validated per-key where a specific format is known
// (currently: *_VERSION keys must look like a semantic version).
func validateConfigValue(key, valueType, value string) error {
	switch valueType {
	case "NUMBER":
		n, err := strconv.ParseFloat(value, 64)
		if err != nil {
			return errWithDetail("value must be a valid number")
		}
		if bounds, ok := configBounds[key]; ok {
			if n < bounds.min {
				return errWithDetail("value must be greater than " + strconv.FormatFloat(bounds.min, 'g', -1, 64))
			}
			if bounds.max != 0 && n > bounds.max {
				return errWithDetail("value must be at most " + strconv.FormatFloat(bounds.max, 'g', -1, 64))
			}
		}
	case "BOOLEAN":
		v := strings.ToLower(strings.TrimSpace(value))
		if v != "true" && v != "false" {
			return errWithDetail("value must be exactly \"true\" or \"false\"")
		}
	case "STRING":
		if strings.TrimSpace(value) == "" {
			return errWithDetail("value must not be empty")
		}
		if strings.HasSuffix(key, "_VERSION") && !isSemverLike(value) {
			return errWithDetail("value must look like a semantic version, e.g. 1.2.3")
		}
	default:
		return errWithDetail("unknown value_type: " + valueType)
	}
	return nil
}

func errWithDetail(detail string) error {
	return fmt.Errorf("%w: %s", ErrInvalidConfigValue, detail)
}

func isSemverLike(v string) bool {
	parts := strings.Split(v, ".")
	if len(parts) < 2 || len(parts) > 3 {
		return false
	}
	for _, p := range parts {
		if p == "" {
			return false
		}
		if _, err := strconv.Atoi(p); err != nil {
			return false
		}
	}
	return true
}
