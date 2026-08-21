package models

import (
	"time"

	"github.com/google/uuid"
)

type MembershipRole string

const (
	MembershipRoleOwner    MembershipRole = "OWNER"
	MembershipRoleAdmin    MembershipRole = "ADMIN"
	MembershipRoleManager  MembershipRole = "MANAGER"
	MembershipRoleEmployee MembershipRole = "EMPLOYEE"
)

type MembershipStatus string

const (
	MembershipStatusActive   MembershipStatus = "ACTIVE"
	MembershipStatusPending  MembershipStatus = "PENDING"
	MembershipStatusSuspend  MembershipStatus = "SUSPENDED"
	MembershipStatusRemoved  MembershipStatus = "REMOVED"
)

type BusinessMembership struct {
	ID         uuid.UUID        `json:"id" db:"id"`
	UserID     uuid.UUID        `json:"user_id" db:"user_id"`
	BusinessID uuid.UUID        `json:"business_id" db:"business_id"`
	Role       MembershipRole   `json:"role" db:"role"`
	Status     MembershipStatus `json:"status" db:"status"`
	JoinedAt   time.Time        `json:"joined_at" db:"joined_at"`
	CreatedAt  time.Time        `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time        `json:"updated_at" db:"updated_at"`
}

type MembershipResponse struct {
	ID         uuid.UUID        `json:"id"`
	UserID     uuid.UUID        `json:"user_id"`
	BusinessID uuid.UUID        `json:"business_id"`
	Role       MembershipRole   `json:"role"`
	Status     MembershipStatus `json:"status"`
	JoinedAt   time.Time        `json:"joined_at"`
}
