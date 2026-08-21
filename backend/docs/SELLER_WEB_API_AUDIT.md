# SELLER WEB — API Audit

Scope: `web-app` seller/employee surfaces audited against the real backend (`backend/cmd/api/main.go` routes + handler/service/model contracts), verified end-to-end against the running Docker Compose stack (`api`, `worker`, `postgres`, `redis`, `web`). No mocks.

## 1. Route-level findings (web → API)

Every call was checked against registered routes and request/response DTOs. Status at audit time:

| Web API method | Old path / payload | Problem | Fix |
|---|---|---|---|
| `productApi.get` | `GET /products/:id` | Route does not exist | `GET /businesses/:bid/products/:pid` |
| `productApi.update` | `PATCH /products/:id` | Route does not exist | `PATCH /businesses/:bid/products/:pid` |
| `productApi.listVariants` | `GET /products/:id/variants` | Route does not exist | `GET /businesses/:bid/products/:pid/variants` |
| `productApi.createVariant` | `POST /products/:id/variants` | Route does not exist | `POST /businesses/:bid/products/:pid/variants` |
| `growthApi.getHistory` | `GET /seller/growth/history` | Route does not exist | `GET /businesses/:bid/growth/history` |
| `growthApi.getSellerGrowth` | `GET /seller/growth` | Route does not exist | `GET /businesses/:bid/growth/level` (returns full `SellerGrowthResponse`) |
| `growthApi.getPointsHistory` | `GET /seller/growth/points-history` | Route does not exist | removed (use `getHistory`) |
| `reviewApi.getShopReviews` | `GET /shops/:id/reviews` | 404 (route is marketplace-scoped) | `GET /marketplace/shops/:id/reviews` |
| `orderApi.sellerTransition` | body `{to_status}` | Backend binds `{status}` (`TrackingStatusRequest`) | body `{status}` |
| `cashApi.openSession` | body `{}` | Backend requires `opening_amount` ≥ 0 | body `{opening_amount, currency?}` |
| `cashApi.closeSession` | body `{declared_amount}` | Backend binds `declared_closing_amount` | body `{declared_closing_amount}` |
| auth session restore | fabricated user from buyer profile; called `authApi.login('','')` | Never restored SELLER sessions; bogus login call | rewritten around `GET /auth/me` (+ business list for sellers) |

## 2. Response-shape mismatches fixed in `web-app/src/api/types.ts`

- `SellerGrowth`: now matches `models.SellerGrowthResponse` — `points` (not `points_account`), `trust.trust_status` (not `status`), `benefits[] = {benefit_type, benefit_value}`.
- `CashSession` / `CashSummary`: now match `models.CashSessionResponse` / `CashSummaryResponse` (`cash_sales_total`, `declared_closing_amount`, `difference`, `total_cash_sales`, `shop_breakdown[]`, `seller_breakdown[]`; removed fictional `today_total/today_cash/...`).
- `InventoryItem`: flat shape replaced by the real nested `InventoryWithVariantResponse` (`{inventory:{...available}, variant, product}`); field is `available`, not `available_quantity`.
- `StockMovement`: `quantity` + `previous_quantity`/`new_quantity` (no `quantity_change`), nullable `variant_id/performed_by/employee_id`.
- `Product`/`CreateProductRequest`/`UpdateProductRequest`: added `unit_price/cost_price/unit/status`; optional fields made optional to match bindings.
- `CreateVariantRequest`: only `sale_price` is required; `sku/name/attributes/purchase_price/barcode/unit` optional.
- `Customer` split into `Customer` + `CustomerSummary` (`customer` wrapper, `total_orders`, `total_purchased`); create/update requests match backend (no `address`/`notes`).
- `BusinessMembership` deleted: `GET /businesses` returns `BusinessResponse[]` (`id`, `name`, …) — web now uses `SellerBusiness`. All pages migrated from `activeBusiness.business_id/business_name` → `.id/.name`.
- `SellerPointsHistory.next_level` typed as `SellerLevelInfo`.

## 3. Page-level wiring defects found & fixed

| Page | Defect | Fix |
|---|---|---|
| `store/auth.tsx` | Session restore faked a BUYER user from buyer profile; `refreshUser` invoked `login('','')`; SELLER businesses never restored; no `/auth/me` usage | Full rewrite: `loadSession()` → `/auth/me`, loads seller businesses (persisted selection in localStorage) or buyer profile; clears tokens on failure; login fallback resolves via `/auth/me` |
| `SellerLayout.tsx` | Local `activeShop` state shadowed the auth store — shop selector never affected pages; EMPLOYEE_NAV pointed to 6 non-existent routes; footer used raw `<a>` reloads | Unified with `useAuth().activeShop/setActiveShop` (persisted); employee nav reduced to existing routes; footer uses `<Link>` |
| `SellerDashboardPage.tsx` | Called phantom `getSellerGrowth()`; read `available_quantity` (field is `available`); read `today_total` (field is `total_cash_sales`); fake static "Getting Started" checklist | Real fields; checklist derived from actual data (products > 0, stock rows > 0, published > 0, orders > 0) with links |
| `SellerStockPage.tsx` | Pure stub ("coming soon") linking to 3 non-existent routes | Real inventory table (`GET /shops/:id/inventory`), inline restock (`POST /shops/:id/stock`), movements tab (`GET /shops/:id/movements`) |
| `SellerEmployeesPage.tsx` | "View"/"Assign Shops"/"Invite Access" buttons did nothing | Assign/unassign shops via `POST/DELETE /employees/:id/shops`; invitation via `POST /employees/:id/invite` showing returned `invitation_url` |
| `SellerOrdersPage.tsx` | "View" button dead; no order actions | State-machine actions (accept/reject/prepare/tracking-status transitions per delivery method), expandable order details |
| `SellerProductsPage.tsx` | Linked to non-existent `/seller/products/new` and `/seller/products/:id`; crashed on null `description` | New `SellerProductCreatePage` + `SellerProductDetailPage` (create product → variants → publish toggle → add stock); null-safe description |
| `SellerProfilePage.tsx` | Fake save (`setTimeout` success), fake notification prefs, dead "Change Password" | Honest read-only account info + real logout (no user-profile update endpoint exists in the API) |
| `SellerCustomersPage.tsx` | Treated list response as flat array; sent unsupported `address`/`notes` | Unwraps `CustomerListResponse.data[]` summaries; form matches `CreateCustomerRequest` |
| `SellerBusinessPage.tsx` | Displayed membership `role` that the API never returns; dead buttons | Shows real business fields; business switcher across `sellerBusinesses` |
| `SellerCashPage.tsx` | Opened sessions without `opening_amount` (400); no close flow; fictional summary fields | Opening-float input, per-session close with declared amount, real summary cards |
| `EmployeeDashboardPage.tsx` | Static placeholder with dead buttons | Live `GET /employees/me` workspace: profile, system-access status, assigned shops |

## 4. Backend defects discovered during verification (fixed)

1. **Inventory authorization hole** — `RecordSale` had *no caller authorization*: any authenticated user could record sales on any shop. Added `requireShopAccess` (owner/admin membership or active employee assignment) to `GetShopInventory`, `AddStock`, `GetStockMovements`, `RecordSale`.
2. **Schema/repo mismatch** — migration 010's `unique_shop_product UNIQUE (shop_id, product_id)` blocked multi-variant stock after migration 012 added variants (repo upserts on `(shop_id, variant_id)`). Migration `028_drop_inventory_shop_product_unique.sql` drops the stale constraint.
3. **Employee link never persisted** — `employee_repository.Update` omitted `linked_user_id`, so accepting an invitation never linked the user (broke `/employees/me` and all employee access).
4. **BUYERs could create businesses** — `CreateBusiness` now requires `AccountType == SELLER` (403 otherwise).
5. **Nil-pointer panic** — `buyer_profile_service` GetProfile/UpdateProfile panicked when no buyer profile existed (repo returns `nil, nil`).
6. **500s instead of 400s** — invalid `shop_type` (e.g. legacy 'RETAIL') now rejected by binding validation (`oneof=PHYSICAL ONLINE`); `FORBIDDEN` mapped to HTTP 403 in businesses handler.
7. **Invitation update crash** — `employee_invitation_repository.UpdateStatus` referenced non-existent `updated_at` column.

## 5. Known remaining gaps (API-side, not web bugs)

- No endpoint to update the authenticated user's profile (hence read-only seller profile page).
- `CompleteOrder` returns 500 for invalid transitions (unmapped `INVALID_STATUS_TRANSITION`); PICKUP orders auto-complete on buyer receipt so the UI avoids it.
- Shop review aggregates refresh asynchronously via worker (`review:aggregate:recalculate`); there can be seconds of lag after a new review.
- `ListProductsByBusiness` ignores query params (`category_id`, `publication_status`, `search`) — accepted but unfiltered server-side.
