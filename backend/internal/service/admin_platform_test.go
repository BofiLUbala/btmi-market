package service_test

import (
	"context"
	"errors"
	"testing"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/google/uuid"
)

// TestPermissionMatrix exercises models.HasPermission directly — the
// granular RBAC layer used by Phase 5A endpoints on top of the existing
// role-group middleware.
func TestPermissionMatrix(t *testing.T) {
	tests := []struct {
		name     string
		role     models.AdminRole
		category string
		perm     models.Permission
		want     bool
	}{
		{"super admin writes anything", models.AdminRoleSuperAdmin, models.ConfigCategoryFinance, models.PermissionFeatureFlagWrite, true},
		{"commerce admin writes commerce", models.AdminRoleCommerceAdmin, models.ConfigCategoryCommerce, models.PermissionFeatureFlagWrite, true},
		{"commerce admin cannot write finance", models.AdminRoleCommerceAdmin, models.ConfigCategoryFinance, models.PermissionFeatureFlagWrite, false},
		{"finance admin writes finance", models.AdminRoleFinanceSupportAdmin, models.ConfigCategoryFinance, models.PermissionGlobalConfigWrite, true},
		{"finance admin cannot write technical", models.AdminRoleFinanceSupportAdmin, models.ConfigCategoryTechnical, models.PermissionGlobalConfigWrite, false},
		{"technical admin writes technical", models.AdminRoleTechnicalAdmin, models.ConfigCategoryTechnical, models.PermissionFeatureFlagWrite, true},
		{"direction admin writes general", models.AdminRoleDirectionAdmin, models.ConfigCategoryGeneral, models.PermissionFeatureFlagWrite, true},
		{"direction admin cannot write commerce", models.AdminRoleDirectionAdmin, models.ConfigCategoryCommerce, models.PermissionFeatureFlagWrite, false},
		{"any role reads any category", models.AdminRoleFinanceSupportAdmin, models.ConfigCategoryTechnical, models.PermissionFeatureFlagRead, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := models.HasPermission(tt.role, tt.category, tt.perm)
			if got != tt.want {
				t.Errorf("HasPermission(%s, %s, %s) = %v, want %v", tt.role, tt.category, tt.perm, got, tt.want)
			}
		})
	}
}

// fakePlatformRepo is an in-memory stand-in for repository.AdminPlatformRepository.
type fakePlatformRepo struct {
	flags   map[string]models.FeatureFlag
	configs map[string]models.GlobalConfig
}

func newFakePlatformRepo() *fakePlatformRepo {
	return &fakePlatformRepo{
		configs: map[string]models.GlobalConfig{
			"POINTS_CONVERSION_RATE": {
				ID: uuid.New(), Key: "POINTS_CONVERSION_RATE", Category: models.ConfigCategoryFinance,
				ValueType: "NUMBER", Value: "100",
			},
			"MIN_SUPPORTED_ANDROID_VERSION": {
				ID: uuid.New(), Key: "MIN_SUPPORTED_ANDROID_VERSION", Category: models.ConfigCategoryTechnical,
				ValueType: "STRING", Value: "1.0.0",
			},
		},
		flags: map[string]models.FeatureFlag{
			"BUYER_POINTS_ENABLED": {
				ID: uuid.New(), Key: "BUYER_POINTS_ENABLED", Category: models.ConfigCategoryFinance,
				Enabled: true, IsHighRisk: true,
			},
			"SELLER_PROMOTIONS_ENABLED": {
				ID: uuid.New(), Key: "SELLER_PROMOTIONS_ENABLED", Category: models.ConfigCategoryCommerce,
				Enabled: true, IsHighRisk: false,
			},
			"REVIEWS_ENABLED": {
				ID: uuid.New(), Key: "REVIEWS_ENABLED", Category: models.ConfigCategoryGeneral,
				Enabled: true, IsHighRisk: false,
			},
			"GENERAL_HIGH_RISK_TEST": {
				ID: uuid.New(), Key: "GENERAL_HIGH_RISK_TEST", Category: models.ConfigCategoryGeneral,
				Enabled: false, IsHighRisk: true,
			},
		}}
}

func (f *fakePlatformRepo) ListFeatureFlags(ctx context.Context) ([]models.FeatureFlag, error) {
	out := []models.FeatureFlag{}
	for _, v := range f.flags {
		out = append(out, v)
	}
	return out, nil
}
func (f *fakePlatformRepo) GetFeatureFlag(ctx context.Context, key string) (*models.FeatureFlag, error) {
	if v, ok := f.flags[key]; ok {
		return &v, nil
	}
	return nil, nil
}
func (f *fakePlatformRepo) UpdateFeatureFlag(ctx context.Context, key string, enabled bool, updatedBy uuid.UUID) error {
	v, ok := f.flags[key]
	if !ok {
		return errors.New("not found")
	}
	v.Enabled = enabled
	f.flags[key] = v
	return nil
}
func (f *fakePlatformRepo) ListGlobalConfigs(ctx context.Context) ([]models.GlobalConfig, error) {
	out := []models.GlobalConfig{}
	for _, v := range f.configs {
		out = append(out, v)
	}
	return out, nil
}
func (f *fakePlatformRepo) GetGlobalConfig(ctx context.Context, key string) (*models.GlobalConfig, error) {
	if v, ok := f.configs[key]; ok {
		return &v, nil
	}
	return nil, nil
}
func (f *fakePlatformRepo) UpdateGlobalConfig(ctx context.Context, key, value string, updatedBy uuid.UUID) error {
	v, ok := f.configs[key]
	if !ok {
		return errors.New("not found")
	}
	v.Value = value
	f.configs[key] = v
	return nil
}
func (f *fakePlatformRepo) IsEnabled(ctx context.Context, key string) (bool, bool, error) {
	v, ok := f.flags[key]
	if !ok {
		return true, false, nil
	}
	return v.Enabled, true, nil
}

// fakeAuditRecorder is an in-memory stand-in so tests don't need a real DB.
type fakeAuditRecorder struct {
	entries []*models.AdminAuditLog
}

func (f *fakeAuditRecorder) Record(entry *models.AdminAuditLog) error {
	f.entries = append(f.entries, entry)
	return nil
}
func (f *fakeAuditRecorder) List(filter *models.AuditListFilter) ([]*models.AdminAuditLog, int, error) {
	return f.entries, len(f.entries), nil
}

func TestUpdateFeatureFlag_HighRiskRequiresConfirm(t *testing.T) {
	repo := newFakePlatformRepo()
	svc := service.NewAdminPlatformService(repo, service.NewAuditServiceWithRecorder(&fakeAuditRecorder{}))
	actor := uuid.New()

	// Disabling a high-risk flag without confirm must be rejected.
	err := svc.UpdateFeatureFlag(context.Background(), actor, models.AdminRoleFinanceSupportAdmin, "BUYER_POINTS_ENABLED", &models.UpdateFeatureFlagRequest{
		Enabled: false,
		Reason:  "testing",
		Confirm: false,
	})
	if !errors.Is(err, service.ErrHighRiskConfirmRequired) {
		t.Fatalf("expected ErrHighRiskConfirmRequired, got %v", err)
	}

	flag, _ := repo.GetFeatureFlag(context.Background(), "BUYER_POINTS_ENABLED")
	if !flag.Enabled {
		t.Fatalf("flag should not have been changed without confirm")
	}
}

func TestUpdateFeatureFlag_WrongCategoryForbidden(t *testing.T) {
	repo := newFakePlatformRepo()
	svc := service.NewAdminPlatformService(repo, service.NewAuditServiceWithRecorder(&fakeAuditRecorder{}))
	actor := uuid.New()

	// Commerce admin may not write a FINANCE-category flag.
	err := svc.UpdateFeatureFlag(context.Background(), actor, models.AdminRoleCommerceAdmin, "BUYER_POINTS_ENABLED", &models.UpdateFeatureFlagRequest{
		Enabled: false,
		Reason:  "testing",
		Confirm: true,
	})
	if err == nil {
		t.Fatalf("expected forbidden error, got nil")
	}
}

func TestUpdateFeatureFlag_LowRiskSucceeds(t *testing.T) {
	repo := newFakePlatformRepo()
	svc := service.NewAdminPlatformService(repo, service.NewAuditServiceWithRecorder(&fakeAuditRecorder{}))
	actor := uuid.New()

	err := svc.UpdateFeatureFlag(context.Background(), actor, models.AdminRoleCommerceAdmin, "SELLER_PROMOTIONS_ENABLED", &models.UpdateFeatureFlagRequest{
		Enabled: false,
		Reason:  "testing rollout",
		Confirm: false,
	})
	if err != nil {
		t.Fatalf("expected low-risk update to succeed, got %v", err)
	}

	flag, _ := repo.GetFeatureFlag(context.Background(), "SELLER_PROMOTIONS_ENABLED")
	if flag.Enabled {
		t.Fatalf("expected flag to be disabled")
	}
}

// TestUpdateFeatureFlag_HighRiskConfirmBothDirections verifies confirm is
// required both when enabling AND disabling a high-risk flag, not just on
// disable — a state the original implementation missed.
func TestUpdateFeatureFlag_HighRiskConfirmBothDirections(t *testing.T) {
	repo := newFakePlatformRepo()
	svc := service.NewAdminPlatformService(repo, service.NewAuditServiceWithRecorder(&fakeAuditRecorder{}))
	actor := uuid.New()

	// GENERAL_HIGH_RISK_TEST starts disabled; enabling it (false -> true)
	// without confirm must be rejected just like disabling would be.
	// SUPER_ADMIN is used because only SUPER_ADMIN and DIRECTION_ADMIN may
	// write GENERAL-category resources, and DIRECTION_ADMIN is separately
	// forbidden from touching high-risk ones entirely (see the
	// DirectionCannotWriteHighRisk test below).
	err := svc.UpdateFeatureFlag(context.Background(), actor, models.AdminRoleSuperAdmin, "GENERAL_HIGH_RISK_TEST", &models.UpdateFeatureFlagRequest{
		Enabled: true,
		Reason:  "testing enable direction",
		Confirm: false,
	})
	if !errors.Is(err, service.ErrHighRiskConfirmRequired) {
		t.Fatalf("expected ErrHighRiskConfirmRequired on enable, got %v", err)
	}

	// With confirm, it succeeds.
	err = svc.UpdateFeatureFlag(context.Background(), actor, models.AdminRoleSuperAdmin, "GENERAL_HIGH_RISK_TEST", &models.UpdateFeatureFlagRequest{
		Enabled: true,
		Reason:  "testing enable direction",
		Confirm: true,
	})
	if err != nil {
		t.Fatalf("expected confirmed enable to succeed, got %v", err)
	}
}

// TestUpdateFeatureFlag_DirectionCannotWriteHighRisk verifies DIRECTION_ADMIN
// is blocked from modifying a high-risk flag even when it sits in the
// GENERAL category DIRECTION_ADMIN otherwise owns, and even with confirm.
func TestUpdateFeatureFlag_DirectionCannotWriteHighRisk(t *testing.T) {
	repo := newFakePlatformRepo()
	svc := service.NewAdminPlatformService(repo, service.NewAuditServiceWithRecorder(&fakeAuditRecorder{}))
	actor := uuid.New()

	err := svc.UpdateFeatureFlag(context.Background(), actor, models.AdminRoleDirectionAdmin, "GENERAL_HIGH_RISK_TEST", &models.UpdateFeatureFlagRequest{
		Enabled: true,
		Reason:  "attempting high-risk change as direction",
		Confirm: true,
	})
	if err == nil {
		t.Fatalf("expected DIRECTION_ADMIN to be forbidden from writing a high-risk flag")
	}
}

// TestUpdateFeatureFlag_DirectionCanWriteGeneralLowRisk verifies
// DIRECTION_ADMIN's write access is not blanket-revoked — it can still
// write GENERAL low-risk flags.
func TestUpdateFeatureFlag_DirectionCanWriteGeneralLowRisk(t *testing.T) {
	repo := newFakePlatformRepo()
	svc := service.NewAdminPlatformService(repo, service.NewAuditServiceWithRecorder(&fakeAuditRecorder{}))
	actor := uuid.New()

	err := svc.UpdateFeatureFlag(context.Background(), actor, models.AdminRoleDirectionAdmin, "REVIEWS_ENABLED", &models.UpdateFeatureFlagRequest{
		Enabled: false,
		Reason:  "direction toggling low-risk general flag",
	})
	if err != nil {
		t.Fatalf("expected DIRECTION_ADMIN to write GENERAL low-risk flag, got %v", err)
	}
}

func TestUpdateGlobalConfig_ValidationRejectsBadNumber(t *testing.T) {
	repo := newFakePlatformRepo()
	svc := service.NewAdminPlatformService(repo, service.NewAuditServiceWithRecorder(&fakeAuditRecorder{}))
	actor := uuid.New()

	err := svc.UpdateGlobalConfig(context.Background(), actor, models.AdminRoleFinanceSupportAdmin, "POINTS_CONVERSION_RATE", &models.UpdateGlobalConfigRequest{
		Value:  "not-a-number",
		Reason: "testing invalid number",
	})
	if !errors.Is(err, service.ErrInvalidConfigValue) {
		t.Fatalf("expected ErrInvalidConfigValue for non-numeric input, got %v", err)
	}
}

func TestUpdateGlobalConfig_ValidationRejectsOutOfBounds(t *testing.T) {
	repo := newFakePlatformRepo()
	svc := service.NewAdminPlatformService(repo, service.NewAuditServiceWithRecorder(&fakeAuditRecorder{}))
	actor := uuid.New()

	// POINTS_CONVERSION_RATE must be > 0.
	err := svc.UpdateGlobalConfig(context.Background(), actor, models.AdminRoleFinanceSupportAdmin, "POINTS_CONVERSION_RATE", &models.UpdateGlobalConfigRequest{
		Value:  "0",
		Reason: "testing zero rate",
	})
	if !errors.Is(err, service.ErrInvalidConfigValue) {
		t.Fatalf("expected ErrInvalidConfigValue for zero conversion rate, got %v", err)
	}

	cfg, _ := repo.GetGlobalConfig(context.Background(), "POINTS_CONVERSION_RATE")
	if cfg.Value != "100" {
		t.Fatalf("expected value to remain unchanged after rejected update, got %q", cfg.Value)
	}
}

func TestUpdateGlobalConfig_ValidationRejectsBadVersionString(t *testing.T) {
	repo := newFakePlatformRepo()
	svc := service.NewAdminPlatformService(repo, service.NewAuditServiceWithRecorder(&fakeAuditRecorder{}))
	actor := uuid.New()

	err := svc.UpdateGlobalConfig(context.Background(), actor, models.AdminRoleTechnicalAdmin, "MIN_SUPPORTED_ANDROID_VERSION", &models.UpdateGlobalConfigRequest{
		Value:  "not-a-version",
		Reason: "testing invalid version string",
	})
	if !errors.Is(err, service.ErrInvalidConfigValue) {
		t.Fatalf("expected ErrInvalidConfigValue for malformed version string, got %v", err)
	}
}

func TestUpdateGlobalConfig_ValidNumberSucceeds(t *testing.T) {
	repo := newFakePlatformRepo()
	svc := service.NewAdminPlatformService(repo, service.NewAuditServiceWithRecorder(&fakeAuditRecorder{}))
	actor := uuid.New()

	err := svc.UpdateGlobalConfig(context.Background(), actor, models.AdminRoleFinanceSupportAdmin, "POINTS_CONVERSION_RATE", &models.UpdateGlobalConfigRequest{
		Value:  "150",
		Reason: "adjusting conversion rate",
	})
	if err != nil {
		t.Fatalf("expected valid update to succeed, got %v", err)
	}
	cfg, _ := repo.GetGlobalConfig(context.Background(), "POINTS_CONVERSION_RATE")
	if cfg.Value != "150" {
		t.Fatalf("expected value 150, got %q", cfg.Value)
	}
}
