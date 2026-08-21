# BTMI Market — Buyer Frontend API Integration Matrix

Version: 1.0 · Date: 2026-08-20
Base URL: `http://localhost:8080/api/v1` · Auth: `Authorization: Bearer <access_token>`
Envelope: success `{message, data}` · error `{error:{code,message}}`

This matrix maps every frontend screen/action in `web-app/` and `android/` to the exact backend endpoint, method, request, and response it consumes.

## A. Authentication

| Screen / Action | Method & Path | Request | Response (data) |
| --- | --- | --- | --- |
| Register form submit | `POST /auth/register` | `{first_name, last_name, phone, email, password, password_confirmation}` | `{user_id}` |
| Activation link open | `GET /auth/activate?email=&token=` | — | success message |
| Resend activation | `POST /auth/resend-activation` | `{email}` | — |
| Login submit | `POST /auth/login` | `{email, password}` | `{access_token, refresh_token, token_type, expires_in}` |
| Silent token refresh | `POST /auth/refresh` | `{refresh_token}` | `{access_token, refresh_token, token_type, expires_in}` |
| Logout | `POST /auth/logout` | — | — |

## B. Buyer profile

| Screen / Action | Method & Path | Request | Response (data) |
| --- | --- | --- | --- |
| Profile setup wizard | `POST /buyer/profile` | `{first_name, last_name, phone, email}` | BuyerProfile |
| Account screen load | `GET /buyer/profile` | — | BuyerProfile |
| Edit profile save | `PATCH /buyer/profile` | partial profile fields | BuyerProfile |

## C. Marketplace browsing

| Screen / Action | Method & Path | Request (query/body) | Response (data) |
| --- | --- | --- | --- |
| Home categories rail | `GET /marketplace/categories` | — | `CategoryResponse[]` |
| Category browse | `GET /marketplace/categories/:slug/products` | `page`, `limit` | paginated products |
| Category subcategories | `GET /marketplace/categories/:slug/subcategories` | — | `SubcategoryResponse[]` |
| Category top shops | `GET /marketplace/categories/:slug/shops` | — | ranked shops |
| Home shops grid | `GET /marketplace/shops` | `city`, `page`, `limit` | `PublicShopResponse[]` |
| Shop detail page | `GET /marketplace/shops/:id/detail` | — | `PublicShopDetailResponse` |
| Shop products | `GET /marketplace/shops/:id/products` | `category, subcategory, q, availability, min_price, max_price, sort, page, limit` | paginated products |
| Product grid (any) | `GET /marketplace/products` | `page`, `limit`, filters | paginated products |
| Product detail page | `GET /marketplace/products/:id/detail` | — | `PublicProductDetailResponse` |
| Product price (buyer) | `GET /marketplace/products/:id/price` | — | `BuyerPriceResponse` |
| Similar products carousel | `GET /marketplace/products/:id/similar` | — | `PublicProductResponse[]` |
| Search submit / type-ahead | `GET /marketplace/search` | `q, category, subcategory, city, min_price, max_price, sort, page, limit` | `MarketplaceSearchResult` |
| Shop reviews tab | `GET /marketplace/shops/:id/reviews` | `page, per_page, sort, rating` | `ShopReviewsResponse` |

## D. Cart → Order flow (the full purchase pipeline)

| Step | Method & Path | Request | Response (data) |
| --- | --- | --- | --- |
| 1. Preview (subtotal, points redeemable) | `POST /buyer/orders/preview` | `{shop_id, items:[{product_id, variant_id, quantity}], use_points}` | `PointRedemptionPreviewResponse` |
| 2. Create order | `POST /buyer/orders` | `{shop_id, items, use_points, idempotency_key}` | `OrderWithLinesResponse` |
| 3. Fetch delivery options | `GET /buyer/orders/:order_id/delivery-options` | — | `DeliveryOptionsResponse` |
| 4. Delivery points preview (optional) | `POST /buyer/orders/:order_id/delivery-points-preview` | `{use_points_for_delivery}` | `DeliveryPointsPreviewResponse` |
| 5. Select delivery method | `POST /buyer/orders/:order_id/delivery` | `{method, use_points_for_delivery, contact_name, phone, address, notes}` | `DeliverySelectResponse` |
| 6. Order points preview (optional) | `POST /buyer/orders/:order_id/points-preview` | `{use_points}` | `PointRedemptionPreviewResponse` |
| 7. Create cash payment | `POST /buyer/orders/:order_id/payment` | `{}` | `BuyerPaymentResponse` (`cash_due`) |
| 8. Buyer confirms cash | `POST /buyer/payments/:payment_id/buyer-confirm` | `{}` | `BuyerPaymentResponse` |

Notes:
- Steps 1–8 are sequential. Every total shown to the user is read from the API response of the immediately preceding step.
- `idempotency_key` is generated client-side (UUID) and reused for retries so a duplicate tap cannot create `DUPLICATE_ORDER` or a double order.
- Payment screen shows `cash_due` as the single amount to hand over; the user never types an amount.

## E. Order list, detail, tracking

| Screen / Action | Method & Path | Request | Response (data) |
| --- | --- | --- | --- |
| Orders tab/list | `GET /buyer/orders` | — | `Order[]` (BuyerOrderData) |
| Order detail | `GET /buyer/orders/:order_id` | — | `{order, lines, history}` |
| Cancel order | `POST /buyer/orders/:order_id/cancel` | `{}` | `Order` |
| Track order | `GET /buyer/orders/:order_id/tracking` | — | `TrackingResponse` |
| Confirm received | `POST /buyer/orders/:order_id/received` | `{}` | `Order` |
| Payment detail | `GET /buyer/orders/:order_id/payment` | — | `BuyerPaymentResponse` |

## F. Points

| Screen / Action | Method & Path | Request | Response (data) |
| --- | --- | --- | --- |
| Points summary card | `GET /buyer/points` | — | `PointAccountResponse` |
| Points history screen | `GET /buyer/points/history` | — | `PointHistoryResponse` (`account, transactions, level_name, next_level, buyer_next_level`) |

## G. Reviews

| Screen / Action | Method & Path | Request | Response (data) |
| --- | --- | --- | --- |
| Check eligibility (on order detail) | `GET /buyer/orders/:order_id/review-eligibility` | — | `ReviewEligibilityResponse` |
| Submit review | `POST /buyer/orders/:order_id/review` | `{rating, comment}` | `ReviewResponse` |
| Update review | `PATCH /buyer/reviews/:review_id` | `{rating, comment}` | `ReviewResponse` |
| Withdraw review | `DELETE /buyer/reviews/:review_id` | — | `null` |
| My reviews list | `GET /buyer/reviews` | `page, per_page` | `BuyerReviewsResponse` |

## H. In-store purchase confirmation

| Screen / Action | Method & Path | Request | Response (data) |
| --- | --- | --- | --- |
| Pending purchases list | `GET /buyer/purchases/pending` | — | `PendingPurchaseResponse[]` |
| Confirm purchase | `POST /buyer/purchases/:purchase_id/confirm` | `{order_id}` | confirmation |

## I. Features with no backend (honest states)

| Feature | UI behaviour | Reason |
| --- | --- | --- |
| Favorites / wishlist | Local-only persistence via `FavoritesProvider`; UI labels "Saved on this device" | No backend endpoint |
| Notifications | Empty state "No notifications yet" | No backend endpoint |
| Saved addresses | Delivery form captures address inline per order | No address-book endpoint |
| Payment methods other than cash | Visible but disabled with "Cash only — coming soon" | Backend supports `CASH` only |
| Live GPS tracking | Status timeline only; no map | By design (no tracking endpoints) |

## J. Shared client behaviour (both apps)

1. Attach `Authorization: Bearer <access_token>` from storage.
2. On `401` with a usable refresh token: single-flight refresh, retry original request once; otherwise force logout to login screen.
3. Unwrap `data` from the success envelope; throw structured `ApiError {code, message, status}` from the error envelope.
4. Money formatting util: `formatMoney(amount, currency)` → `180 000 FC` (thousands narrow-space separated, symbol `FC`).
5. All totals shown in the cart/payment are backend values — never recomputed.
6. Public marketplace endpoints are called without auth when logged out (optional-auth middleware).