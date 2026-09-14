package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/google/uuid"
)

const retirementReason = "Retired obsolete bootstrap/runtime-test SUPER_ADMIN"

type evidence struct {
	id                                      uuid.UUID
	email, status                           string
	created, updated                        time.Time
	lastLogin                               *time.Time
	sessions, auditsAsActor, auditsAsTarget int
	retirementAudits, sessionVersion        int
}

func main() {
	actorFlag := flag.String("actor", "", "authoritative SUPER_ADMIN UUID")
	targetFlag := flag.String("target", "", "obsolete SUPER_ADMIN UUID")
	execute := flag.Bool("execute", false, "perform audited suspension and session revocation")
	flag.Parse()

	cfg := config.Load()
	db, err := database.Connect(cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.DBUser, cfg.DBPassword)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	rows, err := db.Query(`SELECT a.id,a.email,a.status,a.created_at,a.updated_at,a.last_login_at,
		(SELECT COUNT(*) FROM admin_refresh_tokens s WHERE s.admin_id=a.id AND s.revoked_at IS NULL AND s.expires_at>NOW()),
		(SELECT COUNT(*) FROM admin_audit_log l WHERE l.actor_admin_id=a.id),
		(SELECT COUNT(*) FROM admin_audit_log l WHERE l.target_id=a.id::text),
		(SELECT COUNT(*) FROM admin_audit_log l WHERE l.target_id=a.id::text AND l.reason=$1), a.session_version
		FROM admin_users a WHERE a.role='SUPER_ADMIN' ORDER BY a.created_at`, retirementReason)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()
	items := []evidence{}
	for rows.Next() {
		var e evidence
		if err := rows.Scan(&e.id, &e.email, &e.status, &e.created, &e.updated, &e.lastLogin, &e.sessions, &e.auditsAsActor, &e.auditsAsTarget, &e.retirementAudits, &e.sessionVersion); err != nil {
			log.Fatal(err)
		}
		items = append(items, e)
		fmt.Printf("id=%s email=%s status=%s created=%s updated=%s last_login=%v active_sessions=%d audit_actor=%d audit_target=%d retirement_audits=%d session_version=%d\n", e.id, e.email, e.status, e.created.Format(time.RFC3339), e.updated.Format(time.RFC3339), e.lastLogin, e.sessions, e.auditsAsActor, e.auditsAsTarget, e.retirementAudits, e.sessionVersion)
	}
	var activeCount int
	var activeGuard *string
	if err := db.QueryRow(`SELECT (SELECT COUNT(*) FROM admin_users WHERE role='SUPER_ADMIN' AND status='ACTIVE'), to_regclass('public.uq_admin_users_one_active_super_admin')::text`).Scan(&activeCount, &activeGuard); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("active_super_admin_count=%d unique_active_guard=%v\n", activeCount, activeGuard)
	if !*execute {
		return
	}
	actor, err := uuid.Parse(*actorFlag)
	if err != nil {
		log.Fatal("valid --actor is required")
	}
	target, err := uuid.Parse(*targetFlag)
	if err != nil {
		log.Fatal("valid --target is required")
	}
	if actor == target {
		log.Fatal("actor and target must differ")
	}
	adminRepo := repository.NewAdminRepository(db)
	actorAdmin, err := adminRepo.GetByID(actor)
	if err != nil || actorAdmin.Role != models.AdminRoleSuperAdmin || actorAdmin.Status != models.AdminStatusActive {
		log.Fatal("actor is not an active SUPER_ADMIN")
	}
	targetAdmin, err := adminRepo.GetByID(target)
	if err != nil || targetAdmin.Role != models.AdminRoleSuperAdmin || targetAdmin.Status != models.AdminStatusActive {
		log.Fatal("target is not an active SUPER_ADMIN")
	}
	audit := service.NewAuditService(repository.NewAuditRepository(db))
	management := service.NewAdminManagementService(adminRepo, nil, audit, nil)
	if err := management.SuspendAdmin(actor, models.AdminRoleSuperAdmin, target, retirementReason, "127.0.0.1", "reconcile-superadmin-cli"); err != nil {
		log.Fatal(err)
	}
	if err := management.ForceLogoutAdmin(actor, models.AdminRoleSuperAdmin, target, retirementReason, "127.0.0.1", "reconcile-superadmin-cli"); err != nil {
		log.Fatal(err)
	}
	count, err := adminRepo.CountActiveSuperAdmins()
	if err != nil {
		log.Fatal(err)
	}
	if count != 1 {
		log.Fatalf("postcondition failed: active SUPER_ADMIN count=%d", count)
	}
	fmt.Printf("retired=%s active_super_admin_count=%d reason=%q\n", target, count, retirementReason)
	os.Exit(0)
}
