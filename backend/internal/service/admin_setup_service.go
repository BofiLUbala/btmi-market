package service

import (
	"crypto/subtle"
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
	ErrSetupCodeInvalid   = errors.New("SETUP_CODE_INVALID")
	ErrSetupLinkInvalid   = errors.New("INVALID_SETUP_LINK")
	ErrSetupLinkExpired   = errors.New("SETUP_LINK_EXPIRED")
	ErrSetupAlreadyActive = errors.New("ADMIN_ALREADY_ACTIVATED")
)

// setupLinkTTL is how long the owner has to open the activation e-mail.
const setupLinkTTL = 24 * time.Hour

// AdminSetupRepository is what the super admin setup needs from storage.
type AdminSetupRepository interface {
	IsSetupCodeClaimed(codeHash string) (bool, error)
	StartSuperAdminClaim(claim repository.SuperAdminClaim) (uuid.UUID, bool, error)
	CancelSuperAdminClaim(pendingID uuid.UUID, codeHash string) error
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

// AdminSetupService lets the platform owner claim the single SUPER_ADMIN
// account with the one-time code from SUPER_ADMIN_SETUP_CODE. The account is
// created PENDING and only becomes the holder once the owner follows the link
// e-mailed to the address he typed, which is what proves the address is his.
// There is only ever one super admin: activating retires the previous holder.
type AdminSetupService struct {
	repo        AdminSetupRepository
	invitations SetupInvitationRepository
	mailer      SetupMailer
	code        string
}

func NewAdminSetupService(repo AdminSetupRepository, invitations SetupInvitationRepository, mailer SetupMailer, code string) *AdminSetupService {
	return &AdminSetupService{repo: repo, invitations: invitations, mailer: mailer, code: strings.TrimSpace(code)}
}

// Available reports whether a setup code is configured and still unused.
func (s *AdminSetupService) Available() bool {
	if s.code == "" {
		return false
	}
	used, err := s.repo.IsSetupCodeClaimed(HashToken(s.code))
	return err == nil && !used
}

// Start checks the code and the owner's details, creates the pending super
// admin and e-mails him the activation link. It returns the address the link
// went to, and whether this is the platform's first super admin.
func (s *AdminSetupService) Start(code, name, email, password string) (string, bool, error) {
	if s.code == "" {
		return "", false, ErrSetupUnavailable
	}
	if subtle.ConstantTimeCompare([]byte(strings.TrimSpace(code)), []byte(s.code)) != 1 {
		return "", false, ErrSetupCodeInvalid
	}

	nameParts := strings.Fields(name)
	if len(nameParts) == 0 {
		return "", false, errors.New("NAME_REQUIRED")
	}
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	if addr, err := mail.ParseAddress(cleanEmail); err != nil || addr.Address != cleanEmail {
		return "", false, errors.New("INVALID_EMAIL")
	}
	if !IsStrongPassword(password) {
		return "", false, errors.New("PASSWORD_TOO_WEAK")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", false, err
	}
	lastName := "Admin"
	if len(nameParts) > 1 {
		lastName = strings.Join(nameParts[1:], " ")
	}

	codeHash := HashToken(s.code)
	pendingID, first, err := s.repo.StartSuperAdminClaim(repository.SuperAdminClaim{
		CodeHash:     codeHash,
		FirstName:    nameParts[0],
		LastName:     lastName,
		Email:        cleanEmail,
		PasswordHash: string(hash),
	})
	if err != nil {
		return "", false, err
	}

	// From here on a failure must hand the code back, or a typo in the address
	// would close the setup for good with nobody able to sign in.
	rawToken, err := GenerateSecureToken(32)
	if err != nil {
		s.cancel(pendingID, codeHash)
		return "", false, err
	}
	if err := s.invitations.Create(&models.AdminInvitation{
		AdminID:          pendingID,
		InvitedByAdminID: pendingID, // the owner invites himself
		TokenHash:        HashToken(rawToken),
		Status:           models.AdminInvitationStatusPending,
		ExpiresAt:        time.Now().Add(setupLinkTTL),
	}); err != nil {
		s.cancel(pendingID, codeHash)
		return "", false, err
	}

	if err := s.mailer.SendSuperAdminSetupEmail(cleanEmail, nameParts[0], s.mailer.BuildSuperAdminSetupURL(rawToken)); err != nil {
		s.cancel(pendingID, codeHash)
		return "", false, err
	}
	return cleanEmail, first, nil
}

func (s *AdminSetupService) cancel(pendingID uuid.UUID, codeHash string) {
	if err := s.repo.CancelSuperAdminClaim(pendingID, codeHash); err != nil {
		log.Printf("[admin-setup] could not hand the setup code back: %v", err)
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
		if errors.Is(err, repository.ErrSetupNotPending) {
			return nil, ErrSetupAlreadyActive
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
