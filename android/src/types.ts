export type AccountType = 'BUYER' | 'SELLER' | 'EMPLOYEE'

export interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  account_type: AccountType
  capabilities?: {
    buyer: boolean
    seller: boolean
    seller_onboarding: boolean
  }
  avatar_url?: string | null
}

export const canBuy = (user?: User | null) => user?.capabilities?.buyer ?? (user?.account_type !== 'EMPLOYEE')
export const canSell = (user?: User | null) => user?.capabilities?.seller ?? (user?.account_type === 'SELLER')
export const canOnboardSeller = (user?: User | null) => user?.capabilities?.seller_onboarding ?? (user?.account_type === 'SELLER')

export interface LoginResponse {
  access_token: string
  refresh_token: string
  user?: User
}

export interface RegisterInput {
  first_name: string
  middle_name?: string
  last_name: string
  phone: string
  backup_phone?: string
  email: string
  password: string
  password_confirmation: string
  address?: string
  city?: string
  commune?: string
  country?: string
  latitude?: number | null
  longitude?: number | null
}


export interface Category { id: string; name: string; slug: string; sort_order?: number; subcategories?: Category[] }

/** Mirrors backend models.CategoryAttributeDefinition and web-app CategoryAttributeDefinition. */
export interface CategoryAttributeDefinition {
  id: string
  category_id: string
  subcategory_id?: string | null
  key: string
  label_en: string
  label_fr: string
  required: boolean
  variant_attribute: boolean
  input_type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'BOOLEAN'
  allowed_values?: string[]
  display_order: number
  status: string
}

export interface PublicImage { id?: string; url?: string; image_url?: string; is_primary?: boolean }
export interface PublicVariant {
  id: string
  sku?: string
  name?: string
  attributes?: Record<string, string>
  price?: number
  /** Regular price before any promotion, as sent by the marketplace API. */
  base_price?: number
  sale_price?: number
  unit_price?: number
  available_stock?: number
  stock_available?: number
  stock_quantity?: number
  stock?: string
}
export interface PublicProduct {
  id: string
  name: string
  category?: string
  category_name?: string
  shop_id?: string
  shop_name?: string
  price?: number
  sale_price?: number
  base_price?: number
  currency?: string
  unit?: string
  /* Promotion window, mirrored from PublicProductResponse on the backend. */
  discount_active?: boolean
  discount_type?: string
  discount_value?: number
  discount_start?: string | null
  discount_end?: string | null
  seller_sale_price?: number
  /** Rating aggregate, maintained on review write. 0 reviews = never rated. */
  average_rating?: number
  total_reviews?: number
  /** Seller rating is the fallback until a verified buyer review exists. */
  self_rating?: number | null
  available_stock?: number
  availability?: string
  image_url?: string
  primary_image_url?: string
  images?: Array<PublicImage | string>
}
export interface ProductDetail extends PublicProduct {
  description?: string
  variants?: PublicVariant[]
  rating?: number
  review_count?: number
}
export interface ReviewReply {
  id: string
  author_display_name: string
  body: string
  created_at: string
}
export interface ProductReview {
  id: string
  rating: number
  comment: string
  verified_purchase: boolean
  buyer_display_name: string
  created_at: string
  helpful_count: number
  helpful_by_me: boolean
  replies?: ReviewReply[]
  delivery_rating?: number
  service_rating?: number
  order_experience_rating?: number
}
export interface ProductReviewSummary {
  average_rating: number
  total_reviews: number
  rating_1_count: number
  rating_2_count: number
  rating_3_count: number
  rating_4_count: number
  rating_5_count: number
}
export interface ProductReviewsResponse {
  product_id: string
  summary: ProductReviewSummary
  reviews: ProductReview[]
  pagination: { page: number; limit: number; total: number; has_more?: boolean }
}
export interface Shop {
  id: string; name: string; city?: string; address?: string; product_count?: number
  business_id?: string; type?: string; phone?: string; status?: string
  supports_shop_delivery?: boolean; shop_delivery_fee?: number
  supports_partner_delivery?: boolean; partner_delivery_fee?: number; partner_delivery_provider?: string
  delivery_city?: string; delivery_address?: string
  created_at?: string; updated_at?: string
}
export interface UpdateShopRequest {
  name?: string; type?: string; city?: string; address?: string; phone?: string; status?: string
  supports_shop_delivery?: boolean; shop_delivery_fee?: number
  supports_partner_delivery?: boolean; partner_delivery_fee?: number; partner_delivery_provider?: string
  delivery_city?: string; delivery_address?: string
}
export interface CreateShopRequest {
  name: string; type: 'PHYSICAL' | 'ONLINE'; city: string; address: string; phone: string
  supports_shop_delivery?: boolean; shop_delivery_fee?: number
  supports_partner_delivery?: boolean; partner_delivery_fee?: number; partner_delivery_provider?: string
  delivery_city?: string; delivery_address?: string
}
export interface BuyerProfile {
  id: string; first_name: string; last_name: string; email: string; phone: string
  backup_phone?: string; address?: string; city?: string; commune?: string
  country?: string; latitude?: number | null; longitude?: number | null
}
export interface UpdateBuyerProfileRequest {
  first_name?: string
  last_name?: string
  phone?: string
  backup_phone?: string
  address?: string
  city?: string
  commune?: string
  country?: string
  latitude?: number | null
  longitude?: number | null
}
export interface Business {
  id: string; name: string; status: string
  business_type?: string; category?: string; phone?: string; whatsapp?: string; email?: string
  country?: string; city?: string; default_currency?: string
  created_at?: string; updated_at?: string
}
export interface BusinessLifecycleSummary {
  shops: number; products: number; employees: number; inventory_units: number
  active_orders: number; historical_orders: number; unresolved_payments: number
  shop_summaries: Array<{ id: string; name: string; status: string; product_count: number }>
}
export interface ArchiveBusinessResponse { action: 'archived'; summary: BusinessLifecycleSummary }
export interface BuyerOrder { id: string; order_number?: string; shop_id: string; status: string; total_items: number; final_total: number; created_at: string; delivery_method?: string; notes?: string }
export interface SellerOrder extends BuyerOrder {
  business_id: string
  base_total?: number
  delivery_method?: string
  notes?: string
}
export interface OrderLine { id: string; product_id: string; variant_id: string; quantity: number; final_unit_price: number; product_name: string; variant_name?: string; image_url?: string }
export interface OrderStatusHistory { id: string; order_id: string; status: string; changed_by?: string | null; actor_type?: string; notes: string; created_at: string }
export interface TrackingResponse { order_id: string; order_number: string; current_status: string; delivery_method: string; payment_status: string; latest_update: string; latest_update_at?: string | null; history: OrderStatusHistory[] }
export interface BuyerPayment {
  id: string; order_id: string; shop_id: string; shop_name?: string
  payment_method: string; currency: string
  products_base_total: number; products_points_used: number
  products_points_discount: number; products_final_total: number
  delivery_fee_base: number; delivery_points_used: number
  delivery_points_discount: number; delivery_fee_final: number
  cash_due: number
  buyer_confirmed: boolean; buyer_confirmed_at?: string | null
  seller_confirmed: boolean; seller_confirmed_at?: string | null
  status: string; verified_at?: string | null; created_at: string
}
export interface OrderDetail { order: BuyerOrder; lines: OrderLine[]; history?: OrderStatusHistory[]; shop_name: string }

/* ---------- Checkout pipeline ----------
   These mirror the web contract exactly (web-app/src/api/types.ts). The
   backend is the single source of truth for pricing, so nothing here is
   ever computed on the device. */

export type DeliveryMethod = 'TBK_STANDARD' | 'PICKUP' | 'SHOP_DELIVERY' | 'PARTNER'

export interface OrderLineInput { product_id: string; variant_id: string; quantity: number }

export interface OrderWithLines { order: BuyerOrder; lines: OrderLine[] }

export interface PointRedemptionPreview {
  base_total: number; points_used: number; points_discount_amount: number
  final_total: number; currency: string; available_points: number
  maximum_usable_points: number; redeem_rate: number; max_point_coverage: number
}

export interface DeliveryOption {
  method: DeliveryMethod | string; label: string; fee: number
  provider?: string; available: boolean
}

export interface DeliveryOptionsResponse {
  order_id: string; shop_id: string
  options: DeliveryOption[]; current_method: string
}

export interface DeliverySummary {
  method: string; fee_base: number; points_used: number
  points_discount: number; fee_final: number
  contact_name: string; phone: string; address: string; notes: string
}

export interface DeliverySelectResponse {
  order_id: string; products_final_total: number
  delivery: DeliverySummary; total_due: number
}

export interface SelectDeliveryRequest {
  method?: DeliveryMethod | string; use_points_for_delivery: boolean
  contact_name?: string; phone?: string; address?: string; notes?: string
}

export interface DeliveryPointsPreview {
  method: string; fee_base: number; points_used: number
  points_discount_amount: number; fee_final: number; currency: string
  available_points: number; maximum_usable_points: number
  redeem_rate: number; max_delivery_point_coverage: number
}
export interface ReviewEligibility { eligible: boolean; reason: string; existing_review_id?: string }
export interface BuyerReview { id: string; order_id: string; product_id?: string; order_line_id?: string; rating: number; comment: string; verified_purchase: boolean; status: string; delivery_rating?: number; service_rating?: number; order_experience_rating?: number; created_at: string }
export interface BuyerReviewsResponse { reviews: BuyerReview[]; pagination: { page: number; limit: number; total: number; has_more?: boolean } }
export interface ShopReviewsResponse { shop_id: string; summary: ProductReviewSummary; reviews: ProductReview[]; pagination: { page: number; limit: number; total: number; has_more?: boolean } }

/* ---------- Seller: Employees ---------- */
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'TERMINATED'
export interface Employee {
  id: string; business_id: string; linked_user_id?: string | null
  first_name: string; middle_name?: string; last_name: string
  phone: string; email: string; job_title: string; status: EmployeeStatus
  created_at: string; updated_at: string
}
export interface CreateEmployeeRequest { first_name: string; middle_name?: string; last_name: string; phone?: string; email?: string; job_title: string }
export interface UpdateEmployeeRequest { first_name?: string; middle_name?: string; last_name?: string; phone?: string; email?: string; job_title?: string; status?: string }
export interface EmployeeShopAssignment { id: string; employee_id: string; shop_id: string; assigned_by: string; status: string; assigned_at: string; created_at: string; updated_at: string }
export interface AssignEmployeeRequest { shop_id: string }
export interface CreateEmployeeInvitationRequest { employee_id: string }
export interface EmployeeInvitationResponse { id: string; employee_id: string; status: string; expires_at: string; invitation_url?: string; created_at: string }
export interface AcceptEmployeeInvitationRequest { token: string; password: string; password_confirmation: string }

/* ---------- Seller: Products & Variants ---------- */
export type PublicationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export interface Product {
  id: string; business_id: string; name: string; description?: string; sku?: string
  unit_price?: number; cost_price?: number; unit?: string; status?: string
  category_id?: string | null; subcategory_id?: string | null; category_name?: string
  variant_count?: number; total_quantity?: number; reserved_quantity?: number; available_quantity?: number
  publication_status: PublicationStatus
  discount_active?: boolean; discount_type?: string; discount_value?: number
  discount_start?: string | null; discount_end?: string | null
  self_rating?: number | null
  created_at: string; updated_at: string
}
export interface CreateProductRequest {
  name: string; description?: string; sku?: string; unit_price?: number; cost_price?: number; unit?: string
  publication_status?: PublicationStatus; category_id?: string; subcategory_id?: string
  discount_active?: boolean; discount_type?: string; discount_value?: number
  discount_start?: string | null; discount_end?: string | null
  self_rating: number
  /** Optional client-generated key, unique per business. Replaying a create
   *  call with the same key returns the product the first one made instead of
   *  creating a second, so a retry after a timeout cannot duplicate it. */
  idempotency_key?: string
}
export interface UpdateProductRequest {
  name?: string; description?: string; sku?: string; unit_price?: number; cost_price?: number; unit?: string
  status?: string; publication_status?: PublicationStatus; category_id?: string; subcategory_id?: string
  discount_active?: boolean; discount_type?: string; discount_value?: number
  discount_start?: string | null; discount_end?: string | null
}
export interface ProductVariant {
  id: string; product_id: string; sku?: string; name?: string; attributes?: Record<string, string>
  sale_price: number; purchase_price?: number; barcode?: string; unit?: string; status?: string
  created_at: string; updated_at: string
}
export interface CreateVariantRequest { sku?: string; name?: string; attributes?: Record<string, string>; sale_price: number; purchase_price?: number; barcode?: string; unit?: string }
export interface UpdateVariantRequest { sku?: string; name?: string; attributes?: Record<string, string>; sale_price?: number; purchase_price?: number; barcode?: string; unit?: string; status?: string }
export interface ProductImageResponse { id: string; product_id: string; variant_id?: string; url: string; file_name?: string; sort_order?: number; is_primary: boolean; created_at: string }

/* ---------- Seller: Inventory & Stock ---------- */
// GET /shops/:id/inventory nests the row under `inventory` (unlike stock
// movements, which are flat) -- shape confirmed against the live API.
export interface InventoryItem {
  inventory: {
    id: string; business_id: string; shop_id: string; product_id: string; variant_id: string
    quantity: number; reserved_quantity: number; available: number
    created_at: string; updated_at: string
  }
  variant?: ProductVariant
  product?: Product
}
export interface StockMovement {
  id: string; business_id: string; shop_id: string; product_id: string; variant_id?: string | null
  variant?: ProductVariant; product?: Product
  movement_type: string; quantity: number; previous_quantity: number; new_quantity: number
  notes?: string; created_at: string
}
export interface StockReceipt { id: string; shop_id: string; supplier: string; notes?: string; status: string; created_at: string; updated_at: string }
export interface CreateStockReceiptRequest { supplier: string; notes?: string; lines: Array<{ variant_id: string; quantity: number; unit_cost: number }> }
export interface AddStockRequest { variant_id: string; quantity: number; notes?: string }
export interface RecordSaleRequest { variant_id: string; quantity: number; customer_id?: string; employee_id?: string; notes?: string }

/* ---------- Seller: Customers ---------- */
export interface Customer {
  id: string; business_id: string; first_name: string; last_name: string; phone?: string | null; email?: string | null; status: string; created_at: string; updated_at: string
  total_orders?: number; total_purchased?: number
}
export interface CreateCustomerRequest { first_name: string; last_name: string; phone?: string; email?: string }
export interface UpdateCustomerRequest { first_name?: string; last_name?: string; phone?: string; email?: string; status?: string }

/* ---------- Seller: Cash Management ---------- */
export interface CashSession {
  id: string; business_id: string; shop_id: string; employee_id?: string | null
  shop_name?: string; employee_first_name?: string; employee_last_name?: string
  opened_at: string; closed_at?: string | null; opening_amount: number; currency: string
  cash_sales_total: number; expected_amount: number
  declared_closing_amount?: number | null; difference?: number | null; reconciliation_result?: string | null
  status: 'OPEN' | 'CLOSED' | 'RECONCILED'; created_at: string
}
export interface CashPayment { id: string; session_id: string; order_id: string; amount: number; payment_method: string; received_by?: string; created_at: string }
export interface CashSummarySeller { employee_id: string; first_name: string; last_name: string; total_cash_sales: number; open_sessions: number; closed_sessions: number; total_shortage: number; total_overage: number }
export interface CashSummaryShop { shop_id: string; shop_name: string; total_cash_sales: number; open_sessions: number; closed_sessions: number; total_shortage: number; total_overage: number; seller_breakdown: CashSummarySeller[] }
export interface CashSummary { business_id: string; total_cash_sales: number; shop_breakdown: CashSummaryShop[]; seller_breakdown: CashSummarySeller[] }

/* ---------- Seller: Growth ---------- */
export interface PointAccount { id: string; owner_type: string; owner_id: string; current_points: number; lifetime_points: number; reserved_points: number; level_id?: string | null; status: string; updated_at: string }
export interface PointTransaction { id: string; reference_type: string; reference_id: string; type: string; points_change: number; previous_points: number; new_points: number; created_at: string }
export interface SellerLevelInfo { name: string; min_points: number; max_points: number; search_boost: number; recommendation_eligible: boolean; high_value_buyer_access: boolean; progress_to_next_level_percent: number; description: string }
export interface SellerTrustInfo { trust_status: 'HIGH' | 'NORMAL' | 'LOW' | 'SUSPENDED'; verified_sales_count: number; order_completion_rate: number; cancellation_rate: number; purchase_confirmation_rate: number; stock_reliability_rate: number }
export interface LevelBenefitInfo { benefit_type: string; benefit_value: number }
export interface SellerGrowth { points: PointAccount; level: SellerLevelInfo; trust: SellerTrustInfo; benefits: LevelBenefitInfo[]; high_value_buyer_eligible: boolean }
export interface SellerPointsHistory { account: PointAccount; transactions: PointTransaction[]; level_name: string; next_level?: SellerLevelInfo }

/** A courier handover scan. The token is the opaque value encoded in the package QR. */
export interface QRScanRequest {
  token: string
  order_id?: string
  /** Makes a retry after a network failure provably safe to repeat. */
  idempotency_key: string
  latitude?: number
  longitude?: number
  device_id?: string
  device_metadata?: Record<string, unknown>
}

export interface QRScanResponse {
  result: 'SUCCESS' | 'DUPLICATE'
  order_id: string
  package_id: string
  delivery_status: string
  requires_buyer_confirmation: boolean
}

/* ---------- Seller: Finances & Commissions ---------- */
export interface SellerFinanceSummary {
  gross_sales: number
  total_commission: number
  net_revenue: number
  commission_due: number
  commission_collected: number
  sales_count: number
}

export interface SellerSaleCommissionItem {
  id: string
  order_id: string
  order_number: string
  business_id: string
  business_name?: string
  shop_id: string
  shop_name?: string
  gross_amount: number
  commission_base: number
  commission_rate: number
  commission_amount: number
  seller_net_amount: number
  status: 'DUE' | 'COLLECTED' | 'WAIVED' | 'ADJUSTED'
  calculated_at: string
  collected_at?: string
  created_at: string
}

export interface SellerSaleCommissionDetail extends SellerSaleCommissionItem {
  delivery_fee: number
  points_discount: number
  buyer_cash_due: number
  payment_status: string
}

