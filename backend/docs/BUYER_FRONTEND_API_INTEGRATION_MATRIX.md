# BUYER FRONTEND — API INTEGRATION MATRIX

**Date**: 2026-08-21
**Base URL**: `http://localhost:8080/api/v1`
**Auth**: Bearer token (access) with automatic refresh (client.ts)

---

## Legend

- ✅ = Implemented & tested (E2E 113/113)
- ⚠️ = Implemented, known limitation
- ❌ = Not implemented / MISSING (documented in gap analysis)
- 🔒 = Requires authentication
- 🌐 = Public / Optional auth

---

## Marketplace — Product Discovery

| Feature | Endpoint | Method | Auth | Frontend Integration | Test Status | Notes |
|---------|----------|--------|------|----------------------|-------------|-------|
| List products | `/marketplace/products` | GET | 🌐 | `marketplaceApi.products()` → HomePage, SearchPage | ✅ | Pagination, filters, sorting |
| Search products | `/marketplace/search` | GET | 🌐 | `marketplaceApi.search()` → SearchPage | ✅ | q, category, price range, sort |
| Categories | `/marketplace/categories` | GET | 🌐 | `marketplaceApi.categories()` → CategoriesPage | ✅ | Hierarchical |
| Subcategories | `/marketplace/categories/:slug/subcategories` | GET | 🌐 | `marketplaceApi.subcategories()` | ✅ | |
| Product detail | `/marketplace/products/:id/detail` | GET | 🌐 | `marketplaceApi.productDetail()` → **ProductDetailPage** | ✅ | Returns variants w/ attributes, stock, personalized price |
| Product price (personalized) | `/marketplace/products/:id/price` | GET | 🌐 | `marketplaceApi.productPrice()` | ✅ | Used for buyer-level discount display |
| Similar products | `/marketplace/products/:id/similar` | GET | 🌐 | `marketplaceApi.similarProducts()` → ProductDetailPage | ✅ | Unwraps `{products, pagination}` |
| Shop list | `/marketplace/shops` | GET | 🌐 | `marketplaceApi.shops()` → ShopsPage | ✅ | |
| Shop detail | `/marketplace/shops/:id/detail` | GET | 🌐 | `marketplaceApi.shopDetail()` → ShopDetailPage | ✅ | Includes rating, categories |
| Shop products | `/marketplace/shops/:id/products` | GET | 🌐 | `marketplaceApi.shopProducts()` | ✅ | |
| Shop reviews | `/marketplace/shops/:id/reviews` | GET | 🌐 | `marketplaceApi.shopReviews()` | ✅ | Seller read-only view |

---

## Product Configuration (ProductDetailPage)

| Feature | Endpoint | Method | Auth | Frontend Integration | Test Status | Notes |
|---------|----------|--------|------|----------------------|-------------|-------|
| Variant resolution | (client-side) | — | — | `lib/variants.ts` generic engine | ✅ | Builds attribute groups from `variants[].attributes` |
| Stock per variant | (in detail response) | — | — | `variant.stock_quantity`, `variant.stock` | ✅ | AVAILABLE / LOW_STOCK / OUT_OF_STOCK |
| Price per variant | (in detail response) | — | — | `variant.unit_price` | ✅ | Personalized discount shown as banner |
| Quantity subtotal | (client calc) | — | — | `unitPrice * qty` | ✅ | Display only; backend authoritative at checkout |
| Image gallery | N/A (MISSING) | — | — | `Gallery` component w/ placeholder | ❌ | See `BUYER_PRODUCT_MEDIA_GAP.md` |

---

## Cart & Checkout

| Feature | Endpoint | Method | Auth | Frontend Integration | Test Status | Notes |
|---------|----------|--------|------|----------------------|-------------|-------|
| Anonymous cart (local) | — | — | 🌐 | `CartProvider` (localStorage `btmi.cart`) | ✅ | Persists across refresh/login |
| Add to cart | (client) | — | 🌐 | `cart.add({...variant snapshot...})` | ✅ | Validates stock, variant required |
| Cart page | (client) | — | 🌐 | `CartPage` (anonymous accessible) | ✅ | Line subtotals, qty controls, attributes |
| Checkout preview | `/buyer/orders/preview` | POST | 🔒 | `buyerApi.previewOrder()` → authoritative totals | ✅ | Points, delivery fee, final total |
| Create order | `/buyer/orders` | POST | 🔒 | `buyerApi.createOrder()` → `/checkout/delivery` | ✅ | Idempotency key required |
| Delivery options | `/buyer/orders/:id/delivery-options` | GET | 🔒 | `buyerApi.getDeliveryOptions()` → DeliveryPage | ✅ | |
| Select delivery | `/buyer/orders/:id/delivery` | POST | 🔒 | `buyerApi.selectDelivery()` | ✅ | |
| Delivery points preview | `/buyer/orders/:id/delivery-points-preview` | POST | 🔒 | `buyerApi.deliveryPointsPreview()` | ✅ | |
| Order points preview | `/buyer/orders/:id/points-preview` | POST | 🔒 | `buyerApi.orderPointsPreview()` | ✅ | |
| Create payment | `/buyer/orders/:id/payment` | POST | 🔒 | `buyerApi.createPayment()` → PaymentPage | ✅ | |
| Confirm payment (buyer) | `/buyer/payments/:id/buyer-confirm` | POST | 🔒 | `buyerApi.confirmPayment()` | ✅ | |
| Confirm received | `/buyer/orders/:id/received` | POST | 🔒 | `buyerApi.confirmReceived()` | ✅ | Auto-completes PICKUP |
| Cancel order | `/buyer/orders/:id/cancel` | POST | 🔒 | `buyerApi.cancelOrder()` | ✅ | |

---

## Authentication & Session

| Feature | Endpoint | Method | Auth | Frontend Integration | Test Status | Notes |
|---------|----------|--------|------|----------------------|-------------|-------|
| Buyer register | `/auth/register` | POST | 🌐 | `authApi.register()` → RegisterPage | ✅ | |
| Buyer login | `/auth/login` | POST | 🌐 | `authApi.login()` → LoginPage | ✅ | Returns access+refresh, user |
| Seller register | `/auth/register/seller` | POST | 🌐 | `sellerAuthApi.register()` | ✅ | |
| Seller login | `/auth/login` | POST | 🌐 | `sellerAuthApi.login()` | ✅ | |
| Activate account | `/auth/activate?token=` | GET | 🌐 | `ActivatePage` | ✅ | |
| Resend activation | `/auth/resend-activation` | POST | 🌐 | `authApi.resendActivation()` | ✅ | |
| Refresh tokens | `/auth/refresh` | POST | 🔒 | `client.ts` auto-refresh on 401 | ✅ | |
| Get current user | `/auth/me` | GET | 🔒 | `authApi.me()` → session restore | ✅ | Used by `AuthProvider` |
| Logout | (client) | — | 🔒 | `authStore.logout()` clears tokens | ✅ | |

---

## Protected Buyer Pages (Auth Gates)

| Page | Route | Guard | returnTo Support | Test Status |
|------|-------|-------|------------------|-------------|
| Cart | `/cart` | None (anonymous) | N/A | ✅ |
| Checkout | `/checkout/delivery` | `RequireAuth` | ✅ | ✅ |
| Orders | `/orders` | `RequireAuth` | ✅ | ✅ |
| Order detail | `/orders/:id` | `RequireAuth` | ✅ | ✅ |
| Order tracking | `/orders/:id/tracking` | `RequireAuth` | ✅ | ✅ |
| Points | `/points` | `RequireAuth` | ✅ | ✅ |
| Points history | `/points/history` | `RequireAuth` | ✅ | ✅ |
| Favorites | `/favorites` | `RequireAuth` | ✅ | ✅ |
| Profile | `/account` | `RequireAuth` | ✅ | ✅ |
| Edit profile | `/account/edit` | `RequireAuth` | ✅ | ✅ |
| Profile setup | `/account/profile-setup` | `RequireAuth` | ✅ | ✅ |
| Reviews (my) | `/reviews` | `RequireAuth` | ✅ | ✅ |
| Write review | `/orders/:id/review` | `RequireAuth` | ✅ | ✅ |
| Notifications | `/notifications` | `RequireAuth` | ✅ | ✅ |

---

## Error Handling

| HTTP Status | Code | Frontend Behavior |
|-------------|------|-------------------|
| 401 | UNAUTHENTICATED | `client.ts` auto-refresh → if fails, clear tokens, redirect `/login?returnTo=...` |
| 403 | FORBIDDEN | Show "You do not have permission to access this resource." — no redirect |
| 404 | PRODUCT_NOT_FOUND / ACTIVATION_LINK_INVALID | `ErrorBox` with retry |
| 409 | INSUFFICIENT_STOCK / DUPLICATE | `ErrorBox` with actionable message |
| 500 | INTERNAL_ERROR | Show generic "Something went wrong" |
| 0 / network | NETWORK_ERROR | "Cannot reach BTMI Market right now. Check your connection and try again." |

---

## Return-To Mechanism

- `RequireAuth` guard: redirects to `/login?returnTo=<pathname+search>`
- `LoginPage`: reads `returnTo` from query param (validated internal path) or router state
- After login: navigates to `returnTo` if set, else `/` (buyer) or `/seller/dashboard` (seller)
- Protected pages: `/orders`, `/points`, `/favorites`, `/checkout/delivery`, `/account/*` all preserve destination

---

## Test Coverage (E2E 113/113)

All endpoints above covered by `scripts/e2e_verify.ps1` sections 1–12. Evidence: `scripts/evidence/e2e_results_20260821_024200.json`.