package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/email"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	userRepo          *repository.UserRepository
	activationRepo    *repository.ActivationTokenRepository
	refreshTokenRepo  *repository.RefreshTokenRepository
	emailService      *email.Service
	config            *config.Config
}

func NewAuthService(
	userRepo *repository.UserRepository,
	activationRepo *repository.ActivationTokenRepository,
	refreshTokenRepo *repository.RefreshTokenRepository,
	emailService *email.Service,
	cfg *config.Config,
) *AuthService {
	return &AuthService{
		userRepo:         userRepo,
		activationRepo:   activationRepo,
		refreshTokenRepo: refreshTokenRepo,
		emailService:     emailService,
		config:           cfg,
	}
}

func (s *AuthService) Register(req *models.RegisterRequest) (*models.User, error) {
	return s.registerWithAccountType(req, models.AccountTypeBuyer)
}

// GetUserByID returns the current user for authenticated session restore.
func (s *AuthService) GetUserByID(userID uuid.UUID) (*models.User, error) {
	return s.userRepo.GetByID(userID)
}

func (s *AuthService) RegisterSeller(req *models.RegisterRequest) (*models.User, error) {
	return s.registerWithAccountType(req, models.AccountTypeSeller)
}

func (s *AuthService) registerWithAccountType(req *models.RegisterRequest, accountType models.AccountType) (*models.User, error) {
	if req.Password != req.PasswordConfirmation {
		return nil, errors.New("PASSWORD_CONFIRMATION_MISMATCH")
	}

	if len(req.Password) < 8 {
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
		"sub": user.ID.String(),
		"email": user.Email,
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(time.Duration(s.config.AccessTokenTTL) * time.Minute).Unix(),
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
