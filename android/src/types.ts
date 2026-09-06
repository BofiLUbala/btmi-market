export type AccountType = 'BUYER' | 'SELLER' | 'EMPLOYEE'

export interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  account_type: AccountType
  avatar_url?: string | null
}

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

export interface Category { id: string; name: string; slug: string }
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
export interface Shop { id: string; name: string; city?: string; address?: string; product_count?: number }
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
export interface Business { id: string; name: string; status: string }
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
