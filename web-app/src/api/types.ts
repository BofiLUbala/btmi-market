export interface ApiErrorBody {
  error: { code: string; message: string }
}

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
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

/* ---------- Buyer profile ---------- */

export interface BuyerProfile {
  id: string
  user_id: string
  first_name: string
  last_name: string
  phone: string
  backup_phone: string
  address: string
  email: string
  city?: string
  commune?: string
  status: string
  created_at: string
  updated_at: string
}

export interface CreateBuyerProfileRequest {
  first_name: string
  last_name: string
  phone: string
  email: string
}

export interface UpdateBuyerProfileRequest {
  first_name?: string
  last_name?: string
  phone?: string
  backup_phone?: string
  address?: string
  city?: string
  commune?: string
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

export type DeliveryMethod = 'PICKUP' | 'SHOP_DELIVERY' | 'PARTNER'

export interface OrderLineInput {
  product_id: string
  variant_id: string
  quantity: number
}

export interface BuyerOrder {
  id: string
  business_id: string
  shop_id: string
  customer_id?: string | null
  buyer_profile_id?: string | null
  status: OrderStatus
  total_items: number
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
  method: DeliveryMethod
  use_points_for_delivery: boolean
  contact_name?: string
  phone?: string
  address?: string
  notes?: string
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
  buyer_confirmed: boolean
  buyer_confirmed_at?: string | null
  seller_confirmed: boolean
  seller_confirmed_by?: string | null
  seller_confirmed_at?: string | null
  status: string
  verified_at?: string | null
  created_at: string
  updated_at: string
}

/* ---------- Tracking ---------- */

export interface TrackingResponse {
  order_id: string
  order_number: string
  current_status: string
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

export type AccountType = 'BUYER' | 'SELLER' | 'EMPLOYEE'

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
  country: string
  city: string
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

export interface SellerOrder {
  id: string
  business_id: string
  shop_id: string
  customer_id?: string | null
  buyer_profile_id?: string | null
  status: OrderStatus
  total_items: number
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
