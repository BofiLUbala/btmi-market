# BTMI Market — Buyer UI API Gap Analysis

Version: 1.0 · Date: 2026-08-20
Scope: Existing BTMI REST API (Go/Gin, Swagger 2.0 at `backend/docs/swagger.json`, served live at `http://localhost:8080/swagger/doc.json`).
Targets: `web-app/` (React) and `android/` (React Native) buyer-facing apps.

## 1. Summary

| Classification | Meaning |
| --- | --- |
| READY | Real, verified backend endpoint(s) exist and the frontend consumes them. |
| PARTIAL | Backend support exists but is incomplete for the full UX described (details noted). |
| MISSING | No backend endpoint exists. The UI must NOT fake the feature — it is hidden/disabled or shows an explicit "coming soon" state. |

Key decisions honoured in both apps:

- **Cash-first payment only.** The backend only supports `CASH`. No Stripe / card / mobile money.
- **The frontend never computes business truth.** Prices, discounts, points, delivery fees and totals come exclusively from backend responses (`/buyer/orders/preview`, `points-preview`, `delivery-points-preview`, `payment`, etc.). The UI only renders what the API returns.
- **No GPS.** Tracking is a status timeline from the backend, never a map.
- **Favorites / addresses / notifications are `MISSING`** in the backend. The Android Favorites tab and web Favorites page therefore render an honest empty/coming-soon state; they are wired to a `FavoritesProvider` (local persistence only) so the UX exists but is clearly non-authoritative.

## 2. Feature-by-feature gap matrix

### 2.1 Authentication & account

| Feature | Status | Backend reference | Notes |
| --- | --- | --- | --- |
| Register (buyer) | READY | `POST /api/v1/auth/register` | Creates a `PENDING_VERIFICATION` user; `user_id` returned. Buyer profile must be created separately. |
| Email activation | READY | `GET /api/v1/auth/activate` (`token`, `email`) | Email is sent by backend; frontend opens the activation link. |
| Resend activation | READY | `POST /api/v1/auth/resend-activation` | Body `{email}`. |
| Login | READY | `POST /api/v1/auth/login` | Returns `{access_token, refresh_token, token_type, expires_in}`. |
| Refresh token | READY | `POST /api/v1/auth/refresh` | Body `{refresh_token}`. |
| Logout | READY | `POST /api/v1/auth/logout` | |
| Create buyer profile | READY | `POST /api/v1/buyer/profile` | Requires `first_name, last_name, phone, email`. |
| Get buyer profile | READY | `GET /api/v1/buyer/profile` | |
| Update buyer profile | READY | `PATCH /api/v1/buyer/profile` | |
| Password change | MISSING | — | No dedicated endpoint. Not faked. |

### 2.2 Marketplace browsing

| Feature | Status | Backend reference | Notes |
| --- | --- | --- | --- |
| Categories | READY | `GET /api/v1/marketplace/categories` | Public (optional auth). |
| Subcategories | READY | `GET /api/v1/marketplace/categories/:category_slug/subcategories` | |
| Products by category | READY | `GET /api/v1/marketplace/categories/:category_slug/products` | |
| Top shops by category | READY | `GET /api/v1/marketplace/categories/:category_slug/shops` | |
| Shop list | READY | `GET /api/v1/marketplace/shops` | Query: `city`, `page`, `limit`. |
| Shop detail | READY | `GET /api/v1/marketplace/shops/:shop_id/detail` | Includes categories, rating aggregate. |
| Shop products | READY | `GET /api/v1/marketplace/shops/:shop_id/products` | Filters: category, subcategory, q, availability, min_price, max_price, sort, page, limit. |
| Product list | READY | `GET /api/v1/marketplace/products` | |
| Product detail | READY | `GET /api/v1/marketplace/products/:product_id/detail` | Includes variants, availability, buyer-level pricing. |
| Product price for buyer | READY | `GET /api/v1/marketplace/products/:product_id/price` | Buyer-specific `final_price` etc. Requires auth? Optional auth; buyer level applied when authenticated. |
| Similar products | READY | `GET /api/v1/marketplace/products/:product_id/similar` | |
| Search | READY | `GET /api/v1/marketplace/search` | Params: `q`, `shop_id`, `business_id`, `city`, `category`, `subcategory`, `min_price`, `max_price`, `sort`, `page`, `limit`. Sort: `relevance`, `price_asc`, `price_desc`, `seller_level`. |
| Shop reviews (public) | READY | `GET /api/v1/marketplace/shops/:shop_id/reviews` | Params: `page`, `per_page`, `sort`, `rating`. |
| Product images | MISSING | — | No media/image fields on product/shop responses. UI uses generated initials/placeholder artwork. |
| Wishlist / favorites | MISSING | — | No backend endpoint. UI shows honest local-only state. |

### 2.3 Ordering & points

| Feature | Status | Backend reference | Notes |
| --- | --- | --- | --- |
| Order preview (points redemption) | READY | `POST /api/v1/buyer/orders/preview` | Body `{shop_id, items:[{product_id, variant_id, quantity}], use_points}` → `PointRedemptionPreviewResponse` (`base_total`, `points_used`, `points_discount_amount`, `final_total`, `currency`, `available_points`, `maximum_usable_points`, `redeem_rate`, `max_point_coverage`). |
| Create order | READY | `POST /api/v1/buyer/orders` | Body `{shop_id, items, use_points, idempotency_key}` → `OrderWithLinesResponse`. `DUPLICATE_ORDER` on repeated idempotency key. |
| List my orders | READY | `GET /api/v1/buyer/orders` | Returns array of order objects. |
| Order detail | READY | `GET /api/v1/buyer/orders/:order_id` | Returns `{order, lines, history}`. |
| Cancel order (buyer) | READY | `POST /api/v1/buyer/orders/:order_id/cancel` | Only allowed while cancellable (PENDING). |
| Points balance | READY | `GET /api/v1/buyer/points` | |
| Points history | READY | `GET /api/v1/buyer/points/history` | `{account, transactions, level_name, next_level, buyer_next_level}`. |
| Buyer level progress | READY | `GET /api/v1/buyer/points/history` | `buyer_next_level` carries progress + discounts. |

### 2.4 Delivery & tracking

| Feature | Status | Backend reference | Notes |
| --- | --- | --- | --- |
| Delivery options | READY | `GET /api/v1/buyer/orders/:order_id/delivery-options` | Returns `{order_id, shop_id, options:[{method,label,fee,provider,available}], current_method}`. Methods: `PICKUP`, `SHOP_DELIVERY`, `PARTNER`. |
| Select delivery | READY | `POST /api/v1/buyer/orders/:order_id/delivery` | Body `{method, use_points_for_delivery, contact_name, phone, address, notes}` → `DeliverySelectResponse` (`products_final_total`, `delivery`, `total_due`). |
| Delivery points preview | READY | `POST /api/v1/buyer/orders/:order_id/delivery-points-preview` | Body `{use_points_for_delivery}` → `DeliveryPointsPreviewResponse`. |
| Order points preview | READY | `POST /api/v1/buyer/orders/:order_id/points-preview` | Body `{use_points}` → `PointRedemptionPreviewResponse`-style per order. |
| Order tracking | READY | `GET /api/v1/buyer/orders/:order_id/tracking` | `{order_id, order_number, current_status, delivery_method, payment_status, latest_update, latest_update_at, history}`. |
| Live GPS tracking | MISSING | — | No location endpoints. Tracking is status-timeline only (by design). |

### 2.5 Payment (cash-first)

| Feature | Status | Backend reference | Notes |
| --- | --- | --- | --- |
| Create cash payment | READY | `POST /api/v1/buyer/orders/:order_id/payment` | Backend snapshots totals; body is minimal (`{order_id}` context). Returns `BuyerPaymentResponse` with `cash_due`. |
| Get payment | READY | `GET /api/v1/buyer/orders/:order_id/payment` | |
| Buyer confirms cash | READY | `POST /api/v1/buyer/payments/:payment_id/buyer-confirm` | Marks `buyer_confirmed`. |
| Card / mobile money / Stripe | MISSING | — | Not in backend. UI offers cash only; other options visibly disabled. |

### 2.6 Reviews

| Feature | Status | Backend reference | Notes |
| --- | --- | --- | --- |
| Review eligibility | READY | `GET /api/v1/buyer/orders/:order_id/review-eligibility` | `{eligible, reason, existing_review_id}`. |
| Create review | READY | `POST /api/v1/buyer/orders/:order_id/review` | Body `{rating, comment}`. Errors: `REVIEW_ALREADY_EXISTS`, `ORDER_NOT_COMPLETED`, `PAYMENT_NOT_VERIFIED`, `FORBIDDEN`. |
| Update review | READY | `PATCH /api/v1/buyer/reviews/:review_id` | |
| Withdraw review | READY | `DELETE /api/v1/buyer/reviews/:review_id` | |
| My reviews | READY | `GET /api/v1/buyer/reviews` | |
| Shop reviews | READY | `GET /api/v1/marketplace/shops/:shop_id/reviews` | Public; includes aggregate counts by rating. |

### 2.7 Points purchase confirmation (in-store partner flow)

| Feature | Status | Backend reference | Notes |
| --- | --- | --- | --- |
| Pending purchases | READY | `GET /api/v1/buyer/purchases/pending` | In-store purchases awaiting buyer confirmation. |
| Confirm purchase | READY | `POST /api/v1/buyer/purchases/:purchase_id/confirm` | Body `{order_id}`. |

### 2.8 Notifications, addresses, favourites

| Feature | Status | Backend reference | Notes |
| --- | --- | --- | --- |
| Notifications feed | MISSING | — | No endpoint. Web header icon and Android show honest empty state. |
| Saved delivery addresses | MISSING | — | No endpoint. Delivery form is filled inline (no saved address book). |
| Favourites / wishlist | MISSING | — | Local-only persistence with explicit non-authoritative labelling. |

## 3. Conventions honoured by the frontends

- Base URL: `http://localhost:8080/api/v1` (web uses env `VITE_API_BASE`; Android uses `API_BASE` constant, `10.0.2.2` for emulator).
- Success envelope: `{ "message": string, "data": any }`.
- Error envelope: `{ "error": { "code": string, "message": string } }`.
- Auth header: `Authorization: Bearer <access_token>`; refresh via `POST /auth/refresh`.
- Money: rendered as `180 000 FC` (thousands separated by narrow space, `FC` currency) using the currency returned by the API.
- Marketplace is public (optional auth) so the web home/search/shop/product can render pre-login; order/points/review flows require login.
- Pagination: `page`, `limit`/`per_page`; response carries `pagination` where documented; `has_more` drives "load more".

## 4. Endpoints NOT used (seller/scaffolding)

The buyer apps intentionally do not call: `/businesses/*`, `/customers/*`, `/shops/*` (seller), `/orders/*` (seller), `/variants/*`, `/receipts/*`, `/employees/*`, `/cash-sessions/*`, `/cash-payments/*`, `/events/*`, `/categories/:category_id/subcategories` (seller variant). These belong to the seller console.