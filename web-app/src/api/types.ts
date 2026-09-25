export interface ApiErrorBody {
  error: { code: string; message: string }
}

export class ApiError extends Error {
  status: number
  code: string
  data?: Record<string, unknown>
  constructor(status: number, code: string, message: string, data?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.data = data
  }
}

export interface SuccessEnvelope<T> {
  message?: string
  data: T
}

export interface Pagination {
  page: number
  limit: number
  total: number
  has_more: boolean
}

/* ---------- Auth ---------- */

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface RegisterResponse {
  user_id: string
}

export interface RegisterRequest {
  first_name: string
  last_name: string
  phone: string
  backup_phone?: string
  email: string
  password: string
  password_confirmation: string
  address?: string
  province: string
  street: string
  building_number: string
  landmark?: string
  city?: string
  commune?: string
  country?: string
  latitude?: number | null
  longitude?: number | null
}

/* ---------- Buyer profile ---------- */

export interface BuyerProfile {
  id: string
  user_id: string
  first_name: string
  last_name: string
  phone: string
  backup_phone: string
  address: string
  province: string
  street: string
  building_number: string
  landmark: string
  email: string
  city?: string
  commune?: string
  province_id?: string
  city_id?: string
  commune_id?: string
  country?: string
  latitude?: number | null
  longitude?: number | null
  status: string
  created_at: string
  updated_at: string
}

export interface CreateBuyerProfileRequest {
  first_name: string
  last_name: string
  phone: string
  backup_phone?: string
  email: string
  address?: string
  province?: string
  city?: string
  commune?: string
  province_id?: string
  city_id?: string
  commune_id?: string
  street?: string
  building_number?: string
  landmark?: string
  country?: string
  latitude?: number | null
  longitude?: number | null
}

export interface UpdateBuyerProfileRequest {
  first_name?: string
  last_name?: string
  phone?: string
  backup_phone?: string
  address?: string
  province?: string
  city?: string
  commune?: string
  province_id?: string
  city_id?: string
  commune_id?: string
  street?: string
  building_number?: string
  landmark?: string
  country?: string
  latitude?: number | null
  longitude?: number | null
}

/* ---------- Categories ---------- */

export interface SubcategoryResponse {
  id: string
  name: string
  slug: string
  sort_order: number
}

export interface CategoryResponse {
  id: string
  name: string
  slug: string
  sort_order: number
  subcategories?: SubcategoryResponse[]
}

export interface CategoryAttributeDefinition {
  id: string
  category_id: string
  subcategory_id?: string
  key: string
  label_en: string
  label_fr: string
  required: boolean
  variant_attribute: boolean
  input_type: string
  allowed_values: string[]
  display_order: number
}

export interface MissingAttributesApiError {
  code: 'MISSING_REQUIRED_ATTRIBUTES'
  message: string
  missing_keys: string[]
  missing_labels_fr: string[]
  category_id: string
  category_slug: string
  subcategory_slug?: string
}


/* ---------- Marketplace ---------- */

export interface PublicVariant {
  id: string
  sku: string
  unit_price: number
  base_price: number
  stock: string
  stock_quantity: number
}

export interface PublicProduct {
  id: string
  shop_id: string
  shop_name: string
  business_id: string
  business_name: string
  name: string
  sku: string
  description: string
  unit: string
  base_price: number
  currency?: string
  category_id?: string | null
  category_name?: string | null
  category_slug?: string | null
  subcategory_id?: string | null
  subcategory_name?: string | null
  subcategory_slug?: string | null
  variants?: PublicVariant[] | null
  images?: ProductImageResponse[]
  seller_level: string
  seller_trust: string
  availability?: string
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
  created_at: string
}

export interface PublicVariantDetail {
  id: string
  sku: string
  name: string
  attributes: Record<string, string>
  unit_price: number
  base_price: number
  stock: string
  stock_quantity: number
}

export interface PublicProductDetail {
  id: string
  shop_id: string
  shop_name: string
  business_id: string
  business_name: string
  name: string
  sku: string
  description: string
  unit: string
  base_price: number
  currency?: string
  category_id?: string | null
  subcategory_id?: string | null
  category?: CategoryResponse
  subcategory?: CategoryResponse
  variants: PublicVariantDetail[]
  images?: ProductImageResponse[]
  seller_level: string
  seller_trust: string
  availability: string
  discount_active?: boolean
  discount_type?: string
  discount_value?: number
  discount_start?: string | null
  discount_end?: string | null
  seller_sale_price?: number
  /** Seller's own 1-5 star claim for this product. Not a buyer review. */
  self_rating?: number | null
  created_at: string
  buyer_level?: string
  discount_percent?: number
  discount_amount?: number
  final_price?: number
  free_delivery?: boolean
  delivery_discount_percent?: number
}

export interface BuyerPriceResponse {
  base_price: number
  buyer_level: string
  discount_percent: number
  discount_amount: number
  final_price: number
  free_delivery: boolean
  delivery_discount_percent: number
}

export interface PublicShop {
  id: string
  business_id: string
  business_name: string
  name: string
  type: string
  city: string
  address: string
  phone: string
  status: string
  seller_level: string
  seller_trust: string
  product_count: number
  created_at: string
}

export interface CategorySummary {
  id: string
  name: string
  slug: string
}

export interface PublicShopDetail {
  id: string
  business_id: string
  business_name: string
  name: string
  type: string
  city: string
  address: string
  phone: string
  status: string
  seller_level: string
  seller_trust: string
  product_count: number
  categories: CategorySummary[]
  average_rating?: number
  total_reviews?: number
  created_at: string
}

export interface RankedShop {
  shop_id: string
  business_id: string
  business_name: string
  name: string
  city: string
  seller_level: string
  seller_trust: string
  ranking_score: number
  ranking_position: number
}

export interface MarketplaceSearchResult {
  products: PublicProduct[]
  pagination: Pagination
}

export interface PaginatedShops {
  shops: PublicShop[]
  pagination: Pagination
}

export interface PaginatedProducts {
  products: PublicProduct[]
  pagination: Pagination
}

/* ---------- Reviews ---------- */

export interface ShopReviewAggregate {
  shop_id: string
  average_rating: number
  total_reviews: number
  rating_1_count: number
  rating_2_count: number
  rating_3_count: number
  rating_4_count: number
  rating_5_count: number
  last_review_at?: string | null
  updated_at: string
}

export interface PublicReview {
  id: string
  rating: number
  comment: string
  verified_purchase: boolean
  buyer_display_name: string
  created_at: string
  helpful_count: number
  helpful_by_me: boolean
  replies: ReviewReply[]
  delivery_rating?: number
  service_rating?: number
  order_experience_rating?: number
  product_id?: string
  product_name?: string
  variant_name?: string
  image_url?: string
}

export interface ReviewReply {
  id: string
  review_id: string
  author_display_name: string
  body: string
  created_at: string
}

export interface ProductReviewsResponse {
  product_id: string
  summary: Omit<ShopReviewAggregate, 'shop_id' | 'last_review_at' | 'updated_at'>
  reviews: PublicReview[]
  pagination: Pagination
}

export interface ShopReviewsResponse {
  shop_id: string
  summary: ShopReviewAggregate
  reviews: PublicReview[]
  pagination: Pagination
}

export interface SimilarProductsResponse {
  products: PublicProduct[] | null
  pagination: Pagination
}

export interface ReviewResponse {
  id: string
  order_id: string
  buyer_profile_id: string
  business_id: string
  shop_id: string
  product_id?: string
  order_line_id?: string
  variant_id?: string
  rating: number
  delivery_rating?: number
  service_rating?: number
  order_experience_rating?: number
  comment: string
  verified_purchase: boolean
  status: string
  created_at: string
  updated_at: string
}

export interface BuyerReviewsResponse {
  reviews: ReviewResponse[]
  pagination: Pagination
}

export interface ReviewEligibilityResponse {
  eligible: boolean
  reason?: string
  existing_review_id?: string
}

/* ---------- Points ---------- */

export interface PointAccount {
  id: string
  owner_type: string
  owner_id: string
  current_points: number
  lifetime_points: number
  reserved_points: number
  level_id?: string | null
  status: string
  updated_at: string
}

export interface BuyerPointsSummary {
  available_points: number
  reserved_points: number
  lifetime_points: number
  level: string
}

export interface PointTransaction {
  id: string
  reference_type: string
  reference_id: string
  type: string
  points_change: number
  previous_points: number
  new_points: number
  created_at: string
}

export interface BuyerLevelInfo {
  name: string
  min_points: number
  max_points: number
  discount_percent: number
  delivery_discount_percent: number
  free_delivery: boolean
  progress_to_next_level_percent: number
  description: string
}

export interface PointHistoryResponse {
  account: PointAccount
  transactions: PointTransaction[]
  level_name: string
  next_level?: unknown
  buyer_next_level?: BuyerLevelInfo
}

export interface PointRedemptionPreviewResponse {
  base_total: number
  points_used: number
  points_discount_amount: number
  final_total: number
  currency: string
  available_points: number
  maximum_usable_points: number
  redeem_rate: number
  max_point_coverage: number
}

/* ---------- Orders ---------- */

export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RECEIVED'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'HANDED_TO_PARTNER'

export type DeliveryMethod = 'TBK_STANDARD' | 'PICKUP' | 'SHOP_DELIVERY' | 'PARTNER'

export interface OrderLineInput {
  product_id: string
  variant_id: string
  quantity: number
}

/**
 * When the courier committed to bring the parcel, how many attempts failed,
 * at which stage the order was cancelled and when a returned parcel reached
 * the seller. Every view of an order carries it.
 */
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

export interface BuyerOrder extends DeliveryPlan {
  id: string
  checkout_group_id?: string | null
  payment_method?: string
  business_id: string
  shop_id: string
  customer_id?: string | null
  buyer_profile_id?: string | null
  status: OrderStatus
  total_items: number
  /** Currency the order was sold in, snapshotted at checkout. */
  currency?: string
  notes: string
  created_by?: string | null
  base_total: number
  points_used: number
  points_discount_amount: number
  final_total: number
  idempotency_key?: string | null
  order_number?: string
  delivery_method: string
  delivery_fee_base: number
  delivery_points_used: number
  delivery_points_discount: number
  delivery_fee_final: number
  delivery_contact_name: string
  delivery_phone: string
  delivery_address: string
  delivery_province?: string
  delivery_city?: string
  delivery_commune?: string
  delivery_street?: string
  delivery_building_number?: string
  delivery_landmark?: string
  delivery_province_id?: string
  delivery_city_id?: string
  delivery_commune_id?: string
  delivery_notes: string
  delivery_status?: string
  points_finalized: boolean
  accepted_at?: string | null
  preparing_at?: string | null
  ready_at?: string | null
  out_for_delivery_at?: string | null
  delivered_at?: string | null
  received_at?: string | null
  completed_at?: string | null
  created_at: string
  updated_at: string
}

export interface OrderLine {
  id: string
  order_id: string
  product_id: string
  variant_id: string
  quantity: number
  unit_price: number
  base_unit_price: number
  points_discount_per_unit: number
  final_unit_price: number
  created_at: string
  product_name: string
  product_sku: string
  variant_name: string
  variant_sku: string
  variant_attributes: Record<string, string>
  image_url: string
}

export interface OrderStatusHistory {
  id: string
  order_id: string
  status: string
  changed_by?: string | null
  actor_type?: string
  notes: string
  created_at: string
}

export interface OrderWithLines {
  order: BuyerOrder
  lines: OrderLine[]
  history?: OrderStatusHistory[]
  shop_name: string
  business_name?: string
  seller_name?: string
}

export interface BuyerCreateOrderRequest {
  shop_id: string
  items: OrderLineInput[]
  use_points: boolean
  idempotency_key?: string
}

/* ---------- Delivery ---------- */

export interface DeliveryOption {
  method: DeliveryMethod
  label: string
  fee: number
  provider?: string
  available: boolean
}

export interface DeliveryOptionsResponse {
  order_id: string
  shop_id: string
  options: DeliveryOption[]
  current_method: string
}

export interface SelectDeliveryRequest {
  method?: DeliveryMethod | string
  use_points_for_delivery: boolean
  contact_name?: string
  phone?: string
  address?: string
  province?: string; city?: string; commune?: string; street?: string; building_number?: string; landmark?: string
  province_id?: string; city_id?: string; commune_id?: string
  notes?: string
  /** Persists this address as the buyer's primary profile address when true. */
  save_address?: boolean
}

export interface DeliverySummary {
  method: string
  fee_base: number
  points_used: number
  points_discount: number
  fee_final: number
  contact_name: string
  phone: string
  address: string
  province?: string; city?: string; commune?: string
  street?: string; building_number?: string; landmark?: string
  province_id?: string; city_id?: string; commune_id?: string
  notes: string
}

export interface DeliverySelectResponse {
  order_id: string
  products_final_total: number
  delivery: DeliverySummary
  total_due: number
}

export interface DeliveryPointsPreviewResponse {
  method: string
  fee_base: number
  points_used: number
  points_discount_amount: number
  fee_final: number
  currency: string
  available_points: number
  maximum_usable_points: number
  redeem_rate: number
  max_delivery_point_coverage: number
}

/* ---------- Payment (cash-first) ---------- */

export interface BuyerPayment {
  id: string
  order_id: string
  shop_id: string
  shop_name?: string
  buyer_profile_id: string
  payment_method: string
  currency: string
  products_base_total: number
  products_points_used: number
  products_points_discount: number
  products_final_total: number
  delivery_fee_base: number
  delivery_points_used: number
  delivery_points_discount: number
  delivery_fee_final: number
  cash_due: number
  payment_markup: number; final_total: number
  /** Normalised operator: MPESA | AIRTEL_MONEY | ORANGE_MONEY, or absent for cash. */
  provider?: PaymentProviderCode | ''
  provider_label?: string
  /** Our own reference, allocated when the payment is created. */
  internal_reference?: string
  payer_phone?: string
  /** Proof of a settled payment. Absent until it actually settles. */
  receipt_reference?: string
  receipt_issued_at?: string | null
  initiated_at?: string | null
  payment_markup_type?: 'NONE' | 'PERCENTAGE' | 'FIXED'; payment_markup_value?: number
  provider_reference?: string; payment_timing: 'NOW' | 'DELIVERY'
  /** Server-decided: may the buyer start paying this right now, and if not why. */
  payable?: boolean
  payable_reason?: string
  /**
   * Frozen history. These were written under the retired rule where a buyer declared
   * they had paid and a seller declared they had received; nothing sets them any more.
   */
  buyer_confirmed: boolean
  buyer_confirmed_at?: string | null
  seller_confirmed: boolean
  seller_confirmed_by?: string | null
  seller_confirmed_at?: string | null
  /** DUE / PROCESSING while money is owed; PAID (or legacy VERIFIED) once it arrived. */
  status: string
  verified_at?: string | null
  paid_at?: string | null
  /** COURIER for cash taken at the door, PROVIDER for a settled mobile payment. */
  confirmation_actor?: string | null
  confirmed_by_user_id?: string | null
  cash_received_at?: string | null
  created_at: string
  updated_at: string
}
export interface PaymentInitiation {
  payment_id: string
  status: string
  provider: string
  reference: string
  amount: number
  currency: string
  redirect_url?: string
  instructions?: string
}
export interface PaymentMethodConfig { code: string; label: string; enabled: boolean; timing: 'NOW'|'DELIVERY'; channel: 'CASH'|'MOBILE'|'ONLINE'; markup_type: 'NONE'|'PERCENTAGE'|'FIXED'; markup_value: number; markup_amount: number; quoted_total: number; provider?: string }

/** The three mobile money operators. The backend enforces the same set. */
export type PaymentProviderCode = 'MPESA' | 'AIRTEL_MONEY' | 'ORANGE_MONEY'

export interface PaymentProvider { code: PaymentProviderCode; label: string; enabled: boolean; display_order: number }

export interface CheckoutQuote {
  order_id: string; currency: string; subtotal: number; discount: number
  points_discount: number; delivery_fee: number; payment_markup: number; final_total: number
  selected_payment_method: string; payment_methods: PaymentMethodConfig[]
  /** Operators the buyer may pick, straight from the live catalog. */
  providers: PaymentProvider[]
}

/* ---------- Multi-shop cart ---------- */

/**
 * A cart line carries its own shop. Without it the client had to guess which
 * shop a variant came from - it used the first line's - which is what made a
 * second shop's product impossible to check out with.
 */
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

/* ---------- Tracking ---------- */

export interface QRIdentity {
  reference: string
  token?: string
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED'
  label_url?: string
  created_at?: string
}

export interface DeliveryPackageQR extends QRIdentity {
  package_id: string
  order_id: string
  package_number: number
  operational: boolean
  pickup_verified_at?: string | null
  delivery_scanned_at?: string | null
  receipt_confirmed_at?: string | null
}

export interface ProductVerification {
  result: 'SUCCESS'
  order_id: string
  order_reference: string
  product_id: string
  variant_id: string
  product_name: string
  product_number: string
  seller: string
  shop: string
  variant: string
  attributes: Record<string, unknown>
  quantity: number
  unit_price: number
  product_total: number
  currency: string
  verification_method: 'QR_SCAN' | 'MANUAL_PRODUCT_NUMBER'
}

export interface TrackingResponse extends DeliveryPlan {
  order_id: string
  order_number: string
  current_status: string
  delivery_status: string
  delivery_method: string
  payment_status: string
  latest_update: string
  latest_update_at?: string | null
  history: OrderStatusHistory[]
}

/* ---------- Purchase confirmation ---------- */

export interface PendingPurchase {
  order_id: string
  shop_id: string
  shop_name: string
  business_name: string
  amount: number
  currency: string
  employee_name: string
  created_at: string
}

/* ---------- Seller / Business ---------- */

export type AccountType = 'BUYER' | 'SELLER' | 'EMPLOYEE' | 'COURIER'

export interface User {
  id: string
  first_name: string
  middle_name: string
  last_name: string
  phone: string
  email: string
  status: string
  email_verified: boolean
  account_type: AccountType
  capabilities?: {
    buyer: boolean
    seller: boolean
    seller_onboarding: boolean
    courier?: boolean
    employee?: boolean
  }
  avatar_url?: string | null
  created_at: string
  updated_at: string
  city?: string
  commune?: string
}

export interface LoginResponseWithUser extends LoginResponse {
  user?: User
}

export interface Business {
  id: string
  name: string
  description?: string
  registration_number?: string
  tax_id?: string
  logo_url?: string
  status: string
  created_at: string
  updated_at: string
}

export interface SellerBusiness {
  id: string
  name: string
  business_type: string
  category: string
  phone: string
  whatsapp?: string
  email?: string
  country?: string
  city?: string
  province: string
  commune: string
  street: string
  building_number: string
  landmark: string
  default_currency?: string
  status: string
  created_at: string
  updated_at: string
}

export interface BusinessLifecycleSummary {
  shops: number
  products: number
  employees: number
  inventory_units: number
  active_orders: number
  historical_orders: number
  unresolved_payments: number
  shop_summaries: Array<{ id: string; name: string; status: string; product_count: number }>
}

export interface ArchiveBusinessResponse {
  action: 'archived'
  summary: BusinessLifecycleSummary
}

export interface Shop {
  id: string
  business_id: string
  name: string
  type: string
  city: string
  address: string
  province: string
  commune: string
  street: string
  building_number: string
  landmark: string
  phone: string
  status: string
  supports_shop_delivery: boolean
  shop_delivery_fee: number
  supports_partner_delivery: boolean
  partner_delivery_fee: number
  partner_delivery_provider?: string
  delivery_city?: string
  delivery_address?: string
  created_at: string
  updated_at: string
}

export interface CreateBusinessRequest {
  name: string
  business_type: string
  category: string
  phone: string
  whatsapp?: string
  email: string
  country?: string
  province: string
  city: string
  commune: string
  street: string
  building_number: string
  landmark?: string
  default_currency: string
  description?: string
  registration_number?: string
  tax_id?: string
}

export interface CreateShopRequest {
  name: string
  type: string
  city: string
  address: string
  province: string
  commune: string
  street: string
  building_number: string
  landmark?: string
  phone: string
  supports_shop_delivery?: boolean
  shop_delivery_fee?: number
  supports_partner_delivery?: boolean
  partner_delivery_fee?: number
  partner_delivery_provider?: string
  delivery_city?: string
  delivery_address?: string
}

export interface UpdateShopRequest {
  name?: string
  type?: string
  city?: string
  address?: string
  province?: string
  commune?: string
  province_id?: string
  city_id?: string
  commune_id?: string
  street?: string
  building_number?: string
  landmark?: string
  phone?: string
  status?: string
  supports_shop_delivery?: boolean
  shop_delivery_fee?: number
  supports_partner_delivery?: boolean
  partner_delivery_fee?: number
  partner_delivery_provider?: string
  delivery_city?: string
  delivery_address?: string
}

/* ---------- Employees ---------- */

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'TERMINATED'
export type EmployeeInvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'

export interface Employee {
  id: string
  business_id: string
  linked_user_id?: string | null
  first_name: string
  middle_name: string
  last_name: string
  phone: string
  email: string
  job_title: string
  status: EmployeeStatus
  created_at: string
  updated_at: string
}

export interface CreateEmployeeRequest {
  first_name: string
  middle_name?: string
  last_name: string
  phone?: string
  email?: string
  job_title: string
}

export interface UpdateEmployeeRequest {
  first_name?: string
  middle_name?: string
  last_name?: string
  phone?: string
  email?: string
  job_title?: string
  status?: string
}

export interface EmployeeShopAssignment {
  id: string
  employee_id: string
  shop_id: string
  assigned_by: string
  status: string
  assigned_at: string
  created_at: string
  updated_at: string
}

export interface AssignEmployeeRequest {
  shop_id: string
}

export interface EmployeeInvitation {
  id: string
  employee_id: string
  status: EmployeeInvitationStatus
  expires_at: string
  accepted_at?: string | null
  created_at: string
}

export interface CreateEmployeeInvitationRequest {
  employee_id: string
}

export interface EmployeeInvitationResponse {
  id: string
  employee_id: string
  status: EmployeeInvitationStatus
  expires_at: string
  invitation_url?: string
  created_at: string
}

export interface AcceptEmployeeInvitationRequest {
  token: string
  password: string
  password_confirmation: string
}

/* ---------- Products & Variants ---------- */

export type PublicationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface Product {
  id: string
  business_id: string
  name: string
  description: string
  sku: string
  unit_price?: number
  cost_price?: number
  /** Currency the product is priced in; USD for everything created now. */
  currency?: string
  unit?: string
  status?: string
  category_id?: string | null
  subcategory_id?: string | null
  category_name?: string
  variant_count?: number
  total_quantity?: number
  reserved_quantity?: number
  available_quantity?: number
  publication_status: PublicationStatus
  discount_active?: boolean
  discount_type?: string
  discount_value?: number
  discount_start?: string | null
  discount_end?: string | null
  /** Seller's own 1-5 star claim, set once at creation. Not a buyer review. */
  self_rating?: number | null
  created_at: string
  updated_at: string
}

export interface CreateProductRequest {
  name: string
  description?: string
  sku?: string
  unit_price?: number
  cost_price?: number
  unit?: string
  publication_status?: PublicationStatus
  category_id?: string
  subcategory_id?: string
  discount_active?: boolean
  discount_type?: string
  discount_value?: number
  discount_start?: string | null
  discount_end?: string | null
  /** Required: seller's own 1-5 star claim for this product. */
  self_rating: number
  /**
   * Optional client-generated key, unique per business. Replaying a create
   * call with the same key returns the product the first one made instead of
   * creating a second, so a retry after a timeout cannot duplicate it.
   */
  idempotency_key?: string
}

export interface UpdateProductRequest {
  name?: string
  description?: string
  sku?: string
  unit_price?: number
  cost_price?: number
  unit?: string
  status?: string
  publication_status?: PublicationStatus
  category_id?: string
  subcategory_id?: string
  discount_active?: boolean
  discount_type?: string
  discount_value?: number
  discount_start?: string | null
  discount_end?: string | null
}

export interface ProductVariant {
  id: string
  product_id: string
  sku: string
  name: string
  attributes: Record<string, string>
  sale_price: number
  purchase_price: number
  barcode?: string
  unit?: string
  status?: string
  created_at: string
  updated_at: string
}

export interface ProductImageResponse {
  id: string
  product_id: string
  /** Set when the image shows one specific Variant (a colour/model). */
  variant_id?: string
  url: string
  file_name: string
  sort_order: number
  is_primary: boolean
  created_at: string
}

export interface CreateVariantRequest {
  sku?: string
  name?: string
  attributes?: Record<string, string>
  sale_price: number
  purchase_price?: number
  barcode?: string
  unit?: string
}

export interface UpdateVariantRequest {
  sku?: string
  name?: string
  attributes?: Record<string, string>
  sale_price?: number
  purchase_price?: number
  barcode?: string
  unit?: string
  status?: string
}

/* ---------- Inventory & Stock ---------- */

export interface InventoryItem {
  id: string
  business_id: string
  shop_id: string
  product_id: string
  variant_id: string
  variant?: ProductVariant
  product?: Product
  quantity: number
  reserved_quantity: number
  available: number
  stock_status?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  low_stock_threshold?: number
  created_at: string
  updated_at: string
}

export interface StockMovement {
  id: string
  business_id: string
  shop_id: string
  product_id: string
  variant_id?: string | null
  variant?: ProductVariant
  product?: Product
  movement_type: string
  quantity: number
  previous_quantity: number
  new_quantity: number
  notes?: string
  performed_by?: string | null
  employee_id?: string | null
  created_at: string
}

export interface StockReceipt {
  id: string
  shop_id: string
  supplier: string
  notes?: string
  status: string
  created_at: string
  updated_at: string
}

export interface StockReceiptLine {
  id: string
  receipt_id: string
  variant_id: string
  quantity: number
  unit_cost: number
}

export interface CreateStockReceiptRequest {
  supplier: string
  notes?: string
  lines: Array<{
    variant_id: string
    quantity: number
    unit_cost: number
  }>
}

export interface AddStockRequest {
  variant_id: string
  quantity: number
  notes?: string
}

export interface RecordSaleRequest {
  variant_id: string
  quantity: number
  customer_id?: string
  employee_id?: string
  notes?: string
}

/* ---------- Seller Orders ---------- */

export interface SellerOrder extends DeliveryPlan {
  id: string
  business_id: string
  shop_id: string
  customer_id?: string | null
  buyer_profile_id?: string | null
  status: OrderStatus
  total_items: number
  /** Currency the order was sold in, snapshotted at checkout. */
  currency?: string
  notes: string
  created_by?: string | null
  base_total: number
  points_used: number
  points_discount_amount: number
  final_total: number
  idempotency_key?: string | null
  order_number?: string
  delivery_method: string
  delivery_fee_base: number
  delivery_points_used: number
  delivery_points_discount: number
  delivery_fee_final: number
  delivery_contact_name: string
  delivery_phone: string
  delivery_address: string
  delivery_province?: string
  delivery_city?: string
  delivery_commune?: string
  delivery_street?: string
  delivery_building_number?: string
  delivery_landmark?: string
  delivery_province_id?: string
  delivery_city_id?: string
  delivery_commune_id?: string
  delivery_notes: string
  points_finalized: boolean
  accepted_at?: string | null
  preparing_at?: string | null
  ready_at?: string | null
  out_for_delivery_at?: string | null
  delivered_at?: string | null
  received_at?: string | null
  completed_at?: string | null
  created_at: string
  updated_at: string
}

export interface SellerCreateOrderRequest {
  customer_id?: string
  lines: OrderLineInput[]
  notes?: string
}

/* ---------- Customers ---------- */

export interface Customer {
  id: string
  business_id: string
  first_name: string
  last_name: string
  phone?: string | null
  email?: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface CustomerSummary {
  customer: Customer
  total_orders: number
  total_purchased: number
  first_purchase?: string | null
  last_purchase?: string | null
}

export interface CreateCustomerRequest {
  first_name: string
  last_name: string
  phone?: string
  email?: string
}

export interface UpdateCustomerRequest {
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  status?: string
}

/* ---------- Cash Management ---------- */

export interface CashSession {
  id: string
  business_id: string
  shop_id: string
  employee_id?: string | null
  shop_name?: string
  employee_first_name?: string
  employee_last_name?: string
  opened_at: string
  closed_at?: string | null
  opening_amount: number
  currency: string
  cash_sales_total: number
  expected_amount: number
  declared_closing_amount?: number | null
  difference?: number | null
  reconciliation_result?: string | null
  status: 'OPEN' | 'CLOSED' | 'RECONCILED'
  created_at: string
}

export interface CashPayment {
  id: string
  session_id: string
  order_id: string
  amount: number
  payment_method: string
  received_by?: string
  created_at: string
}

export interface CashSummaryShop {
  shop_id: string
  shop_name: string
  total_cash_sales: number
  open_sessions: number
  closed_sessions: number
  total_shortage: number
  total_overage: number
  seller_breakdown: CashSummarySeller[]
}

export interface CashSummarySeller {
  employee_id: string
  first_name: string
  last_name: string
  total_cash_sales: number
  open_sessions: number
  closed_sessions: number
  total_shortage: number
  total_overage: number
}

export interface CashSummary {
  business_id: string
  total_cash_sales: number
  shop_breakdown: CashSummaryShop[]
  seller_breakdown: CashSummarySeller[]
}

/* ---------- Seller Growth ---------- */

export interface SellerLevelInfo {
  name: string
  min_points: number
  max_points: number
  search_boost: number
  recommendation_eligible: boolean
  high_value_buyer_access: boolean
  progress_to_next_level_percent: number
  description: string
}

export interface SellerTrustInfo {
  trust_status: 'HIGH' | 'NORMAL' | 'LOW' | 'SUSPENDED'
  verified_sales_count: number
  order_completion_rate: number
  cancellation_rate: number
  purchase_confirmation_rate: number
  stock_reliability_rate: number
}

export interface LevelBenefitInfo {
  benefit_type: string
  benefit_value: number
}

export interface SellerGrowth {
  points: PointAccount
  level: SellerLevelInfo
  trust: SellerTrustInfo
  benefits: LevelBenefitInfo[]
  high_value_buyer_eligible: boolean
}

export interface SellerPointsHistory {
  account: PointAccount
  transactions: PointTransaction[]
  level_name: string
  next_level?: SellerLevelInfo
}

/* ---------- Reviews ---------- */

/* ---------------------------------------------------------------------------
 * Physical handover at the buyer's door.
 * ------------------------------------------------------------------------- */

/** The verdict on one product check. Anything but VALID stops the handover. */
export type HandoverResult =
  | 'VALID'
  | 'ALREADY_USED'
  | 'WRONG_PRODUCT'
  | 'WRONG_VARIANT'
  | 'WRONG_ORDER'
  | 'WRONG_SHOP'
  | 'INVALID_QR'

export type HandoverStage =
  | 'IN_TRANSIT'
  | 'COURIER_ARRIVED'
  | 'PRODUCT_VERIFIED'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_VERIFIED'
  | 'AWAITING_BUYER_CONFIRMATION'
  | 'DELIVERED'

export interface HandoverVerificationResult {
  result: HandoverResult
  reason?: string
  verification_method: 'QR_SCAN' | 'MANUAL_PRODUCT_NUMBER'
  order_id: string
  order_number?: string
  order_line_id?: string
  product_id?: string
  variant_id?: string
  product_name?: string
  product_number?: string
  variant_name?: string
  attributes?: Record<string, unknown>
  shop_name?: string
  seller_name?: string
  quantity?: number
  unit_price?: number
  line_total?: number
  currency?: string
  verified_at?: string
}

export interface HandoverLine {
  order_line_id: string
  product_id: string
  variant_id: string
  product_name: string
  variant_name: string
  product_number: string
  attributes?: Record<string, unknown>
  image_url?: string
  quantity: number
  unit_price: number
  line_total: number
  product_verified: boolean
  verified_at?: string
  verified_by_role?: string
  buyer_acknowledged: boolean
}

/**
 * The server's own view of where the handover stands. Both apps drive their
 * buttons from the `*_can_*` flags rather than re-deriving the rules, so the
 * UI can never offer a step the backend would refuse.
 */
export interface HandoverState {
  order_id: string
  order_number: string
  order_status: string
  delivery_status: string
  stage: HandoverStage
  buyer_name?: string
  buyer_phone?: string
  delivery_address?: string
  shop_name?: string
  seller_name?: string
  payment_method: string
  payment_status: string
  payment_timing?: string
  /** Operator behind a mobile payment; absent for cash. */
  payment_provider?: string
  amount_due: number
  currency: string
  payment_verified: boolean
  lines: HandoverLine[]
  courier_arrived: boolean
  all_products_verified: boolean
  all_lines_acknowledged: boolean
  delivery_scanned: boolean
  receipt_confirmed: boolean
  courier_can_verify_product: boolean
  courier_can_confirm_cash: boolean
  courier_can_scan_delivery: boolean
  buyer_can_acknowledge: boolean
  buyer_can_confirm_receipt: boolean
  blocked_reason?: string
}

export interface ConfirmCashResponse {
  order_id: string
  payment_id: string
  payment_status: string
  amount_collected: number
  currency: string
  commission_status: string
  commission_amount: number
  /** Cash from the buyer never collects TBK's commission; this stays false here. */
  commission_collected: boolean
  already_confirmed: boolean
}

export interface HandoverLineAcknowledgement {
  order_line_id: string
  product_received: boolean
  matches_order: boolean
  quantity_correct: boolean
}

/** What the courier or buyer scanned, or typed when the camera failed. */
export interface ProductVerificationRequestBody {
  token?: string
  product_number?: string
}

/** Courier profile information */
export interface CourierProfile {
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  status: string
  availability: string
  transport_type: string
  vehicle_info?: string
  service_zone?: string
  province?: string
  city?: string
  commune?: string
  street?: string
  building_number?: string
  landmark?: string
  completed_today: number
  total_deliveries: number
}

/** Courier mission from the missions list */
export interface CourierMission extends DeliveryPlan {
  order_id: string
  order_number: string
  status: string
  delivery_status: string
  shop_name: string
  business_name: string
  shop_address: string
  service_zone: string
  package_count: number
  delivery_address: string
  delivery_contact: string
  delivery_phone: string
  delivery_notes?: string
  assigned_at?: string
  accepted_at?: string
  ready_at?: string
  picked_up_at?: string
  started_at?: string
  arrived_at?: string
  delivered_at?: string
}

/** Courier delivery history item */
export interface CourierHistory {
  order_id: string
  order_number: string
  shop_name: string
  delivery_address: string
  final_status: string
  delivered_at?: string
}

/** QR scan response for pickup/delivery scans */
export interface QRScanResponse {
  result: string
  order_id: string
  package_id?: string
  delivery_status?: string
  requires_buyer_confirmation?: boolean
}

/* ---------- ORDER_ITEM QR ----------
 * One QR per ordered line. The printed code carries only the signed opaque token
 * (tbk.oi.<reference>.<signature>); every field below is resolved server-side at
 * scan time. Clients must never parse the token.
 * Contract: backend/internal/models/order_item_qr.go
 */

/** Authenticated actor a resolution was filtered for. Decided by the backend. */
export type QRRole = 'BUYER' | 'SELLER' | 'COURIER' | 'ADMIN'

/** GET .../items/:item_id/qr — the QR identity of one order line. */
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

/** Identity block echoed by every resolution. */
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
 * Immutable pricing snapshot of the order line. Never the live catalogue price:
 * a product repriced after the sale still resolves at what the buyer paid.
 * Fields the backend prunes for a role arrive as 0 — render, never recompute.
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
  /** Cash the courier must collect at the door. Absent/0 on a prepaid order. */
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

/** POST /qr/resolve (or /admin/qr/resolve) — role-filtered by the backend. */
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
