import { get } from './client'
import type {
  BuyerPriceResponse,
  CategoryResponse,
  MarketplaceSearchResult,
  PaginatedProducts,
  PublicProductDetail,
  PublicShop,
  PublicShopDetail,
  RankedShop,
  ShopReviewsResponse,
  SimilarProductsResponse,
  SubcategoryResponse
} from './types'

export interface MarketplaceQuery {
  page?: number
  limit?: number
  per_page?: number
  city?: string
  q?: string
  category?: string
  subcategory?: string
  min_price?: number
  max_price?: number
  sort?: string
  availability?: string
  rating?: number
}

export const marketplaceApi = {
  categories: () => get<CategoryResponse[]>('/marketplace/categories'),

  subcategories: (slug: string) =>
    get<SubcategoryResponse[]>(`/marketplace/categories/${slug}/subcategories`),

  categoryProducts: (slug: string, q?: MarketplaceQuery) =>
    get<PaginatedProducts>(`/marketplace/categories/${slug}/products`, q),

  categoryTopShops: (slug: string) =>
    get<RankedShop[]>(`/marketplace/categories/${slug}/shops`),

  shops: (q?: MarketplaceQuery) => get<PublicShop[]>('/marketplace/shops', q),

  shopDetail: (id: string) => get<PublicShopDetail>(`/marketplace/shops/${id}/detail`),

  shopProducts: (id: string, q?: MarketplaceQuery) =>
    get<PaginatedProducts>(`/marketplace/shops/${id}/products`, q),

  products: (q?: MarketplaceQuery) => get<PaginatedProducts>('/marketplace/products', q),

  productDetail: (id: string) => get<PublicProductDetail>(`/marketplace/products/${id}/detail`),

  productPrice: (id: string) => get<BuyerPriceResponse>(`/marketplace/products/${id}/price`),

  similarProducts: (id: string) =>
    get<SimilarProductsResponse>(`/marketplace/products/${id}/similar`),

  search: (q: MarketplaceQuery) => get<MarketplaceSearchResult>('/marketplace/search', q),

  shopReviews: (id: string, q?: MarketplaceQuery) =>
    get<ShopReviewsResponse>(`/marketplace/shops/${id}/reviews`, q)
}