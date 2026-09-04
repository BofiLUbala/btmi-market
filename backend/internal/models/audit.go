package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type AdminAuditLog struct {
	ID             uuid.UUID        `json:"id" db:"id"`
	ActorAdminID   uuid.UUID        `json:"actor_admin_id" db:"actor_admin_id"`
	ActorAdminName string           `json:"actor_admin_name,omitempty"`
	ActorAdminEmail string          `json:"actor_admin_email,omitempty"`
	ActorRole      AdminRole        `json:"actor_role" db:"actor_role"`
	Action         string           `json:"action" db:"action"`
	TargetType     string           `json:"target_type" db:"target_type"`
	TargetID       string           `json:"target_id" db:"target_id"`
	Reason         string           `json:"reason" db:"reason"`
	OldValue       *json.RawMessage `json:"old_value,omitempty" db:"old_value"`
	NewValue       *json.RawMessage `json:"new_value,omitempty" db:"new_value"`
	IPAddress      *string          `json:"ip_address,omitempty" db:"ip_address"`
	UserAgent      *string          `json:"user_agent,omitempty" db:"user_agent"`
	CreatedAt      time.Time        `json:"created_at" db:"created_at"`
}

type AuditListFilter struct {
	ActorAdminID *uuid.UUID `form:"actor_admin_id"`
	ActorRole    *string    `form:"actor_role"`
	Action       *string    `form:"action"`
	TargetType   *string    `form:"target_type"`
	TargetID     *string    `form:"target_id"`
	Limit        int        `form:"limit"`
	Offset       int        `form:"offset"`
}
