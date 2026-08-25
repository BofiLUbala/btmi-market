export type AccountType = 'BUYER' | 'SELLER' | 'EMPLOYEE'

export interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  account_type: AccountType
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  user?: User
}

export interface Category { id: string; name: string; slug: string }
export interface PublicImage { id?: string; url?: string; image_url?: string; is_primary?: boolean }
export interface PublicVariant {
  id: string
  sku?: string
  name?: string
  attributes?: Record<string, string>
  price?: number
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
}
export interface Business { id: string; name: string; status: string }
export interface BuyerOrder { id: string; order_number?: string; shop_id: string; status: string; total_items: number; final_total: number; created_at: string }
export interface OrderLine { id: string; product_id: string; variant_id: string; quantity: number; final_unit_price: number; product_name: string; variant_name?: string; image_url?: string }
export interface OrderDetail { order: BuyerOrder; lines: OrderLine[]; shop_name: string }
export interface ReviewEligibility { eligible: boolean; reason: string; existing_review_id?: string }
export interface BuyerReview { id: string; order_id: string; product_id?: string; order_line_id?: string; rating: number; comment: string; verified_purchase: boolean; status: string; delivery_rating?: number; service_rating?: number; order_experience_rating?: number; created_at: string }
export interface BuyerReviewsResponse { reviews: BuyerReview[]; pagination: { page: number; limit: number; total: number; has_more?: boolean } }
export interface ShopReviewsResponse { shop_id: string; summary: ProductReviewSummary; reviews: ProductReview[]; pagination: { page: number; limit: number; total: number; has_more?: boolean } }
