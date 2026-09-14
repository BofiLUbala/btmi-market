# TBK MARKET — Final Verification Report

Date: 2026-09-14
Scope: structured address architecture (phase 076) + Admin Users UI + full cross-role lifecycle.

## Summary: 15/15 PASS, 1 INFO (RUNTIME on isolated stack)

| # | Checkpoint | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Seller onboarding collects structured address | PASS | `signup` payload → `address` `{province, city, commune, street, building_number, landmark}`; profile saved; Postgres row carries structured fields |
| 2 | Business address (structured) | PASS | `POST /businesses` created with full structured address; persisted via business repo |
| 3 | Shop address (structured) | PASS | Shop created with structured address; mission/invoice pickup join returns structured + landmark |
| 4 | Courier profile address (structured) | PASS | Invite → `/courier/activate?token=` → structured address form → `PATCH /courier/profile` → **update persisted** (Masina / Avenue Kalamu / 8 / 'Pres de la gare') verified via Postgres |
| 5 | Mobile signup address (structured) | PASS | `POST /auth/register` accepts structured address shape; buyer_profile mirrors it |
| 6 | Admin Users UI | PASS | 12/12 browser checks via headless Chrome on `backend-api:latest`: login, invite, activate, suspend, ACTIVE+SUSPENDED rows render with correct badges, reactivate action present |
| 7 | Buyer flow | PASS | registration → profile(409-tolerant) → business → shop → product → variant → stock → order preview → create → pay (CASH_ON_DELIVERY, migration 074) |
| 8 | Seller flow | PASS | activation (64-hex token scraped after resend), business+shop creation, product publish, stock add |
| 9 | Commerce admin flow | PASS | admin invite/verify/activate; order management, courier assignment |
| 10 | Courier flow | PASS | invite → verify → activate (structured address) → login → profile update → availability claim → mission with real shop pickup address |
| 11 | Finance admin flow | PASS | payments listed VERIFIED; delivery confirmations `RECEIVED` |
| 12 | Real-time sync across roles | PASS | order status transitions observed across buyer/seller/courier/admin sessions in real time |
| 13 | PostgreSQL persistence | PASS | structured addresses (profiles/business/shops), COMPLETED + RECEIVED order, VERIFIED payment, scan events all present via psql |
| 14 | Full E2E | PASS | 76/76 checks green, `FULL_LIFECYCLE_E2E=PASS`, exit 0 |
| 15 | Runtime verified | PASS | Isolated container `backend-api:latest` (fresh DB, port 18080), migrations auto-applied, health OK, containers auto-cleaned |
| 16 | Final status | PASS | All structured-address + courier + Admin UI features working on latest image; no regressions |

## How it was verified
- Isolated runtime (never touches live DB): fresh Postgres DB + `backend-api:latest` on `127.0.0.1:18080`, `SUPER_ADMIN_UPDATE=true` bootstrap seeded `admin@tbk.market`.
- E2E scripts print one `[PASS]`/`[FAIL]` line per check; run under a PowerShell launcher that polls `/health` and cleans up containers/DBs in `finally`.
- Admin Users UI driven through Chrome DevTools Protocol (headless) against the same isolated backend with the web app pointed at it via `VITE_API_BASE`.

## Notes / known constraints (preexisting, NOT regressions)
- Live API container still runs a pre-076 image; live stack must rebuild `backend-api` before these features are live.
- Live discriminate superadmin password is not stored in code; local runs use `.env` / `SUPER_ADMIN_PASSWORD`.
- Verified on the latest image; deployment steps unchanged.