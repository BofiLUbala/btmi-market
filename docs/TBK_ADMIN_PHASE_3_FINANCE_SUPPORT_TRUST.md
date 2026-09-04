# TBK Market Admin Control Center — Phase 3 (Finance, Support, Trust) Architecture

## Overview
Phase 3 implements the operational administrative backend and web/mobile control interfaces for **Dashboard 3 — Finance / Support / Trust**.

## Control Domains Covered (Domains 31 to 45)
1. **Cash Payment Control**: Dual-confirmation verification (`buyer_confirmed_paid`, `seller_confirmed_received`, `VERIFIED` status) with inconsistency anomaly detection.
2. **Payment Disputes**: Structured case triage and resolution workflows for contested cash payments.
3. **Buyer Points Ledger**: Real-time point account inspection (`available_points`, `reserved_points`, `lifetime_points`).
4. **Seller Points & Growth**: Seller growth level progression, GMV totals, average review ratings, and trust thresholds.
5. **Manual Point Adjustment**: Strictly audited balance changes (`ADD` / `REMOVE`) requiring mandatory justification and immutably stored audit logs.
6. **Product Reviews Moderation**: Helpfulness validation, verified purchase badges, and status transitions (`VISIBLE`, `FLAGGED`, `UNDER_REVIEW`, `HIDDEN`).
7. **Shop / Seller Reviews**: Dedicated service rating moderation separate from product quality.
8. **Review Moderation Queue**: Triage queue for reported/flagged buyer reviews.
9. **Report Queue & Triage**: Unified ticket management for reported products, reviews, and shops.
10. **Customer Support Tickets**: Multi-party conversation threads linked to specific orders and users.
11. **Claims & Complaints**: Resolution of damaged items, delivery complaints, and incorrect products.
12. **Fraud & Anomaly Monitoring**: Rule-based detection for serial cancellations and cash confirmation mismatches.
13. **Trust Signals Control**: Computed seller trust status and buyer verification badges.
14. **Demand & Analytics**: Interest aggregation and conversion potential.
15. **Financial Summary**: Platform-recorded GMV, verified cash receipts, unverified cash, and points discount volume.

---

## Cash-First Payment Principles & Architecture
1. **Physical Cash Double-Confirmation**:
   - Buyer confirms: "I Have Paid" (`buyer_confirmed_paid = true`).
   - Seller confirms: "I Confirm Cash Received" (`seller_confirmed_received = true`).
   - Payment status becomes `VERIFIED` **only** when both confirmations are true.
2. **Zero Online Payment Gateways**:
   - TBK Market operates strictly cash-first. No card processing, Stripe, PayPal, Mobile Money, bank settlement accounts, or platform wallets.
3. **Points Discount vs Cash Due**:
   - `Cash Due = Subtotal Amount - Points Discount Amount + Delivery Fee`.
   - Points discounts are tracked separately from cash due.
4. **Authoritative Single Source of Truth**:
   - Admin APIs read and audit the exact same `buyer_payments` and `orders` records used by Buyer and Seller clients.
5. **Admin Supervision & Triage**:
   - Admin does NOT impersonate Buyer or Seller cash confirmation.
   - Discrepancies (e.g. Buyer claims paid, Seller denies receipt) trigger a `PAYMENT_DISPUTE` case for administrative investigation.
6. **Automated Anomaly Detection Rules**:
   - Both confirmed but status != `VERIFIED`.
   - Status == `VERIFIED` but missing buyer or seller confirmation.
   - Buyer confirmed cash paid over 24h ago without seller confirmation.
   - Seller confirmed cash received over 24h ago without buyer confirmation.

---

## API Specification (`/api/v1/admin/finance/*`)

### Auth & RBAC
- **Allowed Roles**: `SUPER_ADMIN`, `FINANCE_SUPPORT_ADMIN`, `DIRECTION_ADMIN` (read-only).
- **Mutations Allowed**: `SUPER_ADMIN`, `FINANCE_SUPPORT_ADMIN`.

### Endpoints
- `GET /api/v1/admin/finance/summary`: Aggregated financial metrics and anomaly counts.
- `GET /api/v1/admin/finance/payments`: Paginated list of cash payments with double-confirmation status and anomaly flags.
- `GET /api/v1/admin/finance/payments/:id`: Detailed payment breakdown, product line items, and order history.
- `GET /api/v1/admin/finance/points/buyers`: List buyer point accounts and point balances.
- `GET /api/v1/admin/finance/points/buyers/:buyerId/history`: Detailed ledger transaction history for a buyer.
- `POST /api/v1/admin/finance/points/buyers/:buyerId/adjust`: Manual audited point balance adjustment (`ADD` or `REMOVE`) with mandatory justification.
- `GET /api/v1/admin/finance/growth/sellers`: List seller growth levels, total GMV, ratings, and trust status.
- `GET /api/v1/admin/finance/reviews/products`: List product reviews and moderation status.
- `POST /api/v1/admin/finance/reviews/products/:id/hide`: Hide a product review with mandatory reason.
- `POST /api/v1/admin/finance/reviews/products/:id/restore`: Restore a hidden product review.
- `GET /api/v1/admin/finance/reviews/shops`: List shop/service reviews.
- `POST /api/v1/admin/finance/reviews/shops/:id/hide`: Hide a shop review with reason.
- `POST /api/v1/admin/finance/reviews/shops/:id/restore`: Restore a shop review.
- `GET /api/v1/admin/finance/cases`: List dispute and support cases with filters.
- `POST /api/v1/admin/finance/cases`: Open a new dispute or support case.
- `GET /api/v1/admin/finance/cases/:id`: Detailed case info and message history.
- `POST /api/v1/admin/finance/cases/:id/assign`: Assign case to an administrator.
- `POST /api/v1/admin/finance/cases/:id/resolve`: Resolve or close a case with detailed resolution note.
- `POST /api/v1/admin/finance/cases/:id/messages`: Add user-visible or internal admin notes to a case.
- `GET /api/v1/admin/finance/risk`: List rule-based risk events and anomaly flags.
- `POST /api/v1/admin/finance/risk/:id/resolve`: Resolve or dismiss a risk event.

---

## Database Migrations
- Migration `039_add_admin_cases_and_risk.sql` created tables:
  - `cases`
  - `case_messages`
  - `risk_events`

---

## Immutable Audit Trail
All sensitive financial mutations (points adjustments, review hiding/restoration, case assignments, resolutions, and risk event dismissals) automatically log to `admin_audit_log` via `AuditService.Record`.
