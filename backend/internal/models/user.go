package models

import (
	"time"

	"github.com/google/uuid"
)

type UserStatus string

const (
	UserStatusPendingVerification UserStatus = "PENDING_VERIFICATION"
	UserStatusActive              UserStatus = "ACTIVE"
	UserStatusSuspended           UserStatus = "SUSPENDED"
	UserStatusDeactivated         UserStatus = "DEACTIVATED"
)

type AccountType string

const (
	AccountTypeBuyer    AccountType = "BUYER"
	AccountTypeSeller   AccountType = "SELLER"
	AccountTypeEmployee AccountType = "EMPLOYEE"
)

type User struct {
	ID            uuid.UUID   `json:"id" db:"id"`
	FirstName     string      `json:"first_name" db:"first_name"`
	MiddleName    string      `json:"middle_name" db:"middle_name"`
	LastName      string      `json:"last_name" db:"last_name"`
	Phone         string      `json:"phone" db:"phone"`
	Email         string      `json:"email" db:"email"`
	PasswordHash  string      `json:"-" db:"password_hash"`
	Status        UserStatus  `json:"status" db:"status"`
	EmailVerified bool        `json:"email_verified" db:"email_verified"`
	AccountType   AccountType `json:"account_type" db:"account_type"`
	AvatarURL     *string     `json:"avatar_url" db:"avatar_url"`
	CreatedAt     time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at" db:"updated_at"`
}

type RegisterRequest struct {
	FirstName            string   `json:"first_name" binding:"required"`
	MiddleName           string   `json:"middle_name"`
	LastName             string   `json:"last_name" binding:"required"`
	Phone                string   `json:"phone" binding:"required"`
	Email                string   `json:"email" binding:"required,email"`
	Password             string   `json:"password" binding:"required,min=8,max=64"`
	PasswordConfirmation string   `json:"password_confirmation" binding:"required"`
	BackupPhone          string   `json:"backup_phone"`
	Address              string   `json:"address"`
	City                 string   `json:"city"`
	Commune              string   `json:"commune"`
	Country              string   `json:"country"`
	Latitude             *float64 `json:"latitude"`
	Longitude            *float64 `json:"longitude"`
}

type RegisterResponse struct {
	Message string `json:"message"`
	Data    struct {
		UserID string `json:"user_id"`
	} `json:"data"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	User         *User  `json:"user,omitempty"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type RefreshResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
}

type ResendActivationRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type ForgotPasswordRequest struct {
	Identifier string `json:"identifier"`
	Email      string `json:"email"`
}

type ResetPasswordRequest struct {
	Token                string `json:"token" binding:"required"`
	Password             string `json:"password" binding:"required,min=8,max=64"`
	PasswordConfirmation string `json:"password_confirmation" binding:"required"`
}

type ErrorResponse struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

type SuccessResponse struct {
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}
