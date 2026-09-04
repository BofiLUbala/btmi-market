package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"strings"
	"time"
)

type AdminPhase5Service struct {
	db    *sql.DB
	audit *AuditService
}

func NewAdminPhase5Service(db *sql.DB, a *AuditService) *AdminPhase5Service {
	return &AdminPhase5Service{db: db, audit: a}
}
func direction(r models.AdminRole) bool {
	return r == models.AdminRoleSuperAdmin || r == models.AdminRoleDirectionAdmin
}
func technical(r models.AdminRole) bool {
	return r == models.AdminRoleSuperAdmin || r == models.AdminRoleTechnicalAdmin
}
func (s *AdminPhase5Service) GetMaintenance(c context.Context) (*models.MaintenanceState, error) {
	var m models.MaintenanceState
	var a pq.StringArray
	e := s.db.QueryRowContext(c, `SELECT status,message,starts_at,ends_at,affected_clients,reason,updated_by,updated_at FROM platform_maintenance WHERE id=TRUE`).Scan(&m.Status, &m.Message, &m.StartsAt, &m.EndsAt, &a, &m.Reason, &m.UpdatedBy, &m.UpdatedAt)
	m.AffectedClients = []string(a)
	return &m, e
}
func (s *AdminPhase5Service) UpdateMaintenance(c context.Context, id uuid.UUID, r models.AdminRole, q models.UpdateMaintenanceRequest) error {
	if !technical(r) {
		return errors.New("forbidden: missing MAINTENANCE_WRITE permission")
	}
	if q.Reason == "" {
		return errors.New("reason required")
	}
	if q.Status != "OFF" && q.Status != "PARTIAL" && q.Status != "FULL" {
		return errors.New("invalid maintenance status")
	}
	if q.Status == "FULL" && r != models.AdminRoleSuperAdmin {
		return errors.New("FULL maintenance requires SUPER_ADMIN approval")
	}
	if q.Status == "FULL" && !q.Confirm {
		return errors.New("confirmation required for FULL maintenance")
	}
	old, e := s.GetMaintenance(c)
	if e != nil {
		return e
	}
	_, e = s.db.ExecContext(c, `UPDATE platform_maintenance SET status=$1,message=$2,starts_at=$3,ends_at=$4,affected_clients=$5,reason=$6,updated_by=$7,updated_at=NOW() WHERE id=TRUE`, q.Status, q.Message, q.StartsAt, q.EndsAt, pq.Array(q.AffectedClients), q.Reason, id)
	if e == nil {
		_ = s.audit.Record(id, r, "MAINTENANCE_UPDATE", "platform_maintenance", "global", q.Reason, old, q, "", "")
	}
	return e
}
func (s *AdminPhase5Service) ListAnnouncements(c context.Context) ([]models.Announcement, error) {
	rows, e := s.db.QueryContext(c, `SELECT id,title,message,audience,status,starts_at,ends_at,created_by,created_at,updated_at FROM admin_announcements ORDER BY created_at DESC LIMIT 200`)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []models.Announcement{}
	for rows.Next() {
		var a models.Announcement
		if e = rows.Scan(&a.ID, &a.Title, &a.Message, &a.Audience, &a.Status, &a.StartsAt, &a.EndsAt, &a.CreatedBy, &a.CreatedAt, &a.UpdatedAt); e != nil {
			return nil, e
		}
		out = append(out, a)
	}
	return out, rows.Err()
}
func (s *AdminPhase5Service) CreateAnnouncement(c context.Context, id uuid.UUID, r models.AdminRole, q models.AnnouncementRequest) (*models.Announcement, error) {
	if !direction(r) {
		return nil, errors.New("forbidden: missing ANNOUNCEMENT_WRITE permission")
	}
	if strings.TrimSpace(q.Title) == "" || strings.TrimSpace(q.Message) == "" {
		return nil, errors.New("title and message required")
	}
	if q.Status == "" {
		q.Status = "DRAFT"
	}
	var a models.Announcement
	e := s.db.QueryRowContext(c, `INSERT INTO admin_announcements(title,message,audience,status,starts_at,ends_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,title,message,audience,status,starts_at,ends_at,created_by,created_at,updated_at`, q.Title, q.Message, q.Audience, q.Status, q.StartsAt, q.EndsAt, id).Scan(&a.ID, &a.Title, &a.Message, &a.Audience, &a.Status, &a.StartsAt, &a.EndsAt, &a.CreatedBy, &a.CreatedAt, &a.UpdatedAt)
	if e == nil {
		_ = s.audit.Record(id, r, "ANNOUNCEMENT_CREATE", "announcement", a.ID.String(), "announcement created", nil, a, "", "")
	}
	return &a, e
}
func (s *AdminPhase5Service) UpdateAnnouncement(c context.Context, id uuid.UUID, r models.AdminRole, aid uuid.UUID, q models.AnnouncementRequest) error {
	if !direction(r) {
		return errors.New("forbidden: missing ANNOUNCEMENT_WRITE permission")
	}
	res, e := s.db.ExecContext(c, `UPDATE admin_announcements SET title=$1,message=$2,audience=$3,status=$4,starts_at=$5,ends_at=$6,updated_at=NOW() WHERE id=$7`, q.Title, q.Message, q.Audience, q.Status, q.StartsAt, q.EndsAt, aid)
	if e != nil {
		return e
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	_ = s.audit.Record(id, r, "ANNOUNCEMENT_UPDATE", "announcement", aid.String(), "announcement updated", nil, q, "", "")
	return nil
}
func (s *AdminPhase5Service) ListApprovals(c context.Context) ([]models.ApprovalRequest, error) {
	rows, e := s.db.QueryContext(c, `SELECT id,action_type,requested_by,target_type,target_id,payload,reason,status,resolved_by,resolution_reason,created_at,resolved_at FROM admin_approval_requests ORDER BY created_at DESC LIMIT 200`)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []models.ApprovalRequest{}
	for rows.Next() {
		var a models.ApprovalRequest
		if e = rows.Scan(&a.ID, &a.ActionType, &a.RequestedBy, &a.TargetType, &a.TargetID, &a.Payload, &a.Reason, &a.Status, &a.ResolvedBy, &a.ResolutionReason, &a.CreatedAt, &a.ResolvedAt); e != nil {
			return nil, e
		}
		out = append(out, a)
	}
	return out, rows.Err()
}
func (s *AdminPhase5Service) CreateApproval(c context.Context, id uuid.UUID, r models.AdminRole, q models.CreateApprovalRequest) (uuid.UUID, error) {
	if strings.TrimSpace(q.Reason) == "" {
		return uuid.Nil, errors.New("reason required")
	}
	if len(q.Payload) == 0 {
		q.Payload = json.RawMessage(`{}`)
	}
	var aid uuid.UUID
	e := s.db.QueryRowContext(c, `INSERT INTO admin_approval_requests(action_type,requested_by,target_type,target_id,payload,reason) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, q.ActionType, id, q.TargetType, q.TargetID, q.Payload, q.Reason).Scan(&aid)
	if e == nil {
		_ = s.audit.Record(id, r, "APPROVAL_REQUEST", "approval", aid.String(), q.Reason, nil, q, "", "")
	}
	return aid, e
}
func (s *AdminPhase5Service) DecideApproval(c context.Context, id uuid.UUID, r models.AdminRole, aid uuid.UUID, yes bool, reason string) error {
	if !direction(r) {
		return errors.New("forbidden: missing APPROVAL_DECIDE permission")
	}
	var requester uuid.UUID
	var status string
	if e := s.db.QueryRowContext(c, `SELECT requested_by,status FROM admin_approval_requests WHERE id=$1`, aid).Scan(&requester, &status); e != nil {
		return e
	}
	if requester == id {
		return errors.New("separation of duties: requester cannot decide own request")
	}
	if status != "PENDING" {
		return errors.New("approval is already resolved")
	}
	next, action := "REJECTED", "APPROVAL_REJECTED"
	if yes {
		next, action = "APPROVED", "APPROVAL_APPROVED"
	}
	_, e := s.db.ExecContext(c, `UPDATE admin_approval_requests SET status=$1,resolved_by=$2,resolution_reason=$3,resolved_at=NOW() WHERE id=$4 AND status='PENDING'`, next, id, reason, aid)
	if e == nil {
		_ = s.audit.Record(id, r, action, "approval", aid.String(), reason, map[string]string{"status": "PENDING"}, map[string]string{"status": next}, "", "")
	}
	return e
}

var exportRoles = map[string][]models.AdminRole{"USERS": {models.AdminRoleDirectionAdmin}, "BUSINESSES": {models.AdminRoleDirectionAdmin, models.AdminRoleCommerceAdmin}, "SHOPS": {models.AdminRoleCommerceAdmin}, "PRODUCTS": {models.AdminRoleCommerceAdmin}, "INVENTORY": {models.AdminRoleCommerceAdmin}, "ORDERS": {models.AdminRoleCommerceAdmin, models.AdminRoleFinanceSupportAdmin}, "CASH_SUMMARIES": {models.AdminRoleFinanceSupportAdmin}, "POINTS_HISTORY": {models.AdminRoleFinanceSupportAdmin}, "REVIEWS": {models.AdminRoleFinanceSupportAdmin}, "CASES": {models.AdminRoleFinanceSupportAdmin}, "RISK_EVENTS": {models.AdminRoleFinanceSupportAdmin, models.AdminRoleTechnicalAdmin}, "AUDIT_LOGS": {models.AdminRoleDirectionAdmin, models.AdminRoleTechnicalAdmin}}

func canExport(r models.AdminRole, d string) bool {
	if r == models.AdminRoleSuperAdmin {
		return true
	}
	for _, x := range exportRoles[d] {
		if x == r {
			return true
		}
	}
	return false
}
func (s *AdminPhase5Service) CreateExport(c context.Context, id uuid.UUID, r models.AdminRole, q models.CreateExportRequest) (uuid.UUID, error) {
	q.Dataset = strings.ToUpper(q.Dataset)
	if !canExport(r, q.Dataset) {
		return uuid.Nil, errors.New("forbidden: missing EXPORT_CREATE permission for dataset")
	}
	if q.Reason == "" {
		return uuid.Nil, errors.New("reason required")
	}
	if len(q.Filters) == 0 {
		q.Filters = json.RawMessage(`{}`)
	}
	var eid uuid.UUID
	e := s.db.QueryRowContext(c, `INSERT INTO admin_export_jobs(dataset,filters,requested_by) VALUES($1,$2,$3) RETURNING id`, q.Dataset, q.Filters, id).Scan(&eid)
	if e == nil {
		_ = s.audit.Record(id, r, "EXPORT_REQUEST", "export_job", eid.String(), q.Reason, nil, map[string]interface{}{"dataset": q.Dataset}, "", "")
	}
	return eid, e
}
func (s *AdminPhase5Service) ListExports(c context.Context, id uuid.UUID, r models.AdminRole) ([]models.ExportJob, error) {
	q := `SELECT id,dataset,status,filters,requested_by,file_path,error_message,created_at,completed_at FROM admin_export_jobs`
	a := []interface{}{}
	if r != models.AdminRoleSuperAdmin && r != models.AdminRoleDirectionAdmin {
		q += " WHERE requested_by=$1"
		a = append(a, id)
	}
	q += " ORDER BY created_at DESC LIMIT 200"
	rows, e := s.db.QueryContext(c, q, a...)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []models.ExportJob{}
	for rows.Next() {
		var x models.ExportJob
		if e = rows.Scan(&x.ID, &x.Dataset, &x.Status, &x.Filters, &x.RequestedBy, &x.FilePath, &x.ErrorMessage, &x.CreatedAt, &x.CompletedAt); e != nil {
			return nil, e
		}
		out = append(out, x)
	}
	return out, rows.Err()
}
func (s *AdminPhase5Service) Analytics(c context.Context, r models.AdminRole, d string, days int) ([]models.AnalyticsMetric, error) {
	allowed := map[string]models.AdminRole{"direction": models.AdminRoleDirectionAdmin, "commerce": models.AdminRoleCommerceAdmin, "finance": models.AdminRoleFinanceSupportAdmin, "technical": models.AdminRoleTechnicalAdmin}
	if r != models.AdminRoleSuperAdmin && allowed[d] != r {
		return nil, errors.New("forbidden: missing ANALYTICS_READ permission")
	}
	if days != 1 && days != 7 && days != 30 && days != 90 {
		days = 30
	}
	type spec struct{ k, l, t string }
	specs := map[string][]spec{"direction": {{"users", "User growth", "users"}, {"businesses", "Business growth", "businesses"}, {"shops", "Shop growth", "shops"}, {"orders", "Order growth", "orders"}}, "commerce": {{"products", "Products created", "products"}, {"shops", "Shops created", "shops"}, {"orders", "Orders created", "orders"}}, "finance": {{"orders", "Order volume", "orders"}, {"cases", "Case volume", "admin_cases"}, {"risk_events", "Risk events", "admin_risk_events"}}, "technical": {{"security_events", "Security events", "admin_security_events"}}}
	out := []models.AnalyticsMetric{}
	for _, sp := range specs[d] {
		m := models.AnalyticsMetric{Key: sp.k, Label: sp.l, Unit: "count", Trend: []models.AnalyticsPoint{}}
		query := fmt.Sprintf(`SELECT TO_CHAR(d,'YYYY-MM-DD'),COUNT(t.created_at)::float8 FROM generate_series(CURRENT_DATE-$1::int+1,CURRENT_DATE,'1 day') d LEFT JOIN %s t ON t.created_at>=d AND t.created_at<d+'1 day' GROUP BY d ORDER BY d`, sp.t)
		rows, e := s.db.QueryContext(c, query, days)
		if e != nil {
			out = append(out, m)
			continue
		}
		var total float64
		for rows.Next() {
			var p models.AnalyticsPoint
			_ = rows.Scan(&p.Date, &p.Value)
			total += p.Value
			m.Trend = append(m.Trend, p)
		}
		rows.Close()
		m.Value = &total
		m.Available = true
		out = append(out, m)
	}
	return out, nil
}
func (s *AdminPhase5Service) PublicState(c context.Context) (map[string]interface{}, error) {
	m, e := s.GetMaintenance(c)
	if e != nil {
		return nil, e
	}
	rows, e := s.db.QueryContext(c, `SELECT id,title,message,audience,status,starts_at,ends_at,created_by,created_at,updated_at FROM admin_announcements WHERE status='ACTIVE' AND (starts_at IS NULL OR starts_at<=NOW()) AND (ends_at IS NULL OR ends_at>NOW()) ORDER BY created_at DESC`)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	a := []models.Announcement{}
	for rows.Next() {
		var x models.Announcement
		_ = rows.Scan(&x.ID, &x.Title, &x.Message, &x.Audience, &x.Status, &x.StartsAt, &x.EndsAt, &x.CreatedBy, &x.CreatedAt, &x.UpdatedAt)
		a = append(a, x)
	}
	return map[string]interface{}{"maintenance": m, "announcements": a, "server_time": time.Now().UTC()}, nil
}
