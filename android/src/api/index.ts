import { del, get, patch, post, postForm } from './client'
import type { Business, BuyerProfile, BuyerOrder, BuyerReviewsResponse, Category, LoginResponse, OrderDetail, ProductDetail, ProductReviewsResponse, PublicProduct, ReviewEligibility, SellerOrder, Shop, ShopReviewsResponse, User } from '../types'

const list = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]
  const object = value as Record<string, unknown> | null
  for (const key of ['data', 'products', 'shops', 'categories', 'items']) if (Array.isArray(object?.[key])) return object![key] as T[]
  return []
}

export const authApi = {
  login: (email: string, password: string) => post<LoginResponse>('/auth/login', { email, password }),
  me: () => get<User>('/auth/me'),
  logout: () => post('/auth/logout'),
}
export const marketplaceApi = {
  products: async () => list<PublicProduct>(await get<unknown>('/marketplace/products?page=1&limit=20')),
  categories: async () => list<Category>(await get<unknown>('/marketplace/categories')),
  shops: async () => list<Shop>(await get<unknown>('/marketplace/shops?page=1&limit=20')),
  search: async (query: string) => list<PublicProduct>(await get<unknown>(`/marketplace/search?q=${encodeURIComponent(query)}`)),
  searchByImage: async (asset: { uri: string; fileName?: string | null; mimeType?: string | null }) => {
    const form = new FormData()
    form.append('image', { uri: asset.uri, name: asset.fileName || `recherche-${Date.now()}.jpg`, type: asset.mimeType || 'image/jpeg' } as unknown as Blob)
    return list<PublicProduct>(await postForm<unknown>('/marketplace/search/image?limit=20', form))
  },
  categoryProducts: async (slug: string) => list<PublicProduct>(await get<unknown>(`/marketplace/categories/${encodeURIComponent(slug)}/products?page=1&limit=30`)),
  product: (id: string) => get<ProductDetail>(`/marketplace/products/${id}/detail`),
  productReviews: (id: string) => get<ProductReviewsResponse>(`/marketplace/products/${id}/reviews?page=1&per_page=20&sort=newest`),
  markHelpful: (id: string) => post<{ helpful_count: number; helpful_by_me: boolean }>(`/reviews/${id}/helpful`),
  unmarkHelpful: (id: string) => del<{ helpful_count: number; helpful_by_me: boolean }>(`/reviews/${id}/helpful`),
  reply: (id: string, body: string) => post(`/reviews/${id}/replies`, { body }),
}
export const buyerApi = {
  profile: async () => (await get<{ profile: BuyerProfile }>('/buyer/profile')).profile,
  points: () => get<unknown>('/buyer/points'),
  orders: () => get<BuyerOrder[]>('/buyer/orders'),
  order: (id: string) => get<OrderDetail>(`/buyer/orders/${id}`),
  reviewEligibility: (orderId: string, lineId?: string) => get<ReviewEligibility>(`/buyer/orders/${orderId}/review-eligibility${lineId ? `?order_line_id=${encodeURIComponent(lineId)}` : ''}`),
  createReview: (orderId: string, lineId: string, rating: number, comment: string) => post(`/buyer/orders/${orderId}/review`, { order_line_id: lineId, rating, comment }),
  createServiceReview: (orderId: string, deliveryRating: number, serviceRating: number, experienceRating: number, comment: string) => post(`/buyer/orders/${orderId}/service-review`, { delivery_rating: deliveryRating, service_rating: serviceRating, order_experience_rating: experienceRating, comment }),
  updateReview: (id: string, rating: number, comment: string) => patch(`/buyer/reviews/${id}`, { rating, comment }),
  withdrawReview: (id: string) => del(`/buyer/reviews/${id}`),
  reviews: () => get<BuyerReviewsResponse>('/buyer/reviews?page=1&per_page=50'),
}
export const sellerApi = {
  businesses: async () => list<Business>(await get<unknown>('/businesses')),
  shops: async (businessId: string) => list<Shop>(await get<unknown>(`/businesses/${businessId}/shops`)),
  businessOrders: async (businessId: string) => list<SellerOrder>(await get<unknown>(`/businesses/${businessId}/orders`)),
  shopOrders: async (shopId: string) => list<SellerOrder>(await get<unknown>(`/shops/${shopId}/orders`)),
  reviews: (shopId: string) => get<ShopReviewsResponse>(`/marketplace/shops/${shopId}/reviews?page=1&per_page=50&sort=newest`),
}
