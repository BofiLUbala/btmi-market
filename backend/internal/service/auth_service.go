package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/email"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const maxAvatarBytes = 3 << 20 // 3 MB

var allowedAvatarTypes = map[string]string{
	"image/jpeg": "jpg",
	"image/png":  "png",
	"image/webp": "webp",
}

type AuthService struct {
	userRepo          *repository.UserRepository
	activationRepo    *repository.ActivationTokenRepository
	passwordResetRepo *repository.PasswordResetTokenRepository
	refreshTokenRepo  *repository.RefreshTokenRepository
	emailService      *email.Service
	config            *config.Config
}

func NewAuthService(
	userRepo *repository.UserRepository,
	activationRepo *repository.ActivationTokenRepository,
	passwordResetRepo *repository.PasswordResetTokenRepository,
	refreshTokenRepo *repository.RefreshTokenRepository,
	emailService *email.Service,
	cfg *config.Config,
) *AuthService {
	return &AuthService{
		userRepo:          userRepo,
		activationRepo:    activationRepo,
		passwordResetRepo: passwordResetRepo,
		refreshTokenRepo:  refreshTokenRepo,
		emailService:      emailService,
		config:            cfg,
	}
}

func (s *AuthService) Register(req *models.RegisterRequest) (*models.User, error) {
	return s.registerWithAccountType(req, models.AccountTypeBuyer)
}

// GetUserByID returns the current user for authenticated session restore.
func (s *AuthService) GetUserByID(userID uuid.UUID) (*models.User, error) {
	return s.userRepo.GetByID(userID)
}

// UploadAvatar stores a new profile picture for the user and replaces any
// previous one. Works for every account type (buyer, seller, employee)
// since the avatar lives on the shared users table.
func (s *AuthService) UploadAvatar(userID uuid.UUID, header *multipart.FileHeader) (string, error) {
	if header.Size > maxAvatarBytes {
		return "", errors.New("IMAGE_TOO_LARGE")
	}

	ext, ok := allowedAvatarTypes[header.Header.Get("Content-Type")]
	if !ok {
		return "", errors.New("INVALID_IMAGE_TYPE")
	}

	src, err := header.Open()
	if err != nil {
		return "", errors.New("IMAGE_READ_FAILED")
	}
	defer src.Close()

	dir := filepath.Join(s.config.UploadDir, "avatars", userID.String())
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", errors.New("IMAGE_STORAGE_FAILED")
	}

	fileName := fmt.Sprintf("%s.%s", uuid.NewString(), ext)
	fullPath := filepath.Join(dir, fileName)
	dst, err := os.Create(fullPath)
	if err != nil {
		return "", errors.New("IMAGE_STORAGE_FAILED")
	}
	defer dst.Close()

	if _, err := io.Copy(dst, io.LimitReader(src, maxAvatarBytes+1)); err != nil {
		os.Remove(fullPath)
		return "", errors.New("IMAGE_STORAGE_FAILED")
	}

	url := "/uploads/avatars/" + userID.String() + "/" + fileName

	existing, getErr := s.userRepo.GetByID(userID)
	if err := s.userRepo.UpdateAvatar(userID, url); err != nil {
		os.Remove(fullPath)
		return "", errors.New("IMAGE_SAVE_FAILED")
	}

	// Best-effort cleanup of the previous file now that the new one is saved.
	if getErr == nil && existing.AvatarURL != nil && *existing.AvatarURL != "" {
		old := strings.TrimPrefix(*existing.AvatarURL, "/uploads/")
		os.Remove(filepath.Join(s.config.UploadDir, filepath.FromSlash(old)))
	}

	return url, nil
}

func (s *AuthService) RegisterSeller(req *models.RegisterRequest) (*models.User, error) {
	return s.registerWithAccountType(req, models.AccountTypeSeller)
}

func (s *AuthService) registerWithAccountType(req *models.RegisterRequest, accountType models.AccountType) (*models.User, error) {
	if req.Password != req.PasswordConfirmation {
		return nil, errors.New("PASSWORD_CONFIRMATION_MISMATCH")
	}

	if !IsStrongPassword(req.Password) {
		return nil, errors.New("PASSWORD_TOO_WEAK")
	}

	exists, err := s.userRepo.EmailExists(req.Email)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New("EMAIL_ALREADY_EXISTS")
	}

	exists, err = s.userRepo.PhoneExists(req.Phone)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New("PHONE_ALREADY_EXISTS")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user := &models.User{
		FirstName:     req.FirstName,
		MiddleName:    req.MiddleName,
		LastName:      req.LastName,
		Phone:         req.Phone,
		Email:         req.Email,
		PasswordHash:  string(hashedPassword),
		Status:        models.UserStatusPendingVerification,
		EmailVerified: false,
		AccountType:   accountType,
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	if err := s.sendActivationEmail(user); err != nil {
		return nil, fmt.Errorf("failed to send activation email: %w", err)
	}

	return user, nil
}

// IsStrongPassword is the single registration/invitation policy used by the API.
func IsStrongPassword(password string) bool {
	length := utf8.RuneCountInString(password)
	if length < 8 || length > 64 {
		return false
	}
	var upper, lower, number, special bool
	for _, r := range password {
		switch {
		case r >= 'A' && r <= 'Z':
			upper = true
		case r >= 'a' && r <= 'z':
			lower = true
		case r >= '0' && r <= '9':
			number = true
		case unicode.IsSpace(r):
			special = true
		default:
			special = true
		}
	}
	return upper && lower && number && special
}

func (s *AuthService) ActivateAccount(token string) error {
	tokenHash := HashToken(token)

	activationToken, err := s.activationRepo.GetByTokenHash(tokenHash)
	if err != nil {
		return errors.New("ACTIVATION_LINK_INVALID")
	}

	if activationToken.UsedAt != nil {
		return errors.New("ACTIVATION_LINK_ALREADY_USED")
	}

	if time.Now().After(activationToken.ExpiresAt) {
		return errors.New("ACTIVATION_LINK_EXPIRED")
	}

	if err := s.activationRepo.MarkAsUsed(activationToken.ID); err != nil {
		return fmt.Errorf("failed to mark token as used: %w", err)
	}

	if err := s.userRepo.UpdateStatus(activationToken.UserID, models.UserStatusActive); err != nil {
		return fmt.Errorf("failed to update user status: %w", err)
	}

	if err := s.userRepo.UpdateEmailVerified(activationToken.UserID, true); err != nil {
		return fmt.Errorf("failed to update email verified: %w", err)
	}

	return nil
}

func (s *AuthService) ResendActivation(emailAddr string) error {
	user, err := s.userRepo.GetByEmail(emailAddr)
	if err != nil {
		return errors.New("USER_NOT_FOUND")
	}

	if user.Status == models.UserStatusActive && user.EmailVerified {
		return errors.New("ACCOUNT_ALREADY_ACTIVE")
	}

	if err := s.activationRepo.InvalidateAllForUser(user.ID); err != nil {
		return fmt.Errorf("failed to invalidate old tokens: %w", err)
	}

	if err := s.sendActivationEmail(user); err != nil {
		return fmt.Errorf("failed to send activation email: %w", err)
	}

	return nil
}

func (s *AuthService) RequestPasswordReset(identifier string) error {
	identifier = strings.TrimSpace(identifier)
	var user *models.User
	var err error
	if strings.Contains(identifier, "@") {
		user, err = s.userRepo.GetByEmail(identifier)
	} else {
		user, err = s.userRepo.GetByPhone(identifier)
	}
	if err != nil {
		log.Printf("[forgot-password] lookup failed for identifier: %v", err)
		// Don't reveal if user exists or not for security
		return nil
	}

	// A reset link sent to the registered email proves mailbox access. Allow
	// pending accounts to recover their password, while suspended/deactivated
	// accounts remain blocked.
	if user.Status != models.UserStatusActive && user.Status != models.UserStatusPendingVerification {
		return nil
	}

	if err := s.passwordResetRepo.InvalidateAllForUser(user.ID); err != nil {
		return fmt.Errorf("failed to invalidate old tokens: %w", err)
	}

	if err := s.sendPasswordResetEmail(user); err != nil {
		return fmt.Errorf("failed to send password reset email: %w", err)
	}

	return nil
}

func (s *AuthService) ConfirmPasswordReset(token, newPassword, newPasswordConfirmation string) error {
	if newPassword != newPasswordConfirmation {
		return errors.New("PASSWORD_CONFIRMATION_MISMATCH")
	}

	if !IsStrongPassword(newPassword) {
		return errors.New("PASSWORD_TOO_WEAK")
	}

	tokenHash := HashToken(token)

	resetToken, err := s.passwordResetRepo.GetByTokenHash(tokenHash)
	if err != nil {
		return errors.New("RESET_LINK_INVALID")
	}

	if resetToken.UsedAt != nil {
		return errors.New("RESET_LINK_ALREADY_USED")
	}

	if time.Now().After(resetToken.ExpiresAt) {
		return errors.New("RESET_LINK_EXPIRED")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	if err := s.userRepo.UpdatePassword(resetToken.UserID, string(hashedPassword)); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// Consume the link only after the password has actually been stored.
	if err := s.passwordResetRepo.MarkAsUsed(resetToken.ID); err != nil {
		return fmt.Errorf("failed to mark token as used: %w", err)
	}

	// Revoke all refresh tokens for security
	if err := s.refreshTokenRepo.RevokeAllForUser(resetToken.UserID); err != nil {
		return fmt.Errorf("failed to revoke refresh tokens: %w", err)
	}

	return nil
}

func (s *AuthService) sendPasswordResetEmail(user *models.User) error {
	rawToken, err := GenerateSecureToken(32)
	if err != nil {
		return err
	}

	tokenHash := HashToken(rawToken)

	resetToken := &models.PasswordResetToken{
		UserID:    user.ID,
		TokenHash: tokenHash,
		ExpiresAt: time.Now().Add(1 * time.Hour), // 1 hour expiry for password reset
	}

	if err := s.passwordResetRepo.Create(resetToken); err != nil {
		return err
	}

	resetURL := s.emailService.BuildPasswordResetURL(rawToken)
	return s.emailService.SendPasswordResetEmail(user.Email, resetURL)
}

func (s *AuthService) Login(email, password, userAgent, ipAddress string) (*models.LoginResponse, error) {
	user, err := s.userRepo.GetByEmail(email)
	if err != nil {
		return nil, errors.New("INVALID_CREDENTIALS")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("INVALID_CREDENTIALS")
	}

	if user.Status != models.UserStatusActive || !user.EmailVerified {
		return nil, errors.New("ACCOUNT_NOT_ACTIVATED")
	}

	return s.generateTokenPair(user, userAgent, ipAddress)
}

func (s *AuthService) RefreshToken(refreshTokenStr, userAgent, ipAddress string) (*models.RefreshResponse, error) {
	tokenHash := HashToken(refreshTokenStr)

	refreshToken, err := s.refreshTokenRepo.GetByTokenHash(tokenHash)
	if err != nil {
		return nil, errors.New("INVALID_REFRESH_TOKEN")
	}

	if refreshToken.RevokedAt != nil {
		return nil, errors.New("REFRESH_TOKEN_REVOKED")
	}

	if time.Now().After(refreshToken.ExpiresAt) {
		return nil, errors.New("REFRESH_TOKEN_EXPIRED")
	}

	user, err := s.userRepo.GetByID(refreshToken.UserID)
	if err != nil {
		return nil, errors.New("USER_NOT_FOUND")
	}

	if user.Status != models.UserStatusActive {
		return nil, errors.New("ACCOUNT_NOT_ACTIVATED")
	}

	if err := s.refreshTokenRepo.Revoke(refreshToken.ID); err != nil {
		return nil, fmt.Errorf("failed to revoke old refresh token: %w", err)
	}

	loginResp, err := s.generateTokenPair(user, userAgent, ipAddress)
	if err != nil {
		return nil, err
	}

	return &models.RefreshResponse{
		AccessToken:  loginResp.AccessToken,
		RefreshToken: loginResp.RefreshToken,
		TokenType:    loginResp.TokenType,
		ExpiresIn:    loginResp.ExpiresIn,
	}, nil
}

func (s *AuthService) Logout(refreshTokenStr string) error {
	tokenHash := HashToken(refreshTokenStr)

	refreshToken, err := s.refreshTokenRepo.GetByTokenHash(tokenHash)
	if err != nil {
		return nil
	}

	return s.refreshTokenRepo.Revoke(refreshToken.ID)
}

func (s *AuthService) ValidateAccessToken(tokenStr string) (*jwt.Token, error) {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.config.JWTSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		userIDStr, ok := claims["sub"].(string)
		if !ok {
			return nil, errors.New("invalid token claims")
		}
		_, err := uuid.Parse(userIDStr)
		if err != nil {
			return nil, errors.New("invalid user ID in token")
		}
	}

	return token, nil
}

func (s *AuthService) GetUserIDFromToken(token *jwt.Token) (uuid.UUID, error) {
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return uuid.Nil, errors.New("invalid token claims")
	}

	userIDStr, ok := claims["sub"].(string)
	if !ok {
		return uuid.Nil, errors.New("invalid user ID in token")
	}

	return uuid.Parse(userIDStr)
}

func (s *AuthService) sendActivationEmail(user *models.User) error {
	rawToken, err := GenerateSecureToken(32)
	if err != nil {
		return err
	}

	tokenHash := HashToken(rawToken)

	activationToken := &models.AccountActivationToken{
		UserID:    user.ID,
		TokenHash: tokenHash,
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}

	if err := s.activationRepo.Create(activationToken); err != nil {
		return err
	}

	activationURL := s.emailService.BuildActivationURL(rawToken)
	return s.emailService.SendActivationEmail(user.Email, activationURL)
}

func (s *AuthService) generateTokenPair(user *models.User, userAgent, ipAddress string) (*models.LoginResponse, error) {
	accessToken, err := s.generateAccessToken(user)
	if err != nil {
		return nil, err
	}

	rawRefreshToken, err := GenerateSecureToken(64)
	if err != nil {
		return nil, err
	}

	refreshTokenHash := HashToken(rawRefreshToken)

	refreshToken := &models.RefreshToken{
		UserID:    user.ID,
		TokenHash: refreshTokenHash,
		UserAgent: userAgent,
		IPAddress: ipAddress,
		ExpiresAt: time.Now().Add(time.Duration(s.config.RefreshTokenTTL) * time.Minute),
	}

	if err := s.refreshTokenRepo.Create(refreshToken); err != nil {
		return nil, err
	}

	userResp := &models.User{
		ID:            user.ID,
		FirstName:     user.FirstName,
		MiddleName:    user.MiddleName,
		LastName:      user.LastName,
		Phone:         user.Phone,
		Email:         user.Email,
		Status:        user.Status,
		EmailVerified: user.EmailVerified,
		AccountType:   user.AccountType,
		CreatedAt:     user.CreatedAt,
		UpdatedAt:     user.UpdatedAt,
	}

	return &models.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: rawRefreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    s.config.AccessTokenTTL * 60,
		User:         userResp,
	}, nil
}

func (s *AuthService) generateAccessToken(user *models.User) (string, error) {
	claims := jwt.MapClaims{
		"sub":          user.ID.String(),
		"email":        user.Email,
		"account_type": string(user.AccountType),
		"iat":          time.Now().Unix(),
		"exp":          time.Now().Add(time.Duration(s.config.AccessTokenTTL) * time.Minute).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.config.JWTSecret))
}

func GenerateSecureToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
