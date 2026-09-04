# TBK Admin Phase 5 — Advanced Management

## 1. Scope

Phase 5 extends the existing Direction, Commerce, Finance/Trust, and Technical/Security dashboards. It does not add a fifth dashboard. Web and Android use the same `/api/v1/admin/*` endpoints, PostgreSQL state, admin JWTs, RBAC roles, and audit log.

## 2–3. Feature flags and global configuration

`feature_flags` and `global_configs` are operational allowlists, not arbitrary settings. Flags are scoped and categorized, writes require a reason, and old/new values are audited. Public clients read the fail-open, flat `/api/v1/config/feature-flags` projection (`{"KEY": true, ...}` — no metadata). Web provides full editors; mobile provides authorized low-risk toggles and read-only configuration.

**High-risk confirmation applies to both directions**: enabling or disabling an `is_high_risk` flag without `confirm: true` returns `409`, not just disabling it. `DIRECTION_ADMIN` cannot write a high-risk flag at all — including one in the `GENERAL` category it otherwise owns for low-risk writes — enforced by `models.CanWriteHighRisk` in `backend/internal/models/admin_permissions.go`.

**Global config values are validated server-side** before being written (`validateConfigValue` in `admin_platform_service.go`), returning `400` and leaving the stored value unchanged on failure: `NUMBER` must parse as a float, with business bounds per key (`POINTS_CONVERSION_RATE` and `STUCK_ORDER_THRESHOLD_HOURS` `> 0`, `DEFAULT_DISPUTE_THRESHOLD` `>= 0`, `RISK_ALERT_THRESHOLD` in `[0, 100]`); `BOOLEAN` must be `"true"`/`"false"`; `STRING` must be non-empty, and any `*_VERSION` key must look like a semantic version.

**Real consumers**: `PRODUCT_REVIEWS_ENABLED` gates `POST /buyer/orders/:id/review`, `NEW_SELLER_REGISTRATION_ENABLED` gates `POST /auth/register/seller`, and `POINTS_CONVERSION_RATE` now drives the live points-earning rate in `PointService.AwardPoints` (`backend/internal/service/point_service.go`), replacing the previously hardcoded `PointsPerCDF` constant with a live `global_configs` lookup that fails open to the constant if the config row or DB is unavailable. All three verified end-to-end this session (toggle → real behavior change → restore).

## 4. Maintenance

`platform_maintenance` is a singleton with OFF, PARTIAL, and FULL states, message, schedule, client targets, actor, and reason. Technical/Super Admin can change it. FULL is Super-Admin-only and requires explicit confirmation. `/api/v1/config/platform-state` exposes the safe client projection while the Admin API stays accessible.

## 5–6. Announcements and notifications

Announcements support DRAFT, SCHEDULED, ACTIVE, EXPIRED, and ARCHIVED with explicit audiences. Direction/Super Admin may publish; other admins have visibility. The public platform-state response includes only currently active announcements. Delivery counters are deferred because the repository has no notification delivery worker or channel ledger; inventing push/email statistics would violate the data-availability rule.

## 7. Analytics

`GET /api/v1/admin/analytics/:dashboard?days=1|7|30|90` executes daily PostgreSQL counts. Each role can read its dashboard and Super Admin can read all. Missing tracking tables return `available=false`, rendered as `DATA NOT AVAILABLE`; values are never synthesized. Existing domain pages remain the drill-down destinations. GMV, latency, search conversion, backup reliability, and fulfillment-speed series remain deferred until durable event instrumentation exists.

## 8–9. Exports and media control

`admin_export_jobs` stores allowlisted dataset, filters, requester, status, result path, and failure details. Creation is role/dataset checked and audited; mobile is status-only. Worker-side CSV generation/download is deferred and jobs remain QUEUED until a worker is connected. Media health/moderation is deferred because no storage inventory/moderation service exists; product image records remain visible in existing commerce tooling.

## 10–13. Approvals, governance, versions, danger zone

`admin_approval_requests` records payload, target, reason, lifecycle, requester, and resolver. Direction/Super Admin decides; a requester cannot decide their own request. Every request/decision is audited. Existing Technical version endpoints remain the shared release-version source. FULL maintenance is the first danger-zone action: Super Admin, confirmation, reason, and audit are mandatory. Role elevation execution, automatic post-approval mutations, release notes, and deployment rollback are deferred rather than simulated.

## 14. APIs

- Platform: `GET|PATCH /admin/platform/maintenance`, `GET|POST /admin/platform/announcements`, `PATCH /admin/platform/announcements/:id`
- Analytics: `GET /admin/analytics/:dashboard`
- Exports: `GET|POST /admin/exports`
- Approvals: `GET|POST /admin/approvals`, `POST /admin/approvals/:id/approve|reject`
- Safe client state: `GET /config/platform-state`
- Phase 5A: `/admin/platform/feature-flags`, `/admin/platform/config`

## 15–17. Routes and responsive strategy

Web: `/admin/platform/advanced`, `/admin/platform/feature-flags`, `/admin/platform/config`. Android: `/admin/advanced` and `/admin/technical/config`. Web grids collapse at 900px and 600px with no fixed table widths; mobile uses native scrolling, stacked cards, and compact quick actions.

## 18–20. RBAC, audit, and DB changes

RBAC is enforced in services, never only in UI. Phase 5 audit actions include `MAINTENANCE_UPDATE`, `ANNOUNCEMENT_CREATE/UPDATE`, `EXPORT_REQUEST`, `APPROVAL_REQUEST`, and `APPROVAL_APPROVED/REJECTED`. Migrations: `041_add_platform_flags_and_config.sql`, `042_add_admin_phase5_advanced_management.sql`.

## 21. Tests

Static verification: Go tests/build, web TypeScript/Vite build, Android TypeScript check. Runtime E2E requires a migrated PostgreSQL instance, seeded admins for all five roles, and an Android emulator/device. The acceptance report must not claim those checks when the environment is absent.

## 22. Deferred work and parity matrix

| Capability | Web | Mobile | Reason |
|---|---|---|---|
| Flags | Full | Low-risk quick toggle | High-risk review belongs on web |
| Global config | Full | Summary | Complex editing is web-only |
| Maintenance | Full | Status + safe recovery | FULL remains governed |
| Announcements | Full | Active summary | No rich editor on mobile |
| Analytics | Full summaries | 7-day summary | Dense drill-down stays on web |
| Exports | Create/status | Status | File handling stays on web |
| Approvals | Decide | Quick decide | Shared separation-of-duties rule |
| Versions | Existing technical UI | Status via technical dashboard | Same API source |
| Danger zone | Restricted | Limited | Avoid accidental mobile execution |

Deferred: notification delivery ledger, export worker/download, media scanning/moderation, custom analytics dates, durable API telemetry, automatic approved-action execution, release notes, deployment rollback, and device E2E.
