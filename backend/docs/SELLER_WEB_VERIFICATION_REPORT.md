# SELLER WEB — Verification Report

Date: 2026-08-21
Environment: Docker Compose (`backend/docker-compose.yml`) — `api` (:8080), `worker`, `postgres`, `redis`, `web` SPA (:5173). All containers healthy; migrations auto-applied at api startup (schema at version **028**).

## Result summary

| Area | Result |
|---|---|
| Backend E2E suite (`scripts/e2e_verify.ps1`) | **113 / 113 PASSED** |
| Web build (`npm run typecheck` + `npm run build`) | PASS |
| Web container serving rebuilt bundle | PASS (HTTP 200, new bundle verified) |
| Evidence file | `scripts/evidence/e2e_results_20260821_010840.json` |

## E2E coverage by section

1. **Seller auth** — register → DB row (`SELLER|PENDING_VERIFICATION`, hashed password) → invalid activation token 404 → valid activation → login. All pass.
2. **Business & shop** — BUYER blocked from creating business (403); seller creates business + PHYSICAL/ONLINE shops; invalid shop type rejected.
3. **Products / variants / stock** — product CRUD via `/businesses/:bid/products`; multi-variant stock after migration 028 (second variant no longer blocked by legacy `unique_shop_product`); `RecordSale` requires shop access; movements history correct.
4. **Customers / cash** — customer create/list (`CustomerListResponse` shape); cash session open with `opening_amount`, close with `declared_closing_amount`, reconciliation difference computed.
5. **Growth** — points/level/trust/benefits per business; history endpoint.
6. **Seller orders** — accept/reject/prepare transitions; tracking-status updates bound to `{status}`.
7. **Employee flow** — invitation created with URL; invite accepted; `linked_user_id` persisted (repo fix); employee sees only assigned shops via `/employees/me`.
8. **Cross-business security** — full matrix: seller B denied on A's products/inventory/orders/cash/customers (403/404); unauthenticated 401.
9. **Buyer order → seller + payment** — buyer checkout, seller accept/prepare, payment verify, PICKUP flow: buyer receipt **auto-completes** order; terminal transition correctly rejected (400).
10. **Worker background jobs** — asynq jobs processed (incl. `review:aggregate:recalculate`).
11. **Reviews** — eligibility enforced (COMPLETED + VERIFIED); buyer creates review; shop aggregate refreshed asynchronously and polled to `total_reviews ≥ 1`; seller read-only access confirmed (seller hitting buyer-only review endpoints denied 401/403/404).
12. **Buyer regression core** — registration/login/profile, catalog browse, cart→checkout, order tracking, points — no regressions.

## Defects found & fixed during verification

Backend (details in `docs/SELLER_WEB_API_AUDIT.md` §4):
- Missing authorization on inventory endpoints (`RecordSale` etc.) — any user could write any shop's stock. Fixed with `requireShopAccess`.
- Migration drift: stale `unique_shop_product` constraint blocked multi-variant stock → migration 028.
- Employee `linked_user_id` never persisted on update → invitations unusable.
- BUYERs could create businesses; nil-pointer panic on missing buyer profile; invalid shop type / forbidden responses returned 500 instead of 400/403; invitation status update referenced non-existent column.

Web app (§1–§3 of audit):
- 8 API calls hit non-existent routes or wrong payloads (products, growth, reviews, cash, order transition) — all corrected against the real router/DTOs.
- Type layer fictional (`BusinessMembership`, flat inventory, wrong cash/growth fields) — replaced with backend-accurate types.
- Session restore fabricated users and never restored SELLER context — rewritten around `GET /auth/me` with persisted active business/shop.
- 10+ pages had dead buttons, stubs, or fake success states (stock, employees, orders, profile, customers, cash, dashboard) — all wired to real endpoints.

## Known limitations (documented, accepted)

- No user-profile-update endpoint exists → seller profile page is intentionally read-only.
- Shop review aggregates are eventually consistent (async worker refresh).
- `ListProductsByBusiness` ignores filter query params server-side.
- `CompleteOrder` maps invalid transitions to 500 (UI avoids the path; PICKUP auto-completes on receipt).

## Reproduction

```powershell
cd backend
docker compose up -d --build          # api applies migrations incl. 028
./scripts/e2e_verify.ps1              # writes scripts/evidence/e2e_results_<ts>.json
cd ..\web-app ; npm run typecheck ; npm run build
```
