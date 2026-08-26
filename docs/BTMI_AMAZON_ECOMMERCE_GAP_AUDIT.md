# BTMI Market — E-Commerce Gap Audit (Amazon-Benchmarked)

**Date:** 2026-08-26
**Scope:** Full system — Go backend, React web app (buyer + seller), Expo/React Native Android app
**Method:** Repository scan, route enumeration, database inspection, live browser verification against running Docker stack
**Status:** Analysis only. No implementation performed in this pass.

> Amazon is used strictly as a **benchmark for commerce completeness and usability**. No Amazon branding, copy, layout, or assets are proposed for reuse. BTMI keeps its own identity, backend architecture, DRC market constraints and cash-first payment model.

---

## 1. Executive Summary

BTMI Market is **substantially more mature than a prototype**. The backend is coherently layered, the API contract matches the TypeScript client field-for-field, and several mechanisms are implemented to a standard that many production marketplaces get wrong:

**Genuine strengths (do not rewrite these):**

| Area | Why it is strong |
|---|---|
| **Inventory concurrency** | Reserve/release/consume use single atomic conditional `UPDATE … WHERE (quantity - reserved_quantity) >= $n`. No read-then-write race, so **overselling is structurally prevented**. |
| **Order pricing integrity** | Prices are computed server-side via `/buyer/orders/preview`; the client cart price is explicitly marked non-authoritative. |
| **Order creation** | Idempotency-key protected. |
| **Product creation pipeline** | Resumable 5-step pipeline (product → variants → images → stock → publish) that survives partial failure without duplicating the product. Better than most. |
| **Variant model** | Category provides *suggestions*; the seller defines the actual schema; the marketplace renders dynamically from persisted data. This is the correct architecture and matches mature marketplace behaviour. |
| **Shop/Business lifecycle** | Archive-instead-of-delete when commercial history exists; marketplace queries filter `status='ACTIVE'`, so archived shops disappear correctly while orders keep their references. |
| **Tenant isolation** | Enforced at the service layer via `requireMembership(userID, businessID)` rather than trusting route params. |

**The system's real problem is not architecture — it is completeness at the edges.** Three categories of gap dominate:

1. **P0 — Android buyer cannot complete a purchase.** The Android cart calls `/buyer/orders/preview`, displays "Prix et disponibilité confirmés", and stops. There is no delivery step, no payment step, and no `POST /buyer/orders`. Android buyers can browse and fill a cart but **can never place an order**. This is commerce-breaking.
2. **P1 — Discovery is thin.** The marketplace home is two sections (category chips + one unfiltered product grid). Search has no filters at all — no price, rating, availability, category, or shop facet. Product cards omit ratings entirely. For a marketplace, discovery *is* the funnel.
3. **P1 — Trust signals are absent where buyers decide.** `PublicProduct` carries no rating/review aggregate, so no product card anywhere (home, search, category, shop page, similar products) can show stars. Reviews exist and are real, but they are invisible until the buyer is already on the detail page.

Additionally, **favorites are local-only with no backend** (self-documented in the code), and **there is no returns/refunds flow** on either side.

**Recommended sequencing:** fix Android checkout (P0) → add product rating aggregate + search filters (P1, highest conversion impact per unit of work) → wishlist backend → returns.

---

## 2. Current Architecture

```
btmi-ai-market/
├── backend/          Go + Gin + PostgreSQL 16 + Redis 7 + Asynq
│   ├── cmd/api/      main.go — route registration, DI wiring
│   ├── internal/
│   │   ├── handlers/    auth, businesses, buyer, cash, categories, customers,
│   │   │                employees, growth, inventory, marketplace, orders, shops
│   │   ├── service/     business logic + authorization
│   │   ├── repository/  30 repositories, hand-written SQL
│   │   ├── models/      request/response DTOs + domain structs
│   │   └── middleware/  auth.go only (AuthMiddleware, OptionalAuthMiddleware)
│   ├── migrations/   035 sequential .sql files, run on boot
│   └── visual-search/  Python + ONNX MobileNetV2 (image search)
├── web-app/          React 18 + Vite + React Router 6 (buyer AND seller)
└── android/          Expo Router + React Query + Zustand
```

**Runtime:** docker-compose — `api`, `worker`, `postgres`, `redis`, `visual-search`, `web`.

**Notable architectural observations:**

- **Redis is used only as the Asynq job broker and for product-similarity storage.** There is no read-through cache on any marketplace query. Every home/search/category request hits Postgres directly.
- **Authorization is service-layer, not middleware-layer.** Each service re-checks membership. This is safe but repetitive; there is no route-level tenant guard to catch a service that forgets.
- **The web app serves both buyer and seller** from one bundle with one router (`App.tsx`), sharing `web-app/src/api/types.ts`. Good for contract consistency; a bundle-size consideration at scale.
- **Search is `ILIKE`-based**, not full-text. `p.name ILIKE $1 OR p.sku ILIKE $1 OR p.description ILIKE $1`, with a relevance boost via `CASE WHEN p.name ILIKE $n THEN 3 ELSE 0 END`. No `pg_trgm`, no `tsvector`, no typo tolerance.

---

## 3. Current Feature Map

Legend: **READY** = works end-to-end · **PARTIAL** = works but materially incomplete · **MISSING** = not built · **BROKEN** = wired but defective · **LOCAL** = client-only, no backend

### 3.1 Buyer (Web)

| Feature | Backend API | Frontend Screen | DB Source | Status |
|---|---|---|---|---|
| Marketplace home | `GET /marketplace/products`, `/categories` | `HomePage.tsx` | products, categories | **PARTIAL** — 2 sections only |
| Search | `GET /marketplace/search` | `SearchPage.tsx` | products (ILIKE) | **PARTIAL** — no filters |
| Search autocomplete | — | `SearchAutocomplete.tsx` | — | **PARTIAL** — client-side only |
| Visual/image search | `POST /marketplace/search/image` | `SearchPage.tsx` | visual-search svc | **READY** |
| Categories list | `GET /marketplace/categories` | `CategoriesPage.tsx` | categories | **READY** |
| Category browse | `GET /marketplace/categories/:slug/products` | `CategoryBrowsePage.tsx` | products | **READY** |
| Shops list | `GET /marketplace/shops` | `ShopsPage.tsx` | shops | **READY** |
| Shop detail | `GET /marketplace/shops/:id/detail` | `ShopDetailPage.tsx` (131 lines) | shops, products, reviews | **PARTIAL** — no in-shop search/filter |
| Product detail | `GET /marketplace/products/:id/detail` | `ProductDetailPage.tsx` | products, variants, images | **READY** |
| Product images | `GET …/images` | Gallery | product_images | **READY** |
| Variant images | `PATCH …/images/:id/variant` | Gallery `focusUrl` | product_images.variant_id | **READY** (added this session) |
| Variants | included in detail | dynamic selectors | product_variants.attributes | **READY** |
| Availability | included | `StockChip` | inventory | **READY** |
| Cart | `POST /buyer/orders/preview` | `CartPage.tsx` | localStorage + server preview | **PARTIAL** — single-shop, no server persistence |
| Favorites | — | `FavoritesPage.tsx` | localStorage | **LOCAL** |
| Points at purchase | `POST …/points-preview` | `CartPage`, `DeliveryPage` | point_accounts | **READY** |
| Delivery | `GET …/delivery-options`, `POST …/delivery` | `DeliveryPage.tsx` | shops delivery config | **READY** |
| Checkout | `POST /buyer/orders` | `PaymentPage.tsx` | orders | **READY** |
| Orders list | `GET /buyer/orders` | `OrdersPage.tsx` | orders | **READY** |
| Order detail | `GET /buyer/orders/:id` | `OrderDetailPage.tsx` | orders, order_lines | **READY** |
| Tracking | `GET …/tracking` | `TrackOrderPage.tsx` | order_status_history | **READY** |
| Payment confirm | `POST /payments/:id/buyer-confirm` | `PaymentPage.tsx` | buyer_payments | **READY** |
| Reviews (write) | `POST …/review`, `…/service-review` | `ReviewPage.tsx` | seller_reviews | **READY** |
| Review helpful | `POST/DELETE …/helpful` | `ProductDetailPage.tsx` | review_helpful | **READY** |
| Shop evaluation | `POST …/service-review` | `ReviewPage.tsx` | seller_reviews | **READY** |
| My reviews | `GET /buyer/reviews` | `MyReviewsPage.tsx` | seller_reviews | **READY** |
| Profile | `GET/PATCH /buyer/profile` | `EditProfilePage.tsx` | buyer_profiles | **PARTIAL** — single address only |
| Points history | `GET /buyer/points/history` | `PointsHistoryPage.tsx` | point_transactions | **READY** |
| Notifications | — | `NotificationsPage.tsx` | — | **PARTIAL** |
| **Returns / refunds** | — | — | — | **MISSING** |
| **Reorder / buy again** | — | — | — | **MISSING** |
| **Invoice / receipt PDF** | `POST /businesses/:id/receipts` (seller-side) | — | receipts | **MISSING** for buyer |
| **Saved addresses** | — | — | — | **MISSING** |
| **Review photos** | — | — | — | **MISSING** |

### 3.2 Seller (Web)

| Feature | Backend API | Frontend Screen | Status |
|---|---|---|---|
| Dashboard | 6 parallel calls | `SellerDashboardPage.tsx` | **READY** |
| Business create/edit | `POST/PATCH /businesses` | `SellerOnboardingPage`, `SellerBusinessPage` | **READY** |
| Business archive | `POST /businesses/:id/archive` | `SellerBusinessPage` | **READY** — blocks on open orders |
| Shop CRUD | `POST/PATCH/DELETE …/shops` | `SellerShopsPage.tsx` | **READY** |
| Shop delivery config | `PATCH /shops/:id` | `SellerShopsPage` Settings dialog | **READY** (fixed this session) |
| Product creation | 5-step pipeline | `SellerProductCreatePage.tsx` | **READY** |
| Category-aware suggestions | `GET /categories` | `categorySuggestions.ts` | **READY** |
| Variants (create) | `POST …/variants` | Create page cartesian | **READY** |
| Variants (add later) | `POST …/variants` | `SellerProductDetailPage` | **READY** (fixed this session) |
| Product images (create) | `POST …/images` | Create page | **READY** |
| Product images (manage) | `POST/DELETE/PATCH …/images` | `SellerProductDetailPage` | **READY** (added this session) |
| Pricing | `PATCH …/products/:id` | Detail page | **READY** |
| Discounts | `PATCH …/products/:id` | Promotion card | **READY** |
| Stock | `POST /shops/:id/stock` | `SellerStockPage`, detail page | **READY** |
| Orders | `GET /shops/:id/orders` + transitions | `SellerOrdersPage.tsx` | **READY** — live polling |
| Cash confirmation | `POST /payments/:id/seller-confirm` | `SellerOrdersPage` | **READY** |
| Employees | `POST/PATCH …/employees`, invitations | `SellerEmployeesPage.tsx` | **READY** |
| Customers | `GET/POST …/customers` | `SellerCustomersPage.tsx` | **READY** |
| Reviews | `GET /marketplace/shops/:id/reviews` | `SellerReviewsPage.tsx` | **READY** (SQL bug fixed this session) |
| Growth / level / trust | `GET …/growth/*` | `SellerGrowthPage.tsx` | **READY** |
| **Seller reply to review** | `POST …/replies` (exists) | — | **MISSING** in seller UI |
| **Analytics / reports** | — | — | **MISSING** |
| **Bulk import / edit** | — | — | **MISSING** |
| **Returns management** | — | — | **MISSING** |
| **Order search / date filter / export** | — | — | **MISSING** |
| **KYC / documents / payout details** | — | — | **MISSING** |
| **Shop branding (logo/banner)** | — | — | **MISSING** (no DB column) |

### 3.3 Android

| Feature | Status |
|---|---|
| Login / forgot / reset password | **READY** |
| Marketplace home, categories | **READY** |
| Product detail + dynamic variants + specs | **READY** — shares `lib/variants.ts` logic with web |
| Reviews (read, write, helpful, reply) | **READY** |
| Orders list / detail / tracking | **READY** |
| Payment confirm (buyer + seller) | **READY** |
| Seller orders + transitions | **READY** |
| Seller reviews | **READY** |
| Cart | **BROKEN** — dead end, see §19 |
| **Checkout / delivery / order creation** | **MISSING** |
| **Favorites** | screen exists, no API |
| **Search** | partial |
| **Seller: products, stock, shops, employees, cash, growth** | **MISSING** |

---

## 4. Buyer Audit

**Working well:** the purchase path on web is complete and careful. Server-verified pricing, points preview before commitment, idempotent order creation, delivery-method-aware status timeline, review eligibility gated per order line, visibility-aware polling that pauses on tab blur.

**Gaps:**

1. **Favorites are localStorage-only.** `FavoritesPage.tsx:15` states it outright: *"Favorites are stored on this device only — the marketplace has no favorites service yet."* No `favoriteApi` exists in `web-app/src/api/*.ts`; no backend handler or table. Consequences: lost on cache clear, no cross-device sync, unusable for remarketing or restock alerts.
2. **Single shipping address.** `BuyerProfile` has one `address`/`city`/`commune`. `DeliveryPage.tsx` rebuilds the address from profile each time. No address book, no default selection.
3. **No returns.** Nothing on either side — no model, no route, no page. Once `COMPLETED`, the order is terminal.
4. **No reorder.** A buyer who wants the same order again must rebuild the cart by hand.
5. **No buyer-facing receipt/invoice.** `receipts` exist server-side for sellers only.
6. **Cart is single-shop and client-only.** `CartState` carries one `shopId`; `previewOrder(shopId, items…)` takes one shop. Adding from a second shop is blocked. Cart is not persisted server-side, so it does not survive a device change before checkout.

---

## 5. Seller Audit

**Working well:** shop-scoped inventory is respected everywhere; the order state machine is complete and delivery-method aware; archive-with-guard prevents destroying commercial history; the product creation pipeline is resumable.

**Gaps:**

1. **No analytics.** No sales trend, no conversion, no traffic, no best-sellers. A seller cannot answer "is this working?" without exporting nothing.
2. **No bulk operations.** No CSV import, no bulk price update, no duplicate-listing, no bulk order actions, no draft autosave in the create form (state is lost on refresh mid-form).
3. **No invoice / packing slip / order export.** `SellerOrdersPage` filters by shop only — no search, no date range.
4. **Seller cannot reply to a review from the seller dashboard**, even though `POST /reviews/:id/replies` exists and the buyer-facing product page uses it.
5. **No KYC.** `CreateBusinessRequest` takes name, type, category, phone, city, currency, optional registration/tax number. No document upload, no ID verification, no bank/payout details.
6. **No shop branding.** Neither `businesses` nor `shops` has a logo/banner/description column. The buyer-facing `ShopDetailPage` can only render name, city, address, phone. Note: `types.ts` contains a **dead `Business` interface with `logo_url?`** that no page imports — aspirational, not wired.

---

## 6. Marketplace Audit

`HomePage.tsx` is 69 lines and renders exactly two sections:

1. A static French trust strip ("Achetez en toute confiance")
2. Category chips
3. One product grid: `products({ page: 1, limit: 16, sort: 'relevance' })`

| Amazon-style home capability | BTMI | Feasible today? |
|---|---|---|
| Search-first layout | Header search exists | ✔ |
| Category navigation | ✔ chips | ✔ |
| Featured products | ✔ (unfiltered "relevance") | ✔ |
| Deals / promotions row | ✖ | ✔ — `discount_active` + date window already in DB |
| Popular / trending | ✖ | ✔ — `ranking_score` exists in `ranking_repository` |
| Recently viewed | ✖ | ✔ — client-side localStorage, no backend needed |
| Personalized recommendations | ✖ | ⚠ needs behavioural data |
| Popular shops | ✖ | ✔ — `GET /marketplace/shops` + ranking exists |
| Product rating on cards | ✖ | ✖ — **requires backend change** |
| Stock state on cards | ✔ `StockChip` | ✔ |
| Discount presentation | ✔ `% OFF` badge | ✔ |

**Highest-value, lowest-cost additions:** a Deals row and a Popular Shops row are both fully supported by existing backend data and need no schema change.

---

## 7. Search Audit

`GET /marketplace/search` → `marketplace_repository.go:452`:

```sql
(p.name ILIKE $n OR p.sku ILIKE $n OR p.description ILIKE $n)
ORDER BY CASE WHEN p.name ILIKE $n THEN 3 ELSE 0 END DESC, search_boost DESC, p.created_at DESC
```

| Capability | BTMI | Notes |
|---|---|---|
| Product name / SKU / description | ✔ | ILIKE substring |
| Shop search | ✔ separate endpoint | `s.name ILIKE` / `b.name ILIKE` |
| Brand search | ✖ | no brand field in schema |
| Typo tolerance | ✖ | no `pg_trgm` |
| Autocomplete | ⚠ | `SearchAutocomplete.tsx` exists, client-side |
| Recent / popular searches | ✖ | not stored |
| **Filters** | ✖ | **`SearchPage.tsx` exposes only a sort dropdown — zero facets** |
| Sorting | ✔ | relevance, price asc/desc, seller level |
| Pagination | ✔ | "Load more" |
| Visual search | ✔ | ONNX MobileNetV2 — a genuine differentiator |

**This is the single largest discovery gap.** A marketplace search with no price filter, no rating filter, no availability filter and no category facet forces buyers to scroll. Backend already stores every field needed for price / category / availability / shop / discount facets.

---

## 8. Product Detail Audit

`ProductDetailPage.tsx` is the strongest buyer screen.

| Element | Status |
|---|---|
| Image gallery + thumbnails + hover zoom | ✔ |
| Variant-linked images | ✔ (added this session) |
| Title, shop link, seller level | ✔ |
| Category breadcrumb | ✔ |
| Rating summary + jump link | ✔ |
| Price, seller discount, loyalty discount | ✔ |
| Stock (exact variant) | ✔ |
| Dynamic variant selectors | ✔ |
| Invalid combination disabling | ✔ verified live |
| Quantity stepper (capped at stock) | ✔ |
| Add to Cart / Buy Now | ✔ |
| Delivery summary | ✔ |
| Highlights / description / specifications | ✔ |
| Specifications = INFO attributes only | ✔ (fixed this session) |
| Reviews with sort, rating filter, helpful, replies | ✔ |
| Similar products | ✔ real, from `similarity_repository` |
| Frequently bought together | ✖ — would need order-line co-occurrence analysis |
| Q&A | ✖ |

**Verdict: near parity.** Remaining gaps are enhancements, not defects.

---

## 9. Variants Audit

The rule *"category suggests, seller decides, backend stores, marketplace renders"* is correctly implemented and verified live this session:

- `categorySuggestions.ts` is the single source of seller-facing suggestions — not duplicated into buyer UI or Android.
- `buildAttributeGroups()` derives selectors from persisted variant attributes; an attribute with only one distinct value becomes a **specification**, not a selector.
- `isValueAvailable()` disables combinations that do not exist.
- Verified end-to-end: Shoes/Running with Color+Shoe Size as VARIANT and Material as INFO produced exactly 4 variants; buyer saw Color and Shoe Size selectors with Material under Specifications; selecting White correctly greyed out size 42.

**One structural risk remains (now mitigated, not eliminated):** variants can exist with `attributes = '{}'`. Such a variant is invisible to the selector logic and falls back to a raw name. This session added a create-time guard, a warning banner, and an inline repair tool — but **legacy rows in production may still carry empty attributes** and should be audited:

```sql
SELECT p.name, v.name, v.attributes
FROM product_variants v JOIN products p ON p.id = v.product_id
WHERE v.attributes = '{}'::jsonb;
```

**Taxonomy issue — "Shoes" duplication (unresolved, deliberately):** the database contains both `Fashion → Shoes` (subcategory, **3 live products**) and `Shoes` (top-level category with a `Running` subcategory, **6 live products**). Both are in active use; deleting or merging either without a migration would orphan real products. Mitigation applied this session: suggestions now prefer the *subcategory*, so `Fashion → Shoes` correctly yields shoe attributes. **Recommendation:** keep both, then migrate the 3 products to the top-level `Shoes` category under a controlled script and remove `Shoes` from Fashion's subcategory list for new products. Do not run this without explicit approval.

---

## 10. Inventory Audit

**This is the best-engineered part of the system.**

```
Business → Shop → Product → Variant → inventory(shop_id, variant_id, quantity, reserved_quantity)
```

Reserve (`inventory_repository.go:208`):
```sql
UPDATE inventory SET reserved_quantity = reserved_quantity + $3
WHERE shop_id = $1 AND variant_id = $2 AND (quantity - reserved_quantity) >= $3
RETURNING …
```

Release (`:233`) requires `reserved_quantity >= $3`. Consume (`:258`) decrements both.

Because the guard is inside the `WHERE` clause of a single statement, Postgres row-level locking makes the check-and-act atomic. **Overselling is prevented by construction, not by application logic.** The `RETURNING` clause means a failed reservation yields no row and is detectable.

`orders.InventoryClaimed` and `orders.PointsFinalized` flags guard against double-consumption.

**Gaps:** no low-stock alerting, no stock reservation TTL (an abandoned unpaid order holds stock until explicitly cancelled), no cross-shop stock view for multi-shop sellers.

---

## 11. Pricing / Discount Audit

| Capability | Status |
|---|---|
| Regular price (`unit_price`) | ✔ |
| Variant-level price (`sale_price`) | ✔ |
| Percentage discount | ✔ |
| Fixed discount | ✔ |
| Discount start/end window | ✔ |
| Effective price computed server-side | ✔ `getEffectiveVariantPrice()` |
| Buyer-level (loyalty) discount | ✔ |
| Points discount with coverage cap | ✔ `GetMaxPointCoveragePercent()` |
| Delivery fee + delivery points discount | ✔ |
| Price snapshot in order | ✔ `base_unit_price`, `points_discount_per_unit`, `final_unit_price` on `order_lines` |
| Shop-specific price for same product | ✖ — price lives on the variant, not per shop |

**Pricing is backend-authoritative** — the client displays, the server decides. Correct.

---

## 12. Cart Audit

| Element | Status |
|---|---|
| Product, variant, shop, quantity, unit price, subtotal | ✔ |
| Product image in line | ✔ |
| Server-verified pricing preview | ✔ |
| Points toggle with live preview | ✔ |
| Quantity update / remove | ✔ |
| Stock revalidation at preview | ✔ |
| Clear checkout CTA | ✔ |
| **Server-side cart persistence** | ✖ localStorage only |
| **Multi-shop cart** | ✖ single-shop by design |
| **Save for later / move to favorites** | ✖ |

**Multi-shop is a deliberate architectural choice**, not a bug — the whole order/payment/delivery model is shop-scoped. Changing it would be a major redesign. The realistic improvement is **clear messaging** when a buyer adds from a second shop (Android already shows an alert; web should match), plus optionally parallel per-shop carts.

---

## 13. Checkout Audit

Flow: **Cart → Delivery → Payment → Success**, with a progress indicator.

Buyer sees: products, shop, variants, delivery method + fee, points applied, discount, final cash due. Order creation is idempotency-keyed.

**No hidden pricing** — verified. This flow is complete on web.

---

## 14. Orders / Tracking Audit

Statuses (`models/order.go`): `PENDING, ACCEPTED, REJECTED, PREPARING, READY, READY_FOR_PICKUP, OUT_FOR_DELIVERY, HANDED_TO_PARTNER, DELIVERED, RECEIVED, COMPLETED, CANCELLED`.

Delivery methods: `PICKUP`, `SHOP_DELIVERY`, `PARTNER`.

Timestamps are recorded per transition (`accepted_at`, `preparing_at`, `ready_at`, `out_for_delivery_at`, `delivered_at`, `received_at`, `completed_at`), and `order_status_history` provides the audit trail. Buyer and seller read the same backend status — **no dual source of truth**.

Tracking shows order number, shop, lines, variants, quantity, price, payment state, delivery method, current status and history. It is **not** timeline-only.

**Gaps:** no return/refund states; no partial fulfilment; no seller-side order search or date filter.

---

## 15. Payment Audit

Cash-first, dual-confirmation — **preserved as a business rule, not treated as a gap**:

```
Buyer: POST /payments/:id/buyer-confirm   ("I have paid")
Seller: POST /payments/:id/seller-confirm ("Cash received")
→ payment VERIFIED
```

This is a well-designed model for the DRC market: neither side can unilaterally mark a payment complete. `payment_service.go` additionally validates that delivery address, contact name and phone are present before allowing delivery-based payment.

**No mobile money or card integration is recommended in this pass.** Amazon is a UX benchmark, not a payment-method template. If M-Pesa/Airtel Money is ever wanted, it must be an explicit product decision.

---

## 16. Reviews Audit

Reviews are **real and purchase-gated** — no static or mock data anywhere.

| Capability | Status |
|---|---|
| Product review (rating + comment) | ✔ |
| Separate shop/service review (delivery, service, experience) | ✔ |
| Verified-purchase flag | ✔ — **badge was hardcoded in 2 places; fixed this session** |
| Eligibility check before allowing review | ✔ |
| Edit / withdraw | ✔ |
| Helpful votes | ✔ |
| Replies | ✔ |
| Rating breakdown + filter + sort | ✔ |
| Shared backend across web and Android | ✔ |
| **Review photos** | ✖ |
| **Abuse reporting / moderation** | ✖ |
| **Seller reply from seller dashboard** | ✖ (API exists, UI missing) |

**Defect found and fixed this session:** `GetReviewsByShopID` selected `ol.product_name`, `ol.variant_name`, `ol.image_url` — **none of which exist on `order_lines`**. Every seller reviews page request returned HTTP 500 (`pq: column ol.product_name does not exist`). Now joined correctly to `products`, `product_variants` and a lateral `product_images` lookup.

---

## 17. Profile Audit

Contains: personal info, phone, WhatsApp, address/city/commune, points snapshot, links to orders / favorites / reviews / pending purchases, logout.

Orders and Points are correctly kept in the account area rather than primary marketplace navigation.

**Gaps:** no address book (single address), no saved payment methods (n/a for cash), no notification preferences, no account deletion / data export.

---

## 18. Shop / Business Audit

Lifecycle is correct: create → rename → archive-or-delete. Archive is blocked while active orders or unresolved payments exist. Marketplace queries filter `p.publication_status='PUBLISHED' AND p.status='ACTIVE' AND s.status='ACTIVE'`, so **archiving genuinely removes marketplace visibility while orders keep their references**. Verified in `marketplace_repository.go` at 17 separate query sites.

**Public shop page (`ShopDetailPage.tsx`, 131 lines) is the weakest buyer surface:**

| Capability | Status |
|---|---|
| Shop identity (name, city, address, phone) | ✔ |
| Rating + review count | ✔ |
| Product list | ✔ |
| Reviews tab | ✔ |
| **Logo / banner / about** | ✖ — no DB column |
| **Search within shop** | ✖ |
| **Filter / sort within shop** | ✖ |
| **Categories represented** | ✖ |
| **Seller trust badge** | ✖ |

**Visibility is never inferred from stock.** A published product with zero stock correctly shows `OUT_OF_STOCK` rather than disappearing — this is deliberate and right.

---

## 19. Android Audit

| Domain | Web | Android | Parity |
|---|---|---|---|
| Auth (login, forgot, reset) | ✔ | ✔ | **Full** |
| Product detail + variants + specs | ✔ | ✔ | **Full** — shares identical `lib/variants.ts` logic |
| Reviews (read/write/helpful/reply) | ✔ | ✔ | **Full** |
| Orders + tracking + payment confirm | ✔ | ✔ | **Full** |
| Seller orders + transitions | ✔ | ✔ | **Full** |
| Home / categories | ✔ | ✔ | Good |
| Search | ✔ | partial | Gap |
| **Cart → Checkout** | ✔ | **✖ dead end** | **P0** |
| Favorites | local | screen only | Gap |
| Seller products / stock / shops / employees / cash / growth | ✔ | ✖ | Gap |

### The Android P0 in detail

`android/app/(buyer)/cart.tsx` — the entire checkout is:

```ts
const preview = useMutation({
  mutationFn: () => post('/buyer/orders/preview', { shop_id: lines[0]?.shopId, … })
})
…
<Button title={user ? 'Vérifier et continuer' : 'Se connecter pour continuer'}
        onPress={() => user ? preview.mutate() : router.push('/auth/login')} />
{preview.isSuccess && <Card><Text>Prix et disponibilité confirmés.</Text></Card>}
```

The button calls preview, prints a confirmation, and **stops**. There is no navigation to a delivery screen, no payment screen, and `android/src/api/index.ts` contains **no `createOrder`, no `previewOrder`, no delivery endpoints** (verified: grep for `createOrder|previewOrder|checkout` returns 0 matches).

**An Android buyer can browse, add to cart, and never buy.** Web parity is not the issue — this is a broken funnel.

**Architecture is otherwise correct:** Android consumes the same backend, and no category→variant rules are hardcoded on mobile. `android/src/lib/variants.ts` is a faithful port of the web logic.

---

## 20. Security / Trust Audit

| Control | Status |
|---|---|
| JWT access + refresh tokens | ✔ |
| Password hashing (bcrypt `$2a$`/`$2b$`) | ✔ verified in e2e script |
| Email activation required | ✔ |
| Password reset tokens | ✔ |
| Tenant isolation | ✔ service-layer `requireMembership` |
| Shop-scope enforcement | ✔ |
| Employee role checks (Owner/Admin) | ✔ |
| Order audit trail | ✔ `order_status_history` |
| Verified-purchase labels | ✔ (fixed this session) |
| Seller trust / level model | ✔ |
| Idempotent order creation | ✔ |
| **Rate limiting** | ✖ none found |
| **Review abuse protection** | ✖ |
| **CSRF / CORS policy** | ⚠ CORS relies on same-origin nginx proxy in prod |
| **Route-level tenant guard** | ✖ per-service only — one forgotten check = a hole |
| **Audit log for seller actions** | ✖ (orders only) |

**Notable:** no rate limiting on `/auth/login`, `/auth/forgot-password`, or `/auth/register` — brute-force and enumeration exposure.

---

## 21. Performance Audit

| Concern | Finding |
|---|---|
| Pagination | ✔ everywhere |
| Lazy image loading | ✔ `loading="lazy"` on cards |
| **Read caching** | ✖ **Redis is used only for Asynq + similarity. No marketplace query is cached.** |
| Search query cost | ⚠ `ILIKE '%term%'` cannot use a btree index → sequential scan, degrades with catalog size |
| **Frontend N+1** | ⚠ `ShopProductsPage.tsx:52` fires one `productImageApi.list()` **per product**; `OrdersPage.tsx:74` fires one detail call **per order** |
| Ranking precomputation | ✔ `ranking_repository` + background rebuild on boot |
| Bundle size | ⚠ buyer + seller in one bundle, no route-level code splitting observed |
| Android network | ✔ React Query caching |
| Slow-connection handling | ⚠ no explicit retry/backoff policy found |
| Polling | ✔ visibility-aware pause/resume (good) |

**Two concrete wins:** add `ILIKE` → `pg_trgm` GIN index for search, and batch the two frontend N+1 loops.

---

## 22. Amazon-Style Benchmark Matrix

| Capability | Amazon-style expectation | BTMI current | Gap | Value | Complexity | Priority |
|---|---|---|---|---|---|---|
| Mobile checkout | Complete purchase on mobile | Cart dead-ends | **Total** | Critical | M | **P0** |
| Product rating on cards | Stars + count on every card | Absent everywhere | **Total** | Very high | M (backend) | **P1** |
| Search filters | Price, rating, category, availability, shop | None | **Total** | Very high | M | **P1** |
| Wishlist | Server-side, cross-device | localStorage only | **Total** | High | M | **P1** |
| Home discovery | Deals, trending, recently viewed, shops | 1 grid | **Large** | High | S–M | **P1** |
| Returns / refunds | Full RMA | None | **Total** | High | L | **P2** |
| Shop branding | Logo, banner, about | Text only, no column | **Total** | Medium-high | M | **P2** |
| Seller analytics | Sales, traffic, conversion | None | **Total** | High | L | **P2** |
| Address book | Multiple saved addresses | Single address | **Large** | Medium | S–M | **P2** |
| Seller reply to review | From seller console | API only, no UI | **Partial** | Medium | S | **P2** |
| Bulk seller ops | CSV import, bulk edit | None | **Total** | Medium | L | **P3** |
| Review photos | Buyer-uploaded images | None | **Total** | Medium | M | **P3** |
| Typo-tolerant search | Fuzzy matching | ILIKE only | **Large** | Medium | M | **P3** |
| Recommendations | Personalized | Similar products only | **Partial** | Medium | L | **P3** |
| Q&A on product | Buyer questions | None | **Total** | Low-medium | M | **P4** |
| Frequently bought together | Co-purchase analysis | None | **Total** | Medium | L | **P4** |
| Rate limiting | Standard | None | **Total** | High (security) | S | **P1** |
| Read caching | Redis on hot paths | None | **Total** | Medium | M | **P3** |
| Variant images | Colour swatch → image | ✔ implemented | None | — | — | Done |
| Dynamic variants | Seller-defined | ✔ implemented | None | — | — | Done |
| Oversell protection | Atomic reservation | ✔ implemented | None | — | — | Done |

---

## 23. Prioritised Gap List

### P0 — Commerce-breaking

| # | Issue | Evidence |
|---|---|---|
| **P0-1** | **Android buyer cannot place an order.** Cart calls preview then stops; no delivery/payment/order-creation screens; no `createOrder` in the Android API client. | `android/app/(buyer)/cart.tsx`, `android/src/api/index.ts` |
| **P0-2** | **Legacy variants with empty attributes** are invisible to buyer selectors and fall back to raw names (this is what produced "Baby's shirt / s / at" instead of Color and Size selectors). Create-time guard and repair UI now exist; **existing rows still need an audit sweep.** | `product_variants.attributes = '{}'` |

*Resolved during this session (were P0):* seller reviews page returned HTTP 500 on every request (invalid SQL columns); `UpdateShop`/`CreateShop` silently dropped `delivery_city`/`delivery_address`; `ShopResponse` omitted all delivery fields so the UI always showed "disabled"; verified-purchase badge was hardcoded true in 2 places; `useMemo` after early returns in `SellerProductDetailPage` (hooks-order violation).

### P1 — High value

- **P1-1** Product rating aggregate on `PublicProduct` → stars on every product card *(requires backend aggregate; unlocks trust across home, search, category, shop, similar)*
- **P1-2** Search filters: price range, rating, availability, category, shop, discount
- **P1-3** Wishlist/favorites backend (table + CRUD + migration from localStorage)
- **P1-4** Home discovery rows: Deals, Popular Shops, Recently Viewed *(all supported by existing data)*
- **P1-5** Rate limiting on auth endpoints
- **P1-6** Batch the two frontend N+1 loops

### P2 — Important

- Returns/refunds lifecycle (buyer request → seller approve/reject → refund state)
- Shop branding: logo + banner + description (migration + upload + storefront render)
- Seller analytics dashboard
- Buyer address book
- Seller reply-to-review UI
- Seller order search / date filter / CSV export
- Buyer invoice/receipt download

### P3 — Enhancement

- Bulk product import/edit, listing duplication, draft autosave
- Review photos
- `pg_trgm` fuzzy search + server-side autocomplete
- Redis read cache on hot marketplace queries
- Route-level code splitting
- Low-stock alerts, stock reservation TTL

### P4 — Optional / future

- Product Q&A
- Frequently-bought-together
- Personalized recommendations from behavioural data
- Multi-shop / split checkout
- Online payment methods *(explicit product decision required)*

---

## 24. Recommended Target Architecture

**Information architecture (buyer)**
```
Home → [Search] [Categories] [Deals] [Featured] [Popular Shops] [Recently Viewed]
Search → results + facet rail (price, rating, availability, category, shop, discount)
Category → subcategory chips + same facet rail
Shop → identity/branding + rating + in-shop search & filter + products + reviews
Product → gallery(variant-aware) · title/shop/rating · price/discount · variant selectors ·
          availability · quantity · Add to Cart / Buy Now · delivery · highlights ·
          description · specifications(INFO attrs) · seller card · reviews · similar
Account → profile · address book · orders · points · favorites · reviews · returns
```

**Product lifecycle** — unchanged, it is correct:
`DRAFT → (variants + images + shop stock) → PUBLISHED → ARCHIVED`, visibility never inferred from stock.

**Inventory lifecycle** — unchanged, it is correct:
`add stock → reserve on order (atomic) → release on cancel → consume on completion`

**Order lifecycle** — extend with returns:
`… → COMPLETED → [RETURN_REQUESTED → RETURN_APPROVED/REJECTED → RETURNED → REFUNDED]`

**Review lifecycle** — unchanged:
`purchase → eligibility → review (product + separate service review) → helpful/reply → aggregate`

**Web/Android synchronisation principle** — already correct and must be preserved: one backend, one variant contract, no mobile-specific business rules, no duplicated category→attribute maps. Android's job is to reach feature parity, never to fork behaviour.

---

## 25. UX/UI Recommendations

**Preserve BTMI identity:** dark green primary, gold accent, warm neutral background, clean cards, strong product imagery, readable typography. Do not adopt Amazon's palette, density, or layout.

**Structural issues found:**

1. **253 inline styles across 18 seller pages** (worst: Product Create 71, Product Detail 68, Reviews 26, Shops 18). Each page reinvents spacing, colour and borders — this is the concrete cause of the "unprofessional" feel. `SellerDashboardPage` is the counter-example (0 inline styles, consistent classes) and should be the template. *Partially addressed this session:* added `.notice`, `.inline-form`, `.attr-chip`, `.photo-card`, `.field-grid`, `.card-stack` and spacing utilities; count reduced to ~220 and duplicated warning/success boxes unified.
2. **Specifications table drew borders around empty cells** when the attribute count was odd — visible in the reported screenshot. *Fixed this session.*
3. **Empty specification rows** (e.g. a blank "SKU") rendered as empty table cells. *Fixed this session.*
4. **Zero-count rating rows were clickable** and filtered to an empty list. *Fixed this session.*
5. **Shop cards were not clickable** — only the "Open Shop" button navigated. *Fixed this session.*

**Remaining UX work:** finish the inline-style migration for Product Detail and Create; give the public shop page real branding and in-shop search; add facets to search; put ratings on product cards.

---

## 26. Implementation Roadmap

| Phase | Content | Depends on |
|---|---|---|
| **1** | **P0:** Android checkout (delivery + payment + order creation screens, extend `android/src/api`); audit and repair legacy empty-attribute variants | — |
| **2** | **Discovery:** product rating aggregate on `PublicProduct`; stars on `ProductCard`; search facets; home Deals / Popular Shops / Recently Viewed rows | rating aggregate |
| **3** | **Trust & retention:** wishlist backend + localStorage migration; buyer address book; seller reply-to-review UI; rate limiting | — |
| **4** | **Returns:** model, migration, states, buyer request flow, seller approval flow | Phase 1 |
| **5** | **Shop identity:** logo/banner/description migration + upload + storefront render + in-shop search/filter | — |
| **6** | **Seller Center:** analytics, order search/export, invoices, bulk operations | — |
| **7** | **Android parity:** seller module, favorites, full search | Phase 1, 3 |
| **8** | **Performance & personalization:** `pg_trgm` index, Redis read cache, N+1 batching, code splitting, recommendations | — |

---

## 27. Risks

| Risk | Mitigation |
|---|---|
| **Shoes taxonomy migration orphans live products** (3 in `Fashion→Shoes`, 6 in top-level `Shoes`) | Do not migrate without an explicit, reversible script and approval. Subcategory-aware suggestions already remove the practical harm. |
| **Adding rating to `PublicProduct` is a hot-path aggregate** | Use a materialized aggregate or denormalized counter updated on review write — never a per-row subquery in list queries. |
| **Wishlist migration from localStorage** | Merge-on-login rather than overwrite; never silently discard a device's list. |
| **Search facets on `ILIKE`** | Facets multiply an already unindexed query. Add the `pg_trgm` GIN index in the same phase. |
| **Android checkout must reuse the web contract exactly** | Any divergence in preview/points/delivery logic recreates the dual-source-of-truth problem the system currently avoids. |
| **Returns touch inventory and points** | Refund must release/restore stock and reverse points atomically, reusing existing `InventoryClaimed` / `PointsFinalized` guards. |
| **Inline-style cleanup is broad-touch** | Migrate page by page with a type-check and visual verification after each, never in one sweep. |
| **No rate limiting today** | Treat as a security item, not an enhancement. |

---

## 28. Files / APIs Likely Affected

**Phase 1 (P0 — Android checkout)**
- `android/app/(buyer)/cart.tsx`, new `checkout/delivery.tsx`, `checkout/payment.tsx`, `checkout/success.tsx`
- `android/src/api/index.ts` — add `previewOrder`, `createOrder`, `deliveryOptions`, `setDelivery`, `createPayment`
- `android/src/store/cart.ts`
- Backend: **no change required** — endpoints already exist

**Phase 2 (ratings + search facets + home)**
- `backend/internal/models/marketplace.go` — add rating fields to `PublicProductResponse`
- `backend/internal/repository/marketplace_repository.go` — aggregate join + facet `WHERE` clauses
- `backend/internal/handlers/marketplace/*` — filter query params
- `web-app/src/api/types.ts`, `marketplace.ts`
- `web-app/src/components/ui/ProductCard.tsx` — render stars
- `web-app/src/pages/marketplace/SearchPage.tsx` — facet rail
- `web-app/src/pages/marketplace/HomePage.tsx` — new rows
- New migration: `pg_trgm` extension + GIN index

**Phase 3 (wishlist, addresses, rate limiting)**
- New migration: `favorites`, `buyer_addresses`
- New `backend/internal/repository/favorite_repository.go`, `service/favorite_service.go`, `handlers/buyer/`
- `web-app/src/store/favorites.tsx` — server-backed with local merge
- `backend/internal/middleware/` — new `ratelimit.go`

**Phase 4 (returns)**
- New migration: `order_returns`
- `backend/internal/models/order.go` — return states
- `service/order_service.go` — inventory + points reversal
- New buyer and seller pages

**Phase 5 (shop branding)**
- New migration: `businesses.logo_url`, `shops.logo_url`, `banner_url`, `description`
- `models/business.go`, `models/shop.go`, `handlers/shops/handler.go`
- `web-app/src/pages/marketplace/ShopDetailPage.tsx`, `seller/shops/SellerShopsPage.tsx`

---

## Appendix — Defects Found and Fixed During This Audit Session

| # | Defect | File | Severity |
|---|---|---|---|
| 1 | Seller reviews page returned HTTP 500 on every request — SQL referenced `ol.product_name`, `ol.variant_name`, `ol.image_url`, none of which exist on `order_lines` | `repository/review_repository.go` | **P0** |
| 2 | `UpdateShop`/`CreateShop` silently discarded `delivery_city`/`delivery_address` — fields absent from the Go request DTOs while present in the TS types | `models/shop.go`, `service/shop_service.go` | **P1** |
| 3 | `ShopResponse` omitted every delivery field, so the seller UI always displayed delivery as disabled even after a successful save | `handlers/shops/handler.go` | **P1** |
| 4 | "Verified Purchase" badge rendered unconditionally in 2 places, misrepresenting unverified reviews | `SellerReviewsPage.tsx:180`, `ProductDetailPage.tsx:476` | **P1** |
| 5 | `useMemo` called after three early returns — React hooks-order violation | `SellerProductDetailPage.tsx` | **P1** |
| 6 | Buyer Specifications listed *all* variant attributes, duplicating the Color/Size selectors instead of showing only INFO attributes | `ProductDetailPage.tsx` | **P1** |
| 7 | Variants creatable with empty attributes → invisible to buyer selectors | `SellerProductDetailPage.tsx` | **P0** |
| 8 | Seller had no way to manage product images after creation (no UI existed at all) | `SellerProductDetailPage.tsx` | **P1** |
| 9 | Images could not be linked to variants — buyers could not see other colours/models | migration 035 + full stack | **P1** |
| 10 | `Fashion → Shoes` yielded generic fashion suggestions instead of shoe attributes | `SellerProductCreatePage.tsx` | **P2** |
| 11 | Shop cards not clickable — only the button navigated | `SellerShopsPage.tsx` | **P2** |
| 12 | Specifications table drew borders around empty cells on odd counts; empty rows rendered | `pages.css`, `ProductDetailPage.tsx` | **P2** |
| 13 | Zero-count rating rows clickable, filtering to an empty list | `ProductDetailPage.tsx`, `pages.css` | **P3** |
| 14 | Seller reviews page used duplicated local types and `as any` casts; pagination param `limit` did not match backend `per_page` | `SellerReviewsPage.tsx`, `api/seller.ts` | **P2** |

---

**BTMI E-COMMERCE AMAZON-BENCHMARK AUDIT COMPLETE — WAITING FOR APPROVAL BEFORE IMPLEMENTATION.**
