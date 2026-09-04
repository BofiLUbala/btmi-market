package service

import (
	"encoding/json"
	"fmt"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

// auditRecorder is satisfied by *repository.AuditRepository. Defined as an
// interface so tests can substitute an in-memory recorder without a DB.
type auditRecorder interface {
	Record(entry *models.AdminAuditLog) error
	List(filter *models.AuditListFilter) ([]*models.AdminAuditLog, int, error)
}

type AuditService struct {
	auditRepo auditRecorder
}

func NewAuditService(auditRepo *repository.AuditRepository) *AuditService {
	return &AuditService{auditRepo: auditRepo}
}

// NewAuditServiceWithRecorder builds an AuditService against any
// auditRecorder implementation. Used by tests to avoid a real DB.
func NewAuditServiceWithRecorder(recorder auditRecorder) *AuditService {
	return &AuditService{auditRepo: recorder}
}

func (s *AuditService) Record(
	actorAdminID uuid.UUID,
	actorRole models.AdminRole,
	action string,
	targetType string,
	targetID string,
	reason string,
	oldValue interface{},
	newValue interface{},
	ip string,
	userAgent string,
) error {
	var oldRaw *json.RawMessage
	if oldValue != nil {
		if b, err := json.Marshal(oldValue); err == nil {
			raw := json.RawMessage(b)
			oldRaw = &raw
		}
	}

	var newRaw *json.RawMessage
	if newValue != nil {
		if b, err := json.Marshal(newValue); err == nil {
			raw := json.RawMessage(b)
			newRaw = &raw
		}
	}

	var ipPtr *string
	if ip != "" {
		ipPtr = &ip
	}
	var uaPtr *string
	if userAgent != "" {
		uaPtr = &userAgent
	}

	entry := &models.AdminAuditLog{
		ActorAdminID: actorAdminID,
		ActorRole:    actorRole,
		Action:       action,
		TargetType:   targetType,
		TargetID:     targetID,
		Reason:       reason,
		OldValue:     oldRaw,
		NewValue:     newRaw,
		IPAddress:    ipPtr,
		UserAgent:    uaPtr,
	}

	if err := s.auditRepo.Record(entry); err != nil {
		return fmt.Errorf("failed to record audit entry: %w", err)
	}
	return nil
}

func (s *AuditService) List(filter *models.AuditListFilter) ([]*models.AdminAuditLog, int, error) {
	return s.auditRepo.List(filter)
}
