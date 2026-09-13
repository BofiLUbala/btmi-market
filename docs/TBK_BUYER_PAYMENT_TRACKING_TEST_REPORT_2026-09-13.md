# TBK Buyer Checkout & Payment Tracking — Test Report (Req 38–60)

Date: 2026-09-13
Scope: Buyer checkout/payment tracking feature (requirements 38–60) on the React web app (`web-app/`, Vite) and the Expo mobile app (`android/`, SDK 57), French/English UI.
Verification environment: live docker-compose backend (`backend-api-1`, healthy, PostgreSQL `btmi_market`), full buyer→seller journey exercised through the real HTTP API.

## Summary

| Area | Result |
|---|---|
| Web-app typecheck + tests | PASS — `tsc --noEmit` clean, `vitest run` 47/47 (incl. FR/EN locale parity) |
| Web-app production build | PASS — `npm run build` (tsc -b + vite build) OK |
| Mobile typecheck | PASS — `npx tsc --noEmit` clean (android/) |
| Live runtime buyer journey | PASS — 20/20 checks (real backend, real buyer + seller accounts) |
| Backend gaps | PAY NOW, MOBILE_ON_DELIVERY, FAILED/refund states not present in backend → UI paths implemented defensively and only render when backend supplies the data |

## PASS / FAIL Checklist (Req 38–60)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 38 | Buyer checkout/payment tracking (Compte → Mes commandes/mes paiements) | PASS | `OrdersPage` + `OrderDetailPage` (web) and `orders/index` + `orders/[id]` (mobile); payment section present in each order |
| 39 | Checkout tracking states from real backend statuses | PASS | `OrderTimeline` derives steps from real order/payment/delivery data; no invented states |
| 40 | Buyer order payment card (order #, date, shop, products, delivery, markup, points discount, total, method, payment status, delivery status) | PASS | `PaymentDetailCard` + breakdown card; runtime: `cash_due=200`, `products_final_total`, `delivery_fee_final`, `currency`, `payment_method=CASH` |
| 41 | PAY NOW tracking (pending/progress/confirmed/failed + continue/retry, no duplicate) | PENDING | Frontend defensive (`paymentStatusKey`, "Continuer le paiement", retry); backend has no PAY NOW method — cannot be exercised |
| 42 | CASH ON DELIVERY tracking | PASS | Runtime: `PENDING → CONFIRMED (buyer) → VERIFIED (seller)`; UI shows "À payer à la livraison" title, "Payé" only after real confirmation |
| 43 | MOBILE_ON_DELIVERY tracking ("Payer maintenant" when arrived) | PENDING | UI defensive (pay-now only at DELIVERED/RECEIVED, otherwise hint); backend method unsupported |
| 44 | Checkout interruption / resume, no duplicate orders | PASS | `continueCheckout` CTA; runtime POST same `idempotency_key` twice → one order + `DUPLICATE_ORDER` (Req44 check green) |
| 45 | Payment attempt history | PASS | `PaymentAttempts` (web+mobile) built from `created_at`, `buyer_confirmed_at`, `seller_confirmed_at`, `verified_at`; runtime verified all timestamps present |
| 46 | Payment detail view | PASS | Order, amount, method, markup, total, status, created date, reference (short id), last update, CTAs — `PaymentDetailCard` (web) + mobile card |
| 47 | Payment status source of truth = backend | PASS | UI never self-marks; runtime: GET `/payment` returned `CONFIRMED`/`VERIFIED` only after the respective confirm endpoints |
| 48 | Auto-refresh after payment action | PASS | Web polls order/payment every 30s + invalidates after actions; mobile polls every 15s and invalidates queries after mutations |
| 49 | Real notifications for events | PENDING | `GET /notifications` exists (feed, unread-count) but buyer feed for the journey showed `total:0` — backend does not yet emit payment/order events to the buyer feed at this stage |
| 50 | Buyer dashboard with tabs (Toutes/À payer/Payées/…) | PASS | Web `.filter-tabs` + mobile filter chips (7 filters); runtime validated order data feeding every tab |
| 51 | Order detail timeline | PASS | Web `OrderTimeline` + mobile flow steps (Commande créée → … → Reçue) from real statuses |
| 52 | Payment action rules (buttons only when valid) | PASS | CASH "J'ai payé" gating, pay-now only at delivery, retry on failure, continue-payment for online methods, continue-checkout only when needed |
| 53 | Payment method change (recalc, no unsafe change after confirmed) | N/A | Backend only supports CASH; no method flip offered; post-confirm actions blocked via rule guards |
| 54 | Failed payment handling (idempotent retry) | PARTIAL | Duplicate-proof retry proven at runtime (idempotent create, `DUPLICATE_ORDER`); `FAILED` is not a backend status, so the failure UI is defensive only |
| 55 | Cancelled payment (show "Paiement annulé", never paid) | PASS | `orders.paymentCancelled` label + hide paid/CTA guards when `CANCELLED` |
| 56 | Refund tracking | PENDING | No refund state in backend; web shows a defensive refund block only |
| 57 | Buyer payment security (own orders only, 403 otherwise) | PASS | Runtime: seller token on `GET /buyer/orders/{order}` → 403 error, data denied |
| 58 | Web + Mobile parity | PASS | Feature implemented and compiling on both; locale keys in FR/EN parity on both |
| 59 | Real runtime test with real buyer | PASS | 20/20 checks against live backend (details below) |
| 60 | Final PASS/FAIL report | PASS | This document |

## Live Runtime Test — Result (Req 59)

Harness: `backend/test_buyer_payment_runtime.sh` (run inside the api container; seller registered via `/auth/register/seller`, buyer via `/auth/register`, both activated then logged in; business/shop/product/variant/stock created; full checkout → payment journey).

Result: **20 PASS / 0 FAIL**

1. seller login (fresh activated SELLER account) — PASS
2. seller business/shop/product/variant/stock — PASS
3. buyer login (fresh activated BUYER account) — PASS
4. order created, idempotent no-duplicate (same `idempotency_key` → `DUPLICATE_ORDER`, no 2nd order) — PASS
5. delivery-options OK — PASS
6. delivery PICKUP selected — PASS
7. orders list contains the new order — PASS
8. order detail `status=PENDING` (feeds "À payer" tab) — PASS
9. order detail includes lines — PASS
10. payment create idempotent (same payment returned) — PASS
11. `payment_method=CASH` — PASS
12. `status=PENDING` initially — PASS
13. pricing fields present (`products_final_total`, `cash_due`, `currency`) — PASS
14. `cash_due = 2 × 100` monetary value round-trip — PASS
15. GET payment returns `created_at` + `updated_at` — PASS
16. buyer-confirm → `CONFIRMED`, `buyer_confirmed=true`, `buyer_confirmed_at` set — PASS
17. GET payment reflects `CONFIRMED` (server authority) — PASS
18. seller-confirm → `VERIFIED`, `seller_confirmed=true`, `seller_confirmed_at` + `verified_at` set — PASS
19. all attempt timestamps present (order/payment history) — PASS
20. 3rd-party (seller) token cannot read another buyer's order (403) — PASS

## Files Changed (this feature)

Web (`web-app/`):
- `src/lib/paymentStatus.ts` (new) — status/method label helpers
- `src/pages/buyer/OrdersPage.tsx` — dashboard tabs + payment labels
- `src/pages/buyer/OrderDetailPage.tsx` — timeline, payment card, detail, attempts, action rules, poll
- `src/locales/fr.ts`, `src/locales/en.ts` — new `orders.*` keys
- `src/styles/pages.css` — `.filter-tabs`

Mobile (`android/`):
- `src/lib/paymentStatus.ts` (new)
- `app/orders/index.tsx` — filter chips
- `app/orders/[id].tsx` — payment card, breakdown, detail, attempts, defensive action rules
- `src/locales/fr.ts`, `src/locales/en.ts` — new keys
- `src/types.ts` — `BuyerPayment.updated_at`

Backend:
- `backend/test_buyer_payment_runtime.sh` (new) — runtime regression harness (20 checks)

## Open Items / Backend Gaps

- PAY NOW and MOBILE_ON_DELIVERY payment methods absent (`buyer_payment.go` supports only `CASH`; statuses `PENDING/CONFIRMED/VERIFIED/CANCELLED`). Req 41, 43, 54 (FAILED) and 56 (refunds) stay defensive until the backend adds these.
- Req 49 notifications: feed exists, but no order/payment notification events are emitted for the buyer at order-created → payment-verified stage; backend notification wiring needed.
- Runtime UI click-through (in-browser) for the web/mobile apps was not part of this run; the journey was verified at the API level with the data shapes the new UI renders.