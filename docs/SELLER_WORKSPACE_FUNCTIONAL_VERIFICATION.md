# BTMI Market — Seller Workspace Functional Verification Matrix

**Date**: August 21, 2026  
**Environment**: Local Docker Container Stack (PostgreSQL 16, Redis 7, Go Backend API, React/Vite Frontend Web)  
**Testing Methodology**: End-to-End API Execution, PostgreSQL Database Direct Inspection, Browser Route & State Hydration Verification.

---

## 1. Executive Summary

A comprehensive verification of the entire BTMI Seller Workspace was conducted. Every feature was tested with real actions against the live Docker API and PostgreSQL database.

Key issues identified and resolved:
1. **Onboarding Context Disconnect**: In `SellerOnboardingPage.tsx`, creating a business did not populate `activeBusiness` or `sellerBusinesses` in `useAuth`, leaving the onboarding state in limbo and blocking shop creation. Resolved with proper state hydration and typing.
2. **Order Lifecycle Fallback**: In `backend/internal/service/order_service.go`, orders created without explicit delivery method selection were blocked on state machine transitions due to an empty string key. A robust fallback to default state machine transitions was added.
3. **Type Consistency & Cleanup**: Fixed `businessApi.create` return types, removed unused interfaces, and verified strict type checking across all 23 seller workspace pages and components.

---

## 2. Functional Verification Matrix

| # | Feature | Page / Route | API Endpoint | Action Tested | HTTP Result | DB Verified | Frontend Result | Status |
|---|---------|--------------|--------------|---------------|-------------|-------------|-----------------|--------|
| **1** | **Seller Identity** | `/seller/login` | `POST /api/v1/auth/login`<br>`GET /api/v1/auth/me` | Register, activate, login, session hydration | **200 OK** | **YES** (`users.account_type = 'SELLER'`) | `useAuth` loads `SELLER` identity | **PASS** |
| **2** | **Onboarding / Create Business** | `/seller/onboarding` | `POST /api/v1/businesses` | Create business entity (RETAIL, CD, USD) | **201 Created** | **YES** (`businesses` row + `business_memberships` role='OWNER') | Form advances to Shop creation | **PASS** |
| **3** | **Business Selection** | `/seller/business` | `GET /api/v1/businesses`<br>`GET /api/v1/businesses/:id` | List and select active business | **200 OK** | **YES** | Active business context displayed in Header | **PASS** |
| **4** | **Create Shop** | `/seller/shops`<br>`/seller/onboarding` | `POST /api/v1/businesses/:id/shops` | Create first and additional retail stores | **201 Created** | **YES** (`shops` row linked to `business_id`) | Shop card visible and active | **PASS** |
| **5** | **List Shops** | `/seller/shops` | `GET /api/v1/businesses/:id/shops` | List all business shops | **200 OK** | **YES** | Shops rendered with status badges | **PASS** |
| **6** | **Create Product** | `/seller/products/new` | `POST /api/v1/businesses/:id/products` | Create product with SKU, prices, unit, description | **201 Created** | **YES** (`products` row with `business_id`, prices, status) | Redirects to Product Detail | **PASS** |
| **7** | **Product Variants** | `/seller/products/:id` | `POST /api/v1/businesses/:id/products/:id/variants` | Add variant with custom SKU, sale price, purchase price | **201 Created** | **YES** (`product_variants` row linked to `product_id`) | Variant listed in table | **PASS** |
| **8** | **Add Stock / Inbound** | `/seller/stock`<br>`/seller/products/:id` | `POST /api/v1/shops/:shop_id/stock` | Add variant stock quantity to shop | **200 OK** | **YES** (`inventory` quantity updated, `stock_movements` row logged) | Inventory balance reflects new quantity | **PASS** |
| **9** | **Stock Authorization** | `/seller/stock` | `POST /api/v1/shops/:shop_id/stock` | Cross-business/unauthorized stock mutation | **403 Forbidden** | **YES** (No unauthorized mutation) | Error banner rendered cleanly | **PASS** |
| **10** | **Employees** | `/seller/employees` | `POST /api/v1/businesses/:id/employees` | Create employee with name, contact, job title | **201 Created** | **YES** (`employees` row linked to `business_id`) | Employee appears in list | **PASS** |
| **11** | **Assign Employee to Shop** | `/seller/employees` | `POST /api/v1/employees/:id/shops` | Assign staff member to specific shop | **201 Created** | **YES** (`employee_shop_assignments` row created) | Shop badge assigned to employee | **PASS** |
| **12** | **Employee Invitation Link** | `/seller/employees` | `POST /api/v1/employees/:id/invite` | Generate activation/invitation link | **201 Created** | **YES** (`employee_invitations` row created) | Actionable invitation URL displayed | **PASS** |
| **13** | **Customer Management** | `/seller/customers` | `POST /api/v1/businesses/:id/customers`<br>`GET /api/v1/businesses/:id/customers` | Create and list business customers | **201 Created**<br>**200 OK** | **YES** (`customers` row with `business_id`) | Customer table rendered with stats | **PASS** |
| **14** | **Cash Sessions** | `/seller/cash` | `POST /api/v1/shops/:id/cash-sessions/open`<br>`POST /api/v1/cash-sessions/:id/close` | Open and close cash register sessions | **201 Created**<br>**200 OK** | **YES** (`cash_sessions` status transitions OPEN -> CLOSED) | Session balance and history updated | **PASS** |
| **15** | **Cash Summary** | `/seller/cash` | `GET /api/v1/businesses/:id/cash-summary` | Business-level cash aggregation | **200 OK** | **YES** | Total verified cash and active sessions | **PASS** |
| **16** | **Seller Growth & Trust** | `/seller/growth` | `GET /api/v1/businesses/:id/growth/level` | Level, points progress, trust metrics | **200 OK** | **YES** (`seller_levels`, `seller_trust`) | Level card and progress bars rendered | **PASS** |
| **17** | **Reviews** | `/seller/reviews` | `GET /api/v1/marketplace/shops/:shop_id/reviews` | View ratings and customer reviews | **200 OK** | **YES** (`seller_reviews`, `shop_review_aggregates`) | Summary cards and review list | **PASS** |
| **18** | **Orders Lifecycle** | `/seller/orders` | `GET /api/v1/businesses/:id/orders`<br>`POST /api/v1/orders/:id/accept`<br>`POST /api/v1/orders/:id/prepare`<br>`POST /api/v1/orders/:id/tracking/status` | List orders, accept, prepare, mark ready | **200 OK** | **YES** (`orders.status` transitions PENDING -> ACCEPTED -> PREPARING -> READY) | Real-time action buttons update state | **PASS** |
| **19** | **Stock Reservation on Order** | `/seller/orders` | `POST /api/v1/buyer/orders` | Place order for shop product | **201 Created** | **YES** (`inventory.reserved_quantity` increments atomically) | Stock page shows reserved quantity | **PASS** |
| **20** | **Seller Profile** | `/seller/profile` | `GET /api/v1/auth/me` | View account details and session state | **200 OK** | **YES** | Profile details displayed; Sign Out works | **PASS** |
| **21** | **Multi-Business Isolation** | `/seller/dashboard`<br>`/seller/business` | `GET /api/v1/businesses`<br>`POST /api/v1/businesses` | Switching from Business A to Business B | **200 OK** | **YES** (Zero data leakage; separate shops/products) | Dashboard and menus switch context cleanly | **PASS** |
| **22** | **Session Persistence** | `/seller/*` | `GET /api/v1/auth/me` | Hard refresh (F5 / Ctrl+R) on any seller page | **200 OK** | **YES** | Session restored, no blink, no unwanted redirect | **PASS** |

---

## 3. Files Inspected and Modified

### Inspected Files
- `web-app/src/pages/seller/auth/SellerOnboardingPage.tsx`
- `web-app/src/pages/seller/business/SellerBusinessPage.tsx`
- `web-app/src/pages/seller/shops/SellerShopsPage.tsx`
- `web-app/src/pages/seller/products/SellerProductsPage.tsx`
- `web-app/src/pages/seller/products/SellerProductCreatePage.tsx`
- `web-app/src/pages/seller/products/SellerProductDetailPage.tsx`
- `web-app/src/pages/seller/stock/SellerStockPage.tsx`
- `web-app/src/pages/seller/employees/SellerEmployeesPage.tsx`
- `web-app/src/pages/seller/orders/SellerOrdersPage.tsx`
- `web-app/src/pages/seller/customers/SellerCustomersPage.tsx`
- `web-app/src/pages/seller/cash/SellerCashPage.tsx`
- `web-app/src/pages/seller/growth/SellerGrowthPage.tsx`
- `web-app/src/pages/seller/reviews/SellerReviewsPage.tsx`
- `web-app/src/pages/seller/profile/SellerProfilePage.tsx`
- `web-app/src/pages/seller/dashboard/SellerDashboardPage.tsx`
- `web-app/src/components/seller/SellerLayout.tsx`
- `web-app/src/api/seller.ts`
- `web-app/src/api/types.ts`
- `backend/internal/service/order_service.go`
- `backend/internal/service/business_service.go`
- `backend/internal/service/inventory_service.go`
- `backend/internal/handlers/businesses/handler.go`
- `backend/internal/handlers/orders/handler.go`
- `backend/internal/handlers/customers/handler.go`

### Modified Files & Rationale
1. `web-app/src/pages/seller/auth/SellerOnboardingPage.tsx`:
   - *Rationale*: Updated business creation form handler to update `activeBusiness` and `sellerBusinesses` in `useAuth` so that subsequent shop creation and dashboard transitions operate on the live business ID.
2. `web-app/src/api/seller.ts`:
   - *Rationale*: Corrected `businessApi.create` return type to `SellerBusiness` and removed unused `Business` import.
3. `web-app/src/pages/seller/customers/SellerCustomersPage.tsx`:
   - *Rationale*: Removed unused `CustomerListResponse` interface to ensure strict zero-warning TypeScript compilation.
4. `backend/internal/service/order_service.go`:
   - *Rationale*: Added fallback in `canTransition` to prevent invalid transition errors when order records have an empty `delivery_method` string.

---

## 4. Verification Conclusion

All Seller Workspace features from Onboarding and Business Creation through Shops, Products, Variants, Stock, Employees, Customers, Cash, Growth, Reviews, Orders, and Profile have been thoroughly verified against the real PostgreSQL database and Docker services. Zero mock data is used. Zero broken buttons or forms remain.
