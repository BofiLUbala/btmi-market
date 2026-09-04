package models

import (
	"encoding/json"
	"github.com/google/uuid"
	"time"
)

type MaintenanceState struct {
	Status          string     `json:"status"`
	Message         string     `json:"message"`
	StartsAt        *time.Time `json:"starts_at,omitempty"`
	EndsAt          *time.Time `json:"ends_at,omitempty"`
	AffectedClients []string   `json:"affected_clients"`
	Reason          string     `json:"reason"`
	UpdatedBy       *uuid.UUID `json:"updated_by,omitempty"`
	UpdatedAt       time.Time  `json:"updated_at"`
}
type UpdateMaintenanceRequest struct {
	Status          string     `json:"status"`
	Message         string     `json:"message"`
	Reason          string     `json:"reason"`
	StartsAt        *time.Time `json:"starts_at,omitempty"`
	EndsAt          *time.Time `json:"ends_at,omitempty"`
	AffectedClients []string   `json:"affected_clients"`
	Confirm         bool       `json:"confirm"`
}
type Announcement struct {
	ID        uuid.UUID  `json:"id"`
	Title     string     `json:"title"`
	Message   string     `json:"message"`
	Audience  string     `json:"audience"`
	Status    string     `json:"status"`
	StartsAt  *time.Time `json:"starts_at,omitempty"`
	EndsAt    *time.Time `json:"ends_at,omitempty"`
	CreatedBy uuid.UUID  `json:"created_by"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}
type AnnouncementRequest struct {
	Title    string     `json:"title"`
	Message  string     `json:"message"`
	Audience string     `json:"audience"`
	Status   string     `json:"status"`
	StartsAt *time.Time `json:"starts_at,omitempty"`
	EndsAt   *time.Time `json:"ends_at,omitempty"`
}
type ApprovalRequest struct {
	ID               uuid.UUID       `json:"id"`
	ActionType       string          `json:"action_type"`
	RequestedBy      uuid.UUID       `json:"requested_by"`
	TargetType       string          `json:"target_type"`
	TargetID         string          `json:"target_id"`
	Payload          json.RawMessage `json:"payload"`
	Reason           string          `json:"reason"`
	Status           string          `json:"status"`
	ResolvedBy       *uuid.UUID      `json:"resolved_by,omitempty"`
	ResolutionReason *string         `json:"resolution_reason,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
	ResolvedAt       *time.Time      `json:"resolved_at,omitempty"`
}
type CreateApprovalRequest struct {
	ActionType string          `json:"action_type"`
	TargetType string          `json:"target_type"`
	TargetID   string          `json:"target_id"`
	Payload    json.RawMessage `json:"payload"`
	Reason     string          `json:"reason"`
}
type DecisionRequest struct {
	Reason string `json:"reason"`
}
type ExportJob struct {
	ID           uuid.UUID       `json:"id"`
	Dataset      string          `json:"dataset"`
	Status       string          `json:"status"`
	Filters      json.RawMessage `json:"filters"`
	RequestedBy  uuid.UUID       `json:"requested_by"`
	FilePath     *string         `json:"file_path,omitempty"`
	ErrorMessage *string         `json:"error_message,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
	CompletedAt  *time.Time      `json:"completed_at,omitempty"`
}
type CreateExportRequest struct {
	Dataset string          `json:"dataset"`
	Filters json.RawMessage `json:"filters"`
	Reason  string          `json:"reason"`
}
type AnalyticsPoint struct {
	Date  string  `json:"date"`
	Value float64 `json:"value"`
}
type AnalyticsMetric struct {
	Key       string           `json:"key"`
	Label     string           `json:"label"`
	Value     *float64         `json:"value"`
	Unit      string           `json:"unit"`
	Available bool             `json:"available"`
	Trend     []AnalyticsPoint `json:"trend"`
}
