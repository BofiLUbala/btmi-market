package service

import (
	"errors"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// Deleting your own account is an App Store requirement (rule 5.1.1(v)), and
// it has to work for every account the app can create. Since migration 118
// that includes accounts known by a phone number alone, which have no password
// their holder could type -- only a hash of random bytes thrown away at
// sign-up. So the proof of ownership depends on how the account was made:
//
//   - an account with a password proves ownership by typing it, exactly as
//     before; a code is NOT accepted instead, so this path is no weaker than
//     it was;
//   - a phone-only account proves ownership with a one-time code sent to its
//     own verified number -- the same proof that opens it every time its
//     holder signs in.
//
// users.has_password is what tells the two apart (migration 121): comparing
// the hash cannot, since a placeholder looks like any other bcrypt digest.

const (
	deletionProofPassword = "PASSWORD"
	deletionProofCode     = "CODE"
)

// accountDeletionProof decides what the request has to carry, and checks a
// password when that is the proof. It never looks at the database, so the
// decision can be tested on its own.
func accountDeletionProof(user *models.User, password, challengeID, code string) (string, error) {
	if user.HasPassword {
		if strings.TrimSpace(password) == "" {
			return "", errors.New("PASSWORD_REQUIRED")
		}
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
			return "", errors.New("INVALID_PASSWORD")
		}
		return deletionProofPassword, nil
	}
	// Nothing to type: the number is the only way in, so it has to be one we
	// have already seen a code come back on.
	if !user.PhoneVerified {
		return "", errors.New("PHONE_NOT_VERIFIED")
	}
	if strings.TrimSpace(challengeID) == "" || strings.TrimSpace(code) == "" {
		return "", errors.New("DELETION_CODE_REQUIRED")
	}
	return deletionProofCode, nil
}

// RequestAccountDeletionCode sends the one-time code that confirms the deletion of
// an account that has no password. The blockers are checked first: it would be
// unkind to send a code for a deletion that is going to be refused anyway.
func (s *AuthService) RequestAccountDeletionCode(userID uuid.UUID) (*models.WhatsAppChallenge, error) {
	if !s.whatsappReady() {
		return nil, errors.New("WHATSAPP_UNAVAILABLE")
	}
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, errors.New("USER_NOT_FOUND")
	}
	if user.HasPassword {
		// The password is the proof for this account; a code would be a second,
		// weaker way in and is refused.
		return nil, errors.New("PASSWORD_REQUIRED")
	}
	if !user.PhoneVerified {
		return nil, errors.New("PHONE_NOT_VERIFIED")
	}
	if err := s.checkAccountDeletionBlockers(userID); err != nil {
		return nil, err
	}
	return s.sendWhatsAppCode(user, otpPurposeDeleteAccount)
}

// DeleteAccount erases the signed-in user's own account once they have proved
// it is theirs -- their password, or a code on their number for an account
// that has none. It refuses while orders are in progress or an active business
// is still owned, so nobody is left waiting on a delivery or a shop.
func (s *AuthService) DeleteAccount(userID uuid.UUID, password, challengeID, code string) error {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return errors.New("USER_NOT_FOUND")
	}
	proof, err := accountDeletionProof(user, password, challengeID, code)
	if err != nil {
		return err
	}
	if proof == deletionProofCode {
		if err := s.consumeOTP(userID, otpPurposeDeleteAccount, challengeID, code); err != nil {
			return err
		}
	}
	if err := s.checkAccountDeletionBlockers(userID); err != nil {
		return err
	}
	if err := s.userRepo.AnonymizeAccount(userID); err != nil {
		return err
	}
	return s.refreshTokenRepo.RevokeAllForUser(userID)
}

// checkAccountDeletionBlockers refuses a deletion that would strand an order
// or a shop. Both the code request and the deletion itself go through it.
func (s *AuthService) checkAccountDeletionBlockers(userID uuid.UUID) error {
	openOrders, ownedBusinesses, err := s.userRepo.AccountDeletionBlockers(userID)
	if err != nil {
		return err
	}
	if openOrders > 0 {
		return errors.New("OPEN_ORDERS")
	}
	if ownedBusinesses > 0 {
		return errors.New("OWNS_BUSINESS")
	}
	return nil
}
