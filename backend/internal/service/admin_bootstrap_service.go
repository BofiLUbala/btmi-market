package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// AdminBootstrapRepository specifies database operations needed for the bootstrap process.
type AdminBootstrapRepository interface {
	CountSuperAdmins() (int, error)
	GetByEmail(email string) (*models.AdminUser, error)
	Create(admin *models.AdminUser) error
	UpdatePassword(id uuid.UUID, passwordHash string) error
}

// AdminAuditRecorder records bootstrap actions in the audit log.
type AdminAuditRecorder interface {
	Record(entry *models.AdminAuditLog) error
}

type BootstrapResult struct {
	Created bool              `json:"created"`
	Message string            `json:"message"`
	Admin   *models.AdminUser `json:"admin,omitempty"`
}

type AdminBootstrapService struct {
	repo          AdminBootstrapRepository
	auditRecorder AdminAuditRecorder
}

func NewAdminBootstrapService(repo AdminBootstrapRepository, auditRecorder AdminAuditRecorder) *AdminBootstrapService {
	return &AdminBootstrapService{
		repo:          repo,
		auditRecorder: auditRecorder,
	}
}

// BootstrapSuperAdmin creates the very first SUPER_ADMIN account idempotently.
func (s *AdminBootstrapService) BootstrapSuperAdmin(name, email, password string) (*BootstrapResult, error) {
	cleanEmail := strings.TrimSpace(email)
	if cleanEmail == "" {
		return nil, errors.New("SUPER_ADMIN_EMAIL is required")
	}

	if password == "" {
		return nil, errors.New("SUPER_ADMIN_PASSWORD is required")
	}

	cleanName := strings.TrimSpace(name)
	if cleanName == "" {
		cleanName = "Super Admin"
	}

	// 1. FIRST-SUPER-ADMIN RULE: If any SUPER_ADMIN exists, skip idempotently.
	superAdminCount, err := s.repo.CountSuperAdmins()
	if err != nil {
		return nil, fmt.Errorf("failed to check existing super admins: %w", err)
	}
	if superAdminCount > 0 {
		return &BootstrapResult{
			Created: false,
			Message: "SUPER_ADMIN already exists. Bootstrap skipped.",
		}, nil
	}

	// 2. EMAIL UNIQUENESS: If email exists with ANY other admin role, refuse cleanly.
	existingAdmin, err := s.repo.GetByEmail(cleanEmail)
	if err == nil && existingAdmin != nil {
		return nil, fmt.Errorf("email %q already exists with admin role %q; refusing to overwrite or modify existing admin", cleanEmail, existingAdmin.Role)
	}

	// 3. PASSWORD HASHING: Use standard bcrypt hashing matching existing admin auth.
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// 4. NAME PARSING: Extract first_name and last_name matching table NOT NULL constraints.
	nameParts := strings.Fields(cleanName)
	firstName := nameParts[0]
	lastName := "Admin"
	if len(nameParts) > 1 {
		lastName = strings.Join(nameParts[1:], " ")
	}

	// 5. CREATE ACTIVE SUPER ADMIN
	superAdmin := &models.AdminUser{
		FirstName:    firstName,
		LastName:     lastName,
		Email:        cleanEmail,
		PasswordHash: string(hash),
		Role:         models.AdminRoleSuperAdmin,
		Status:       models.AdminStatusActive,
		MFAEnabled:   false,
	}

	if err := s.repo.Create(superAdmin); err != nil {
		return nil, fmt.Errorf("failed to create super admin: %w", err)
	}

	// 6. AUDIT: Record inaugural bootstrap action using the newly inserted Super Admin identity.
	if s.auditRecorder != nil {
		newValJSON, _ := json.Marshal(map[string]interface{}{
			"id":         superAdmin.ID.String(),
			"first_name": superAdmin.FirstName,
			"last_name":  superAdmin.LastName,
			"email":      superAdmin.Email,
			"role":       string(superAdmin.Role),
			"status":     string(superAdmin.Status),
		})
		rawNewVal := json.RawMessage(newValJSON)
		auditEntry := &models.AdminAuditLog{
			ActorAdminID: superAdmin.ID,
			ActorRole:    models.AdminRoleSuperAdmin,
			Action:       "SUPER_ADMIN_BOOTSTRAP_CREATED",
			TargetType:   "admin_user",
			TargetID:     superAdmin.ID.String(),
			Reason:       "Initial developer/system bootstrap of first Super Admin",
			NewValue:     &rawNewVal,
		}
		_ = s.auditRecorder.Record(auditEntry)
	}

	return &BootstrapResult{
		Created: true,
		Message: fmt.Sprintf("Super Admin created successfully (ID: %s, Email: %s)", superAdmin.ID, superAdmin.Email),
		Admin:   superAdmin,
	}, nil
}

// ResetSuperAdminPassword safely updates the password for an existing SUPER_ADMIN account.
// It strictly validates:
// - email and password are provided (min 8 characters)
// - the account exists and is a SUPER_ADMIN (refuses non-SUPER_ADMIN accounts)
// - password is encrypted via bcrypt
// - action is recorded in the audit log
// - never exposes or logs the password
func (s *AdminBootstrapService) ResetSuperAdminPassword(email, newPassword string) (*models.AdminUser, error) {
	cleanEmail := strings.TrimSpace(email)
	if cleanEmail == "" {
		return nil, errors.New("SUPER_ADMIN_EMAIL is required for password reset")
	}

	if len(newPassword) < 8 {
		return nil, errors.New("SUPER_ADMIN_PASSWORD must be at least 8 characters")
	}

	existingAdmin, err := s.repo.GetByEmail(cleanEmail)
	if err != nil || existingAdmin == nil {
		return nil, fmt.Errorf("admin user with email %q not found", cleanEmail)
	}

	if existingAdmin.Role != models.AdminRoleSuperAdmin {
		return nil, fmt.Errorf("account %q has role %q; password reset via this CLI is strictly restricted to SUPER_ADMIN", cleanEmail, existingAdmin.Role)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	if err := s.repo.UpdatePassword(existingAdmin.ID, string(hash)); err != nil {
		return nil, fmt.Errorf("failed to update password: %w", err)
	}

	existingAdmin.PasswordHash = string(hash)
	existingAdmin.Status = models.AdminStatusActive

	if s.auditRecorder != nil {
		newValJSON, _ := json.Marshal(map[string]interface{}{
			"id":     existingAdmin.ID.String(),
			"email":  existingAdmin.Email,
			"role":   string(existingAdmin.Role),
			"status": string(existingAdmin.Status),
		})
		rawNewVal := json.RawMessage(newValJSON)
		auditEntry := &models.AdminAuditLog{
			ActorAdminID: existingAdmin.ID,
			ActorRole:    models.AdminRoleSuperAdmin,
			Action:       "SUPER_ADMIN_PASSWORD_RESET",
			TargetType:   "admin_user",
			TargetID:     existingAdmin.ID.String(),
			Reason:       "CLI SUPER_ADMIN password reset operation",
			NewValue:     &rawNewVal,
		}
		_ = s.auditRecorder.Record(auditEntry)
	}

	return existingAdmin, nil
}

