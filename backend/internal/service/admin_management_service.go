package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/email"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// AdminManagementService lets a SUPER_ADMIN administer other Control Center
// admin accounts: invite, activate, suspend, reactivate, change role, and
// force logout. It is fully separate from AdminDirectionService, which
// manages ordinary platform end-users, not admin_users accounts.
type AdminManagementService struct {
	adminRepo      *repository.AdminRepository
	invitationRepo *repository.AdminInvitationRepository
	auditService   *AuditService
	emailService   *email.Service
}

func NewAdminManagementService(
	adminRepo *repository.AdminRepository,
	invitationRepo *repository.AdminInvitationRepository,
	auditService *AuditService,
	emailService *email.Service,
) *AdminManagementService {
	return &AdminManagementService{
		adminRepo:      adminRepo,
		invitationRepo: invitationRepo,
		auditService:   auditService,
		emailService:   emailService,
	}
}

// invitableRoles is the set of roles that can be created through the
// invite flow. SUPER_ADMIN accounts can only ever be created via the
// secure CLI bootstrap (backend/cmd/create-superadmin), never over the API.
var invitableRoles = map[models.AdminRole]bool{
	models.AdminRoleDirectionAdmin:      true,
	models.AdminRoleCommerceAdmin:       true,
	models.AdminRoleFinanceSupportAdmin: true,
	models.AdminRoleTechnicalAdmin:      true,
}

func (s *AdminManagementService) ListAdmins(roleFilter, statusFilter, search string, limit, offset int) ([]*models.AdminUserListResponse, int, error) {
	admins, total, err := s.adminRepo.List(roleFilter, statusFilter, search, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	items := make([]*models.AdminUserListResponse, 0, len(admins))
	for _, a := range admins {
		item := &models.AdminUserListResponse{
			ID:          a.ID,
			FirstName:   a.FirstName,
			LastName:    a.LastName,
			Email:       a.Email,
			Role:        a.Role,
			Status:      a.Status,
			LastLoginAt: a.LastLoginAt,
			CreatedAt:   a.CreatedAt,
		}
		if invitation, invitationErr := s.invitationRepo.GetByAdminID(a.ID); invitationErr == nil {
			status := invitation.Status
			if status == models.AdminInvitationStatusPending && time.Now().After(invitation.ExpiresAt) {
				status = models.AdminInvitationStatusExpired
			}
			item.InvitationStatus = &status
			item.InvitationExpiry = &invitation.ExpiresAt
		}
		items = append(items, item)
	}
	return items, total, nil
}

// InviteAdmin creates a PENDING admin_users row plus a single-use activation
// token, and sends (or, in dev mode, logs) the invitation email.
func (s *AdminManagementService) InviteAdmin(actorID uuid.UUID, actorRole models.AdminRole, req *models.InviteAdminRequest, ip, userAgent string) (*models.AdminUser, string, error) {
	if !invitableRoles[req.Role] {
		return nil, "", errors.New("INVALID_ROLE")
	}

	if existing, err := s.adminRepo.GetByEmail(req.Email); err == nil && existing != nil {
		return nil, "", errors.New("EMAIL_ALREADY_EXISTS")
	}

	// Placeholder password hash: unusable until the admin sets a real one via activation.
	placeholder, err := bcrypt.GenerateFromPassword([]byte(uuid.New().String()), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", fmt.Errorf("failed to prepare placeholder credential: %w", err)
	}

	admin := &models.AdminUser{
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Email:        req.Email,
		PasswordHash: string(placeholder),
		Role:         req.Role,
		Status:       models.AdminStatusPending,
	}
	if err := s.adminRepo.Create(admin); err != nil {
		return nil, "", fmt.Errorf("failed to create admin: %w", err)
	}

	rawToken, err := s.createInvitation(admin.ID, actorID)
	if err != nil {
		return nil, "", err
	}

	invitationURL := s.emailService.BuildAdminInvitationURL(rawToken)
	if err := s.emailService.SendAdminInvitationEmail(admin.Email, admin.FirstName, string(admin.Role), invitationURL); err != nil {
		// Invitation creation is only successful if delivery succeeds. Roll back
		// the still-PENDING account (its invitation cascades) so a retry with the
		// same email is possible instead of returning EMAIL_ALREADY_EXISTS.
		if rollbackErr := s.adminRepo.DeletePendingAdmin(admin.ID); rollbackErr != nil {
			return nil, "", fmt.Errorf("failed to send invitation email: %v; rollback failed: %w", err, rollbackErr)
		}
		return nil, "", fmt.Errorf("failed to send invitation email: %w", err)
	}

	_ = s.auditService.Record(
		actorID, actorRole, "ADMIN_INVITED", "admin_user", admin.ID.String(),
		fmt.Sprintf("Invited %s as %s", admin.Email, admin.Role),
		nil,
		map[string]interface{}{"email": admin.Email, "role": admin.Role, "status": admin.Status},
		ip, userAgent,
	)

	return admin, rawToken, nil
}

func (s *AdminManagementService) createInvitation(adminID, invitedBy uuid.UUID) (string, error) {
	rawToken, err := GenerateSecureToken(32)
	if err != nil {
		return "", err
	}

	invitation := &models.AdminInvitation{
		AdminID:          adminID,
		InvitedByAdminID: invitedBy,
		TokenHash:        HashToken(rawToken),
		Status:           models.AdminInvitationStatusPending,
		ExpiresAt:        time.Now().Add(7 * 24 * time.Hour),
	}
	if err := s.invitationRepo.Create(invitation); err != nil {
		return "", fmt.Errorf("failed to create invitation: %w", err)
	}
	return rawToken, nil
}

// ResendInvitation invalidates any pending invitation for the target admin and issues a new one.
func (s *AdminManagementService) ResendInvitation(actorID uuid.UUID, actorRole models.AdminRole, targetID uuid.UUID, ip, userAgent string) error {
	admin, err := s.adminRepo.GetByID(targetID)
	if err != nil {
		return errors.New("ADMIN_NOT_FOUND")
	}
	if admin.Status != models.AdminStatusPending {
		return errors.New("ADMIN_ALREADY_ACTIVATED")
	}

	if err := s.invitationRepo.InvalidateAllForAdmin(targetID); err != nil {
		return fmt.Errorf("failed to invalidate previous invitations: %w", err)
	}

	rawToken, err := s.createInvitation(admin.ID, actorID)
	if err != nil {
		return err
	}

	invitationURL := s.emailService.BuildAdminInvitationURL(rawToken)
	if err := s.emailService.SendAdminInvitationEmail(admin.Email, admin.FirstName, string(admin.Role), invitationURL); err != nil {
		return fmt.Errorf("failed to send invitation email: %w", err)
	}

	_ = s.auditService.Record(
		actorID, actorRole, "INVITATION_RESENT", "admin_user", admin.ID.String(),
		fmt.Sprintf("Resent invitation to %s", admin.Email),
		nil, nil, ip, userAgent,
	)

	return nil
}

// VerifyInvitation is called by the public activation page to check a token
// before showing the "set your password" form.
func (s *AdminManagementService) VerifyInvitation(rawToken string) (*models.AdminUser, error) {
	invitation, err := s.invitationRepo.GetByTokenHash(HashToken(rawToken))
	if err != nil {
		return nil, errors.New("INVALID_INVITATION")
	}
	if invitation.Status != models.AdminInvitationStatusPending {
		return nil, errors.New("INVALID_INVITATION")
	}
	if time.Now().After(invitation.ExpiresAt) {
		return nil, errors.New("INVITATION_EXPIRED")
	}
	admin, err := s.adminRepo.GetByID(invitation.AdminID)
	if err != nil {
		return nil, errors.New("ADMIN_NOT_FOUND")
	}
	return admin, nil
}

// ActivateAdmin is the public endpoint an invited admin hits to set their
// password and move their account from PENDING to ACTIVE.
func (s *AdminManagementService) ActivateAdmin(req *models.ActivateAdminRequest, ip, userAgent string) (*models.AdminUser, error) {
	if req.Password != req.PasswordConfirm {
		return nil, errors.New("PASSWORD_CONFIRMATION_MISMATCH")
	}
	if !IsStrongPassword(req.Password) {
		return nil, errors.New("PASSWORD_TOO_WEAK")
	}

	tokenHash := HashToken(req.Token)
	invitation, err := s.invitationRepo.GetByTokenHash(tokenHash)
	if err != nil {
		return nil, errors.New("INVALID_INVITATION")
	}
	if invitation.Status != models.AdminInvitationStatusPending {
		return nil, errors.New("INVALID_INVITATION")
	}
	if time.Now().After(invitation.ExpiresAt) {
		return nil, errors.New("INVITATION_EXPIRED")
	}

	admin, err := s.adminRepo.GetByID(invitation.AdminID)
	if err != nil {
		return nil, errors.New("ADMIN_NOT_FOUND")
	}
	if admin.Status != models.AdminStatusPending {
		return nil, errors.New("ADMIN_ALREADY_ACTIVATED")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	if err := s.adminRepo.ActivateWithPassword(admin.ID, string(hashedPassword)); err != nil {
		return nil, fmt.Errorf("failed to activate admin: %w", err)
	}

	now := time.Now()
	if err := s.invitationRepo.UpdateStatus(invitation.ID, models.AdminInvitationStatusAccepted, &now); err != nil {
		return nil, fmt.Errorf("failed to update invitation status: %w", err)
	}

	// The newly activated admin is the actor of their own activation event.
	_ = s.auditService.Record(
		admin.ID, admin.Role, "ADMIN_ACTIVATED", "admin_user", admin.ID.String(),
		"Admin completed invitation activation and set their password",
		map[string]interface{}{"status": models.AdminStatusPending},
		map[string]interface{}{"status": models.AdminStatusActive},
		ip, userAgent,
	)

	admin.Status = models.AdminStatusActive
	return admin, nil
}

func (s *AdminManagementService) SuspendAdmin(actorID uuid.UUID, actorRole models.AdminRole, targetID uuid.UUID, reason, ip, userAgent string) error {
	admin, err := s.adminRepo.GetByID(targetID)
	if err != nil {
		return errors.New("ADMIN_NOT_FOUND")
	}
	if admin.Status == models.AdminStatusSuspended {
		return errors.New("ADMIN_ALREADY_SUSPENDED")
	}
	if err := s.adminRepo.ValidateSuperAdminProtection(targetID, admin.Role, models.AdminStatusSuspended); err != nil {
		return err
	}

	oldStatus := admin.Status
	if err := s.adminRepo.UpdateStatus(targetID, models.AdminStatusSuspended); err != nil {
		return fmt.Errorf("failed to suspend admin: %w", err)
	}
	_ = s.adminRepo.RevokeAllRefreshTokensForAdmin(targetID)

	_ = s.auditService.Record(
		actorID, actorRole, "ADMIN_SUSPENDED", "admin_user", targetID.String(), reason,
		map[string]interface{}{"status": oldStatus},
		map[string]interface{}{"status": models.AdminStatusSuspended},
		ip, userAgent,
	)
	return nil
}

func (s *AdminManagementService) ReactivateAdmin(actorID uuid.UUID, actorRole models.AdminRole, targetID uuid.UUID, reason, ip, userAgent string) error {
	admin, err := s.adminRepo.GetByID(targetID)
	if err != nil {
		return errors.New("ADMIN_NOT_FOUND")
	}
	if admin.Status == models.AdminStatusActive {
		return errors.New("ADMIN_ALREADY_ACTIVE")
	}
	if admin.Status == models.AdminStatusPending {
		return errors.New("ADMIN_NOT_YET_ACTIVATED")
	}

	oldStatus := admin.Status
	if err := s.adminRepo.UpdateStatus(targetID, models.AdminStatusActive); err != nil {
		return fmt.Errorf("failed to reactivate admin: %w", err)
	}

	_ = s.auditService.Record(
		actorID, actorRole, "ADMIN_REACTIVATED", "admin_user", targetID.String(), reason,
		map[string]interface{}{"status": oldStatus},
		map[string]interface{}{"status": models.AdminStatusActive},
		ip, userAgent,
	)
	return nil
}

func (s *AdminManagementService) ForceLogoutAdmin(actorID uuid.UUID, actorRole models.AdminRole, targetID uuid.UUID, reason, ip, userAgent string) error {
	if _, err := s.adminRepo.GetByID(targetID); err != nil {
		return errors.New("ADMIN_NOT_FOUND")
	}
	if err := s.adminRepo.InvalidateAllSessions(targetID); err != nil {
		return fmt.Errorf("failed to revoke admin sessions: %w", err)
	}

	_ = s.auditService.Record(
		actorID, actorRole, "ADMIN_FORCE_LOGOUT", "admin_user", targetID.String(), reason,
		nil, map[string]interface{}{"action": "all_sessions_revoked"}, ip, userAgent,
	)
	return nil
}

// UpdateOwnProfile lets a signed-in admin correct the name the console shows
// as their identity. A bootstrapped SUPER_ADMIN starts as the literal
// placeholder its environment variables gave it, so without this the operator's
// own name is the one thing in the console they cannot fix.
func (s *AdminManagementService) UpdateOwnProfile(actorID uuid.UUID, actorRole models.AdminRole, req *models.UpdateAdminProfileRequest, ip, userAgent string) (*models.AdminUser, error) {
	admin, err := s.adminRepo.GetByID(actorID)
	if err != nil {
		return nil, errors.New("ADMIN_NOT_FOUND")
	}

	firstName := strings.TrimSpace(req.FirstName)
	lastName := strings.TrimSpace(req.LastName)
	if firstName == "" || lastName == "" {
		return nil, errors.New("INVALID_NAME")
	}
	if firstName == admin.FirstName && lastName == admin.LastName {
		return admin, nil
	}

	if err := s.adminRepo.UpdateProfile(actorID, firstName, lastName); err != nil {
		return nil, fmt.Errorf("failed to update profile: %w", err)
	}

	_ = s.auditService.Record(
		actorID, actorRole, "ADMIN_PROFILE_UPDATED", "admin_user", actorID.String(), "Self-service name update",
		map[string]interface{}{"first_name": admin.FirstName, "last_name": admin.LastName},
		map[string]interface{}{"first_name": firstName, "last_name": lastName},
		ip, userAgent,
	)

	admin.FirstName = firstName
	admin.LastName = lastName
	return admin, nil
}

// DeleteAdminResult reports which of the two deletions actually happened, so
// the console can tell the operator whether the row is gone or retired.
type DeleteAdminResult struct {
	HardDeleted bool
	Email       string
	Role        models.AdminRole
	Status      models.AdminStatus
}

// DeleteAdmin removes an admin account permanently.
//
// An invited admin who never activated has produced nothing that references it
// except its own invitation, which cascades, so its row is deleted outright.
// Any admin who has actually acted is retired instead of erased: their entries
// in admin_audit_log, admin_announcements, admin_approval_requests and
// admin_export_jobs all point at the row with ON DELETE NO ACTION, and dropping
// them to free the row would destroy the record of what the account did. Either
// way the account can never sign in again and its address is released.
//
// The audit entry is written before the change so ADMIN_DELETED survives its own
// target and keeps the address, role and status the account had.
func (s *AdminManagementService) DeleteAdmin(actorID uuid.UUID, actorRole models.AdminRole, targetID uuid.UUID, confirmEmail, reason, ip, userAgent string) (*DeleteAdminResult, error) {
	if actorID == targetID {
		return nil, errors.New("CANNOT_DELETE_YOURSELF")
	}

	admin, err := s.adminRepo.GetByID(targetID)
	if err != nil {
		return nil, errors.New("ADMIN_NOT_FOUND")
	}
	// Retyping the address is what separates deleting this account from
	// deleting the row above it in a list.
	if !strings.EqualFold(strings.TrimSpace(confirmEmail), admin.Email) {
		return nil, errors.New("EMAIL_CONFIRMATION_MISMATCH")
	}
	// Deleting is strictly more destructive than deactivating, so it inherits
	// the same invariant: the platform must keep one active SUPER_ADMIN.
	if err := s.adminRepo.ValidateSuperAdminProtection(targetID, admin.Role, models.AdminStatusDeactivated); err != nil {
		return nil, err
	}

	result := &DeleteAdminResult{Email: admin.Email, Role: admin.Role, Status: admin.Status}
	newValue := map[string]interface{}{"deleted": true}

	_ = s.auditService.Record(
		actorID, actorRole, "ADMIN_DELETED", "admin_user", targetID.String(), reason,
		map[string]interface{}{"email": admin.Email, "role": admin.Role, "status": admin.Status},
		newValue,
		ip, userAgent,
	)

	if admin.Status == models.AdminStatusPending {
		if err := s.adminRepo.DeletePendingAdmin(targetID); err != nil {
			return nil, fmt.Errorf("failed to delete admin: %w", err)
		}
		result.HardDeleted = true
		return result, nil
	}

	// uuid keeps the tombstone unique even if the same address is invited,
	// deleted, invited and deleted again.
	tombstone := fmt.Sprintf("deleted+%s@tbk.invalid", targetID.String())
	if err := s.adminRepo.TombstoneAdmin(targetID, tombstone); err != nil {
		return nil, fmt.Errorf("failed to delete admin: %w", err)
	}
	return result, nil
}

func (s *AdminManagementService) ChangeAdminRole(actorID uuid.UUID, actorRole models.AdminRole, targetID uuid.UUID, req *models.ChangeAdminRoleRequest, ip, userAgent string) error {
	if !invitableRoles[req.Role] {
		return errors.New("INVALID_ROLE")
	}

	admin, err := s.adminRepo.GetByID(targetID)
	if err != nil {
		return errors.New("ADMIN_NOT_FOUND")
	}
	if admin.Role == req.Role {
		return errors.New("ADMIN_ALREADY_HAS_ROLE")
	}
	if err := s.adminRepo.ValidateSuperAdminProtection(targetID, req.Role, admin.Status); err != nil {
		return err
	}

	oldRole := admin.Role
	if err := s.adminRepo.UpdateRole(targetID, req.Role); err != nil {
		return fmt.Errorf("failed to change admin role: %w", err)
	}

	_ = s.auditService.Record(
		actorID, actorRole, "ADMIN_ROLE_CHANGED", "admin_user", targetID.String(), req.Reason,
		map[string]interface{}{"role": oldRole},
		map[string]interface{}{"role": req.Role},
		ip, userAgent,
	)
	return nil
}
