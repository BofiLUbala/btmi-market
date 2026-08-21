# BTMI Market — Complete Database Schema

> **Version:** 1.0 — 24 migrations, 36 tables
> **Generated from:** Supabase migrations `001`–`024`

---

## Table of Contents

1. [Migration Timeline](#migration-timeline)
2. [Custom Types (Enums)](#custom-types-enums)
3. [Table Documentation](#table-documentation)
   - [Auth Domain](#auth-domain)
   - [Business Domain](#business-domain)
   - [Employee Domain](#employee-domain)
   - [Product Domain](#product-domain)
   - [Inventory Domain](#inventory-domain)
   - [Order Domain](#order-domain)
   - [Customer Domain](#customer-domain)
   - [Cash Domain](#cash-domain)
   - [Points & Levels Domain](#points--levels-domain)
   - [Trust Domain](#trust-domain)
   - [Marketplace Domain](#marketplace-domain)
   - [Reviews Domain](#reviews-domain)
4. [ERD Diagram](#erd-diagram)

---

## Migration Timeline

| # | Migration File | Purpose |
|---|---|---|
| 001 | `create_users` | Users table with status enum |
| 002 | `create_activation_tokens` | Account activation tokens |
| 003 | `create_refresh_tokens` | Refresh tokens for JWT rotation |
| 004 | `create_businesses` | Business entities |
| 005 | `create_business_memberships` | User → Business role memberships |
| 006 | `create_shops` | Shops under businesses |
| 007 | `create_employees` | Employee records |
| 008 | `create_employee_shop_assignments` | Employee → Shop access |
| 009 | `create_products` | Product catalog |
| 010 | `create_inventory` | Per-shop inventory |
| 011 | `create_stock_movements` | Stock movement audit log |
| 012 | `add_product_variants` | Variant system + inventory FK update |
| 013 | `add_stock_receipts` | Stock receipt + receipt lines |
| 014 | `add_orders` | Orders + order lines + status history |
| 015 | `add_stock_movements_indexes` | Additional composite index |
| 016 | `add_customers` | Customer records |
| 017 | `add_cash_tracking` | Cash sessions + cash payments |
| 018 | `add_buyer_side_points_growth` | Buyer profiles, levels, points, trust, verified transactions, purchase confirmations |
| 019 | `add_categories_and_publication` | Categories, subcategories, publication_status |
| 020 | `add_point_redemption_and_buyer_orders` | Reserved points, order price fields |
| 021 | `buyer_levels_restructure_and_config` | Buyer level restructure + point_config |
| 022 | `add_delivery_and_buyer_payments` | Delivery config + buyer_payments |
| 023 | `add_order_tracking` | Order tracking timestamps + order number |
| 024 | `add_seller_reviews` | Reviews + aggregates + history |

---

## Custom Types (Enums)

| Enum Name | Values |
|---|---|
| `user_status` | `PENDING`, `ACTIVE`, `INACTIVE`, `SUSPENDED` |
| `business_type` | `INDIVIDUAL`, `COMPANY`, `PARTNERSHIP` |
| `business_status` | `PENDING`, `ACTIVE`, `INACTIVE`, `SUSPENDED` |
| `membership_role` | `OWNER`, `ADMIN`, `MANAGER`, `STAFF` |
| `membership_status` | `PENDING`, `ACTIVE`, `INACTIVE` |
| `shop_type` | `PHYSICAL`, `ONLINE`, `BOTH` |
| `shop_status` | `ACTIVE`, `INACTIVE`, `SUSPENDED` |
| `employee_status` | `ACTIVE`, `INACTIVE`, `TERMINATED` |
| `assignment_status` | `ACTIVE`, `INACTIVE` |
| `product_status` | `ACTIVE`, `INACTIVE`, `DISCONTINUED` |
| `variant_status` | `ACTIVE`, `INACTIVE` |
| `stock_movement_type` | `IN`, `OUT`, `ADJUSTMENT`, `TRANSFER` |
| `receipt_status` | `PENDING`, `RECEIVED`, `CANCELLED` |
| `order_status` | `PENDING`, `ACCEPTED`, `PREPARING`, `READY`, `OUT_FOR_DELIVERY`, `DELIVERED`, `RECEIVED`, `COMPLETED`, `CANCELLED` |
| `cash_session_status` | `OPEN`, `CLOSED` |
| `cash_reference_type` | `ORDER`, `REFUND`, `ADJUSTMENT` |
| `cash_payment_status` | `PENDING`, `COMPLETED`, `FAILED` |
| `customer_status` | `ACTIVE`, `INACTIVE` |

---

## Table Documentation

---

### Auth Domain

---

#### 1. `users`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `first_name` | `VARCHAR(100)` | NOT NULL | | |
| `middle_name` | `VARCHAR(100)` | | `''` | |
| `last_name` | `VARCHAR(100)` | NOT NULL | | |
| `phone` | `VARCHAR(20)` | UNIQUE, NOT NULL | | Login identifier |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL | | Login identifier |
| `password_hash` | `VARCHAR(255)` | NOT NULL | | bcrypt hash |
| `status` | `user_status` | NOT NULL | `'PENDING'` | |
| `email_verified` | `BOOLEAN` | | `FALSE` | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_users_email` | `email` | UNIQUE |
| `idx_users_phone` | `phone` | UNIQUE |
| `idx_users_status` | `status` | BTREE |

---

#### 2. `account_activation_tokens`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `user_id` | `UUID` | NOT NULL, FK → `users(id)` ON DELETE CASCADE | | |
| `token_hash` | `VARCHAR(255)` | NOT NULL | | SHA-256 of token |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | | 24h from creation |
| `used_at` | `TIMESTAMPTZ` | | `NULL` | NULL = unused |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_activation_tokens_user_id` | `user_id` | BTREE |
| `idx_activation_tokens_token_hash` | `token_hash` | UNIQUE |
| `idx_activation_tokens_expires_at` | `expires_at` | BTREE |

---

#### 3. `refresh_tokens`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `user_id` | `UUID` | NOT NULL, FK → `users(id)` ON DELETE CASCADE | | |
| `token_hash` | `VARCHAR(255)` | NOT NULL | | SHA-256 of token |
| `user_agent` | `VARCHAR(500)` | | | Browser/device info |
| `ip_address` | `VARCHAR(45)` | | | IPv4 or IPv6 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | | 30d from creation |
| `revoked_at` | `TIMESTAMPTZ` | | `NULL` | NULL = active |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_refresh_tokens_user_id` | `user_id` | BTREE |
| `idx_refresh_tokens_token_hash` | `token_hash` | UNIQUE |
| `idx_refresh_tokens_expires_at` | `expires_at` | BTREE |

---

### Business Domain

---

#### 4. `businesses`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `name` | `VARCHAR(255)` | NOT NULL | | Business display name |
| `business_type` | `business_type` | NOT NULL | | |
| `category` | `VARCHAR(100)` | | | Free-text category |
| `phone` | `VARCHAR(20)` | | | |
| `whatsapp` | `VARCHAR(20)` | | | |
| `email` | `VARCHAR(255)` | | | |
| `country` | `VARCHAR(100)` | | | |
| `city` | `VARCHAR(100)` | | | |
| `default_currency` | `VARCHAR(3)` | | `'USD'` | ISO 4217 |
| `status` | `business_status` | NOT NULL | `'PENDING'` | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_businesses_name` | `name` | BTREE |
| `idx_businesses_status` | `status` | BTREE |

---

#### 5. `business_memberships`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `user_id` | `UUID` | NOT NULL, FK → `users(id)` ON DELETE CASCADE | | |
| `business_id` | `UUID` | NOT NULL, FK → `businesses(id)` ON DELETE CASCADE | | |
| `role` | `membership_role` | NOT NULL | | OWNER, ADMIN, MANAGER, STAFF |
| `status` | `membership_status` | NOT NULL | `'PENDING'` | |
| `joined_at` | `TIMESTAMPTZ` | | | When membership was accepted |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Constraints:**

| Name | Type | Columns |
|---|---|---|
| `business_memberships_user_id_business_id_key` | UNIQUE | `(user_id, business_id)` |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_memberships_user_id` | `user_id` | BTREE |
| `idx_memberships_business_id` | `business_id` | BTREE |
| `idx_memberships_role` | `role` | BTREE |
| `idx_memberships_status` | `status` | BTREE |

---

#### 6. `shops`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `business_id` | `UUID` | NOT NULL, FK → `businesses(id)` ON DELETE CASCADE | | |
| `name` | `VARCHAR(255)` | NOT NULL | | |
| `type` | `shop_type` | NOT NULL | | PHYSICAL, ONLINE, BOTH |
| `city` | `VARCHAR(100)` | | | |
| `address` | `VARCHAR(500)` | | | |
| `phone` | `VARCHAR(20)` | | | |
| `status` | `shop_status` | NOT NULL | `'ACTIVE'` | |
| `supports_shop_delivery` | `BOOLEAN` | | `FALSE` | |
| `shop_delivery_fee` | `DECIMAL(15,2)` | | `0` | |
| `supports_partner_delivery` | `BOOLEAN` | | `FALSE` | |
| `partner_delivery_fee` | `DECIMAL(15,2)` | | `0` | |
| `partner_delivery_provider` | `VARCHAR(100)` | | | e.g. "Jumia", "Local" |
| `delivery_city` | `VARCHAR(255)` | | | |
| `delivery_address` | `VARCHAR(255)` | | | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_shops_business_id` | `business_id` | BTREE |
| `idx_shops_status` | `status` | BTREE |

---

### Employee Domain

---

#### 7. `employees`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `business_id` | `UUID` | NOT NULL, FK → `businesses(id)` ON DELETE CASCADE | | |
| `linked_user_id` | `UUID` | FK → `users(id)` ON DELETE SET NULL | `NULL` | Links to app user account |
| `first_name` | `VARCHAR(100)` | NOT NULL | | |
| `middle_name` | `VARCHAR(100)` | | | |
| `last_name` | `VARCHAR(100)` | NOT NULL | | |
| `phone` | `VARCHAR(20)` | | | |
| `email` | `VARCHAR(255)` | | | |
| `job_title` | `VARCHAR(100)` | | | |
| `status` | `employee_status` | NOT NULL | `'ACTIVE'` | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_employees_business_id` | `business_id` | BTREE |
| `idx_employees_linked_user_id` | `linked_user_id` | BTREE |
| `idx_employees_status` | `status` | BTREE |

---

#### 8. `employee_shop_assignments`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `employee_id` | `UUID` | NOT NULL, FK → `employees(id)` ON DELETE CASCADE | | |
| `shop_id` | `UUID` | NOT NULL, FK → `shops(id)` ON DELETE CASCADE | | |
| `assigned_by` | `UUID` | NOT NULL, FK → `users(id)` ON DELETE CASCADE | | Admin who made assignment |
| `status` | `assignment_status` | NOT NULL | `'ACTIVE'` | |
| `assigned_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Constraints:**

| Name | Type | Columns |
|---|---|---|
| `employee_shop_assignments_employee_id_shop_id_key` | UNIQUE | `(employee_id, shop_id)` |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_assignments_employee_id` | `employee_id` | BTREE |
| `idx_assignments_shop_id` | `shop_id` | BTREE |
| `idx_assignments_status` | `status` | BTREE |

---

### Product Domain

---

#### 9. `products`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `business_id` | `UUID` | NOT NULL, FK → `businesses(id)` ON DELETE CASCADE | | |
| `name` | `VARCHAR(255)` | NOT NULL | | |
| `sku` | `VARCHAR(100)` | | | Stock-keeping unit |
| `description` | `TEXT` | | | |
| `unit_price` | `DECIMAL(15,2)` | NOT NULL | | Default selling price |
| `cost_price` | `DECIMAL(15,2)` | NOT NULL | | |
| `unit` | `VARCHAR(50)` | | `'PCS'` | PCS, KG, LTR, etc. |
| `status` | `product_status` | NOT NULL | `'ACTIVE'` | |
| `publication_status` | `VARCHAR(20)` | | `'PUBLISHED'` | PUBLISHED, DRAFT |
| `category_id` | `UUID` | FK → `categories(id)` ON DELETE SET NULL | `NULL` | |
| `subcategory_id` | `UUID` | FK → `subcategories(id)` ON DELETE SET NULL | `NULL` | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_products_business_id` | `business_id` | BTREE |
| `idx_products_sku` | `sku` | BTREE |
| `idx_products_status` | `status` | BTREE |
| `idx_products_publication_status` | `publication_status` | BTREE |
| `idx_products_category_id` | `category_id` | BTREE |
| `idx_products_subcategory_id` | `subcategory_id` | BTREE |

---

#### 10. `product_variants`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `product_id` | `UUID` | NOT NULL, FK → `products(id)` ON DELETE CASCADE | | |
| `sku` | `VARCHAR(100)` | | | Variant-level SKU |
| `name` | `VARCHAR(255)` | NOT NULL | | e.g. "Red / XL" |
| `attributes` | `JSONB` | | `'{}'` | `{"color":"red","size":"XL"}` |
| `sale_price` | `DECIMAL(15,2)` | NOT NULL | | |
| `purchase_price` | `DECIMAL(15,2)` | NOT NULL | | |
| `barcode` | `VARCHAR(100)` | | | |
| `unit` | `VARCHAR(50)` | | `'PCS'` | |
| `status` | `variant_status` | NOT NULL | `'ACTIVE'` | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_variants_product_id` | `product_id` | BTREE |
| `idx_variants_sku` | `sku` | BTREE |
| `idx_variants_barcode` | `barcode` | BTREE |
| `idx_variants_status` | `status` | BTREE |

---

### Inventory Domain

---

#### 11. `inventory`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `business_id` | `UUID` | NOT NULL, FK → `businesses(id)` ON DELETE CASCADE | | Denormalized for fast queries |
| `shop_id` | `UUID` | NOT NULL, FK → `shops(id)` ON DELETE CASCADE | | |
| `product_id` | `UUID` | NOT NULL, FK → `products(id)` ON DELETE CASCADE | | |
| `variant_id` | `UUID` | NOT NULL, FK → `product_variants(id)` ON DELETE CASCADE | | Per-variant stock |
| `quantity` | `INTEGER` | NOT NULL, CHECK (`quantity >= 0`) | `0` | Available quantity |
| `reserved_quantity` | `INTEGER` | NOT NULL, CHECK (`reserved_quantity >= 0`) | `0` | Held for pending orders |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Constraints:**

| Name | Type | Columns |
|---|---|---|
| `inventory_shop_id_variant_id_key` | UNIQUE | `(shop_id, variant_id)` |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_inventory_business_id` | `business_id` | BTREE |
| `idx_inventory_shop_id` | `shop_id` | BTREE |
| `idx_inventory_product_id` | `product_id` | BTREE |

---

#### 12. `stock_movements`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `business_id` | `UUID` | NOT NULL, FK → `businesses(id)` ON DELETE CASCADE | | |
| `shop_id` | `UUID` | NOT NULL, FK → `shops(id)` ON DELETE CASCADE | | |
| `product_id` | `UUID` | NOT NULL, FK → `products(id)` ON DELETE CASCADE | | |
| `variant_id` | `UUID` | FK → `product_variants(id)` ON DELETE SET NULL | `NULL` | |
| `movement_type` | `stock_movement_type` | NOT NULL | | IN, OUT, ADJUSTMENT, TRANSFER |
| `quantity` | `INTEGER` | NOT NULL | | Positive for IN, negative for OUT |
| `previous_quantity` | `INTEGER` | NOT NULL | | Snapshot before movement |
| `new_quantity` | `INTEGER` | NOT NULL | | Snapshot after movement |
| `reference_id` | `UUID` | | | Links to order, receipt, etc. |
| `reference_type` | `VARCHAR` | | | ORDER, RECEIVING, MANUAL, etc. |
| `notes` | `TEXT` | | | |
| `performed_by` | `UUID` | FK → `users(id)` ON DELETE SET NULL | `NULL` | |
| `employee_id` | `UUID` | FK → `employees(id)` ON DELETE SET NULL | `NULL` | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_stock_movements_business_id` | `business_id` | BTREE |
| `idx_stock_movements_shop_id` | `shop_id` | BTREE |
| `idx_stock_movements_product_id` | `product_id` | BTREE |
| `idx_stock_movements_movement_type` | `movement_type` | BTREE |
| `idx_stock_movements_created_at` | `created_at` | BTREE |
| `idx_stock_movements_variant_id_created_at` | `(variant_id, created_at)` | COMPOSITE |

---

#### 13. `stock_receipts`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `business_id` | `UUID` | NOT NULL, FK → `businesses(id)` ON DELETE CASCADE | | |
| `shop_id` | `UUID` | NOT NULL, FK → `shops(id)` ON DELETE CASCADE | | |
| `received_by` | `UUID` | FK → `users(id)` ON DELETE SET NULL | `NULL` | |
| `reference_number` | `VARCHAR(100)` | | | External reference |
| `notes` | `TEXT` | | | |
| `status` | `receipt_status` | NOT NULL | `'PENDING'` | |
| `received_at` | `TIMESTAMPTZ` | | | When goods physically arrived |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_receipts_business_id` | `business_id` | BTREE |
| `idx_receipts_shop_id` | `shop_id` | BTREE |
| `idx_receipts_status` | `status` | BTREE |

---

#### 14. `stock_receipt_lines`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `receipt_id` | `UUID` | NOT NULL, FK → `stock_receipts(id)` ON DELETE CASCADE | | |
| `variant_id` | `UUID` | NOT NULL, FK → `product_variants(id)` ON DELETE CASCADE | | |
| `quantity` | `INTEGER` | NOT NULL, CHECK (`quantity > 0`) | | |
| `unit_cost` | `DECIMAL(15,2)` | NOT NULL | | |
| `notes` | `TEXT` | | | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_receipt_lines_receipt_id` | `receipt_id` | BTREE |
| `idx_receipt_lines_variant_id` | `variant_id` | BTREE |

---

### Order Domain

---

#### 15. `orders`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `business_id` | `UUID` | NOT NULL, FK → `businesses(id)` ON DELETE CASCADE | | |
| `shop_id` | `UUID` | NOT NULL, FK → `shops(id)` ON DELETE CASCADE | | |
| `customer_id` | `UUID` | FK → `customers(id)` ON DELETE SET NULL | `NULL` | |
| `buyer_profile_id` | `UUID` | | `NULL` | Buyer-side identity |
| `status` | `order_status` | NOT NULL | `'PENDING'` | |
| `total_items` | `INTEGER` | NOT NULL | | Sum of line quantities |
| `notes` | `TEXT` | | | |
| `created_by` | `UUID` | NOT NULL, FK → `users(id)` | | Employee who created it |
| `base_total` | `DECIMAL(15,2)` | | `0` | Sum of base_unit_price × qty |
| `points_used` | `INTEGER` | | `0` | Points redeemed on order |
| `points_discount_amount` | `DECIMAL(15,2)` | | `0` | Dollar value of points used |
| `final_total` | `DECIMAL(15,2)` | | `0` | base_total − points_discount + delivery |
| `idempotency_key` | `VARCHAR(255)` | UNIQUE WHERE NOT NULL | `NULL` | Prevents duplicate orders |
| `order_number` | `VARCHAR(20)` | UNIQUE WHERE NOT NULL | `NULL` | Human-readable order ID |
| `delivery_method` | `VARCHAR(20)` | | `NULL` | PICKUP, SHOP_DELIVERY, PARTNER_DELIVERY |
| `delivery_fee_base` | `DECIMAL(15,2)` | | `0` | |
| `delivery_points_used` | `INTEGER` | | `0` | |
| `delivery_points_discount` | `DECIMAL(15,2)` | | `0` | |
| `delivery_fee_final` | `DECIMAL(15,2)` | | `0` | |
| `delivery_contact_name` | `VARCHAR(255)` | | | |
| `delivery_phone` | `VARCHAR(50)` | | | |
| `delivery_address` | `VARCHAR(500)` | | | |
| `delivery_notes` | `TEXT` | | | |
| `points_finalized` | `BOOLEAN` | | `FALSE` | Whether points have been awarded |
| `accepted_at` | `TIMESTAMPTZ` | | | |
| `preparing_at` | `TIMESTAMPTZ` | | | |
| `ready_at` | `TIMESTAMPTZ` | | | |
| `out_for_delivery_at` | `TIMESTAMPTZ` | | | |
| `delivered_at` | `TIMESTAMPTZ` | | | |
| `received_at` | `TIMESTAMPTZ` | | | |
| `completed_at` | `TIMESTAMPTZ` | | | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_orders_business_id` | `business_id` | BTREE |
| `idx_orders_shop_id` | `shop_id` | BTREE |
| `idx_orders_status` | `status` | BTREE |
| `idx_orders_created_at` | `created_at` | BTREE |
| `idx_orders_customer_id` | `customer_id` | BTREE |
| `idx_orders_buyer_profile_id` | `buyer_profile_id` | BTREE |
| `idx_orders_idempotency_key` | `idempotency_key` | PARTIAL (WHERE NOT NULL) |
| `idx_orders_order_number` | `order_number` | PARTIAL (WHERE NOT NULL) |

---

#### 16. `order_lines`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `order_id` | `UUID` | NOT NULL, FK → `orders(id)` ON DELETE CASCADE | | |
| `product_id` | `UUID` | NOT NULL, FK → `products(id)` ON DELETE CASCADE | | |
| `variant_id` | `UUID` | NOT NULL, FK → `product_variants(id)` ON DELETE CASCADE | | |
| `quantity` | `INTEGER` | NOT NULL, CHECK (`quantity > 0`) | | |
| `unit_price` | `DECIMAL(15,2)` | NOT NULL | | Price at time of order |
| `base_unit_price` | `DECIMAL(15,2)` | | `0` | Original price before discounts |
| `points_discount_per_unit` | `DECIMAL(15,2)` | | `0` | Points discount applied per unit |
| `final_unit_price` | `DECIMAL(15,2)` | | `0` | base_unit_price − points_discount |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_order_lines_order_id` | `order_id` | BTREE |
| `idx_order_lines_product_id` | `product_id` | BTREE |
| `idx_order_lines_variant_id` | `variant_id` | BTREE |

---

#### 17. `order_status_history`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `order_id` | `UUID` | NOT NULL, FK → `orders(id)` ON DELETE CASCADE | | |
| `status` | `order_status` | NOT NULL | | New status being recorded |
| `changed_by` | `UUID` | NOT NULL, FK → `users(id)` | | |
| `notes` | `TEXT` | | | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_order_status_history_order_id` | `order_id` | BTREE |

---

### Customer Domain

---

#### 18. `customers`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `business_id` | `UUID` | NOT NULL, FK → `businesses(id)` ON DELETE CASCADE | | |
| `first_name` | `VARCHAR(100)` | NOT NULL | | |
| `last_name` | `VARCHAR(100)` | NOT NULL | | |
| `phone` | `VARCHAR(50)` | | | |
| `email` | `VARCHAR(255)` | | | |
| `status` | `customer_status` | NOT NULL | `'ACTIVE'` | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Constraints:**

| Name | Type | Columns | Condition |
|---|---|---|---|
| `customers_business_id_phone_key` | UNIQUE | `(business_id, phone)` | WHERE `phone IS NOT NULL AND phone != ''` |
| `customers_business_id_email_key` | UNIQUE | `(business_id, email)` | WHERE `email IS NOT NULL AND email != ''` |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_customers_business_id` | `business_id` | BTREE |
| `idx_customers_phone` | `phone` | BTREE |
| `idx_customers_email` | `email` | BTREE |

---

### Cash Domain

---

#### 19. `cash_sessions`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `business_id` | `UUID` | NOT NULL, FK → `businesses(id)` | | |
| `shop_id` | `UUID` | NOT NULL, FK → `shops(id)` | | |
| `employee_id` | `UUID` | NOT NULL, FK → `employees(id)` | | Cashier |
| `opened_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `closed_at` | `TIMESTAMPTZ` | | `NULL` | NULL = still open |
| `opening_amount` | `DECIMAL(12,2)` | NOT NULL | | Float in drawer |
| `currency` | `VARCHAR(3)` | | `'USD'` | |
| `cash_sales_total` | `DECIMAL(12,2)` | | | Calculated at close |
| `expected_amount` | `DECIMAL(12,2)` | | | opening + sales |
| `declared_closing_amount` | `DECIMAL(12,2)` | | | What cashier counts |
| `difference` | `DECIMAL(12,2)` | | | declared − expected |
| `reconciliation_result` | `VARCHAR(20)` | | | BALANCED, OVER, SHORT |
| `status` | `cash_session_status` | NOT NULL | `'OPEN'` | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_cash_sessions_business` | `business_id` | BTREE |
| `idx_cash_sessions_shop` | `shop_id` | BTREE |
| `idx_cash_sessions_employee` | `employee_id` | BTREE |
| `idx_cash_sessions_status` | `status` | BTREE |
| `idx_cash_sessions_shop_status` | `(shop_id, status)` | COMPOSITE |

---

#### 20. `cash_payments`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `business_id` | `UUID` | NOT NULL, FK → `businesses(id)` | | |
| `shop_id` | `UUID` | NOT NULL, FK → `shops(id)` | | |
| `employee_id` | `UUID` | NOT NULL, FK → `employees(id)` | | |
| `customer_id` | `UUID` | FK → `customers(id)` | `NULL` | |
| `cash_session_id` | `UUID` | NOT NULL, FK → `cash_sessions(id)` | | |
| `reference_type` | `cash_reference_type` | NOT NULL | | ORDER, REFUND, ADJUSTMENT |
| `reference_id` | `UUID` | NOT NULL | | FK to orders, etc. |
| `amount` | `DECIMAL(12,2)` | NOT NULL | | |
| `currency` | `VARCHAR(3)` | | `'USD'` | |
| `status` | `cash_payment_status` | NOT NULL | `'PENDING'` | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_cash_payments_business` | `business_id` | BTREE |
| `idx_cash_payments_shop` | `shop_id` | BTREE |
| `idx_cash_payments_employee` | `employee_id` | BTREE |
| `idx_cash_payments_session` | `cash_session_id` | BTREE |
| `idx_cash_payments_reference` | `(reference_type, reference_id)` | COMPOSITE |
| `idx_cash_payments_status` | `status` | BTREE |
| `idx_cash_payments_created` | `created_at` | BTREE |

---

### Points & Levels Domain

---

#### 21. `buyer_profiles`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `user_id` | `UUID` | UNIQUE, NOT NULL, FK → `users(id)` | | One profile per user |
| `first_name` | `VARCHAR(255)` | | | |
| `last_name` | `VARCHAR(255)` | | | |
| `phone` | `VARCHAR(50)` | | | |
| `email` | `VARCHAR(255)` | | | |
| `city` | `VARCHAR(255)` | | | |
| `commune` | `VARCHAR(255)` | | | |
| `status` | `VARCHAR(50)` | | `'ACTIVE'` | |
| `created_at` | `TIMESTAMP` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMP` | NOT NULL | `NOW()` | |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_buyer_profiles_user_id` | `user_id` | UNIQUE |

---

#### 22. `seller_levels`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `name` | `VARCHAR(50)` | UNIQUE, NOT NULL | | |
| `min_points` | `INTEGER` | NOT NULL | | |
| `max_points` | `INTEGER` | NOT NULL | | |
| `search_boost` | `DECIMAL(5,2)` | NOT NULL | | Ranking multiplier |
| `recommendation_eligible` | `BOOLEAN` | NOT NULL | | |
| `high_value_buyer_access` | `BOOLEAN` | NOT NULL | | |
| `description` | `TEXT` | | | |
| `created_at` | `TIMESTAMP` | NOT NULL | `NOW()` | |

**Seeded Data:**

| Name | Min Points | Max Points | Search Boost | Recommendation | High-Value Access |
|---|---|---|---|---|---|
| STARTER | 0 | 499 | 1.00 | FALSE | FALSE |
| ACTIVE | 500 | 1999 | 1.25 | TRUE | FALSE |
| PRO | 2000 | 4999 | 1.50 | TRUE | TRUE |
| ELITE | 5000 | 9999 | 2.00 | TRUE | TRUE |
| PREMIUM | 10000 | 999999 | 3.00 | TRUE | TRUE |

---

#### 23. `buyer_levels`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `name` | `VARCHAR(50)` | UNIQUE, NOT NULL | | |
| `min_points` | `INTEGER` | NOT NULL | | |
| `max_points` | `INTEGER` | NOT NULL | | |
| `discount_percent` | `DECIMAL(5,2)` | NOT NULL | | Product discount |
| `delivery_discount_percent` | `DECIMAL(5,2)` | NOT NULL | | Delivery discount |
| `free_delivery` | `BOOLEAN` | NOT NULL | | |
| `description` | `TEXT` | | | |
| `created_at` | `TIMESTAMP` | NOT NULL | `NOW()` | |

**Seeded Data (restructured in migration 021):**

| Name | Min Points | Max Points | Discount % | Delivery Discount % | Free Delivery |
|---|---|---|---|---|---|
| BRONZE | 0 | 499 | 0.00 | 0.00 | FALSE |
| SILVER | 500 | 1999 | 2.00 | 5.00 | FALSE |
| GOLD | 2000 | 4999 | 5.00 | 10.00 | FALSE |
| PLATINUM | 5000 | 9999 | 10.00 | 20.00 | TRUE |
| DIAMOND | 10000 | 999999 | 15.00 | 30.00 | TRUE |

---

#### 24. `level_benefits`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `level_type` | `VARCHAR(20)` | NOT NULL | | `BUYER` or `SELLER` |
| `level_name` | `VARCHAR(50)` | NOT NULL | | References buyer_levels.name or seller_levels.name |
| `benefit_type` | `VARCHAR(100)` | NOT NULL | | e.g. DISCOUNT, FREE_DELIVERY |
| `benefit_value` | `DECIMAL(10,2)` | NOT NULL | | Numeric value |
| `status` | `VARCHAR(20)` | | `'ACTIVE'` | |
| `created_at` | `TIMESTAMP` | NOT NULL | `NOW()` | |

**Constraints:**

| Name | Type | Columns |
|---|---|---|
| `level_benefits_level_type_level_name_benefit_type_key` | UNIQUE | `(level_type, level_name, benefit_type)` |

---

#### 25. `point_accounts`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `owner_type` | `VARCHAR(20)` | NOT NULL | | `BUYER` or `SELLER` |
| `owner_id` | `UUID` | NOT NULL | | buyer_profiles.id or businesses.id |
| `current_points` | `INTEGER` | | `0` | Spendable balance |
| `lifetime_points` | `INTEGER` | | `0` | Total ever earned |
| `reserved_points` | `INTEGER` | | `0` | Held for pending orders |
| `level_id` | `UUID` | FK → `buyer_levels(id)` or `seller_levels(id)` | `NULL` | |
| `status` | `VARCHAR(20)` | | `'ACTIVE'` | |
| `created_at` | `TIMESTAMP` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMP` | NOT NULL | `NOW()` | |

**Constraints:**

| Name | Type | Columns |
|---|---|---|
| `point_accounts_owner_type_owner_id_key` | UNIQUE | `(owner_type, owner_id)` |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_point_accounts_owner` | `(owner_type, owner_id)` | COMPOSITE |

---

#### 26. `point_transactions`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `point_account_id` | `UUID` | NOT NULL, FK → `point_accounts(id)` | | |
| `reference_type` | `VARCHAR(50)` | NOT NULL | | ORDER, ADJUSTMENT, PROMOTION |
| `reference_id` | `UUID` | NOT NULL | | FK to referenced entity |
| `type` | `VARCHAR(20)` | NOT NULL | | CREDIT or DEBIT |
| `points_change` | `INTEGER` | NOT NULL | | Positive = credit, negative = debit |
| `previous_points` | `INTEGER` | NOT NULL | | Balance before |
| `new_points` | `INTEGER` | NOT NULL | | Balance after |
| `created_at` | `TIMESTAMP` | NOT NULL | `NOW()` | |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_point_transactions_account` | `point_account_id` | BTREE |
| `idx_point_transactions_reference` | `(reference_type, reference_id)` | COMPOSITE |

**Unique Index (dedup):**

| Name | Columns | Condition |
|---|---|---|
| `uniq_point_credit_per_reference` | `(point_account_id, reference_type, reference_id, type)` | WHERE `type = 'CREDIT'` |

---

#### 27. `point_config`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `key` | `VARCHAR(100)` | PRIMARY KEY | | |
| `value` | `DECIMAL(15,4)` | NOT NULL | | |
| `description` | `TEXT` | | | |
| `updated_at` | `TIMESTAMP` | NOT NULL | `NOW()` | |

**Seeded Data:**

| Key | Value | Description |
|---|---|---|
| `earn_rate` | 1000.0000 | Points earned per currency unit spent |
| `redeem_rate` | 1000.0000 | Points required per currency unit discount |
| `max_point_coverage` | 20.0000 | Max % of order total payable with points |
| `max_delivery_point_coverage` | 100.0000 | Max % of delivery fee payable with points |

---

### Trust Domain

---

#### 28. `seller_trust`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `business_id` | `UUID` | UNIQUE, NOT NULL, FK → `businesses(id)` | | One trust record per business |
| `trust_status` | `VARCHAR(20)` | | `'NORMAL'` | NORMAL, PROBATION, SUSPENDED |
| `verified_sales_count` | `INTEGER` | | `0` | |
| `order_completion_rate` | `DECIMAL(5,2)` | | `100.00` | Percentage |
| `cancellation_rate` | `DECIMAL(5,2)` | | `0.00` | Percentage |
| `purchase_confirmation_rate` | `DECIMAL(5,2)` | | `0.00` | Percentage |
| `stock_reliability_rate` | `DECIMAL(5,2)` | | `100.00` | Percentage |
| `last_calculated_at` | `TIMESTAMP` | | | |
| `created_at` | `TIMESTAMP` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMP` | NOT NULL | `NOW()` | |

---

#### 29. `verified_transactions`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `order_id` | `UUID` | NOT NULL, FK → `orders(id)` | | |
| `business_id` | `UUID` | NOT NULL, FK → `businesses(id)` | | |
| `buyer_profile_id` | `UUID` | NOT NULL, FK → `buyer_profiles(id)` | | |
| `shop_id` | `UUID` | NOT NULL, FK → `shops(id)` | | |
| `amount` | `DECIMAL(12,2)` | NOT NULL | | |
| `currency` | `VARCHAR(10)` | | `'CDF'` | |
| `status` | `VARCHAR(20)` | | `'PENDING'` | PENDING, VERIFIED, REFUNDED |
| `verified_at` | `TIMESTAMP` | | | |
| `refunded_at` | `TIMESTAMP` | | | |
| `points_awarded_seller` | `BOOLEAN` | | `FALSE` | |
| `points_awarded_buyer` | `BOOLEAN` | | `FALSE` | |
| `created_at` | `TIMESTAMP` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMP` | NOT NULL | `NOW()` | |

**Unique Index:**

| Name | Columns | Condition |
|---|---|---|
| `uniq_verified_transaction_per_order` | `(order_id)` | WHERE `status != 'REFUNDED'` |

---

#### 30. `purchase_confirmations`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `order_id` | `UUID` | NOT NULL, FK → `orders(id)` | | |
| `buyer_profile_id` | `UUID` | NOT NULL, FK → `buyer_profiles(id)` | | |
| `cash_payment_id` | `UUID` | FK → `cash_payments(id)` | `NULL` | Optional link to cash payment |
| `confirmed_at` | `TIMESTAMP` | NOT NULL | `NOW()` | |
| `created_at` | `TIMESTAMP` | NOT NULL | `NOW()` | |

**Constraints:**

| Name | Type | Columns |
|---|---|---|
| `purchase_confirmations_order_id_buyer_profile_id_key` | UNIQUE | `(order_id, buyer_profile_id)` |

---

### Marketplace Domain

---

#### 31. `categories`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `name` | `VARCHAR(100)` | NOT NULL | | |
| `slug` | `VARCHAR(100)` | UNIQUE, NOT NULL | | URL-friendly identifier |
| `status` | `VARCHAR(20)` | | `'ACTIVE'` | |
| `sort_order` | `INTEGER` | NOT NULL | | Display ordering |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Seeded Data:**

| Name | Slug | Sort Order |
|---|---|---|
| Fashion | `fashion` | 1 |
| Children | `children` | 2 |
| Electronics | `electronics` | 3 |
| Home | `home` | 4 |
| Beauty | `beauty` | 5 |
| Food | `food` | 6 |
| Sport | `sport` | 7 |
| Automotive | `automotive` | 8 |
| Services | `services` | 9 |

---

#### 32. `subcategories`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `category_id` | `UUID` | NOT NULL, FK → `categories(id)` ON DELETE CASCADE | | |
| `name` | `VARCHAR(100)` | NOT NULL | | |
| `slug` | `VARCHAR(100)` | NOT NULL | | |
| `status` | `VARCHAR(20)` | | `'ACTIVE'` | |
| `sort_order` | `INTEGER` | NOT NULL | | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Constraints:**

| Name | Type | Columns |
|---|---|---|
| `subcategories_category_id_slug_key` | UNIQUE | `(category_id, slug)` |

---

### Reviews Domain

---

#### 33. `buyer_payments`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `order_id` | `UUID` | UNIQUE, NOT NULL, FK → `orders(id)` | | One payment record per order |
| `business_id` | `UUID` | NOT NULL, FK → `businesses(id)` | | |
| `shop_id` | `UUID` | NOT NULL, FK → `shops(id)` | | |
| `buyer_profile_id` | `UUID` | NOT NULL, FK → `buyer_profiles(id)` | | |
| `payment_method` | `VARCHAR(20)` | | `'CASH'` | |
| `currency` | `VARCHAR(10)` | | `'CDF'` | |
| `products_base_total` | `DECIMAL(15,2)` | | | |
| `products_points_used` | `INTEGER` | | | |
| `products_points_discount` | `DECIMAL(15,2)` | | | |
| `products_final_total` | `DECIMAL(15,2)` | | | |
| `delivery_fee_base` | `DECIMAL(15,2)` | | | |
| `delivery_points_used` | `INTEGER` | | | |
| `delivery_points_discount` | `DECIMAL(15,2)` | | | |
| `delivery_fee_final` | `DECIMAL(15,2)` | | | |
| `cash_due` | `DECIMAL(15,2)` | | | Final amount to pay in cash |
| `buyer_confirmed` | `BOOLEAN` | | `FALSE` | |
| `buyer_confirmed_at` | `TIMESTAMPTZ` | | | |
| `seller_confirmed` | `BOOLEAN` | | `FALSE` | |
| `seller_confirmed_by` | `UUID` | FK → `users(id)` | `NULL` | |
| `seller_confirmed_at` | `TIMESTAMPTZ` | | | |
| `status` | `VARCHAR(20)` | | `'PENDING'` | PENDING, CONFIRMED, DISPUTED |
| `verified_at` | `TIMESTAMPTZ` | | | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

---

#### 34. `seller_reviews`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `order_id` | `UUID` | UNIQUE, NOT NULL, FK → `orders(id)` | | One review per order |
| `buyer_profile_id` | `UUID` | NOT NULL, FK → `buyer_profiles(id)` | | |
| `business_id` | `UUID` | NOT NULL, FK → `businesses(id)` | | Seller being reviewed |
| `shop_id` | `UUID` | NOT NULL, FK → `shops(id)` | | |
| `rating` | `SMALLINT` | NOT NULL, CHECK (`rating >= 1 AND rating <= 5`) | | 1–5 stars |
| `comment` | `TEXT` | | | |
| `verified_purchase` | `BOOLEAN` | | `true` | Always true for real orders |
| `status` | `VARCHAR(20)` | | `'ACTIVE'` | ACTIVE, HIDDEN, DELETED |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

**Indexes:**

| Index Name | Columns | Type |
|---|---|---|
| `idx_seller_reviews_shop_id` | `shop_id` | BTREE |

---

#### 35. `review_history`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | `gen_random_uuid()` | |
| `review_id` | `UUID` | NOT NULL, FK → `seller_reviews(id)` ON DELETE CASCADE | | |
| `old_rating` | `SMALLINT` | | | Previous rating |
| `new_rating` | `SMALLINT` | | | Updated rating |
| `old_comment` | `TEXT` | | | Previous comment |
| `new_comment` | `TEXT` | | | Updated comment |
| `changed_by` | `UUID` | NOT NULL | | User who made the edit |
| `changed_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

---

#### 36. `shop_review_aggregates`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `shop_id` | `UUID` | PRIMARY KEY, FK → `shops(id`) | | One row per shop |
| `average_rating` | `DECIMAL(3,2)` | | | Weighted average |
| `total_reviews` | `INTEGER` | | `0` | |
| `rating_1_count` | `INTEGER` | | `0` | |
| `rating_2_count` | `INTEGER` | | `0` | |
| `rating_3_count` | `INTEGER` | | `0` | |
| `rating_4_count` | `INTEGER` | | `0` | |
| `rating_5_count` | `INTEGER` | | `0` | |
| `last_reviewed_at` | `TIMESTAMPTZ` | | | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | |

---

## ERD Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    BTMI MARKET ERD                                  │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────── AUTH DOMAIN ───────────┐
│                                   │
│  ┌──────────┐    1:N   ┌──────────────────────────┐    1:N   ┌──────────────────┐
│  │  users   │─────────▶│  account_activation_tokens │          │  refresh_tokens  │
│  │──────────│          └──────────────────────────┘          └──────────────────┘
│  │ id (PK)  │◀──────────────────────────────────────────────────────────────────────┘
│  │ phone    │
│  │ email    │
│  │ status   │
│  └──────────┘
│       │
│       │ 1:N
│       ▼
└───────────┬─────────────────────────────────────────────────────────────────────────┘
            │
┌───────────▼──────── BUSINESS DOMAIN ────────────────────────────────────────────────┐
│                                                                                     │
│  ┌──────────────────────┐    N:1    ┌──────────────┐                               │
│  │  business_memberships │──────────▶│  businesses  │                               │
│  │──────────────────────│           │──────────────│                               │
│  │ id (PK)              │           │ id (PK)      │                               │
│  │ user_id (FK→users)   │           │ name         │                               │
│  │ business_id (FK)     │           │ status       │                               │
│  │ role                 │           └──────┬───────┘                               │
│  └──────────────────────┘                  │                                        │
│                                            │ 1:N                                   │
│                              ┌─────────────┼─────────────┐                         │
│                              ▼             ▼             ▼                         │
│                    ┌──────────┐  ┌──────────┐  ┌──────────────┐                   │
│                    │  shops   │  │ products │  │  employees   │                   │
│                    │──────────│  │──────────│  │──────────────│                   │
│                    │ id (PK)  │  │ id (PK)  │  │ id (PK)      │                   │
│                    │ biz_id   │  │ biz_id   │  │ biz_id       │                   │
│                    │ name     │  │ name     │  │ linked_user  │                   │
│                    │ status   │  │ sku      │  │ first_name   │                   │
│                    └──────────┘  │ cat_id   │  │ status       │                   │
│                                  │ sub_id   │  └──────┬───────┘                   │
│                                  └────┬─────┘         │ 1:N                       │
│                                       │               ▼                           │
│                                       │     ┌──────────────────────────┐          │
│                                       │     │ employee_shop_assignments │          │
│                                       │     │──────────────────────────│          │
│                                       │     │ id (PK)                  │          │
│                                       │     │ employee_id (FK)         │          │
│                                       │     │ shop_id (FK)             │          │
│                                       │     └──────────────────────────┘          │
│                                       ▼                                           │
└───────────────────────────────────────┬───────────────────────────────────────────┘
                                        │
┌──────────── PRODUCT DOMAIN ───────────▼────────────────────────────────────────────┐
│                                                                                     │
│  ┌──────────────┐    1:N   ┌──────────────────┐                                    │
│  │   products   │─────────▶│ product_variants  │                                    │
│  │──────────────│          │──────────────────│                                    │
│  │ id (PK)      │          │ id (PK)          │                                    │
│  │ business_id  │          │ product_id (FK)  │                                    │
│  │ name         │          │ sku              │                                    │
│  │ sku          │          │ attributes (JSON)│                                    │
│  │ unit_price   │          │ sale_price       │                                    │
│  │ category_id  │          │ barcode          │                                    │
│  │ subcategory_id│         └────────┬─────────┘                                    │
│  └──────────────┘                  │ 1:N                                           │
│                                    ▼                                               │
│                          ┌──────────────────┐                                      │
│                          │    inventory     │                                      │
│                          │──────────────────│                                      │
│                          │ id (PK)          │                                      │
│                          │ shop_id (FK)     │                                      │
│                          │ variant_id (FK)  │                                      │
│                          │ quantity         │                                      │
│                          │ reserved_quantity│                                      │
│                          └──────────────────┘                                      │
│                                    │ 1:N                                           │
│                                    ▼                                               │
│                          ┌──────────────────┐                                      │
│                          │ stock_movements  │                                      │
│                          │──────────────────│                                      │
│                          │ id (PK)          │                                      │
│                          │ shop_id (FK)     │                                      │
│                          │ variant_id (FK)  │                                      │
│                          │ movement_type    │                                      │
│                          │ quantity         │                                      │
│                          │ previous_quantity│                                      │
│                          │ new_quantity     │                                      │
│                          │ reference_type   │                                      │
│                          │ reference_id     │                                      │
│                          └──────────────────┘                                      │
│                                                                                     │
│  ┌────────────────┐   1:N   ┌─────────────────────┐                               │
│  │ stock_receipts │────────▶│ stock_receipt_lines  │                               │
│  │────────────────│         │─────────────────────│                               │
│  │ id (PK)        │         │ id (PK)              │                               │
│  │ shop_id (FK)   │         │ receipt_id (FK)      │                               │
│  │ received_by    │         │ variant_id (FK)      │                               │
│  │ status         │         │ quantity             │                               │
│  └────────────────┘         │ unit_cost            │                               │
│                             └─────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────── ORDER DOMAIN ──────────────────────────────────────────────────────────┐
│                                                                                     │
│  ┌──────────┐    1:N   ┌──────────┐                                               │
│  │  shops   │─────────▶│  orders  │                                               │
│  └──────────┘          │──────────│                                               │
│                        │ id (PK)  │                                               │
│                        │ shop_id  │                                               │
│                        │ status   │                                               │
│                        └────┬─────┘                                               │
│                             │                                                      │
│               ┌─────────────┼──────────────┬──────────────┐                       │
│               ▼             ▼              ▼              ▼                       │
│     ┌──────────────┐ ┌────────────────┐ ┌───────────────┐ ┌─────────────────┐     │
│     │ order_lines  │ │order_status_   │ │  customers    │ │  buyer_payments │     │
│     │──────────────│ │  history       │ │──────────────│ │─────────────────│     │
│     │ id (PK)      │ │────────────────│ │ id (PK)      │ │ id (PK)         │     │
│     │ order_id(FK) │ │ id (PK)        │ │ business_id  │ │ order_id (FK)   │     │
│     │ product_id   │ │ order_id (FK)  │ │ first_name   │ │ buyer_profile_id│     │
│     │ variant_id   │ │ status         │ │ last_name    │ │ cash_due        │     │
│     │ quantity     │ │ changed_by     │ │ phone        │ │ status          │     │
│     │ unit_price   │ │ created_at     │ │ status       │ └─────────────────┘     │
│     └──────────────┘ └────────────────┘ └──────────────┘                           │
│                                                                                     │
│  Order tracking timestamps on orders table:                                         │
│  accepted_at → preparing_at → ready_at → out_for_delivery_at →                     │
│  delivered_at → received_at → completed_at                                          │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────── CASH DOMAIN ───────────────────────────────────────────────────────────┐
│                                                                                     │
│  ┌───────────────┐   1:N   ┌────────────────┐                                     │
│  │ cash_sessions │────────▶│  cash_payments  │                                     │
│  │───────────────│         │────────────────│                                     │
│  │ id (PK)       │         │ id (PK)        │                                     │
│  │ shop_id (FK)  │         │ session_id(FK) │                                     │
│  │ employee_id   │         │ reference_type │                                     │
│  │ opening_amount│         │ reference_id   │                                     │
│  │ status        │         │ amount         │                                     │
│  └───────────────┘         │ status         │                                     │
│                            └────────────────┘                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────── POINTS & LEVELS DOMAIN ────────────────────────────────────────────────┐
│                                                                                     │
│  ┌────────────────┐                                                                │
│  │ buyer_profiles │                                                                │
│  │────────────────│                                                                │
│  │ id (PK)        │                                                                │
│  │ user_id (FK→u) │                                                                │
│  └───────┬────────┘                                                                │
│          │ 1:1                                                                      │
│          ▼                                                                          │
│  ┌────────────────┐   N:1   ┌──────────────┐   1:N   ┌────────────────────┐       │
│  │ point_accounts │────────▶│ buyer_levels │         │ point_transactions │       │
│  │────────────────│         │──────────────│         │────────────────────│       │
│  │ id (PK)        │         │ id (PK)      │         │ id (PK)            │       │
│  │ owner_type     │         │ name         │         │ point_account_id   │       │
│  │ owner_id       │         │ min_points   │         │ reference_type     │       │
│  │ current_points │         │ max_points   │         │ reference_id       │       │
│  │ lifetime_points│         │ discount_%   │         │ type               │       │
│  │ reserved_points│         │ free_delivery│         │ points_change      │       │
│  │ level_id (FK)  │         └──────────────┘         │ previous/new_points│       │
│  └────────────────┘                                  └────────────────────┘       │
│                                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐                           │
│  │ seller_levels │  │ level_benefits│  │ point_config  │                           │
│  │───────────────│  │───────────────│  │──────────────│                           │
│  │ id (PK)       │  │ id (PK)       │  │ key (PK)     │                           │
│  │ name          │  │ level_type    │  │ value        │                           │
│  │ min/max_points│  │ level_name    │  │ description  │                           │
│  │ search_boost  │  │ benefit_type  │  └──────────────┘                           │
│  └───────────────┘  │ benefit_value │                                              │
│                     └───────────────┘                                              │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────── TRUST DOMAIN ──────────────────────────────────────────────────────────┐
│                                                                                     │
│  ┌──────────────┐   1:1   ┌──────────────┐                                        │
│  │  businesses  │────────▶│ seller_trust │                                        │
│  │──────────────│         │──────────────│                                        │
│  │ id (PK)      │         │ business_id  │                                        │
│  └──────────────┘         │ trust_status │                                        │
│                           │ verified_    │                                        │
│                           │  sales_count │                                        │
│                           │ completion_% │                                        │
│                           │ cancellation_%│                                       │
│                           │ stock_       │                                        │
│                           │  reliability%│                                        │
│                           └──────────────┘                                        │
│                                                                                     │
│  ┌───────────────────────┐   N:1   ┌────────────────┐                             │
│  │ verified_transactions │────────▶│    orders      │                             │
│  │───────────────────────│         │────────────────│                             │
│  │ id (PK)               │         │ id (PK)        │                             │
│  │ order_id (FK)         │         └────────────────┘                             │
│  │ business_id (FK)      │                                                        │
│  │ buyer_profile_id (FK) │                                                        │
│  │ amount                │                                                        │
│  │ status                │                                                        │
│  └───────────────────────┘                                                        │
│                                                                                     │
│  ┌──────────────────────────┐   N:1   ┌────────────────┐                          │
│  │ purchase_confirmations   │────────▶│    orders      │                          │
│  │──────────────────────────│         └────────────────┘                          │
│  │ id (PK)                  │                                                     │
│  │ order_id (FK, UNIQUE)    │                                                     │
│  │ buyer_profile_id (FK)    │                                                     │
│  │ cash_payment_id (FK)     │                                                     │
│  └──────────────────────────┘                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────── MARKETPLACE DOMAIN ────────────────────────────────────────────────────┐
│                                                                                     │
│  ┌────────────┐    1:N   ┌────────────────┐                                       │
│  │ categories │─────────▶│ subcategories  │                                       │
│  │────────────│          │────────────────│                                       │
│  │ id (PK)    │          │ id (PK)        │                                       │
│  │ name       │          │ category_id(FK)│                                       │
│  │ slug       │          │ name           │                                       │
│  └────────────┘          │ slug           │                                       │
│       ▲                  └────────────────┘                                       │
│       │                         ▲                                                  │
│       │ FK (SET NULL)           │ FK (SET NULL)                                    │
│       └─────────────────────────┘                                                  │
│                    products.category_id → categories.id                            │
│                    products.subcategory_id → subcategories.id                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────── REVIEWS DOMAIN ────────────────────────────────────────────────────────┐
│                                                                                     │
│  ┌────────────────┐   1:1   ┌─────────────────────┐                               │
│  │    orders      │────────▶│   seller_reviews    │                               │
│  │────────────────│         │─────────────────────│                               │
│  │ id (PK)        │         │ id (PK)             │                               │
│  └────────────────┘         │ order_id (FK, UNIQ) │                               │
│                             │ buyer_profile_id(FK)│                               │
│                             │ business_id (FK)    │                               │
│                             │ shop_id (FK)        │                               │
│                             │ rating (1-5)        │                               │
│                             │ comment             │                               │
│                             └──────────┬──────────┘                               │
│                                        │ 1:N                                      │
│                                        ▼                                          │
│                             ┌─────────────────────┐    ┌─────────────────────┐     │
│                             │   review_history    │    │shop_review_aggregates│     │
│                             │─────────────────────│    │─────────────────────│     │
│                             │ id (PK)             │    │ shop_id (PK, FK)    │     │
│                             │ review_id (FK)      │    │ average_rating      │     │
│                             │ old_rating          │    │ total_reviews       │     │
│                             │ new_rating          │    │ rating_1..5_count   │     │
│                             │ old_comment         │    │ last_reviewed_at    │     │
│                             │ new_comment         │    └─────────────────────┘     │
│                             │ changed_by          │                               │
│                             │ changed_at          │                               │
│                             └─────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════════
                              CROSS-DOMAIN FK MAP
═══════════════════════════════════════════════════════════════════════════════════════

  users ──────────────────────────────────────────────────────────────────────┐
    │                                                                        │
    ├─▶ account_activation_tokens.user_id                                    │
    ├─▶ refresh_tokens.user_id                                               │
    ├─▶ business_memberships.user_id                                         │
    ├─▶ employees.linked_user_id          (SET NULL)                         │
    ├─▶ employee_shop_assignments.assigned_by                                │
    ├─▶ orders.created_by                                                     │
    ├─▶ order_status_history.changed_by                                      │
    ├─▶ buyer_profiles.user_id              (UNIQUE)                          │
    ├─▶ stock_movements.performed_by        (SET NULL)                        │
    ├─▶ stock_receipts.received_by          (SET NULL)                        │
    └─▶ buyer_payments.seller_confirmed_by  (SET NULL)                        │

  businesses ────────────────────────────────────────────────────────────────┐
    │                                                                        │
    ├─▶ business_memberships.business_id                                     │
    ├─▶ shops.business_id                                                    │
    ├─▶ employees.business_id                                                │
    ├─▶ products.business_id                                                 │
    ├─▶ inventory.business_id                                                │
    ├─▶ stock_movements.business_id                                          │
    ├─▶ stock_receipts.business_id                                           │
    ├─▶ orders.business_id                                                   │
    ├─▶ customers.business_id                                                │
    ├─▶ cash_sessions.business_id                                            │
    ├─▶ cash_payments.business_id                                            │
    ├─▶ point_accounts.owner_id             (when owner_type='SELLER')       │
    ├─▶ seller_trust.business_id             (UNIQUE)                        │
    ├─▶ verified_transactions.business_id                                    │
    └─▶ buyer_payments.business_id                                           │

  shops ─────────────────────────────────────────────────────────────────────┐
    │                                                                        │
    ├─▶ employee_shop_assignments.shop_id                                    │
    ├─▶ inventory.shop_id                                                    │
    ├─▶ stock_movements.shop_id                                              │
    ├─▶ stock_receipts.shop_id                                               │
    ├─▶ orders.shop_id                                                       │
    ├─▶ cash_sessions.shop_id                                                │
    ├─▶ cash_payments.shop_id                                                │
    ├─▶ verified_transactions.shop_id                                        │
    ├─▶ buyer_payments.shop_id                                               │
    ├─▶ seller_reviews.shop_id                                               │
    └─▶ shop_review_aggregates.shop_id         (PK)                          │

  orders ────────────────────────────────────────────────────────────────────┐
    │                                                                        │
    ├─▶ order_lines.order_id                                                 │
    ├─▶ order_status_history.order_id                                        │
    ├─▶ cash_payments.reference_id          (when reference_type='ORDER')    │
    ├─▶ verified_transactions.order_id                                       │
    ├─▶ purchase_confirmations.order_id                                      │
    ├─▶ buyer_payments.order_id              (UNIQUE)                        │
    └─▶ seller_reviews.order_id              (UNIQUE)                        │

  products ──────────────────────────────────────────────────────────────────┐
    │                                                                        │
    ├─▶ product_variants.product_id                                          │
    ├─▶ inventory.product_id                                                 │
    ├─▶ stock_movements.product_id                                           │
    ├─▶ order_lines.product_id                                               │
    └─▶ categories/subcategories (via products.category_id / subcategory_id) │

  product_variants ──────────────────────────────────────────────────────────┐
    │                                                                        │
    ├─▶ inventory.variant_id                                                 │
    ├─▶ stock_movements.variant_id          (SET NULL)                       │
    ├─▶ stock_receipt_lines.variant_id                                       │
    └─▶ order_lines.variant_id                                               │

  buyer_profiles ────────────────────────────────────────────────────────────┐
    │                                                                        │
    ├─▶ point_accounts.owner_id             (when owner_type='BUYER')       │
    ├─▶ verified_transactions.buyer_profile_id                               │
    ├─▶ purchase_confirmations.buyer_profile_id                              │
    └─▶ seller_reviews.buyer_profile_id                                      │

  categories ────────────────────────────────────────────────────────────────┐
    │                                                                        │
    ├─▶ subcategories.category_id           (CASCADE)                        │
    └─▶ products.category_id                (SET NULL)                       │

  subcategories ─────────────────────────────────────────────────────────────┐
    │                                                                        │
    └─▶ products.subcategory_id            (SET NULL)                        │

  point_accounts ────────────────────────────────────────────────────────────┐
    │                                                                        │
    └─▶ point_transactions.point_account_id                                  │

  cash_sessions ─────────────────────────────────────────────────────────────┐
    │                                                                        │
    └─▶ cash_payments.cash_session_id                                        │

  seller_reviews ────────────────────────────────────────────────────────────┐
    │                                                                        │
    └─▶ review_history.review_id            (CASCADE)                        │
```

---

## Summary Statistics

| Metric | Count |
|---|---|
| Total tables | 36 |
| Total migrations | 24 |
| Custom enum types | 18 |
| Tables with UUID PK | 36 |
| Tables with composite unique constraints | 8 |
| Partial unique indexes | 3 |
| JSONB columns | 1 (`product_variants.attributes`) |
| Seeded reference tables | 6 (`seller_levels`, `buyer_levels`, `level_benefits`, `point_config`, `categories`, `subcategories`) |
