export type AccountType = 'BUYER' | 'SELLER' | 'EMPLOYEE' | 'COURIER'

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
    courier?: boolean
    employee?: boolean
  }
  avatar_url?: string | null
  created_at?: string
  middle_name?: string | null
  city?: string | null
  commune?: string | null
  status?: string
}

export const canBuy = (user?: User | null) => user?.capabilities?.buyer ?? (user?.account_type !== 'EMPLOYEE' && user?.account_type !== 'COURIER')
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
  province?: string; province_id?: string
  city?: string; city_id?: string
  commune?: string; commune_id?: string
  street?: string; building_number?: string; landmark?: string
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
  /** Set on a shop's product-review tab (type=product): which item was reviewed. */
  product_name?: string
  variant_name?: string
  image_url?: string
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
  province?: string; commune?: string; street?: string; building_number?: string; landmark?: string
}
export interface UpdateShopRequest {
  name?: string; type?: string; city?: string; address?: string; phone?: string; status?: string
  supports_shop_delivery?: boolean; shop_delivery_fee?: number
  supports_partner_delivery?: boolean; partner_delivery_fee?: number; partner_delivery_provider?: string
  delivery_city?: string; delivery_address?: string
  province?: string; commune?: string; street?: string; building_number?: string; landmark?: string
  province_id?: string; city_id?: string; commune_id?: string
}
export interface CreateShopRequest {
  name: string; type: 'PHYSICAL' | 'ONLINE'; city: string; address: string; phone: string
  supports_shop_delivery?: boolean; shop_delivery_fee?: number
  supports_partner_delivery?: boolean; partner_delivery_fee?: number; partner_delivery_provider?: string
  delivery_city?: string; delivery_address?: string
  province: string; commune: string; street: string; building_number: string; landmark?: string
  province_id?: string; city_id?: string; commune_id?: string
}
export interface BuyerProfile {
  id: string; first_name: string; last_name: string; email: string; phone: string
  backup_phone?: string; address?: string; city?: string; commune?: string
  province?: string; province_id?: string; city_id?: string; commune_id?: string
  street?: string; building_number?: string; landmark?: string
  country?: string; latitude?: number | null; longitude?: number | null
  status?: string; created_at?: string; updated_at?: string
}
export interface UpdateBuyerProfileRequest {
  first_name?: string
  last_name?: string
  phone?: string
  backup_phone?: string
  address?: string
  province?: string; province_id?: string; city_id?: string; commune_id?: string
  city?: string
  commune?: string
  street?: string; building_number?: string; landmark?: string
  country?: string
  latitude?: number | null
  longitude?: number | null
}
export interface Business {
  id: string; name: string; status: string
  business_type?: string; category?: string; phone?: string; whatsapp?: string; email?: string
  country?: string; city?: string; default_currency?: string
  created_at?: string; updated_at?: string
  province?: string; commune?: string; street?: string; building_number?: string; landmark?: string
}
export interface BusinessLifecycleSummary {
  shops: number; products: number; employees: number; inventory_units: number
  active_orders: number; historical_orders: number; unresolved_payments: number
  shop_summaries: Array<{ id: string; name: string; status: string; product_count: number }>
}
export interface ArchiveBusinessResponse { action: 'archived'; summary: BusinessLifecycleSummary }
/** Delivery commitment and outcome carried by every view of an order. */
export interface DeliveryPlan {
  expected_delivery_date?: string | null
  expected_delivery_slot?: 'MORNING' | 'AFTERNOON' | 'EVENING' | ''
  delivery_attempts?: number
  cancelled_stage?: 'NOT_ASSIGNED' | 'COURIER_ASSIGNED' | 'IN_DELIVERY' | 'BUYER_NOT_FOUND' | ''
  returned_to_seller_at?: string | null
  /** Each courier step, dated when it happened (TBK delivery). */
  courier_assigned_at?: string | null
  courier_accepted_at?: string | null
  pickup_verified_at?: string | null
  courier_started_at?: string | null
  courier_arrived_at?: string | null
}
export interface BuyerOrder extends DeliveryPlan { points_used?: number; points_discount_amount?: number; delivery_points_used?: number; delivery_fee_base?: number; id: string; order_number?: string; shop_id: string; status: string; total_items: number; base_total?: number; final_total: number; currency?: string; created_at: string; delivery_method?: string; delivery_status?: string; delivery_fee_final?: number; delivery_contact_name?: string; delivery_phone?: string; delivery_address?: string; delivery_notes?: string; notes?: string }
export interface SellerOrder extends BuyerOrder {
  business_id: string
  base_total?: number
  delivery_method?: string
  notes?: string
}
export interface OrderLine { id: string; product_id: string; variant_id: string; quantity: number; unit_price?: number; final_unit_price: number; product_name: string; variant_name?: string; variant_sku?: string; variant_attributes?: Record<string, string>; image_url?: string }
export interface OrderStatusHistory { id: string; order_id: string; status: string; changed_by?: string | null; actor_type?: string; notes: string; created_at: string }
export interface TrackingResponse extends DeliveryPlan { order_id: string; order_number: string; current_status: string; delivery_status?: string | null; delivery_method: string; payment_status: string; latest_update: string; latest_update_at?: string | null; history: OrderStatusHistory[] }
export interface BuyerPayment {
  id: string; order_id: string; shop_id: string; shop_name?: string
  payment_method: string; currency: string
  products_base_total: number; products_points_used: number
  products_points_discount: number; products_final_total: number
  delivery_fee_base: number; delivery_points_used: number
  delivery_points_discount: number; delivery_fee_final: number
  cash_due: number
  payment_markup: number; final_total: number
  /** MPESA | AIRTEL_MONEY | ORANGE_MONEY for mobile money; empty for cash. */
  provider?: string; provider_label?: string; payer_phone?: string
  provider_reference?: string; payment_timing: 'NOW' | 'DELIVERY'
  /** Our reference from creation; replaced on receipts by the operator's once settled. */
  internal_reference?: string; receipt_reference?: string; receipt_issued_at?: string | null
  /** Frozen history from the retired buyer/seller declaration rule. */
  buyer_confirmed: boolean; buyer_confirmed_at?: string | null
  seller_confirmed: boolean; seller_confirmed_at?: string | null
  /** DUE / PROCESSING while money is owed; PAID (or legacy VERIFIED) once it arrived. */
  status: string; verified_at?: string | null; created_at: string
  paid_at?: string | null; cash_received_at?: string | null
  /** COURIER for cash taken at the door, PROVIDER for a settled mobile payment. */
  confirmation_actor?: string | null; confirmed_by_user_id?: string | null
  payable?: boolean; payable_reason?: string
  updated_at?: string
}
export interface PaymentMethodConfig { code: string; label: string; enabled: boolean; timing: 'NOW'|'DELIVERY'; channel: 'CASH'|'MOBILE'|'ONLINE'; markup_type: 'NONE'|'PERCENTAGE'|'FIXED'; markup_value: number; markup_amount: number; quoted_total: number; provider?: string }
/** The three mobile money operators. The backend enforces the same set. */
export type PaymentProviderCode = 'MPESA' | 'AIRTEL_MONEY' | 'ORANGE_MONEY'
export interface PaymentProvider { code: PaymentProviderCode; label: string; enabled: boolean; display_order: number }
export interface CheckoutQuote { order_id: string; currency: string; subtotal: number; discount: number; points_discount: number; delivery_fee: number; payment_markup: number; final_total: number; selected_payment_method: string; payment_methods: PaymentMethodConfig[]; providers?: PaymentProvider[] }
export interface PaymentInitiation { payment_id: string; status: string; provider: string; reference: string; amount: number; currency: string; redirect_url?: string; instructions?: string }

/* ---------- Multi-shop cart (same contract as the web) ---------- */
/** A cart line carries its own shop; the backend groups lines into one order per shop. */
export interface CartLineInput { product_id: string; variant_id: string; shop_id: string; quantity: number }
/** A problem with one specific line. The rest of the cart stays valid. */
export interface CartLineIssue {
  product_id: string; variant_id: string; shop_id: string
  product_name?: string; variant_name?: string
  code: string; message: string; available: number; requested: number
}
export interface CartShopGroup {
  shop_id: string; shop_name: string; currency: string
  subtotal: number; item_count: number
  order_id?: string; order_number?: string
  lines: CartLineInput[]
}
export interface CartPreview {
  currency: string; subtotal: number; item_count: number; shop_count: number
  shops: CartShopGroup[]; issues: CartLineIssue[]; checkoutable: boolean
  available_points: number; points_discount_amount: number; final_total: number
}
export interface CheckoutCreated {
  checkout_group_id: string; currency: string; subtotal: number
  shop_count: number; shops: CartShopGroup[]; order_ids: string[]
}

/* ---------- Handover at the door (buyer + courier) ---------- */
export interface HandoverLine {
  order_line_id: string; product_id: string; variant_id: string
  product_name: string; variant_name: string; product_number: string
  attributes?: Record<string, unknown>; image_url?: string
  quantity: number; unit_price: number; line_total: number
  product_verified: boolean; verified_at?: string; verified_by_role?: string
  buyer_acknowledged: boolean
}
/**
 * The server's own view of where the handover stands. Buttons are driven by the
 * `*_can_*` flags, never re-derived, so the app cannot offer a refused step.
 */
export interface HandoverState {
  order_id: string; order_number: string; order_status: string; delivery_status: string; stage: string
  buyer_name?: string; buyer_phone?: string; delivery_address?: string; shop_name?: string; seller_name?: string
  payment_method: string; payment_status: string; payment_timing?: string; payment_provider?: string
  amount_due: number; currency: string; payment_verified: boolean
  lines: HandoverLine[]
  courier_arrived: boolean; all_products_verified: boolean; all_lines_acknowledged: boolean
  delivery_scanned: boolean; receipt_confirmed: boolean
  courier_can_verify_product: boolean; courier_can_confirm_cash: boolean
  buyer_can_acknowledge: boolean; buyer_can_confirm_receipt: boolean
  blocked_reason?: string
}
export interface HandoverLineAcknowledgement { order_line_id: string; product_received: boolean; matches_order: boolean; quantity_correct: boolean }
export type HandoverResult = 'VALID' | 'ALREADY_USED' | 'WRONG_PRODUCT' | 'WRONG_VARIANT' | 'WRONG_ORDER' | 'WRONG_SHOP' | 'INVALID_QR'
export interface HandoverVerificationResult {
  result: HandoverResult; reason?: string; verification_method: 'QR_SCAN' | 'MANUAL_PRODUCT_NUMBER'
  order_id: string; order_number?: string; order_line_id?: string
  product_id?: string; variant_id?: string; product_name?: string; product_number?: string; variant_name?: string
  shop_name?: string; seller_name?: string; quantity?: number; unit_price?: number; line_total?: number; currency?: string; verified_at?: string
}
export interface ConfirmCashResponse {
  order_id: string; payment_id: string; payment_status: string; amount_collected: number; currency: string
  commission_status: string; commission_amount: number; commission_collected: boolean; already_confirmed: boolean
}

/* ---------- Courier missions ---------- */
export type CourierAvailability = 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE'
export interface CourierProfile {
  status: string; availability: CourierAvailability; first_name?: string; last_name?: string
  transport_type?: string; service_zone?: string; completed_today?: number; total_deliveries?: number
}
/** GET /courier/history row, exactly as the backend returns it. */
export interface CourierHistoryItem {
  order_id: string; order_number: string; shop_name: string; delivery_address: string
  assigned_at?: string | null; delivered_at?: string | null; final_status: string; incident_status?: string
}
export interface CourierMission extends DeliveryPlan {
  order_id: string; order_number: string; status: string; delivery_status: string
  shop_name: string; business_name: string; shop_address: string; service_zone: string; package_count: number
  delivery_address: string; delivery_contact: string; delivery_phone: string; delivery_notes?: string
  total_amount?: number; currency?: string; payment_method?: string; payment_status?: string
  assigned_at?: string | null; accepted_at?: string | null; ready_at?: string | null; picked_up_at?: string | null
  started_at?: string | null; arrived_at?: string | null; delivered_at?: string | null
}
/** The package label the courier scans at pickup (GET /orders/:id/package-qr). */
export interface PackageQR { reference: string; status: string; package_number: number; operational: boolean; pickup_verified_at?: string | null; delivery_scanned_at?: string | null }
export interface OrderDetail { order: BuyerOrder; lines: OrderLine[]; history?: OrderStatusHistory[]; shop_name: string; business_name?: string; seller_name?: string }

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
  province?: string; city?: string; commune?: string
  street?: string; building_number?: string; landmark?: string
  province_id?: string; city_id?: string; commune_id?: string
}

export interface DeliverySelectResponse {
  order_id: string; products_final_total: number
  delivery: DeliverySummary; total_due: number
}

export interface SelectDeliveryRequest {
  method?: DeliveryMethod | string; use_points_for_delivery: boolean
  contact_name?: string; phone?: string; address?: string; notes?: string
  province?: string; city?: string; commune?: string; street?: string; building_number?: string; landmark?: string
  province_id?: string; city_id?: string; commune_id?: string
  save_address?: boolean
}

export interface DeliveryPointsPreview {
  method: string; fee_base: number; points_used: number
  points_discount_amount: number; fee_final: number; currency: string
  available_points: number; maximum_usable_points: number
  redeem_rate: number; max_delivery_point_coverage: number
}
export interface ReviewEligibility { eligible: boolean; reason: string; existing_review_id?: string }
export interface BuyerReview { id: string; order_id: string; product_id?: string; shop_id?: string; order_line_id?: string; rating: number; comment: string; verified_purchase: boolean; status: string; delivery_rating?: number; service_rating?: number; order_experience_rating?: number; created_at: string }
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
/** GET /variants/:id/inventory — one flat row per shop holding this variant. */
export interface VariantInventoryRow { id: string; shop_id: string; product_id?: string; variant_id: string; quantity: number; reserved_quantity: number; available?: number }
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

/* ---------- Buyer: points & in-store purchases (web api/types.ts) ---------- */
export interface BuyerPointsSummary { available_points: number; reserved_points: number; lifetime_points: number; level: string }
export interface BuyerLevelInfo { name: string; min_points: number; max_points: number; discount_percent: number; delivery_discount_percent: number; free_delivery: boolean; progress_to_next_level_percent: number; description: string }
export interface PointHistoryResponse { account: PointAccount; transactions: PointTransaction[]; level_name: string; next_level?: unknown; buyer_next_level?: BuyerLevelInfo }
export interface PendingPurchase { order_id: string; shop_id: string; shop_name: string; business_name: string; amount: number; currency: string; employee_name: string; created_at: string }

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

export interface ProductVerification {
  result: 'SUCCESS'; order_id: string; order_reference: string
  product_id: string; variant_id: string; product_name: string; product_number: string
  seller: string; shop: string; variant: string; attributes: Record<string, unknown>
  quantity: number; unit_price: number; product_total: number; currency: string
  verification_method: 'QR_SCAN' | 'MANUAL_PRODUCT_NUMBER'
}

/* ---------- Seller: Finances & Commissions ---------- */
// Mirrors the backend's SellerFinanceSummary exactly. The field names here
// used to diverge from the API (total_commission / net_revenue / sales_count),
// which made every card read as $0.00 no matter the real revenue.
export interface SellerFinanceSummary {
  gross_sales: number
  tbk_commission_total: number
  seller_net_revenue: number
  commission_due: number
  commission_collected: number
  // Buyer-payment axis, kept separate from the commission axis above.
  payments_received: number
  payments_due: number
  units_sold: number
  /** Live platform rate, so the commission card never hardcodes a percentage. */
  commission_rate: number
  total_completed_sales: number
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
  currency?: string
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


/* ---------- ORDER_ITEM QR ----------
 * One QR per ordered line. The scanned code is only the signed opaque token
 * (tbk.oi.<reference>.<signature>): the app posts it verbatim to /qr/resolve and
 * never decodes it. The backend authenticates the courier, resolves their role
 * against the order and returns only the fields that role may see — fields it
 * withholds simply do not arrive, and are never reconstructed here.
 * Contract: backend/internal/models/order_item_qr.go
 */

export type QRRole = 'BUYER' | 'SELLER' | 'COURIER' | 'ADMIN'

export interface OrderItemQR {
  reference: string
  token?: string
  order_id: string
  order_item_id: string
  product_id: string
  variant_id: string
  status: string
  label_url?: string
  created_at: string
}

export interface OrderItemQRIdentity {
  reference: string
  order_id: string
  order_item_id: string
  status: string
}

export interface OrderItemQRProduct {
  product_id: string
  product_number?: string
  product_name: string
  product_image?: string
  product_sku?: string
  variant_id: string
  variant_name: string
  variant_sku?: string
  size?: string
  color?: string
  attributes?: Record<string, unknown>
  quantity: number
}

export interface OrderItemQRShop {
  shop_id: string
  shop_name: string
  shop_reference?: string
  business_id: string
  seller_name?: string
}

export interface OrderItemQROrder {
  order_id: string
  order_number: string
  order_item_id: string
  order_date: string
  order_status: string
  delivery_status?: string
  delivery_method?: string
  payment_method?: string
  payment_status?: string
  payment_timing?: string
}

/**
 * Immutable pricing snapshot. For a courier the backend zeroes everything except
 * `currency` and, on a cash-on-delivery order, `amount_to_collect`. A missing or
 * zero `amount_to_collect` means nothing to collect — not an amount of zero.
 */
export interface OrderItemQRPrice {
  unit_price: number
  quantity: number
  subtotal: number
  discount: number
  points_discount: number
  item_total: number
  delivery_fee: number
  payment_markup?: number
  payment_markup_type?: string
  amount_to_collect?: number
  final_amount: number
  currency: string
}

export interface OrderItemQRBuyer {
  buyer_profile_id?: string
  buyer_reference?: string
  first_name?: string
  last_name?: string
  display_name?: string
  phone?: string
  email?: string
}

export interface OrderItemQRAddress {
  recipient_name?: string
  recipient_phone?: string
  province?: string
  city?: string
  commune?: string
  street?: string
  building_number?: string
  landmark?: string
  delivery_instructions?: string
}

export interface OrderItemQRResolution {
  qr: OrderItemQRIdentity
  role: QRRole
  product: OrderItemQRProduct
  shop: OrderItemQRShop
  order: OrderItemQROrder
  price: OrderItemQRPrice
  buyer?: OrderItemQRBuyer
  delivery_address?: OrderItemQRAddress
}

export interface OrderItemQRResolveRequest {
  token: string
}

/* ---------- Seller: finances (same contract as web api/seller.ts sellerFinanceApi) ---------- */
export interface SellerFinanceCurrencyTotal { currency: string; gross_sales: number; commission_amount: number; seller_net_amount: number; collected_commission: number; due_commission: number; payments_collected: number; payments_due: number; units_sold: number; verified_sales: number }
export interface SellerFinanceDashboard {
  gross_sales: number; commission_amount: number; seller_net_amount: number; collected_commission: number; due_commission: number; waived_commission: number
  collected_cash: number; collected_mobile: number; payments_collected: number; payments_due: number; payments_pending?: number; refunded_amount?: number
  units_sold: number; verified_sales: number; refunded_sales: number; pending_orders: number; commission_rate: number; currency?: string
  mixed_currency: boolean; totals_by_currency: SellerFinanceCurrencyTotal[]
}
export interface SellerFinanceBreakdownItem { id?: string; label: string; sub_label: string; gross_sales: number; commission_amount: number; seller_net_amount: number; collected: number; due: number; payments_collected?: number; payments_due?: number; sales_count: number; units_sold: number; currency: string }
export interface SellerFinanceTimeseriesPoint { period: string; gross_sales: number; commission_amount: number; seller_net_amount: number; collected: number; due: number; sales_count: number; currency: string }
export type SellerBreakdownGroup = 'shop' | 'product' | 'variant' | 'business'
export interface SellerFinanceParams { shop_id?: string; product_id?: string; variant_id?: string; payment_status?: string; commission_status?: string; date_from?: string; date_to?: string }
export interface SaleFinanceLine { product_id?: string; product_name: string; product_sku: string; variant_id?: string; variant_name: string; variant_sku: string; quantity: number; unit_price: number; points_discount: number; final_unit_price: number; gross_amount: number }
export interface SaleHistoryItem extends SellerSaleCommissionItem {
  buyer_name: string; payment_method: string; provider?: string; payment_reference?: string; payment_status: string
  order_status: string; delivery_method: string; delivery_status: string; total_quantity: number; lines: SaleFinanceLine[]
}
export interface SaleFinanceDetail {
  sale: SellerSaleCommissionItem; buyer_name: string; payment_method: string; provider?: string; payment_reference?: string; payment_status: string
  order_status: string; delivery_method: string; delivery_status: string; payment_markup: number; delivery_fee: number
  products_subtotal: number; final_total: number; ordered_at: string; verified_at?: string; lines: SaleFinanceLine[]
}
