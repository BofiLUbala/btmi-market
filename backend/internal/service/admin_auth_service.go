package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AdminAuthService struct {
	adminRepo *repository.AdminRepository
	config    *config.Config
}

func NewAdminAuthService(adminRepo *repository.AdminRepository, cfg *config.Config) *AdminAuthService {
	return &AdminAuthService{
		adminRepo: adminRepo,
		config:    cfg,
	}
}

func (s *AdminAuthService) Login(email, password, ipAddress, userAgent string) (*models.AdminLoginResponse, error) {
	admin, err := s.adminRepo.GetByEmail(email)
	if err != nil {
		return nil, errors.New("INVALID_CREDENTIALS")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("INVALID_CREDENTIALS")
	}

	if admin.Status != models.AdminStatusActive {
		return nil, errors.New("ADMIN_ACCOUNT_SUSPENDED")
	}

	_ = s.adminRepo.UpdateLastLogin(admin.ID)

	return s.generateTokenPair(admin, ipAddress, userAgent)
}

func (s *AdminAuthService) RefreshToken(refreshTokenStr, ipAddress, userAgent string) (*models.AdminLoginResponse, error) {
	tokenHash := hashAdminToken(refreshTokenStr)

	refreshToken, err := s.adminRepo.GetRefreshToken(tokenHash)
	if err != nil {
		return nil, errors.New("INVALID_REFRESH_TOKEN")
	}

	if refreshToken.RevokedAt != nil {
		return nil, errors.New("REFRESH_TOKEN_REVOKED")
	}

	if time.Now().After(refreshToken.ExpiresAt) {
		return nil, errors.New("REFRESH_TOKEN_EXPIRED")
	}

	admin, err := s.adminRepo.GetByID(refreshToken.AdminID)
	if err != nil {
		return nil, errors.New("ADMIN_NOT_FOUND")
	}

	if admin.Status != models.AdminStatusActive {
		return nil, errors.New("ADMIN_ACCOUNT_SUSPENDED")
	}

	// Revoke old refresh token (rotation)
	_ = s.adminRepo.RevokeRefreshToken(refreshToken.ID)

	return s.generateTokenPair(admin, ipAddress, userAgent)
}

func (s *AdminAuthService) Logout(refreshTokenStr string) error {
	tokenHash := hashAdminToken(refreshTokenStr)
	token, err := s.adminRepo.GetRefreshToken(tokenHash)
	if err != nil {
		return nil
	}
	return s.adminRepo.RevokeRefreshToken(token.ID)
}

func (s *AdminAuthService) GetAdminByID(id uuid.UUID) (*models.AdminUser, error) {
	return s.adminRepo.GetByID(id)
}

func (s *AdminAuthService) ValidateAccessToken(tokenStr string) (*models.AdminClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &models.AdminClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.config.JWTSecret), nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*models.AdminClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid admin token claims")
	}

	// Strictly verify that this token was issued specifically for the admin surface
	hasAdminAudience := false
	for _, aud := range claims.Audience {
		if aud == "admin" {
			hasAdminAudience = true
			break
		}
	}
	if !hasAdminAudience {
		return nil, errors.New("token audience mismatch: not an admin token")
	}

	return claims, nil
}

func (s *AdminAuthService) generateTokenPair(admin *models.AdminUser, ipAddress, userAgent string) (*models.AdminLoginResponse, error) {
	expiresIn := 3600 // 1 hour for admin sessions
	claims := &models.AdminClaims{
		AdminID: admin.ID,
		Email:   admin.Email,
		Role:    admin.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   admin.ID.String(),
			Issuer:    "tbk-market-admin",
			Audience:  jwt.ClaimStrings{"admin"},
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expiresIn) * time.Second)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessToken, err := token.SignedString([]byte(s.config.JWTSecret))
	if err != nil {
		return nil, fmt.Errorf("failed to sign admin access token: %w", err)
	}

	rawRefreshToken, err := generateAdminSecureToken(64)
	if err != nil {
		return nil, fmt.Errorf("failed to generate admin refresh token: %w", err)
	}

	refreshTokenHash := hashAdminToken(rawRefreshToken)
	var ip *string
	if ipAddress != "" {
		ip = &ipAddress
	}
	var ua *string
	if userAgent != "" {
		ua = &userAgent
	}

	dbRefreshToken := &models.AdminRefreshToken{
		AdminID:   admin.ID,
		TokenHash: refreshTokenHash,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour), // 7 days refresh token
		IPAddress: ip,
		UserAgent: ua,
	}

	if err := s.adminRepo.CreateRefreshToken(dbRefreshToken); err != nil {
		return nil, fmt.Errorf("failed to store admin refresh token: %w", err)
	}

	return &models.AdminLoginResponse{
		AccessToken:  accessToken,
		RefreshToken: rawRefreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    expiresIn,
		Admin:        admin,
	}, nil
}

func hashAdminToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

func generateAdminSecureToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
