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
export interface Shop { id: string; name: string; city?: string; address?: string; product_count?: number }
export interface BuyerProfile {
  id: string; first_name: string; last_name: string; email: string; phone: string
  backup_phone?: string; address?: string; city?: string; commune?: string
}
export interface Business { id: string; name: string; status: string }
