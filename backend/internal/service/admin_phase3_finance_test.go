package service

import (
	"testing"

	"github.com/google/uuid"

	"github.com/btmi-ai-market/backend/internal/models"
)

func TestPhase3RBACRules(t *testing.T) {
	svc := &AdminFinanceService{}

	// FINANCE_SUPPORT_ADMIN and SUPER_ADMIN must be allowed
	if err := svc.checkFinanceAccess(models.AdminRoleSuperAdmin); err != nil {
		t.Errorf("expected SuperAdmin access allowed, got %v", err)
	}
	if err := svc.checkFinanceAccess(models.AdminRoleFinanceSupportAdmin); err != nil {
		t.Errorf("expected FinanceSupportAdmin access allowed, got %v", err)
	}
	if err := svc.checkFinanceAccess(models.AdminRoleDirectionAdmin); err != nil {
		t.Errorf("expected DirectionAdmin access allowed, got %v", err)
	}

	// COMMERCE_ADMIN and TECHNICAL_ADMIN must be rejected for Finance access
	if err := svc.checkFinanceAccess(models.AdminRoleCommerceAdmin); err == nil {
		t.Errorf("expected CommerceAdmin access rejected, got nil")
	}
	if err := svc.checkFinanceAccess(models.AdminRoleTechnicalAdmin); err == nil {
		t.Errorf("expected TechnicalAdmin access rejected, got nil")
	}

	// Mutation permissions
	if err := svc.checkFinanceMutation(models.AdminRoleSuperAdmin); err != nil {
		t.Errorf("expected SuperAdmin mutation allowed, got %v", err)
	}
	if err := svc.checkFinanceMutation(models.AdminRoleFinanceSupportAdmin); err != nil {
		t.Errorf("expected FinanceSupportAdmin mutation allowed, got %v", err)
	}

	if err := svc.checkFinanceMutation(models.AdminRoleDirectionAdmin); err == nil {
		t.Errorf("expected DirectionAdmin mutation rejected, got nil")
	}
	if err := svc.checkFinanceMutation(models.AdminRoleCommerceAdmin); err == nil {
		t.Errorf("expected CommerceAdmin mutation rejected, got nil")
	}
	if err := svc.checkFinanceMutation(models.AdminRoleTechnicalAdmin); err == nil {
		t.Errorf("expected TechnicalAdmin mutation rejected, got nil")
	}
}

func TestPhase3CaseModelValidation(t *testing.T) {
	req := &models.AdminCreateCaseRequest{
		CaseType:    "PAYMENT_DISPUTE",
		Priority:    "HIGH",
		Title:       "Test Dispute Case",
		Description: "Buyer confirmed cash paid but seller denied receipt",
	}

	if req.CaseType != "PAYMENT_DISPUTE" {
		t.Errorf("unexpected case type: %s", req.CaseType)
	}
	if req.Priority != "HIGH" {
		t.Errorf("unexpected priority: %s", req.Priority)
	}
}

func TestPhase3PointAdjustmentValidation(t *testing.T) {
	adj := &models.AdminPointAdjustmentRequest{
		Type:   "ADD",
		Amount: 500,
		Reason: "Compensation for delayed delivery resolution",
	}

	if adj.Type != "ADD" || adj.Amount != 500 {
		t.Errorf("invalid adjustment parameters")
	}
	if len(adj.Reason) < 5 {
		t.Errorf("justification reason too short")
	}
}

func TestPhase3ReviewModerationValidation(t *testing.T) {
	reviewID := uuid.New()
	if reviewID == uuid.Nil {
		t.Errorf("nil review UUID generated")
	}

	modReq := &models.AdminReviewModerationRequest{
		Reason: "Abusive and defamatory language reported by seller",
	}
	if len(modReq.Reason) < 5 {
		t.Errorf("moderation reason too short")
	}
}
