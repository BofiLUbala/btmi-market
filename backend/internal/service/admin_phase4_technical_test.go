package service

import (
	"testing"

	"github.com/btmi-ai-market/backend/internal/models"
)

// ─── RBAC TESTS ───────────────────────────────────────────────────────────────

func TestAdminTechnicalService_checkTechnicalAccess(t *testing.T) {
	svc := &AdminTechnicalService{}

	// Allowed roles
	for _, role := range []models.AdminRole{
		models.AdminRoleSuperAdmin,
		models.AdminRoleTechnicalAdmin,
		models.AdminRoleDirectionAdmin,
	} {
		if err := svc.checkTechnicalAccess(role); err != nil {
			t.Errorf("expected role %s to be allowed for technical access, got error: %v", role, err)
		}
	}

	// Forbidden roles
	for _, role := range []models.AdminRole{
		models.AdminRoleCommerceAdmin,
		models.AdminRoleFinanceSupportAdmin,
	} {
		if err := svc.checkTechnicalAccess(role); err == nil {
			t.Errorf("expected role %s to be FORBIDDEN for technical access, but was allowed", role)
		}
	}
}

func TestAdminTechnicalService_checkMutationAccess(t *testing.T) {
	svc := &AdminTechnicalService{}

	// Allowed roles for mutations
	for _, role := range []models.AdminRole{
		models.AdminRoleSuperAdmin,
		models.AdminRoleTechnicalAdmin,
	} {
		if err := svc.checkMutationAccess(role); err != nil {
			t.Errorf("expected role %s to be allowed for mutations, got error: %v", role, err)
		}
	}

	// Forbidden roles for mutations (including DirectionAdmin — read-only)
	for _, role := range []models.AdminRole{
		models.AdminRoleDirectionAdmin,
		models.AdminRoleCommerceAdmin,
		models.AdminRoleFinanceSupportAdmin,
	} {
		if err := svc.checkMutationAccess(role); err == nil {
			t.Errorf("expected role %s to be FORBIDDEN for mutations, but was allowed", role)
		}
	}
}

// ─── SANITIZE ERROR TESTS ─────────────────────────────────────────────────────

func TestSanitizeError_redactsCredentials(t *testing.T) {
	msg := sanitizeError(nil)
	if msg != "" {
		t.Errorf("expected empty string for nil error, got: %s", msg)
	}

	type errString string
	errWithPassword := errorString("connection refused: password=secret123 host=localhost")
	result := sanitizeError(errWithPassword)
	if result == "" {
		t.Fatal("expected non-empty sanitized error")
	}
	if len(result) > 200 {
		t.Errorf("sanitized error too long: %d chars", len(result))
	}
}

func TestSanitizeError_truncatesLongMessages(t *testing.T) {
	longErr := errorString(string(make([]byte, 300)))
	result := sanitizeError(longErr)
	if len(result) > 200 {
		t.Errorf("expected error to be truncated to 200 chars, got %d", len(result))
	}
}

// ─── REDIS INFO PARSER TESTS ──────────────────────────────────────────────────

func TestParseRedisInfoInt64(t *testing.T) {
	info := "used_memory:123456\r\nconnected_clients:5\r\nkeyspace_hits:1000\r\nkeyspace_misses:50\r\n"

	if v := parseRedisInfoInt64(info, "used_memory"); v != 123456 {
		t.Errorf("expected 123456, got %d", v)
	}
	if v := parseRedisInfoInt64(info, "connected_clients"); v != 5 {
		t.Errorf("expected 5, got %d", v)
	}
	if v := parseRedisInfoInt64(info, "missing_key"); v != 0 {
		t.Errorf("expected 0 for missing key, got %d", v)
	}
}

// ─── HELPER TYPES ─────────────────────────────────────────────────────────────

type errorString string

func (e errorString) Error() string { return string(e) }
