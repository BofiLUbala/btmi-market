package models

import (
	"time"

	"github.com/google/uuid"
)

type EmployeeStatus string

const (
	EmployeeStatusActive     EmployeeStatus = "ACTIVE"
	EmployeeStatusInactive   EmployeeStatus = "INACTIVE"
	EmployeeStatusTerminated EmployeeStatus = "TERMINATED"
)

type Employee struct {
	ID           uuid.UUID      `json:"id" db:"id"`
	BusinessID   uuid.UUID      `json:"business_id" db:"business_id"`
	LinkedUserID *uuid.UUID     `json:"linked_user_id" db:"linked_user_id"`
	FirstName    string         `json:"first_name" db:"first_name"`
	MiddleName   string         `json:"middle_name" db:"middle_name"`
	LastName     string         `json:"last_name" db:"last_name"`
	Phone        string         `json:"phone" db:"phone"`
	Email        string         `json:"email" db:"email"`
	JobTitle     string         `json:"job_title" db:"job_title"`
	Status       EmployeeStatus `json:"status" db:"status"`
	CreatedAt    time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at" db:"updated_at"`
}

type CreateEmployeeRequest struct {
	FirstName  string `json:"first_name" binding:"required"`
	MiddleName string `json:"middle_name"`
	LastName   string `json:"last_name" binding:"required"`
	Phone      string `json:"phone"`
	Email      string `json:"email"`
	JobTitle   string `json:"job_title"`
}

type UpdateEmployeeRequest struct {
	FirstName  *string `json:"first_name"`
	MiddleName *string `json:"middle_name"`
	LastName   *string `json:"last_name"`
	Phone      *string `json:"phone"`
	Email      *string `json:"email"`
	JobTitle   *string `json:"job_title"`
	Status     *string `json:"status"`
}

type EmployeeResponse struct {
	ID           uuid.UUID      `json:"id"`
	BusinessID   uuid.UUID      `json:"business_id"`
	LinkedUserID *uuid.UUID     `json:"linked_user_id"`
	FirstName    string         `json:"first_name"`
	MiddleName   string         `json:"middle_name"`
	LastName     string         `json:"last_name"`
	Phone        string         `json:"phone"`
	Email        string         `json:"email"`
	JobTitle     string         `json:"job_title"`
	Status       EmployeeStatus `json:"status"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
}

type EmployeeInvitationStatus string

const (
	EmployeeInvitationStatusPending  EmployeeInvitationStatus = "PENDING"
	EmployeeInvitationStatusAccepted EmployeeInvitationStatus = "ACCEPTED"
	EmployeeInvitationStatusExpired  EmployeeInvitationStatus = "EXPIRED"
	EmployeeInvitationStatusRevoked  EmployeeInvitationStatus = "REVOKED"
)

type EmployeeInvitation struct {
	ID         uuid.UUID                `json:"id" db:"id"`
	EmployeeID uuid.UUID                `json:"employee_id" db:"employee_id"`
	TokenHash  string                   `json:"-" db:"token_hash"`
	Status     EmployeeInvitationStatus `json:"status" db:"status"`
	ExpiresAt  time.Time                `json:"expires_at" db:"expires_at"`
	AcceptedAt *time.Time               `json:"accepted_at,omitempty" db:"accepted_at"`
	CreatedAt  time.Time                `json:"created_at" db:"created_at"`
}

type CreateEmployeeInvitationRequest struct {
	EmployeeID uuid.UUID `json:"employee_id" binding:"required"`
}

type EmployeeInvitationResponse struct {
	ID            uuid.UUID                `json:"id"`
	EmployeeID    uuid.UUID                `json:"employee_id"`
	Status        EmployeeInvitationStatus `json:"status"`
	ExpiresAt     time.Time                `json:"expires_at"`
	InvitationURL string                   `json:"invitation_url,omitempty"`
	CreatedAt     time.Time                `json:"created_at"`
}

type AcceptEmployeeInvitationRequest struct {
	Token           string `json:"token" binding:"required"`
	Password        string `json:"password" binding:"required,min=8,max=64"`
	PasswordConfirm string `json:"password_confirmation" binding:"required"`
}

type EmployeeActivationToken struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	UserID    uuid.UUID  `json:"user_id" db:"user_id"`
	TokenHash string     `json:"-" db:"token_hash"`
	ExpiresAt time.Time  `json:"expires_at" db:"expires_at"`
	UsedAt    *time.Time `json:"used_at,omitempty" db:"used_at"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
}
