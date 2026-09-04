package models

import (
	"time"

	"github.com/google/uuid"
)

type FeatureFlag struct {
	ID          uuid.UUID  `json:"id"`
	Key         string     `json:"key"`
	Description string     `json:"description"`
	Enabled     bool       `json:"enabled"`
	Scope       string     `json:"scope"`
	Category    string     `json:"category"`
	IsHighRisk  bool       `json:"is_high_risk"`
	Environment string     `json:"environment"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	UpdatedBy   *uuid.UUID `json:"updated_by,omitempty"`
	CanWrite    bool       `json:"can_write"`
}

type GlobalConfig struct {
	ID          uuid.UUID  `json:"id"`
	Key         string     `json:"key"`
	Description string     `json:"description"`
	ValueType   string     `json:"value_type"`
	Value       string     `json:"value"`
	Category    string     `json:"category"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	UpdatedBy   *uuid.UUID `json:"updated_by,omitempty"`
	CanWrite    bool       `json:"can_write"`
}

type UpdateFeatureFlagRequest struct {
	Enabled bool   `json:"enabled"`
	Reason  string `json:"reason"`
	Confirm bool   `json:"confirm"`
}

type UpdateGlobalConfigRequest struct {
	Value  string `json:"value"`
	Reason string `json:"reason"`
}
