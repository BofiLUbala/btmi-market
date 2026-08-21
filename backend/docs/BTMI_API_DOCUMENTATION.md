# BTMI AI Market - Backend API Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Authentication & Authorization](#authentication--authorization)
4. [Business Module Documentation](#business-module-documentation)
5. [Background Working](#background-working)
6. [Redis Usage](#redis-usage)
7. [Docker Deployment](#docker-deployment)
8. [Environment Variables](#environment-variables)
9. [Error Format](#error-format)
10. [Concurrency Protection](#concurrency-protection)
11. [Security](#security)
12. [Testing](#testing)
13. [Known Limitations](#known-limitations)
14. [Audit Findings](#audit-findings)

---

## Project Overview

- **Go Module:** `github.com/btmi-ai-market/backend`
- **Go Version:** 1.25.0
- **HTTP Framework:** Gin (`github.com/gin-gonic/gin` v1.12.0)
- **Database:** PostgreSQL 16 (driver: `github.com/lib/pq`)
- **Redis:** `github.com/redis/go-redis/v9`
- **Job Queue:** Asynq (`github.com/hibiken/asynq` v0.26.0)
- **JWT:** `github.com/golang-jwt/jwt/v5`
- **UUID:** `github.com/google/uuid`
- **Password Hashing:** bcrypt (`golang.org/x/crypto`)
- **Cron:** `github.com/robfig/cron/v3`
- **Migration System:** Custom (schema_migrations table)
- **API Base Path:** `/api/v1`
- **Swagger UI:** Available at `/swagger`

---

## Architecture

```
CLIENTS (Seller App, Buyer App)
         |
      REST API (Gin)
         |
  Auth Middleware (JWT)
         |
   Service Layer
         |
   Repository Layer
         |
     PostgreSQL (source of truth)
         |
   Redis (derived/acceleration)
         |
   Asynq Worker (background jobs)
```

**Docker Services:**
- `api` — Gin HTTP server
- `postgres` — PostgreSQL 16
- `redis` — Redis 7
- `worker` — Asynq background worker

---

## Authentication & Authorization

### Registration Flow

**Endpoint:** `POST /api/v1/auth/register`

**Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "middle_name": "M",
  "phone": "+243123456789",
  "email": "john@example.com",
  "password": "securepassword",
  "password_confirmation": "securepassword"
}
```

**Validation Rules:**
- Email must be unique across all users
- Phone must be unique across all users
- Password minimum 8 characters
- Password must match password_confirmation

**Processing:**
1. Password hashed with bcrypt (default cost)
2. User status set to `PENDING_VERIFICATION`
3. Activation token created (24-hour expiry, SHA-256 hash stored in database)
4. Activation email sent (or logged in dev mode if SMTP not configured)

**Response:** `201 Created`

---

### Activation

**Endpoint:** `GET /api/v1/auth/activate?token=xxx`

**Processing:**
1. Token is single-use (checked via `used_at` field, marked on use)
2. Sets user status to `ACTIVE`
3. Sets `email_verified = true`
4. Redirects to frontend activation success page

**Response:** HTML redirect page

---

### Resend Activation

**Endpoint:** `POST /api/v1/auth/resend-activation`

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Processing:**
1. Invalidates ALL existing activation tokens for the user
2. Generates new activation token
3. Sends new activation email

**Response:** `200 OK`

---

### Login

**Endpoint:** `POST /api/v1/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Requirements:**
- User must have `ACTIVE` status
- `email_verified` must be `true`

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "opaque-refresh-token-string",
  "expires_in": 900,
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

**Token Details:**
- Access Token: JWT HS256, configurable TTL (default 15 minutes)
- Refresh Token: Opaque token, configurable TTL (default 10080 minutes / 7 days)
- Captures `user_agent` and IP address for refresh token tracking

---

### Refresh Token

**Endpoint:** `POST /api/v1/auth/refresh`

**Request Body:**
```json
{
  "refresh_token": "opaque-refresh-token-string"
}
```

**Processing (Token Rotation):**
1. Old token is revoked
2. New access token + refresh token pair is issued
3. Validates: token not revoked, not expired, user still active

**Response:** Same structure as login response

---

### Logout

**Endpoint:** `POST /api/v1/auth/logout`

**Headers:** `Authorization: Bearer <access_token>`

**Processing:**
1. Revokes the refresh token associated with the session

**Response:** `200 OK`

---

### JWT Details

| Property | Value |
|---|---|
| Algorithm | HS256 |
| Claims | `sub` (user UUID), `email`, `iat`, `exp` |
| Access Token TTL | Configurable via `ACCESS_TOKEN_TTL` (minutes), default 15 |
| Refresh Token TTL | Configurable via `REFRESH_TOKEN_TTL` (minutes), default 10080 |

---

### Middleware

**AuthMiddleware:**
- Required for protected endpoints
- Extracts Bearer token from `Authorization` header
- Validates JWT signature and expiration
- Returns `401 UNAUTHORIZED` if token is missing or invalid
- Sets `user_id` in Gin context for downstream handlers

**OptionalAuthMiddleware:**
- If token is present and valid: validates and sets `user_id` in context
- If token is absent: continues without `user_id`
- Silently ignores invalid tokens (by design)
- Used for marketplace endpoints where user authentication is optional

---

### Authorization Model

**Business Membership:**
- Required for all seller operations
- Roles: `OWNER`, `ADMIN`, `MANAGER`, `EMPLOYEE`
- Owner/Admin can manage shops, employees, and products
- Employee must be assigned to specific shop(s) via `employee_shop_assignments`

**Shop Access:**
- Owner/Admin: Access to all shops within their business
- Employee: Access only to assigned shops
- Cross-business access is strictly forbidden

**Buyer Operations:**
- Require `buyer_profile_id` linked to the authenticated user

---

## Business Module Documentation

### 1. Businesses

**Endpoints:**
- `POST /api/v1/businesses` — Create business (auto-creates OWNER membership)
- `GET /api/v1/businesses` — List user's businesses
- `GET /api/v1/businesses/:id` — Get business by ID (requires active membership)

**Tables:** `businesses`, `business_memberships`

**Membership Model:**
- When a user creates a business, they automatically become the OWNER
- Membership roles control access to shops, employees, and products
- Each membership links a user to a business with a specific role

---

### 2. Shops

**Endpoints:**
- `POST /api/v1/businesses/:business_id/shops` — Create shop (owner/admin only)
- `GET /api/v1/businesses/:business_id/shops` — List shops by business
- `GET /api/v1/shops/:id` — Get shop by ID
- `PUT /api/v1/shops/:id` — Update shop (partial update supported)

**Tables:** `shops`

**Delivery Configuration:**
| Field | Type | Description |
|---|---|---|
| `supports_shop_delivery` | boolean | Whether shop offers its own delivery |
| `shop_delivery_fee` | numeric | Fee for shop's own delivery service |
| `supports_partner_delivery` | boolean | Whether shop supports partner delivery |
| `partner_delivery_fee` | numeric | Fee for partner delivery |
| `partner_delivery_provider` | string | Name of partner delivery provider |
| `delivery_city` | string | City where delivery is available |
| `delivery_address` | string | Delivery address |

---

### 3. Employees

**Endpoints:**
- `POST /api/v1/businesses/:business_id/employees` — Create employee (owner/admin)
- `GET /api/v1/businesses/:business_id/employees` — List employees by business
- `GET /api/v1/employees/:id` — Get employee details
- `PUT /api/v1/employees/:id` — Update employee
- `POST /api/v1/employees/:id/shops` — Assign employee to shop (checks same business, no duplicates)
- `DELETE /api/v1/employees/:id/shops/:shop_id` — Remove employee from shop
- `GET /api/v1/shops/:shop_id/employees` — List employees assigned to a shop
- `GET /api/v1/employees/:id/shops` — List shops assigned to an employee

**Tables:** `employees`, `employee_shop_assignments`

**Assignment Rules:**
- Employee must belong to the same business as the shop
- Duplicate assignments are prevented
- Owner/Admin can assign employees to any shop in the business
- Employee can only access shops they are assigned to

---

### 4. Products & Variants

**Endpoints:**
- `POST /api/v1/businesses/:business_id/products` — Create product with category/subcategory
- `PUT /api/v1/products/:id` — Update product (triggers ranking + similarity background jobs)
- `GET /api/v1/businesses/:business_id/products` — List products by business
- `GET /api/v1/products/:id` — Get product by ID
- `POST /api/v1/products/:product_id/variants` — Create variant for product
- `PUT /api/v1/variants/:id` — Update variant
- `GET /api/v1/products/:product_id/variants` — List variants for a product
- `GET /api/v1/variants/:id` — Get variant by ID

**Tables:** `products`, `product_variants`

**Product Fields:**
- `name`, `description`, `sku`, `category_id`, `subcategory_id`
- `publication_status`: `DRAFT`, `PUBLISHED`, `ARCHIVED`

**Variant Fields:**
- `sku`, `name`, `attributes` (JSONB), `sale_price`, `purchase_price`, `barcode`
- Linked to parent product

**Background Triggers:**
- Product update triggers `ranking:shop_category:recalculate` job
- Product update triggers `similarity:product:recalculate` job

---

### 5. Inventory

**Endpoints:**
- `POST /api/v1/shops/:shop_id/inventory` — Add stock to shop (records `INITIAL_STOCK` or `STOCK_IN` movement)
- `POST /api/v1/shops/:shop_id/inventory/sale` — Record sale (atomic decrement, records `SALE_PHYSICAL` or `SALE_ONLINE`)
- `POST /api/v1/shops/:shop_id/inventory/reserve` — Reserve stock (for online orders)
- `POST /api/v1/shops/:shop_id/inventory/release` — Release reserved stock
- `GET /api/v1/shops/:shop_id/inventory` — Get shop inventory (with variant + product details)
- `GET /api/v1/variants/:variant_id/inventory` — Get variant inventory across all shops

**Tables:** `inventory`, `stock_movements`

**Stock Movement Types:**
| Movement Type | Description |
|---|---|
| `INITIAL` | Initial stock count |
| `STOCK_IN` | New stock received |
| `SALE_PHYSICAL` | Physical point-of-sale |
| `SALE_ONLINE` | Online order sale |
| `ADJUSTMENT` | Manual inventory adjustment |
| `RETURN` | Customer return |
| `TRANSFER_IN` | Stock transferred in from another shop |
| `TRANSFER_OUT` | Stock transferred out to another shop |
| `RESERVE` | Stock reserved for online order |
| `RELEASE` | Reserved stock released |

**Atomic Operations:**
- Stock decrement uses `UPDATE ... WHERE quantity >= X` to prevent overselling
- Stock movements record `previous_quantity` and `new_quantity` for audit trail

---

### 6. Stock Receipts

**Endpoints:**
- `POST /api/v1/shops/:shop_id/stock-receipts` — Receive stock with receipt lines

**Request Body:**
```json
{
  "supplier": "Supplier Name",
  "notes": "Monthly restock",
  "lines": [
    {
      "variant_id": "uuid",
      "quantity": 50,
      "unit_cost": 1500.00
    }
  ]
}
```

**Processing:**
1. Creates stock receipt record
2. Creates stock receipt lines for each item
3. Updates inventory per line (adds quantity)
4. Records stock movements per line (`STOCK_IN` type)

**Tables:** `stock_receipts`, `stock_receipt_lines`

---

### 7. Stock History

**Endpoints:**
- `GET /api/v1/stock-movements` — Get stock movements with filtering

**Query Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `shop_id` | UUID | Filter by shop |
| `business_id` | UUID | Filter by business |
| `variant_id` | UUID | Filter by variant |
| `product_id` | UUID | Filter by product (via variant) |
| `movement_type` | string | Filter by movement type |
| `employee_id` | UUID | Filter by performer |
| `date_from` | ISO 8601 | Start date filter |
| `date_to` | ISO 8601 | End date filter |
| `page` | integer | Page number (default 1) |
| `limit` | integer | Items per page (default 20) |

**Response Enrichment:**
- Each movement includes shop, product, variant, and performer info via SQL joins
- Paginated response with total count

---

### 8. Customers

**Endpoints:**
- `POST /api/v1/businesses/:business_id/customers` — Create customer (phone/email unique per business)
- `GET /api/v1/businesses/:business_id/customers/:id` — Get customer with order summary
- `PUT /api/v1/businesses/:business_id/customers/:id` — Update customer
- `GET /api/v1/businesses/:business_id/customers` — List business customers (paginated search)
- `GET /api/v1/businesses/:business_id/customers/:id/orders` — Get customer orders (filtered by shop, status, date range)

**Tables:** `customers`

**Uniqueness:**
- Phone number is unique within a business
- Email is unique within a business
- Customers from different businesses can share phone/email

---

### 9. Orders (Seller-Created)

**Endpoints:**
- `POST /api/v1/shops/:shop_id/orders` — Create order with lines
- `PUT /api/v1/orders/:id/accept` — Accept order
- `PUT /api/v1/orders/:id/reject` — Reject order (releases stock)
- `PUT /api/v1/orders/:id/prepare` — Mark as preparing
- `PUT /api/v1/orders/:id/complete` — Complete order (claims reserved stock, creates cash payment, finalizes points)
- `PUT /api/v1/orders/:id/cancel` — Cancel order

**Request Body (Create Order):**
```json
{
  "customer_id": "uuid",
  "lines": [
    {
      "variant_id": "uuid",
      "quantity": 2
    }
  ],
  "notes": "Customer requested gift wrap"
}
```

**Processing:**
1. Price is snapshot from variant at creation time
2. Stock is reserved (for online orders)
3. Order number generated: `BTMI-XXXXX` (auto-incremented from 1000)

**Status Flow:**
`PENDING` → `ACCEPTED` → `PREPARING` → `READY` → `COMPLETED`
(`CANCELLED` can be reached from any non-terminal status)

**Tables:** `orders`, `order_lines`, `order_status_history`

---

### 10. Orders (Buyer-Created)

**Endpoints:**
- `POST /api/v1/buyer/orders` — Create buyer order with idempotency key
- `GET /api/v1/buyer/orders/:id` — Get buyer order details
- `GET /api/v1/buyer/orders` — List buyer orders
- `POST /api/v1/buyer/orders/:id/cancel` — Cancel buyer order
- `GET /api/v1/buyer/orders/preview` — Preview order (calculate totals + max points)
- `POST /api/v1/buyer/orders/:id/select-delivery` — Select delivery method (`PICKUP`, `SHOP_DELIVERY`, `PARTNER`)
- `GET /api/v1/buyer/orders/:id/delivery-points-preview` — Delivery points preview
- `GET /api/v1/buyer/orders/:id/order-points-preview` — Order points preview
- `POST /api/v1/buyer/orders/:id/payments` — Create buyer payment
- `PUT /api/v1/buyer/orders/:id/confirm-payment` — Buyer/seller payment confirmation

**Request Body (Create Order):**
```json
{
  "shop_id": "uuid",
  "lines": [
    {
      "variant_id": "uuid",
      "quantity": 2
    }
  ],
  "idempotency_key": "unique-client-generated-key",
  "points_to_redeem": 50,
  "notes": "Leave at door"
}
```

**Processing:**
1. Price snapshot from variant at creation time
2. Optional point redemption calculated and applied
3. Idempotency key prevents duplicate orders
4. Stock reservation occurs at creation

**Idempotency:**
- `idempotency_key` is stored with UNIQUE INDEX
- Duplicate requests return the existing order instead of creating a new one

**Tables:** `orders`, `order_lines`, `order_status_history`, `buyer_payments`

---

### 11. Order Tracking State Machine

#### SHOP_DELIVERY Flow
```
PENDING → ACCEPTED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED → RECEIVED → COMPLETED
```
**Cancelation:** Any status except `COMPLETED`, `DELIVERED`, `RECEIVED`, or `OUT_FOR_DELIVERY` can transition to `CANCELLED`

#### PICKUP Flow
```
PENDING → ACCEPTED → PREPARING → READY_FOR_PICKUP → RECEIVED → COMPLETED
```
**Cancelation:** Any status except `COMPLETED`, `RECEIVED`, or `READY_FOR_PICKUP` can transition to `CANCELLED`

#### PARTNER Flow
```
PENDING → ACCEPTED → PREPARING → READY → HANDED_TO_PARTNER → DELIVERED → RECEIVED → COMPLETED
```
**Cancelation:** Any status except `COMPLETED`, `DELIVERED`, `RECEIVED`, or `HANDED_TO_PARTNER` can transition to `CANCELLED`

**Concurrency Protection:**
- Order transitions use `SELECT ... FOR UPDATE` (row-level lock)
- Prevents race conditions when multiple actors attempt simultaneous updates

**Status History:**
- Every transition is recorded in `order_status_history`
- Each record includes: `actor_type` (`SELLER`/`BUYER`/`SYSTEM`), `from_status`, `to_status`, `created_at`

**Timestamps:**
| Field | Set When |
|---|---|
| `accepted_at` | Order accepted |
| `preparing_at` | Preparation started |
| `ready_at` | Ready for pickup/delivery |
| `out_for_delivery_at` | Out for delivery |
| `delivered_at` | Delivered to customer |
| `received_at` | Customer confirmed receipt |
| `completed_at` | Order completed |

---

### 12. Cash Management

**Endpoints:**
- `POST /api/v1/shops/:shop_id/cash-sessions/open` — Open cash session (employee at shop, checks assignment)
- `POST /api/v1/shops/:shop_id/cash-sessions/:session_id/close` — Close cash session (declared amount)
- `PUT /api/v1/cash-sessions/:session_id/reconcile` — Reconcile session (owner/admin only, compares declared vs expected)
- `GET /api/v1/shops/:shop_id/cash-summary` — Get shop cash summary
- `GET /api/v1/businesses/:business_id/cash-summary` — Get business cash summary

**Tables:** `cash_sessions`, `cash_payments`

**Session Model:**
- Each session tracks: opening_amount, closing_amount, declared_amount
- Cash payments are created from completed orders
- Reconciliation compares declared_amount against expected (calculated from payments)

---

### 13. Buyer Profile

**Endpoints:**
- `POST /api/v1/buyer/profiles` — Create buyer profile
- `GET /api/v1/buyer/profiles/me` — Get current user's buyer profile
- `PUT /api/v1/buyer/profiles/me` — Update buyer profile

**Tables:** `buyer_profiles`

**Auto-Creation:**
- When a buyer profile is created, a point account is automatically created with `BRONZE` level
- Tracks verified purchases count

---

### 14. Point System

**Configuration:**
| Setting | Default | Description |
|---|---|---|
| Earn Rate | 1000 CDF = 1 point | Points earned per CDF spent |
| Redeem Rate | 1 point = 1000 CDF discount | Discount value per redeemed point |
| Max Point Coverage | 20% of order total | Maximum discount from points |
| Max Delivery Coverage | 100% of delivery fee | Maximum delivery discount from points |

**Point Accounts:**
| Field | Description |
|---|---|
| `current_points` | Available points for redemption |
| `lifetime_points` | Total points earned (never decreases) |
| `reserved_points` | Points reserved for pending orders |

**Atomic Operations:**
- `ReserveAtomic`: Atomically moves points from current to reserved
- `ReleaseAtomic`: Atomically moves points from reserved back to current
- `ConsumeAtomic`: Atomically removes points from reserved (after order completion)

**Idempotency:**
- Unique credit index on `(account, reference_type, reference_id, type=Credit)` prevents duplicate point awards

**Tables:** `point_accounts`, `point_transactions`, `point_config`

---

### 15. Buyer Levels

**Level Thresholds:**
| Level | Lifetime Points | Price Discount | Delivery Discount | Free Delivery |
|---|---|---|---|---|
| BRONZE | 0–499 | 0% | 0% | No |
| SILVER | 500–1999 | 1% | 0% | No |
| GOLD | 2000–4999 | 3% | 0% | No |
| PLATINUM | 5000–9999 | 5% | 2% | No |
| DIAMOND | 10000+ | 7% | 5% | Yes |

**Level Persistence:**
- Level is based on `lifetime_points` (never decreases)
- Level persists after point redemption
- Level is recalculated on each verified transaction

**Tables:** `buyer_levels`, `level_benefits`

---

### 16. Seller Levels

**Level Thresholds:**
| Level | Lifetime Points | Search Boost | Recommendation Eligible |
|---|---|---|---|
| STARTER | 0–499 | 0% | No |
| ACTIVE | 500–1999 | 10% | No |
| PRO | 2000–4999 | 25% | Yes |
| ELITE | 5000–9999 | 50% | Yes |
| PREMIUM | 10000+ | 100% | Yes |

**Search Boost:**
- Boost percentage increases shop ranking score in category sorted sets
- Formula: `score = seller_points * (1 + searchBoost/100)`

**Tables:** `seller_levels`, `level_benefits`

---

### 17. Seller Growth

**Endpoints:**
- `GET /api/v1/seller/growth` — Get points account, level info, trust status, benefits
- `GET /api/v1/seller/growth/points-history` — Points history with level progress

**Information Returned:**
- Current points and lifetime points
- Current seller level and next level threshold
- Trust status and metrics
- Benefits associated with current level
- Points transaction history with running totals

**Tables:** `point_accounts`, `seller_trust`

---

### 18. Seller Trust

**Trust Levels:**
| Level | Description |
|---|---|
| `HIGH` | Trusted seller |
| `NORMAL` | Default level |
| `LOW` | Below threshold metrics |
| `SUSPENDED` | Severe issues, ranking halved |

**Metrics:**
| Metric | Description |
|---|---|
| `verified_sales_count` | Total verified sales |
| `order_completion_rate` | Percentage of orders completed |
| `cancellation_rate` | Percentage of orders cancelled |
| `purchase_confirmation_rate` | Percentage of payments confirmed |
| `stock_reliability_rate` | Accuracy of stock levels |

**Recalculation Triggers:**
- On verified payments
- On refunds

**Impact:**
- LOW or SUSPENDED trust halves the shop's ranking score in category sorted sets

**Tables:** `seller_trust`

---

### 19. Marketplace

**Endpoints:**
- `GET /api/v1/marketplace/shops` — Public shop listing (by city, paginated)
- `GET /api/v1/marketplace/products` — Public product listing
- `GET /api/v1/marketplace/products/:id` — Product detail with variants + stock info
- `GET /api/v1/marketplace/shops/:id` — Shop detail with categories
- `GET /api/v1/marketplace/categories` — List all categories
- `GET /api/v1/marketplace/categories/:id` — Get category with subcategories
- `GET /api/v1/marketplace/products/:id/personalized-price` — Buyer personalized pricing (level discount)

**Categories (Seeded Data):**
1. Fashion
2. Children
3. Electronics
4. Home
5. Beauty
6. Food
7. Sport
8. Automotive
9. Services

**Tables:** `categories`, `subcategories` (seeded data)

---

### 20. Search

**Endpoint:** `GET /api/v1/marketplace/search`

**Query Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `q` | string | Search term (ILIKE across name, SKU, description) |
| `category_id` | UUID | Filter by category |
| `subcategory_id` | UUID | Filter by subcategory |
| `min_price` | numeric | Minimum price filter |
| `max_price` | numeric | Maximum price filter |
| `city` | string | Filter by city |
| `sort` | string | Sort order: `price_asc`, `price_desc`, `relevance`, `seller_level` |
| `page` | integer | Page number (default 1) |
| `limit` | integer | Items per page (default 20) |

**Search Implementation:**
- Full-text ILIKE search across product name, SKU, and description
- PostgreSQL-based (no Elasticsearch)

---

### 21. Category Ranking

**Redis Key Pattern:**
```
marketplace:category:{categoryID}:shops
```
Type: Redis Sorted Set

**Score Calculation:**
```
score = seller_points * (1 + searchBoost / 100)
```
- If trust is LOW or SUSPENDED: score is halved

**Fallback:**
- Redis-first strategy
- PostgreSQL fallback when Redis is unavailable or returns empty results

**Rebuild Triggers:**
- Startup: Full rebuild after 10-second delay
- Daily at 3 AM: Full category ranking rebuild (cron job)
- On product update: Recalculate affected categories (Asynq job)
- On verified payment: Recalculate affected categories (Asynq job)

**Tables:** `shops`, `products`, `point_accounts`, `seller_levels`, `seller_trust`

---

### 22. Similar Products

**Redis Key Pattern:**
```
marketplace:similar:product:{productID}
```
Type: Redis Sorted Set

**Algorithm Weights:**
| Factor | Weight | Description |
|---|---|---|
| Category match | 40 points | Same category bonus |
| Subcategory match | 30 points | Same subcategory bonus |
| Name similarity | 30% weight | Exact match=100, containment=80, word overlap |
| Attribute similarity | 15% weight | JSONB attribute comparison |
| Price similarity | 15% weight | Ratio-based price comparison |

**Final Score:**
```
final_score = similarity_score * 0.7 + seller_ranking_score * 0.3
```

**Rebuild Triggers:**
- Daily at 4 AM: Full product similarity rebuild (cron job)
- On product update: Recalculate similarity for affected product (Asynq job)

**Fallback:**
- PostgreSQL fallback when Redis is unavailable

**Tables:** `products`, `product_variants`, `point_accounts`, `seller_levels`

---

### 23. Buyer Payments

**Payment Model:**
- Supports CASH payment method (extensible for future methods)
- All amounts are derived from order/delivery snapshot at time of payment
- Two-party confirmation required for verification

**Confirmation Flow:**
1. Buyer confirms payment
2. Seller confirms payment
3. When both confirm: status changes to `VERIFIED`
4. Background processing triggered on verification

**Background Processing on Verification:**
1. Awards points to seller
2. Awards points to buyer
3. Creates verified transaction
4. Recalculates seller trust
5. Triggers ranking recalculation

**Tables:** `buyer_payments`

---

### 24. Verified Transactions

**Trigger:** Created when buyer payment is verified (both parties confirmed)

**Fields:**
| Field | Description |
|---|---|
| `amount` | Transaction amount |
| `currency` | Transaction currency |
| `status` | `PENDING`, `VERIFIED`, `REFUNDED` |
| `points_awarded_seller` | Whether seller points have been awarded |
| `points_awarded_buyer` | Whether buyer points have been awarded |

**Uniqueness:**
- One verified transaction per order (except when refunded)
- Enforced at database level

**Tables:** `verified_transactions`

---

### 25. Purchase Confirmations

**Endpoint:** Buyer confirms cash purchase for completed orders

**Processing:**
1. Creates purchase confirmation record
2. Creates verified transaction
3. Awards seller points
4. Awards buyer points
5. Triggers ranking recalculation

**Tables:** `purchase_confirmations`

---

### 26. Reviews

**Endpoints:**
- `POST /api/v1/reviews` — Create review (1–5 stars, max 1000 char comment)
- `PUT /api/v1/reviews/:id` — Update own active review (with history tracking)
- `DELETE /api/v1/reviews/:id` — Withdraw own review (soft delete)
- `GET /api/v1/shops/:shop_id/reviews` — Shop reviews (paginated with rating filter, sort, aggregate summary)

**Create Review Request Body:**
```json
{
  "order_id": "uuid",
  "rating": 5,
  "comment": "Excellent shop, fast delivery!"
}
```

**Eligibility Requirements:**
- Order belongs to the authenticated buyer
- Order status is `COMPLETED`
- Payment has been verified
- No existing review for this order

**Update Rules:**
- Can only update own reviews
- Only active (non-withdrawn) reviews can be updated
- Update creates a history record

**Shop Reviews Response:**
```json
{
  "reviews": [...],
  "aggregate": {
    "total_reviews": 150,
    "average_rating": 4.5,
    "rating_distribution": {
      "5": 80,
      "4": 40,
      "3": 20,
      "2": 5,
      "1": 5
    }
  }
}
```

**Background Processing:**
- On review creation/update: Recalculates shop aggregate rating
- On review creation/update: Updates seller trust metrics

**Tables:** `seller_reviews`, `review_history`, `shop_review_aggregates`

---

## Background Working

### Asynq Worker

| Property | Value |
|---|---|
| Concurrency | 10 |
| Queue | default (weight 1) |
| Process | Separate from API server |

The worker process uses the same binary as the API server but runs with a different command.

### Job Types

| Job Name | Description |
|---|---|
| `ranking:shop_category:recalculate` | Recalculate shop ranking in all eligible categories |
| `ranking:category:rebuild` | Rebuild category ranking from PostgreSQL |
| `ranking:consistency_check` | Full rebuild if consistency flag is set |
| `similarity:product:recalculate` | Recalculate similar products for a specific product |
| `similarity:product:rebuild` | Rebuild similarity for a specific product |
| `similarity:product:rebuild_all` | Rebuild all product similarities |
| `payment:process_verified` | Process verified payment (points, trust, ranking) |
| `review:aggregate:recalculate` | Recalculate shop review aggregate + seller trust |

### Periodic Cron Jobs

| Schedule | Job |
|---|---|
| Daily at 3:00 AM | Full category ranking rebuild |
| Daily at 4:00 AM | Full product similarity rebuild |

### Startup Behavior

- **API Server:** Rebuilds all category rankings after a 10-second delay on startup

---

## Redis Usage

### Key Patterns

| Key Pattern | Type | Description |
|---|---|---|
| `marketplace:category:{categoryID}:shops` | Sorted Set | Shop rankings per category |
| `marketplace:similar:product:{productID}` | Sorted Set | Similar products per product |

### Fallback Strategy

- Redis-first approach for all cached data
- Automatic PostgreSQL fallback when:
  - Redis is unavailable
  - Redis returns empty results
  - Redis operations fail

---

## Docker Deployment

### Services

| Service | Description | Port |
|---|---|---|
| `api` | Gin HTTP server | 8080 |
| `postgres` | PostgreSQL 16 Alpine | 5432 |
| `redis` | Redis 7 Alpine | 6379 |
| `worker` | Asynq background worker | — |

### Health Checks

| Service | Health Check Command |
|---|---|
| `postgres` | `pg_isready` |
| `redis` | `redis-cli ping` |

### Dependencies

- `api` depends on `postgres` + `redis` (healthy)
- `worker` depends on `postgres` + `redis` (healthy)

---

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `APP_ENV` | `development` | No | Environment name (development, production, test) |
| `API_PORT` | `8080` | No | API listen port |
| `DB_HOST` | `localhost` | Yes | PostgreSQL host |
| `DB_PORT` | `5432` | No | PostgreSQL port |
| `DB_NAME` | `btmi_market` | Yes | Database name |
| `DB_USER` | `btmi_user` | Yes | Database user |
| `DB_PASSWORD` | `btmi_secret_password` | Yes | Database password |
| `JWT_SECRET` | `dev-secret-key` | Yes | JWT signing secret |
| `ACCESS_TOKEN_TTL` | `15` | No | Access token TTL in minutes |
| `REFRESH_TOKEN_TTL` | `10080` | No | Refresh token TTL in minutes (default 7 days) |
| `FRONTEND_URL` | `http://localhost:3000` | Yes | Frontend URL for activation links |
| `REDIS_ADDR` | `redis:6379` | Yes | Redis address |
| `REDIS_PASSWORD` | (empty) | No | Redis password |
| `REDIS_DB` | `0` | No | Redis database number |
| `BACKGROUND_WORKER_ENABLED` | `false` | No | Enable periodic cron jobs |
| `SMTP_HOST` | (empty) | No | SMTP host (dev mode logs if empty) |
| `SMTP_PORT` | (empty) | No | SMTP port |
| `SMTP_USER` | (empty) | No | SMTP username |
| `SMTP_PASSWORD` | (empty) | No | SMTP password |
| `SMTP_FROM` | `noreply@btmi-market.com` | No | Sender email address |
| `MIGRATIONS_DIR` | `./migrations` | No | Migrations directory path |
| `DOCS_DIR` | `./docs` | No | Swagger docs directory path |

---

## Error Format

All API errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|---|---|---|
| 401 | `UNAUTHORIZED` | Authentication required or invalid token |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 400 | `INVALID_CREDENTIALS` | Email or password is incorrect |
| 400 | `ACCOUNT_NOT_ACTIVATED` | Account pending email verification |
| 400 | `EMAIL_ALREADY_EXISTS` | Email is already registered |
| 400 | `PHONE_ALREADY_EXISTS` | Phone number is already registered |
| 400 | `PASSWORD_CONFIRMATION_MISMATCH` | Passwords do not match |
| 400 | `PASSWORD_TOO_WEAK` | Password does not meet minimum requirements |
| 404 | `SHOP_NOT_FOUND` | Shop not found |
| 404 | `ORDER_NOT_FOUND` | Order not found |
| 400 | `INVALID_TRANSITION` | Invalid status transition for the current state |
| 400 | `INSUFFICIENT_STOCK` | Not enough stock available |
| 409 | `DUPLICATE_ORDER` | Order with this idempotency key already exists |
| 400 | `REVIEW_ALREADY_EXISTS` | Review already exists for this order |
| 400 | `ACTIVATION_LINK_INVALID` | Activation token is invalid |
| 400 | `ACTIVATION_LINK_EXPIRED` | Activation token has expired (24h limit) |
| 400 | `ACTIVATION_LINK_ALREADY_USED` | Activation token has already been used |

---

## Concurrency Protection

| Mechanism | Implementation |
|---|---|
| Order transitions | `SELECT ... FOR UPDATE` (row-level lock) |
| Stock operations | Atomic SQL: `UPDATE ... WHERE quantity >= X` |
| Point reservation | Atomic `ReserveAtomic`, `ReleaseAtomic`, `ConsumeAtomic` |
| Payment verification | Two-party confirmation (buyer + seller) |
| Review uniqueness | UNIQUE constraint on `order_id` |
| Idempotency | UNIQUE INDEX on `orders(idempotency_key) WHERE NOT NULL` |

---

## Security

| Aspect | Implementation |
|---|---|
| Passwords | bcrypt hashing (default cost) |
| Tokens | SHA-256 hashed before storage (activation, refresh) |
| JWT | HS256 with configurable secret |
| Authorization | Membership-based, employee-shop assignment |
| SQL | Parameterized queries (no raw string interpolation) |
| Cross-business isolation | Enforced at service layer |
| Sensitive data | Passwords never returned in responses |
| Audit trail | Stock movements, order status history, review history, point transactions |

---

## Testing

### Unit Tests
- No Go unit tests exist (no `*_test.go` files found in the codebase)

### E2E Test Scripts
11 manual test scripts require a running server:

| Script | Description |
|---|---|
| `test_api.sh` | General API endpoint testing |
| `test_login.sh` | Authentication flow testing |
| `test_customers.sh` | Customer management testing |
| `test_cash.sh` | Cash management testing |
| `test_orders.sh` | Order flow testing |
| `test_stock_history.sh` | Stock history and movements testing |
| `test_point3.sh` | Point system testing |
| `test_growth.sh` | Seller growth testing (bash) |
| `test_growth.ps1` | Seller growth testing (PowerShell) |
| `test_marketplace.ps1` | Marketplace endpoints testing |
| `test_order_flow.ps1` | Complete order flow testing |

**Note:** Scripts use `curl` (bash) or `Invoke-WebRequest` (PowerShell) and cannot run without a live server environment.

---

## Known Limitations

1. **No Digital Payment Integration** — Only CASH payment method supported. No mobile money, credit card, or bank transfer integration.

2. **Partner Delivery Abstracted** — No real GPS tracking or delivery partner API integration. Partner delivery is modeled but not connected to external services.

3. **No Elasticsearch** — Search uses PostgreSQL ILIKE, which may not scale well for large datasets or complex queries.

4. **No Go Unit Tests** — No `*_test.go` files exist. All testing is manual via E2E scripts.

5. **No CI/CD Pipeline** — No GitHub Actions, GitLab CI, or other CI/CD configuration found.

6. **SMTP Credentials Hardcoded** — SMTP credentials are hardcoded in `docker-compose.yml` (see Audit Findings).

7. **Incomplete Similarity Rebuild** — `getAllPublishedProducts()` in `cmd/worker/main.go` returns `nil, nil`, meaning the similarity rebuild cron job won't function.

8. **OptionalAuthMiddleware Silent Error Handling** — Invalid tokens are silently ignored by design, which may hide authentication issues in development.

9. **No Rate Limiting** — No rate limiting middleware configured on any endpoints.

10. **No API Versioning Beyond v1** — Only v1 API exists. No versioning strategy for breaking changes.

11. **No File Upload Support** — No endpoints for uploading product images, documents, or other files.

12. **No WebSocket/Real-time Push** — Uses polling for event notifications. No WebSocket or Server-Sent Events support.

---

## Audit Findings

### CRITICAL
None found.

### HIGH

1. **Hardcoded SMTP Credentials in docker-compose.yml**
   - Location: `docker-compose.yml` lines 23–24
   - SMTP username and password are hardcoded in plain text
   - Recommendation: Move to environment variables or use Docker secrets

2. **Incomplete Similarity Rebuild Implementation**
   - Location: `cmd/worker/main.go` lines 295–296
   - `getAllPublishedProducts()` returns `nil, nil`
   - Impact: Similarity rebuild cron job (daily at 4 AM) won't function
   - Recommendation: Implement the function to fetch published products

3. **Dockerfile.worker Build Issue**
   - Location: `Dockerfile.worker`
   - References `--from=builder` but has no multi-stage build definition
   - Impact: Worker container may fail to build
   - Recommendation: Add multi-stage build or fix the reference

### MEDIUM

4. **No Go Unit Tests**
   - No `*_test.go` files exist in the codebase
   - Recommendation: Add unit tests for critical business logic

5. **No Rate Limiting**
   - No rate limiting middleware configured on any endpoints
   - Recommendation: Add rate limiting to prevent abuse

6. **Hardcoded Activation Token Expiry**
   - Activation token expiry is hardcoded to 24 hours
   - Recommendation: Make configurable via environment variable

7. **Default Worker Disabled in Docker**
   - `BACKGROUND_WORKER_ENABLED=false` by default in docker-compose for API service
   - Recommendation: Enable in production environment

### LOW

8. **OptionalAuthMiddleware Silent Error Swallowing**
   - Invalid tokens are silently ignored
   - May hide authentication issues in development
   - Recommendation: Add debug logging for invalid tokens

9. **No CORS Middleware**
   - No CORS configuration found
   - Recommendation: Configure CORS for frontend integration

10. **stock_movements Migration Inconsistency**
    - `reference_type` column exists in model but not in migration 011
    - Column was added later in code
    - Recommendation: Ensure migration matches model

### INFO

11. **Swagger Documentation**
    - Swagger exists but was not fully verified against all code routes
    - Recommendation: Verify and update Swagger spec

12. **E2E Test Scripts**
    - Scripts are manual-only with no CI integration
    - Recommendation: Add to CI pipeline for automated testing

13. **Order Number Sequence**
    - Order numbers start at 1000 (BTMI-1000)
    - No configuration option to change starting number

---

*Last Updated: 2026*
*API Version: v1*
*Base URL: `/api/v1`*
*Swagger UI: `/swagger`*