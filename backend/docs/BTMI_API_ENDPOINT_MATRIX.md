# BTMI API Endpoint Matrix

> Base path: `/api/v1`

## Health & Swagger

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /health | No | Health check | |
| GET | /swagger/doc.json | No | Swagger JSON spec | |
| GET | /swagger | No | Swagger UI | |
| GET | /swagger/index.html | No | Swagger UI | |

## Auth

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| POST | /auth/register | No | Register new user | |
| GET | /auth/activate | No | Activate account | Token via query param |
| POST | /auth/resend-activation | No | Resend activation email | |
| POST | /auth/login | No | Login with email/password | |
| POST | /auth/refresh | No | Refresh token rotation | |
| POST | /auth/logout | No | Revoke refresh token | |

## Businesses (Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| POST | /businesses | Auth | Create business | |
| GET | /businesses | Auth | List user's businesses | |
| GET | /businesses/:business_id | Auth | Get business | |

## Shops (nested under businesses, Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| POST | /businesses/:business_id/shops | Auth | Create shop | owner/admin |
| GET | /businesses/:business_id/shops | Auth | List business shops | |

## Employees (nested under businesses, Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| POST | /businesses/:business_id/employees | Auth | Create employee | owner/admin |
| GET | /businesses/:business_id/employees | Auth | List business employees | |

## Products (nested under businesses, Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| POST | /businesses/:business_id/products | Auth | Create product | |
| GET | /businesses/:business_id/products | Auth | List products | |
| GET | /businesses/:business_id/products/:product_id | Auth | Get product | |
| PATCH | /businesses/:business_id/products/:product_id | Auth | Update product | |

## Variants (nested under products, Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| POST | /businesses/:business_id/products/:product_id/variants | Auth | Create variant | |
| GET | /businesses/:business_id/products/:product_id/variants | Auth | List variants | |

## Stock Receipts (nested under businesses, Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| POST | /businesses/:business_id/receipts | Auth | Receive stock | |
| GET | /businesses/:business_id/receipts | Auth | List receipts | |

## Stock History (nested under businesses, Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /businesses/:business_id/stock/history | Auth | Business stock history | |

## Orders (nested under businesses, Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /businesses/:business_id/orders | Auth | List business orders | |

## Customers (nested under businesses, Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| POST | /businesses/:business_id/customers | Auth | Create customer | |
| GET | /businesses/:business_id/customers | Auth | List customers | |

## Cash (nested under businesses, Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /businesses/:business_id/cash-sessions | Auth | List business sessions | |
| GET | /businesses/:business_id/cash-summary | Auth | Business cash summary | |

## Growth (nested under businesses, Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /businesses/:business_id/growth/points | Auth | Get seller points | |
| GET | /businesses/:business_id/growth/level | Auth | Get seller level | |
| GET | /businesses/:business_id/growth/benefits | Auth | Get seller benefits | |
| GET | /businesses/:business_id/growth/history | Auth | Get growth history | |

## Customers (standalone, Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /customers/:customer_id | Auth | Get customer | |
| PATCH | /customers/:customer_id | Auth | Update customer | |
| GET | /customers/:customer_id/orders | Auth | Get customer orders | |

## Shops (standalone, Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /shops/:shop_id | Auth | Get shop | |
| PATCH | /shops/:shop_id | Auth | Update shop | |
| POST | /shops/:shop_id/stock | Auth | Add stock | |
| POST | /shops/:shop_id/sales | Auth | Record sale | |
| GET | /shops/:shop_id/inventory | Auth | Get shop inventory | |
| GET | /shops/:shop_id/movements | Auth | Get stock movements | |
| GET | /shops/:shop_id/stock/history | Auth | Shop stock history | |
| GET | /shops/:shop_id/employees | Auth | List shop employees | |
| POST | /shops/:shop_id/reserve | Auth | Reserve stock | |
| POST | /shops/:shop_id/release | Auth | Release stock | |
| POST | /shops/:shop_id/orders | Auth | Create seller order | |
| GET | /shops/:shop_id/orders | Auth | List shop orders | |
| POST | /shops/:shop_id/cash-sessions/open | Auth | Open cash session | |
| GET | /shops/:shop_id/cash-sessions | Auth | List shop sessions | |
| GET | /shops/:shop_id/cash-sessions/open | Auth | Get open session | |
| GET | /shops/:shop_id/cash-summary | Auth | Shop cash summary | |
| GET | /shops/:shop_id/cash-payments | Auth | List shop payments | |

## Orders (standalone, Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /orders/:order_id | Auth | Get order | |
| POST | /orders/:order_id/accept | Auth | Accept order | |
| POST | /orders/:order_id/reject | Auth | Reject order | |
| POST | /orders/:order_id/prepare | Auth | Prepare order | |
| POST | /orders/:order_id/complete | Auth | Complete order | |
| POST | /orders/:order_id/cancel | Auth | Cancel order | |
| POST | /orders/:order_id/tracking/status | Auth | Seller tracking transition | |

## Variants (standalone, Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /variants/:variant_id | Auth | Get variant | |
| PATCH | /variants/:variant_id | Auth | Update variant | |
| GET | /variants/:variant_id/inventory | Auth | Get variant inventory | |
| GET | /variants/:variant_id/stock/history | Auth | Variant stock history | |

## Receipts (standalone, Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /receipts/:receipt_id | Auth | Get receipt | |

## Employees (standalone, Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /employees/:employee_id | Auth | Get employee | |
| PATCH | /employees/:employee_id | Auth | Update employee | |
| POST | /employees/:employee_id/shops | Auth | Assign to shop | |
| DELETE | /employees/:employee_id/shops/:shop_id | Auth | Remove from shop | |
| GET | /employees/:employee_id/shops | Auth | List employee shops | |
| GET | /employees/:employee_id/cash-sessions | Auth | List employee sessions | |

## Cash Sessions (standalone, Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /cash-sessions/:session_id | Auth | Get session | |
| POST | /cash-sessions/:session_id/close | Auth | Close session | |
| POST | /cash-sessions/:session_id/reconcile | Auth | Reconcile session | owner/admin |
| GET | /cash-sessions/:session_id/payments | Auth | Get session payments | |

## Cash Payments (Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /cash-payments/:payment_id | Auth | Get payment | |

## Payments (Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| POST | /payments/:payment_id/seller-confirm | Auth | Seller confirm payment | |

## Buyer Profile (Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| POST | /buyer/profile | Auth | Create buyer profile | |
| GET | /buyer/profile | Auth | Get buyer profile | |
| PATCH | /buyer/profile | Auth | Update buyer profile | |

## Buyer Points (Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /buyer/points | Auth | Get buyer points | |
| GET | /buyer/points/history | Auth | Get points history | |

## Buyer Purchases (Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /buyer/purchases/pending | Auth | Get pending purchases | |
| POST | /buyer/purchases/:purchase_id/confirm | Auth | Confirm purchase | |

## Buyer Orders (Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| POST | /buyer/orders/preview | Auth | Preview order totals | max points included |
| POST | /buyer/orders | Auth | Create buyer order | |
| GET | /buyer/orders | Auth | List buyer orders | |
| GET | /buyer/orders/:order_id | Auth | Get buyer order | |
| GET | /buyer/orders/:order_id/delivery-options | Auth | Get delivery options | |
| POST | /buyer/orders/:order_id/delivery | Auth | Select delivery | |
| POST | /buyer/orders/:order_id/delivery-points-preview | Auth | Delivery points preview | |
| POST | /buyer/orders/:order_id/points-preview | Auth | Order points preview | |
| POST | /buyer/orders/:order_id/payment | Auth | Create payment | |
| GET | /buyer/orders/:order_id/payment | Auth | Get payment | |
| POST | /buyer/payments/:payment_id/buyer-confirm | Auth | Buyer confirm payment | |
| POST | /buyer/orders/:order_id/cancel | Auth | Cancel buyer order | |
| POST | /buyer/orders/:order_id/received | Auth | Confirm received | |
| GET | /buyer/orders/:order_id/tracking | Auth | Get order tracking | |

## Buyer Reviews (Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /buyer/orders/:order_id/review-eligibility | Auth | Check review eligibility | |
| POST | /buyer/orders/:order_id/review | Auth | Create review | |
| PATCH | /buyer/reviews/:review_id | Auth | Update review | |
| DELETE | /buyer/reviews/:review_id | Auth | Withdraw review | |
| GET | /buyer/reviews | Auth | List buyer reviews | |

## Marketplace (Optional Auth)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /marketplace/shops | Optional | List public shops | |
| GET | /marketplace/shops/:shop_id | Optional | Get public shop | |
| GET | /marketplace/shops/:shop_id/detail | Optional | Get shop detail | |
| GET | /marketplace/shops/:shop_id/products | Optional | List shop products | |
| GET | /marketplace/products | Optional | List public products | |
| GET | /marketplace/products/:product_id | Optional | Get public product | |
| GET | /marketplace/products/:product_id/detail | Optional | Get product detail | |
| GET | /marketplace/products/:product_id/price | Optional | Get buyer price | |
| GET | /marketplace/products/:product_id/similar | Optional | Get similar products | |
| GET | /marketplace/search | Optional | Search products | |
| GET | /marketplace/categories | Optional | List categories | |
| GET | /marketplace/categories/:category_slug/subcategories | Optional | List subcategories | |
| GET | /marketplace/categories/:category_slug/products | Optional | Products by category | |
| GET | /marketplace/categories/:category_slug/shops | Optional | Top shops for category | |
| GET | /marketplace/shops/:shop_id/reviews | Optional | Shop reviews | |

## Categories (Optional Auth)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /categories | Optional | List categories | |
| GET | /categories/:category_id/subcategories | Optional | List subcategories | |

## Events (Auth required)

| Method | Path | Auth | Description | Notes |
|--------|------|------|-------------|-------|
| GET | /events/stock | Auth | Get stock events | |

---

**Total endpoints: 133**
