# TBK Market — Administrative Control Center Architecture
## 4 Dashboards, Web + Mobile Admin, 60 Control Domains, Shared Backend & RBAC

**Status**: Phase 4 Complete, Phase 5A Complete — Technical & Security, plus Feature Flags & Global Configuration ("Advanced Management") Operational. See [`TBK_ADMIN_PHASE_5_ADVANCED_MANAGEMENT.md`](./TBK_ADMIN_PHASE_5_ADVANCED_MANAGEMENT.md) for Phase 5 detail.  
**Scope**: Shared Backend (`/api/v1/admin/*`), Web Admin (desktop-first), Mobile Admin (mobile-first)

> **Phase 5 note**: Phase 5 ("Advanced Management") does not add a 5th dashboard. It extends the same 4 dashboards below with cross-cutting capabilities — feature flags, global configuration, maintenance, announcements, analytics, exports, and approvals/governance — under a new shared `/api/v1/admin/platform/*` namespace and a granular permission layer (`backend/internal/models/admin_permissions.go`) layered on top of the role-group RBAC described in this document. Only Phase 5A (Feature Flags & Global Configuration) is implemented so far.

---

## 1. Executive Summary

The **TBK Market Administrative Control Center** is a unified governance, operations, financial, and technical orchestration system. It is designed to administer the real, live state of the TBK Market platform across all consumer and merchant touchpoints: Buyer Web, Seller Web, Android Buyer, Android Seller, background workers, PostgreSQL database, and Redis instances.

### Foundational Principles
1. **Single Source of Truth**: The Control Center is **NOT** a second backend or a separate database. Admin actions mutate the exact same business entities used by buyers, sellers, and workers.
2. **Four Specialized Dashboards**: Rather than a single monolithic "Super Admin" interface, operational duties are partitioned into four purpose-built domains:
   - **Dashboard 1: Direction / Supervision** (Executive governance, KPIs, user/business/shop lifecycle, approvals, global audit)
   - **Dashboard 2: Commerce & Operations** (Catalog, variants, inventory, stock anomalies, orders, fulfillment, ranking, quality)
   - **Dashboard 3: Finance / Support / Trust** (Cash verification, disputes, points ledger, review moderation, cases, claims, fraud)
   - **Dashboard 4: Technical & Security** (System health, API/DB/Redis metrics, worker jobs, visual search, backups, migrations, RBAC)
3. **Omni-Channel Admin (Web & Mobile)**:
   - **Web Admin**: Heavy operational control, desktop-first, tabular data, advanced filtering, multi-step actions, and deep analytics.
   - **Mobile Admin**: Rapid response, mobile-first, alert triage, urgent suspensions, dispute reviews, system health acknowledgment, and status verification.
4. **Shared Backend Namespace & Security**:
   - Both Web and Mobile Admin consume the same `/api/v1/admin/*` endpoints.
   - Separate Admin authentication mechanism with distinct JWT signing claims (`aud: "admin"`), preventing token replay attacks.
   - Strict Role-Based Access Control (RBAC) enforced server-side on every request.
   - Immutable, structured audit logging for all mutating administrative operations.
   - Zero hard deletion of business entities: lifecycle transitions (`SUSPENDED`, `ARCHIVED`, `DISABLED`, `HIDDEN`) protect historical traceability.
   - Zero exposure of infrastructure secrets or direct database execution consoles.

---

## 2. Current System State

Before adding the Control Center, TBK Market contains:
- **Backend**: Go with Gin HTTP router, PostgreSQL via `lib/pq` and custom migrations, Redis client for caching/ranking, Asynq client for background worker tasks, and custom JWT authentication.
- **Identity Model**: `User` model with `AccountType` (`BUYER`, `SELLER`, `EMPLOYEE`) and `UserStatus` (`PENDING_VERIFICATION`, `ACTIVE`, `SUSPENDED`, `DEACTIVATED`). There are currently **no** platform administrator tables, roles, or tokens.
- **Business Entities**: Well-structured `Business`, `BusinessMembership`, `Shop`, `Employee`, `EmployeeShopAssignment`, `Product`, `ProductVariant`, `Inventory`, `StockMovement`, `Order`, `OrderLine`, `OrderStatusHistory`, `CashPayment`, `BuyerPayment`, `PointAccount`, `PointTransaction`, `SellerReview`, and `Category`.
- **Gaps**:
  - No `/api/v1/admin/*` endpoints exist.
  - No admin identity, permissions, or session tracking exist.
  - No immutable audit logging exists for platform operations.
  - Entities have status enums supporting `SUSPENDED`, but no admin routes exist to transition them.
  - No cross-business administrative overview endpoints exist.

---

## 3. Four-Dashboard Architecture

```
                          TBK CONTROL CENTER
                                  │
                   SAME BACKEND /api/v1/admin/*
                   SAME RBAC / SAME AUDIT LOG
                                  │
                  ┌───────────────┴───────────────┐
                  │                               │
             WEB ADMIN                       MOBILE ADMIN
           Desktop-first                     Mobile-first
                  │                               │
        ┌─────────┼─────────┐           ┌─────────┼─────────┐
        │         │         │           │         │         │
   DIRECTION   COMMERCE   FINANCE     DIRECTION COMMERCE  FINANCE
        │         │         │           │         │         │
        └──────── TECHNICAL ────────────┴──────── TECHNICAL ┘
```

1. **Dashboard 1: Direction / Supervision (`/admin/direction`)**
   - Strategic leadership view.
   - Global KPIs, user lookup, seller/buyer profiles, business & shop lifecycle oversight.
   - High-impact governance approvals gate (e.g. mass suspension, point grants, policy overrides).
   - Unrestricted global audit log inspection.
2. **Dashboard 2: Commerce & Operations (`/admin/commerce`)**
   - Physical and digital marketplace operations.
   - Product catalog, category taxonomy, attribute suggestions, SKU variant integrity.
   - Shop-scoped inventory, stock movement auditing, anomaly alerts (negative stock, stale reservations).
   - Order management, stuck order intervention, delivery tracking, seller performance metrics.
3. **Dashboard 3: Finance / Support / Trust (`/admin/finance`)**
   - Economic integrity, user trust, and dispute resolution.
   - Cash payment double-confirmation verification (Buyer vs Seller).
   - Points ledger oversight (Buyer & Seller) and audited manual balance adjustments.
   - Product & shop review moderation, moderation queue, case/claim resolution, and rule-based fraud detection.
4. **Dashboard 4: Technical & Security (`/admin/technical`)**
   - Infrastructure reliability, engineering health, and security administration.
   - Live status of API, PostgreSQL, Redis, Asynq workers, and Python Visual Search service.
   - Database connection stats, migration execution state, automated backup history.
   - Session revocation, admin RBAC management, admin account lifecycle, and platform feature toggles.

---

## 4. Web Admin Architecture

- **Surface**: Desktop-first web application located under the `/admin` routing namespace in `web-app` (isolated module structure with dedicated store, API, components, and lazy-loaded views).
- **Design Philosophy**:
  - Dense, informative data tables with multi-column sorting and filtering.
  - Side-by-side comparative diffs for audit inspections and governance requests.
  - Rich metrics widgets with historical trend charts.
  - Modal action confirmation dialogs requiring mandatory "reason" inputs for all sensitive mutations.
- **Top-Level Navigation**:
  - Horizontal dashboard selector displaying only authorized dashboards.
  - Profile dropdown with Admin Name, Role Badge, Session Expiry, and Logout.
  - Left-hand sub-navigation specific to the active dashboard.

---

## 5. Mobile Admin Architecture

- **Surface**: Mobile-first application integrated into `android/app/admin` using Expo Router stack and bottom tabs.
- **Design Philosophy**:
  - Speed, responsiveness, and actionable triage.
  - High-priority cards: critical alerts, stuck orders, pending approvals, and system health status.
  - Quick actions: instantaneous search, one-tap account suspension, dispute escalation, and incident acknowledgment.
  - Compact detail sheets optimized for handheld touch interaction.
- **Navigation**:
  - Primary bottom tab bar or drawer linking Direction, Commerce, Finance, and Technical.
  - Role-guarded screen transitions; inaccessible modules are suppressed from the UI.

---

## 6. Shared API Model

Both Web and Mobile Admin communicate exclusively with the shared backend namespace:
```
/api/v1/admin/...
```
- **No Client Divergence**: Web and mobile call identical endpoints with identical payloads.
- **Uniform Error Envelope**:
  ```json
  {
    "error": {
      "code": "PERMISSION_DENIED",
      "message": "Role COMMERCE_ADMIN cannot access technical infrastructure"
    }
  }
  ```
- **Uniform Success Envelope**:
  ```json
  {
    "message": "Action completed successfully",
    "data": { ... }
  }
  ```

---

## 7. Shared RBAC Model

Admin authorization uses a decoupled, additive permission model enforced by `AdminRBACMiddleware`:
1. The administrator authenticates via `/api/v1/admin/auth/login`.
2. The server verifies credentials against `admin_users` and issues an Admin Access Token containing:
   - `sub`: Admin UUID
   - `role`: Admin Role string
   - `aud`: `"admin"`
3. On every admin request, `AdminAuthMiddleware` verifies token validity and audience.
4. `AdminRBACMiddleware` verifies whether the authenticated admin's role has the required permission for the endpoint.

---

## 8. Role Matrix

| Role | Primary Dashboard | Read-Only Visibility | Prohibited Surfaces |
|---|---|---|---|
| `SUPER_ADMIN` | All 4 Dashboards | All | None |
| `DIRECTION_ADMIN` | Dashboard 1 (Direction) | Dashboards 2, 3, 4 (Summaries & Health only) | Direct DB/Redis commands, secret inspection |
| `COMMERCE_ADMIN` | Dashboard 2 (Commerce) | Dashboard 1 (Commerce KPIs) | Dashboard 3 (Finance/Points/Cases), Dashboard 4 (Tech/Infra/RBAC) |
| `FINANCE_SUPPORT_ADMIN` | Dashboard 3 (Finance) | Dashboard 1 (Financial KPIs) | Dashboard 2 (Stock edits), Dashboard 4 (Tech/Infra/RBAC) |
| `TECHNICAL_ADMIN` | Dashboard 4 (Technical) | Dashboard 1 (Platform Health) | Dashboard 2 (Commerce mutations), Dashboard 3 (Point adjustments, financial changes) |

---

## 9. Permission Matrix

| Permission Key | Description | SUPER_ADMIN | DIRECTION_ADMIN | COMMERCE_ADMIN | FINANCE_SUPPORT_ADMIN | TECHNICAL_ADMIN |
|---|---|:---:|:---:|:---:|:---:|:---:|
| `admin:direction:read` | View executive KPIs and summaries | ✅ | ✅ | ✅ (summary) | ✅ (summary) | ✅ (summary) |
| `admin:direction:governance` | Approve high-impact governance items | ✅ | ✅ | ❌ | ❌ | ❌ |
| `admin:users:manage` | Suspend/reactivate users, force logout | ✅ | ✅ | ❌ | ❌ | ❌ |
| `admin:audit:read` | View platform audit log | ✅ | ✅ | ❌ (scoped only) | ❌ (scoped only) | ❌ (scoped only) |
| `admin:commerce:read` | Inspect catalog, variants, stock, orders | ✅ | ✅ | ✅ | ❌ | ❌ |
| `admin:commerce:write` | Modify categories, flag/unpublish products | ✅ | ❌ | ✅ | ❌ | ❌ |
| `admin:inventory:manage` | Correct stock, investigate stock anomalies | ✅ | ❌ | ✅ | ❌ | ❌ |
| `admin:finance:read` | View payments, cash reconciliation, points | ✅ | ✅ | ❌ | ✅ | ❌ |
| `admin:finance:points_write` | Manually adjust buyer/seller points | ✅ | ❌ | ❌ | ✅ | ❌ |
| `admin:moderation:write` | Moderate reviews, resolve claims & cases | ✅ | ❌ | ❌ | ✅ | ❌ |
| `admin:technical:read` | Monitor API, DB, Redis, jobs, health | ✅ | ✅ (health only) | ❌ | ❌ | ✅ |
| `admin:technical:infra` | Manage migrations, backups, feature flags | ✅ | ❌ | ❌ | ❌ | ✅ |
| `admin:rbac:manage` | Create/edit admin accounts and role bindings | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 10. Mapping of All 60 Control Domains

| # | Control Domain | Dashboard | Current Status | Real Implementation Plan |
|---|---|---|---|---|
| 1 | Global Executive Dashboard | Direction | 🟡 Model exists | Aggregate COUNT/SUM queries across users, businesses, shops, products, orders, cash payments. |
| 2 | User Management Overview | Direction | 🟡 Model exists | Cross-account search across `users` table; status mutation to `SUSPENDED`/`ACTIVE`; token revocation. |
| 3 | Seller Management | Direction | 🟡 Model exists | Join `businesses`, `shops`, `seller_trust`, `point_accounts`, and `orders` to aggregate performance. |
| 4 | Buyer Management | Direction | 🟡 Model exists | Join `buyer_profiles`, `orders`, `point_accounts`, and `seller_reviews`. |
| 5 | Business Management | Direction | 🟡 Model exists | Expose business listing, lifecycle transitions (`SUSPENDED`/`ACTIVE`/`ARCHIVED`), order checks. |
| 6 | Shop Management | Direction | 🟡 Model exists | Shop listing across businesses, lifecycle status mutations (`ACTIVE`/`INACTIVE`/`SUSPENDED`). |
| 7 | Governance Approvals | Direction | 🆕 New model | `approval_requests` table to require two-person rule on major suspensions or config overrides. |
| 8 | Global Audit View | Direction | 🆕 New model | `admin_audit_log` table storing actor, action, target, timestamps, reasons, and JSON diffs. |
| 9 | Product Catalog Control | Commerce | 🟡 Model exists | Cross-business product search, publication status toggle (`PUBLISHED`/`ARCHIVED`), moderation flags. |
| 10 | Category Management | Commerce | 🟡 Model exists | Full CRUD on `categories` table (create, rename, reorder, disable, archive). |
| 11 | Subcategory Management | Commerce | 🟡 Model exists | Full CRUD on `subcategories` table with parent linkage and ordering. |
| 12 | Category Attribute Suggestions | Commerce | 🟡 Model exists | Expose `category_requirements.go` taxonomy suggestions for seller listing guidance. |
| 13 | Product Variant Control | Commerce | 🟡 Model exists | Inspect SKUs, attribute JSONMap, prices, and detect duplicate SKUs or pricing anomalies. |
| 14 | Shop-Scoped Inventory | Commerce | ✅ Model exists | Expose `inventory` table ensuring `available = quantity - reserved_quantity` formula holds. |
| 15 | Stock Movement History | Commerce | ✅ Model exists | Cross-shop filterable view of `stock_movements` table. |
| 16 | Stock Anomalies | Commerce | 🟡 Model exists | Query detecting negative stock, `reserved > quantity`, and stale reservations. |
| 17 | Order Management | Commerce | ✅ Model exists | Unified cross-business order list with customer, items, price, delivery, and payment status. |
| 18 | Order Synchronization | Commerce | ✅ Already unified | Verification endpoint ensuring Buyer & Seller read from identical `orders` and `order_status_history`. |
| 19 | Order Lifecycle | Commerce | ✅ Model exists | View order progression through `OrderStatus` enum (`PENDING` to `COMPLETED`). |
| 20 | Stuck Order Detection | Commerce | 🟡 Model exists | Time-threshold queries flagging orders stuck in intermediate statuses without automatic mutation. |
| 21 | Marketplace Visibility Control | Commerce | ✅ Model exists | Inspection query showing why an item is hidden (Business/Shop status, PublicationStatus, Inventory). |
| 22 | Public Shop Page Control | Commerce | ✅ Model exists | View live public shop profile and product listings directly from admin. |
| 23 | Search Control | Commerce | 🆕 New model | `search_query_log` table logging search terms, zero-result queries, and conversion. |
| 24 | Marketplace Ranking | Commerce | ✅ Model exists | Inspection endpoint exposing Redis category ranking scores and weighting factors. |
| 25 | Product Card Quality | Commerce | 🟡 Model exists | Quality audit detecting missing primary images, missing descriptions, or poor formatting. |
| 26 | Discount / Promotion Control | Commerce | ✅ Model exists | Inspect active promotions, discount validity dates, and effective prices. |
| 27 | Seller Operational Performance | Commerce | 🟡 Model exists | Performance metrics: acceptance rate, fulfillment speed, stock accuracy from `seller_trust`. |
| 28 | Product Performance | Commerce | 🟡 Model exists | Aggregated sales volume, review score, and order frequency per product. |
| 29 | Category Performance | Commerce | 🟡 Model exists | Aggregated order volume, GMV, and product count grouped by category. |
| 30 | Employee Operational Control | Commerce | ✅ Model exists | View business employees, assigned shops, permissions, and revoke access on compromised accounts. |
| 31 | Cash Payment Control | Finance | ✅ Model exists | Reconciliation endpoint displaying `BuyerConfirmed`, `SellerConfirmed`, and `Status` (`VERIFIED`). |
| 32 | Payment Disputes | Finance | 🆕 New model | Unified `case` model (`case_type = PAYMENT_DISPUTE`) for order payment disagreements. |
| 33 | Buyer Points | Finance | ✅ Model exists | Detailed ledger view of `point_accounts` (`OwnerType=BUYER`) and `point_transactions`. |
| 34 | Seller Points / Growth | Finance | ✅ Model exists | Detailed ledger view of `point_accounts` (`OwnerType=SELLER_BUSINESS`) and seller levels. |
| 35 | Manual Point Adjustment | Finance | 🟡 Model exists | Audited endpoint to credit/debit points with mandatory justification and audit logging. |
| 36 | Product Reviews | Finance | ✅ Model exists | List all product reviews with ratings, helpfulness counts, and verified purchase flags. |
| 37 | Shop / Seller Reviews | Finance | ✅ Model exists | Separate listing for shop service ratings (`DeliveryRating`, `ServiceRating`, `ExperienceRating`). |
| 38 | Review Moderation | Finance | 🟡 Model exists | Moderate abusive reviews: transition review status (`ACTIVE`, `FLAGGED`, `HIDDEN`). |
| 39 | Report / Moderation Queue | Finance | 🆕 New model | `cases` queue for reported products, reviews, shops, and accounts. |
| 40 | Customer Support | Finance | 🆕 New model | Support ticket system (`case_type = SUPPORT_TICKET`) with threaded messages. |
| 41 | Claims / Complaints | Finance | 🆕 New model | Order claims management for damaged, missing, or incorrect goods. |
| 42 | Fraud / Anomaly Monitoring | Finance | 🟡 Model exists | Rule-based fraud alerts: repeat cancellations, abnormal cash confirmations, rapid reviews. |
| 43 | Trust Signals | Finance | ✅ Model exists | Expose computed `seller_trust` metrics and buyer verified transaction badges. |
| 44 | Favorites / Interest Analytics | Finance | 🟡 Verified | Aggregate favorite counts (if backend model present) or product interest counters. |
| 45 | Financial Summary | Finance | 🟡 Model exists | Backend-calculated GMV, verified cash total, points discounts, and platform volume. |
| 46 | System Health | Technical | 🟡 Model exists | Comprehensive health fan-out checking API, DB, Redis, Asynq, and Visual Search. |
| 47 | API Monitoring | Technical | 🆕 New middleware | In-memory sliding window request counters, 4xx/5xx rates, and average latency metrics. |
| 48 | Database Monitoring | Technical | 🟡 Model exists | PostgreSQL connection pool status, database size, and slow query stats (`pg_stat_activity`). |
| 49 | Redis Monitoring | Technical | 🟡 Model exists | Redis `INFO`, memory consumption, key counts, and queue depth. |
| 50 | Worker / Job Monitoring | Technical | ✅ Model exists | Asynq queue status: pending, running, failed, retry, and dead jobs via `asynq.Inspector`. |
| 51 | Visual Search Monitoring | Technical | ✅ Model exists | Proxy ping to Visual Search Python service, measuring response time and availability. |
| 52 | Backups | Technical | 🆕 New tracking | Database backup execution log (`backup_runs` table) and manual trigger endpoint. |
| 53 | Database Migrations | Technical | ✅ Model exists | Read applied migrations from `schema_migrations` and compare with filesystem `.sql` files. |
| 54 | Email / SMTP Health | Technical | 🟡 Model exists | SMTP connectivity check and log of outgoing system/activation emails (without exposing password). |
| 55 | Session Management | Technical | ✅ Model exists | View active user refresh tokens and revoke tokens individually or globally. |
| 56 | RBAC Control | Technical | 🆕 New model | Manage admin roles and permissions dynamically. |
| 57 | Admin Account Management | Technical | 🆕 New model | CRUD for `admin_users` table with password resets and status controls (`SUPER_ADMIN` only). |
| 58 | Security Audit | Technical | 🆕 New model | Dedicated security event filter over `admin_audit_log` (failed logins, privilege escalations). |
| 59 | Application Version Control | Technical | 🆕 New model | `app_versions` table maintaining minimum supported and current versions for Web & Android. |
| 60 | Platform Control Features | Technical | 🆕 New model | Global feature flags (`feature_flags`), platform maintenance mode, and broadcast banners. |

---

## 11. Existing APIs

The current platform provides endpoints for:
- Authentication (`/api/v1/auth/*`)
- Business & Shop Management (`/api/v1/businesses/*`, `/api/v1/shops/*`)
- Inventory & Variants (`/api/v1/variants/*`, `/api/v1/shops/:id/inventory`, `/api/v1/shops/:id/stock`)
- Orders & Tracking (`/api/v1/orders/*`, `/api/v1/buyer/orders/*`)
- Cash Sessions & Payments (`/api/v1/cash-sessions/*`, `/api/v1/buyer/payments/*`)
- Points & Growth (`/api/v1/buyer/points/*`, `/api/v1/businesses/:id/growth/*`)
- Reviews (`/api/v1/marketplace/shops/:id/reviews`, `/api/v1/buyer/reviews/*`)
- Marketplace Public Catalog (`/api/v1/marketplace/*`)

---

## 12. Missing Admin APIs

All admin capabilities require new endpoints mounted under `/api/v1/admin/*`:
- `POST /api/v1/admin/auth/login`, `POST /api/v1/admin/auth/refresh`, `POST /api/v1/admin/auth/logout`, `GET /api/v1/admin/auth/me`
- `GET /api/v1/admin/direction/overview`, `GET /api/v1/admin/direction/audit-log`
- `GET /api/v1/admin/users`, `POST /api/v1/admin/users/:id/suspend`, `POST /api/v1/admin/users/:id/reactivate`, `POST /api/v1/admin/users/:id/force-logout`
- `GET /api/v1/admin/businesses`, `POST /api/v1/admin/businesses/:id/suspend`, `POST /api/v1/admin/businesses/:id/reactivate`
- `GET /api/v1/admin/shops`, `POST /api/v1/admin/shops/:id/suspend`, `POST /api/v1/admin/shops/:id/reactivate`
- `GET /api/v1/admin/products`, `POST /api/v1/admin/products/:id/unpublish`, `POST /api/v1/admin/products/:id/flag`
- `POST/PATCH/DELETE /api/v1/admin/categories`, `POST/PATCH/DELETE /api/v1/admin/subcategories`
- `GET /api/v1/admin/orders`, `GET /api/v1/admin/orders/stuck`
- `GET /api/v1/admin/inventory/anomalies`, `GET /api/v1/admin/inventory`
- `GET /api/v1/admin/payments/cash`, `GET /api/v1/admin/points/accounts`, `POST /api/v1/admin/points/:id/adjust`
- `GET /api/v1/admin/reviews`, `PATCH /api/v1/admin/reviews/:id/status`
- `GET/POST/PATCH /api/v1/admin/cases`, `POST /api/v1/admin/cases/:id/messages`
- `GET /api/v1/admin/technical/health`, `GET /api/v1/admin/technical/metrics`, `GET /api/v1/admin/technical/db`, `GET /api/v1/admin/technical/redis`, `GET /api/v1/admin/technical/jobs`
- `GET/POST /api/v1/admin/admins`, `PATCH /api/v1/admin/admins/:id/status`
- `GET/PATCH /api/v1/admin/feature-flags`, `GET/PATCH /api/v1/admin/platform-config`

---

## 13. Existing DB Models

Directly reused across admin queries:
`User`, `Business`, `BusinessMembership`, `Shop`, `Employee`, `EmployeeShopAssignment`, `Product`, `ProductVariant`, `ProductImage`, `Inventory`, `StockMovement`, `StockReceipt`, `Order`, `OrderLine`, `OrderStatusHistory`, `CashPayment`, `CashSession`, `BuyerPayment`, `BuyerProfile`, `PointAccount`, `PointTransaction`, `SellerLevel`, `BuyerLevel`, `SellerTrust`, `SellerReview`, `Category`, `Subcategory`.

---

## 14. New Models Required

| Table Name | Purpose | Fields |
|---|---|---|
| `admin_users` | Platform staff credentials & role | `id`, `first_name`, `last_name`, `email`, `password_hash`, `role`, `status`, `last_login_at`, `created_at`, `updated_at` |
| `admin_refresh_tokens` | Admin session tokens | `id`, `admin_id`, `token_hash`, `expires_at`, `revoked_at`, `ip_address`, `user_agent`, `created_at` |
| `admin_audit_log` | Permanent audit history | `id`, `actor_admin_id`, `actor_role`, `action`, `target_type`, `target_id`, `reason`, `old_value`, `new_value`, `ip_address`, `user_agent`, `created_at` |
| `approval_requests` | Governance two-person approvals | `id`, `action_type`, `target_id`, `payload`, `requested_by`, `status`, `approved_by`, `rejected_by`, `decision_reason`, `created_at` |
| `cases` | Unified dispute/report/support tickets | `id`, `case_type`, `target_type`, `target_id`, `reporter_id`, `assigned_admin_id`, `priority`, `status`, `resolution`, `created_at`, `updated_at` |
| `case_messages` | Threaded messages on cases | `id`, `case_id`, `author_type`, `author_id`, `message`, `attachments`, `created_at` |
| `search_query_log` | Real-time marketplace search tracking | `id`, `query`, `normalized_query`, `result_count`, `matched_category_id`, `user_id`, `created_at` |
| `backup_runs` | Record of automated/manual pg_dumps | `id`, `filename`, `size_bytes`, `status`, `triggered_by`, `error_message`, `started_at`, `completed_at` |
| `feature_flags` | Dynamic platform switches | `id`, `key`, `name`, `description`, `enabled`, `updated_by`, `updated_at` |
| `platform_config` | Dynamic settings (e.g. maintenance) | `key`, `value_json`, `updated_by`, `updated_at` |
| `app_versions` | Version control & update enforcement | `id`, `platform`, `version`, `min_supported_version`, `release_notes`, `released_at` |

---

## 15. Existing Routes

- `/api/v1/auth/*`
- `/api/v1/businesses/*`
- `/api/v1/shops/*`
- `/api/v1/orders/*`
- `/api/v1/variants/*`
- `/api/v1/employees/*`
- `/api/v1/cash-sessions/*`
- `/api/v1/cash-payments/*`
- `/api/v1/payments/*`
- `/api/v1/buyer/*`
- `/api/v1/marketplace/*`
- `/api/v1/reviews/*`
- `/api/v1/categories/*`
- `/api/v1/events/*`

---

## 16. Proposed Admin Routes

All routes reside under `/api/v1/admin`:
- **Auth**: `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`
- **Direction**: `/direction/overview`, `/direction/users`, `/direction/users/:id/suspend`, `/direction/users/:id/reactivate`, `/direction/users/:id/force-logout`, `/direction/audit-log`, `/direction/approvals`
- **Commerce**: `/commerce/products`, `/commerce/products/:id/unpublish`, `/commerce/products/:id/flag`, `/commerce/categories`, `/commerce/subcategories`, `/commerce/inventory`, `/commerce/inventory/anomalies`, `/commerce/orders`, `/commerce/orders/stuck`
- **Finance**: `/finance/cash-payments`, `/finance/points`, `/finance/points/:id/adjust`, `/finance/reviews`, `/finance/reviews/:id/status`, `/finance/cases`, `/finance/cases/:id/messages`, `/finance/fraud-alerts`
- **Technical**: `/technical/health`, `/technical/metrics`, `/technical/db`, `/technical/redis`, `/technical/jobs`, `/technical/backups`, `/technical/migrations`, `/technical/admins`, `/technical/feature-flags`, `/technical/config`

---

## 17. Audit Architecture

1. **Completeness**: Every state-altering administrative action records a row in `admin_audit_log`.
2. **Synchronous Integrity**: Audit logs are written within the same database transaction or immediately upon operation success. Failure to log halts the operation.
3. **Structured Context**:
   - `actor_admin_id`: UUID of administrator.
   - `actor_role`: Role at time of action.
   - `action`: E.g. `USER_SUSPENDED`, `PRODUCT_UNPUBLISHED`, `POINTS_ADJUSTED`.
   - `target_type`: Entity table or type (`USER`, `BUSINESS`, `SHOP`, `PRODUCT`, `REVIEW`, `POINT_ACCOUNT`).
   - `target_id`: ID of affected entity.
   - `reason`: Mandatory text justification supplied by the admin.
   - `old_value` / `new_value`: JSON snapshot of changed fields.
   - `ip_address` / `user_agent`: Client network metadata.
4. **Immutability**: No delete, update, or purge endpoint exists for `admin_audit_log`.

---

## 18. Security Rules

1. **Zero Secret Leakage**: Admin API responses strip `password_hash`, `jwt_secret`, `smtp_password`, database connection strings, and payment gateway keys.
2. **No Direct SQL Execution**: No raw SQL console or arbitrary database query tool is exposed.
3. **Token Audience Segregation**: Admin tokens use `aud: "admin"`. Attempting to use an admin token on buyer/seller endpoints yields 401 Unauthorized; attempting to use a user token on admin endpoints yields 401 Unauthorized.
4. **Mandatory Justification**: High-impact actions (suspension, points adjustments, manual status overrides) reject requests with empty reasons.

---

## 19. Web Routes

Mounted in `web-app`:
- `/admin/login`
- `/admin` (Redirects to primary dashboard based on role)
- `/admin/direction`
  - `/admin/direction/overview`
  - `/admin/direction/users`
  - `/admin/direction/sellers`
  - `/admin/direction/buyers`
  - `/admin/direction/businesses`
  - `/admin/direction/shops`
  - `/admin/direction/approvals`
  - `/admin/direction/audit`
- `/admin/commerce`
  - `/admin/commerce/products`
  - `/admin/commerce/categories`
  - `/admin/commerce/variants`
  - `/admin/commerce/inventory`
  - `/admin/commerce/orders`
  - `/admin/commerce/performance`
- `/admin/finance`
  - `/admin/finance/cash`
  - `/admin/finance/disputes`
  - `/admin/finance/points`
  - `/admin/finance/reviews`
  - `/admin/finance/cases`
  - `/admin/finance/summary`
- `/admin/technical`
  - `/admin/technical/health`
  - `/admin/technical/metrics`
  - `/admin/technical/database`
  - `/admin/technical/redis`
  - `/admin/technical/jobs`
  - `/admin/technical/admins`
  - `/admin/technical/platform`

---

## 20. Mobile Routes

Mounted in `android/app/admin`:
- `app/admin/login.tsx`
- `app/admin/_layout.tsx` (Tabs / Drawer)
- `app/admin/index.tsx` (Executive summary & alert hub)
- `app/admin/direction/index.tsx` (KPIs, user search, urgent suspension)
- `app/admin/commerce/index.tsx` (Order & product lookup, stuck orders)
- `app/admin/finance/index.tsx` (Cash verification, open dispute review)
- `app/admin/technical/index.tsx` (Component health lights, incident acknowledgment)

---

## 21. Feature Parity Matrix

| Feature Domain | Backend API | Web Admin Capability | Mobile Admin Capability | Parity Status |
|---|---|---|---|:---:|
| Executive KPIs | Shared `/api/v1/admin/direction/overview` | Full interactive charts, historical date pickers | Condensed KPI cards, delta indicators | ✅ Full |
| User Suspension | Shared `/api/v1/admin/direction/users/:id/suspend` | Batch actions, detailed user history | Single user search, quick-action sheet | ✅ Full |
| Audit Inspection | Shared `/api/v1/admin/direction/audit-log` | Full filter matrix, JSON diff inspector | Recent events list, detail drawer | ✅ Full |
| Category Editing | Shared `/api/v1/admin/categories` | Drag-and-drop tree reordering, icon upload | Read-only inspection / quick disable | ⚡ Read-First |
| Order Triage | Shared `/api/v1/admin/orders` | Advanced multi-filter table, export to CSV | Search by Order ID, stuck status flag | ✅ Full |
| Points Adjustment | Shared `/api/v1/admin/points/:id/adjust` | Dual-ledger balance visualizer, reason modal | Balance check, adjustment modal with PIN | ✅ Full |
| Review Moderation | Shared `/api/v1/admin/reviews/:id/status` | Full queue, sentiment filters, history | Quick Swipe Hide / Approve | ✅ Full |
| Infrastructure Monitoring | Shared `/api/v1/admin/technical/health` | Memory graphs, connection pool depth | Live Health Lights (Green/Yellow/Red) | ✅ Full |

---

## 22. Mobile-Only Limitations

- No bulk multi-file CSV/PDF exports.
- No complex category hierarchy drag-and-drop tree restructuring.
- No heavy JSON configuration editors (e.g. raw platform config JSON schemas).
- Simplified audit views focused on actionable security events rather than dense full-database diffs.

---

## 23. Web-Only Advanced Functions

- Full-screen multi-metric correlation graphs.
- Side-by-side JSON diff viewer for database mutations.
- Advanced multi-criteria search queries (joining user, shop, date, and order states).
- Multi-item batch moderation and bulk status update tools.

---

## 24. Testing Strategy

1. **RBAC Isolation Tests**:
   - `COMMERCE_ADMIN` receives 403 when requesting `/api/v1/admin/technical/*`.
   - `FINANCE_SUPPORT_ADMIN` receives 403 when requesting `/api/v1/admin/categories`.
   - `TECHNICAL_ADMIN` receives 403 when attempting `/api/v1/admin/points/:id/adjust`.
   - `DIRECTION_ADMIN` receives 200 on `/api/v1/admin/direction/*` but 403 on direct database operations.
   - `SUPER_ADMIN` receives 200 across all 4 dashboards.
2. **Token Security Tests**:
   - Marketplace buyer JWT rejected with 401 on `/api/v1/admin/*`.
   - Admin JWT rejected with 401 on `/api/v1/buyer/*`.
3. **Cross-App State Synchronization Tests**:
   - Admin suspends Shop -> Buyer Web hides shop -> Android hides shop -> Orders preserved.
   - Admin unpublishes Product -> Product immediately disappears from public search -> Historical line items intact.
4. **Audit Immutability Tests**:
   - Sensitive action creates exactly one immutable audit log entry.
   - Verifying that no DELETE or UPDATE query succeeds on `admin_audit_log`.

---

## 25. Implementation Phases

- **Phase 1: Foundation**:
  - Migrations: `admin_users`, `admin_refresh_tokens`, `admin_audit_log`.
  - Admin Auth & RBAC Middleware.
  - Direction Overview & User Management endpoints.
  - Web Admin Shell (`/admin/*`) & Mobile Admin Shell (`android/app/admin/*`).
- **Phase 2: Commerce & Operations**:
  - Cross-business catalog, categories CRUD, inventory anomaly queries, order triage, and stuck order alerts.
- **Phase 3: Finance / Support / Trust**:
  - Cash payment reconciliation, points ledger & audited adjustments, review moderation queue, and cases model.
- **Phase 4: Technical & Security**:
  - Health fan-out, DB/Redis/Job monitoring, backup run tracking, migrations inspector, and admin account management.
- **Phase 5: Advanced Controls & Polish**:
  - Search analytics, feature flags, maintenance mode banners, platform export tools, and audit diff visualizations.

---

## 26. Risks & Mitigations

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| Admin token leakage | High | Short access token TTL (15m), secure refresh token rotation, instant token revocation endpoint. |
| Accidental mass suspension | Critical | Two-person governance approval workflow (`approval_requests`) for high-impact actions. |
| Inadvertent data loss | Critical | Enforce soft-lifecycle status transitions (`SUSPENDED`, `ARCHIVED`, `HIDDEN`) instead of SQL `DELETE`. |
| Cross-client state drift | Medium | Web and Mobile Admin consume the exact same backend endpoints and database records. |
| Infrastructure secret exposure | High | Explicit Go DTO structs omitting secrets; automated response serialization sanitization. |

---

## 27. Data Migration Requirements

- Migration `038_create_admin_control_center.sql`:
  - `admin_roles` type / check constraints.
  - `admin_users` table with unique email index.
  - `admin_refresh_tokens` table with hash index and expiry index.
  - `admin_audit_log` table with compound indexes on `(created_at DESC)`, `(target_type, target_id)`, and `(actor_admin_id)`.
  - Initial `SUPER_ADMIN` bootstrap seeding.

---

## 28. Files Likely Affected

### Backend
- `backend/migrations/038_create_admin_control_center.sql`
- `backend/internal/models/admin.go`
- `backend/internal/models/audit.go`
- `backend/internal/repository/admin_repository.go`
- `backend/internal/repository/audit_repository.go`
- `backend/internal/service/admin_auth_service.go`
- `backend/internal/service/audit_service.go`
- `backend/internal/service/admin_direction_service.go`
- `backend/internal/middleware/admin_auth.go`
- `backend/internal/middleware/admin_rbac.go`
- `backend/internal/handlers/admin/auth_handler.go`
- `backend/internal/handlers/admin/direction_handler.go`
- `backend/cmd/api/main.go`

### Web Admin (`web-app`)
- `web-app/src/store/adminAuth.ts`
- `web-app/src/api/admin.ts`
- `web-app/src/components/admin/AdminLayout.tsx`
- `web-app/src/components/admin/AdminGuards.tsx`
- `web-app/src/pages/admin/auth/AdminLoginPage.tsx`
- `web-app/src/pages/admin/direction/DirectionDashboardPage.tsx`
- `web-app/src/pages/admin/commerce/CommerceDashboardPage.tsx`
- `web-app/src/pages/admin/finance/FinanceDashboardPage.tsx`
- `web-app/src/pages/admin/technical/TechnicalDashboardPage.tsx`
- `web-app/src/App.tsx`

### Mobile Admin (`android`)
- `android/src/store/adminAuth.ts`
- `android/src/api/admin.ts`
- `android/app/admin/_layout.tsx`
- `android/app/admin/login.tsx`
- `android/app/admin/index.tsx`
- `android/app/admin/direction/index.tsx`
- `android/app/admin/commerce/index.tsx`
- `android/app/admin/finance/index.tsx`
- `android/app/admin/technical/index.tsx`
# Phase 5 advanced management extension

Phase 5 is a cross-cutting control layer inside the four dashboards, not a fifth dashboard. Shared platform state lives in PostgreSQL and is exposed through the same Admin API, admin authentication, granular role checks, and immutable audit service used by the existing dashboards. See [TBK_ADMIN_PHASE_5_ADVANCED_MANAGEMENT.md](TBK_ADMIN_PHASE_5_ADVANCED_MANAGEMENT.md) for the API, parity, responsive, DB, and deferred-work matrix.
