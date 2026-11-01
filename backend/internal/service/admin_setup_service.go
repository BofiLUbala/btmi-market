package service

import (
	"errors"
	"log"
	"net/mail"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// Errors the setup screen translates (apiError.<code> in the app).
var (
	ErrSetupUnavailable   = errors.New("SETUP_UNAVAILABLE")
	ErrSetupLinkInvalid   = errors.New("INVALID_SETUP_LINK")
	ErrSetupLinkExpired   = errors.New("SETUP_LINK_EXPIRED")
	ErrSetupAlreadyActive = errors.New("ADMIN_ALREADY_ACTIVATED")
)

// setupLinkTTL is how long the owner has to open the activation e-mail.
const setupLinkTTL = 24 * time.Hour

// AdminSetupRepository is what the super admin setup needs from storage.
type AdminSetupRepository interface {
	HasActiveSuperAdmin() (bool, error)
	StartSuperAdminClaim(claim repository.SuperAdminClaim) (uuid.UUID, error)
	CancelSuperAdminClaim(pendingID uuid.UUID) error
	ActivateSuperAdminClaim(pendingID uuid.UUID) error
	GetByID(id uuid.UUID) (*models.AdminUser, error)
}

// SetupInvitationRepository is the slice of the admin invitation storage the
// setup uses: the activation link is an invitation like any other.
type SetupInvitationRepository interface {
	Create(invitation *models.AdminInvitation) error
	GetByTokenHash(tokenHash string) (*models.AdminInvitation, error)
	UpdateStatus(id uuid.UUID, status models.AdminInvitationStatus, acceptedAt *time.Time) error
}

// SetupMailer sends the one e-mail the setup depends on.
type SetupMailer interface {
	BuildSuperAdminSetupURL(token string) string
	SendSuperAdminSetupEmail(to, firstName, setupURL string) error
}

// AdminSetupService lets the platform owner create the single SUPER_ADMIN
// account. It is only on offer while the platform has no active super admin;
// the account is created PENDING and only becomes the holder once the owner
// follows the link e-mailed to the address he typed, which is what proves the
// address is his.
type AdminSetupService struct {
	repo        AdminSetupRepository
	invitations SetupInvitationRepository
	mailer      SetupMailer
}

func NewAdminSetupService(repo AdminSetupRepository, invitations SetupInvitationRepository, mailer SetupMailer) *AdminSetupService {
	return &AdminSetupService{repo: repo, invitations: invitations, mailer: mailer}
}

// Available reports whether the setup is open: it is, until a super admin is
// active. From then on the account can only change hands from the inside.
func (s *AdminSetupService) Available() bool {
	held, err := s.repo.HasActiveSuperAdmin()
	return err == nil && !held
}

// Start checks the owner's details, creates the pending super admin and e-mails
// him the activation link. It returns the address the link went to.
func (s *AdminSetupService) Start(name, email, password string) (string, error) {
	held, err := s.repo.HasActiveSuperAdmin()
	if err != nil {
		return "", err
	}
	if held {
		return "", ErrSetupUnavailable
	}

	nameParts := strings.Fields(name)
	if len(nameParts) == 0 {
		return "", errors.New("NAME_REQUIRED")
	}
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	if addr, err := mail.ParseAddress(cleanEmail); err != nil || addr.Address != cleanEmail {
		return "", errors.New("INVALID_EMAIL")
	}
	if !IsStrongPassword(password) {
		return "", errors.New("PASSWORD_TOO_WEAK")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	lastName := "Admin"
	if len(nameParts) > 1 {
		lastName = strings.Join(nameParts[1:], " ")
	}

	pendingID, err := s.repo.StartSuperAdminClaim(repository.SuperAdminClaim{
		FirstName:    nameParts[0],
		LastName:     lastName,
		Email:        cleanEmail,
		PasswordHash: string(hash),
	})
	if err != nil {
		return "", err
	}

	// From here on a failure must drop the pending account, or a typo in the
	// address would leave it squatting on the e-mail.
	rawToken, err := GenerateSecureToken(32)
	if err != nil {
		s.cancel(pendingID)
		return "", err
	}
	if err := s.invitations.Create(&models.AdminInvitation{
		AdminID:          pendingID,
		InvitedByAdminID: pendingID, // the owner invites himself
		TokenHash:        HashToken(rawToken),
		Status:           models.AdminInvitationStatusPending,
		ExpiresAt:        time.Now().Add(setupLinkTTL),
	}); err != nil {
		s.cancel(pendingID)
		return "", err
	}

	if err := s.mailer.SendSuperAdminSetupEmail(cleanEmail, nameParts[0], s.mailer.BuildSuperAdminSetupURL(rawToken)); err != nil {
		s.cancel(pendingID)
		return "", err
	}
	return cleanEmail, nil
}

func (s *AdminSetupService) cancel(pendingID uuid.UUID) {
	if err := s.repo.CancelSuperAdminClaim(pendingID); err != nil {
		log.Printf("[admin-setup] could not drop the pending super admin: %v", err)
	}
}

// Verify is what the activation page calls before offering the button.
func (s *AdminSetupService) Verify(rawToken string) (*models.AdminUser, error) {
	_, admin, err := s.pending(rawToken)
	return admin, err
}

// Activate makes the pending account the super admin and burns the link.
func (s *AdminSetupService) Activate(rawToken string) (*models.AdminUser, error) {
	invitation, admin, err := s.pending(rawToken)
	if err != nil {
		return nil, err
	}
	if err := s.repo.ActivateSuperAdminClaim(admin.ID); err != nil {
		switch {
		case errors.Is(err, repository.ErrSetupNotPending):
			return nil, ErrSetupAlreadyActive
		case errors.Is(err, repository.ErrSetupClosed):
			return nil, ErrSetupUnavailable
		}
		return nil, err
	}
	now := time.Now()
	if err := s.invitations.UpdateStatus(invitation.ID, models.AdminInvitationStatusAccepted, &now); err != nil {
		// The account is the holder now; a stale invitation row only means the
		// link could be replayed, and the next activation finds it not pending.
		log.Printf("[admin-setup] could not close the activation link: %v", err)
	}
	admin.Status = models.AdminStatusActive
	return admin, nil
}

// pending resolves a raw activation token to its live invitation and account.
func (s *AdminSetupService) pending(rawToken string) (*models.AdminInvitation, *models.AdminUser, error) {
	if strings.TrimSpace(rawToken) == "" {
		return nil, nil, ErrSetupLinkInvalid
	}
	invitation, err := s.invitations.GetByTokenHash(HashToken(rawToken))
	if err != nil || invitation.Status != models.AdminInvitationStatusPending {
		return nil, nil, ErrSetupLinkInvalid
	}
	if time.Now().After(invitation.ExpiresAt) {
		return nil, nil, ErrSetupLinkExpired
	}
	admin, err := s.repo.GetByID(invitation.AdminID)
	if err != nil || admin.Role != models.AdminRoleSuperAdmin {
		return nil, nil, ErrSetupLinkInvalid
	}
	if admin.Status != models.AdminStatusPending {
		return nil, nil, ErrSetupAlreadyActive
	}
	return invitation, admin, nil
}
