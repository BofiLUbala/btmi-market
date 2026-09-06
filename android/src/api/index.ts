import { del, get, patch, post, postForm } from './client'
import type { Business, BuyerOrder, BuyerPayment, BuyerProfile, BuyerReviewsResponse, Category, DeliveryOptionsResponse, DeliveryPointsPreview, DeliverySelectResponse, LoginResponse, OrderDetail, OrderLineInput, OrderWithLines, PointRedemptionPreview, ProductDetail, ProductReviewsResponse, PublicProduct, RegisterInput, ReviewEligibility, SelectDeliveryRequest, SellerOrder, Shop, ShopReviewsResponse, TrackingResponse, User } from '../types'

const list = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]
  const object = value as Record<string, unknown> | null
  for (const key of ['data', 'products', 'shops', 'categories', 'items']) if (Array.isArray(object?.[key])) return object![key] as T[]
  return []
}

export const authApi = {
  login: (email: string, password: string) => post<LoginResponse>('/auth/login', { email, password }),
  // The account is created inactive: the API only returns the new id and mails
  // an activation link, so there is no session to store here.
  register: (body: RegisterInput) => post<{ user_id: string }>('/auth/register', body),
  // Seller accounts go through the same activation flow as buyers, just a
  // different endpoint so the backend tags the user SELLER from creation.
  registerSeller: (body: RegisterInput) => post<{ user_id: string }>('/auth/register/seller', body),
  resendActivation: (email: string) => post('/auth/resend-activation', { email }),
  reinitializeRegistration: (email: string, password: string) => post('/auth/reinitialize-registration', { email, password }),
  forgotPassword: (identifier: string) => post('/auth/forgot-password', { identifier }),
  resetPassword: (token: string, password: string, passwordConfirmation: string) => post('/auth/reset-password', { token, password, password_confirmation: passwordConfirmation }),
  me: () => get<User>('/auth/me'),
  logout: () => post('/auth/logout'),
  becomeSeller: () => post<User>('/auth/become-seller'),
  uploadAvatar: (asset: { uri: string; fileName?: string | null; mimeType?: string | null }) => {
    const form = new FormData()
    form.append('file', { uri: asset.uri, name: asset.fileName || `avatar-${Date.now()}.jpg`, type: asset.mimeType || 'image/jpeg' } as unknown as Blob)
    return postForm<{ avatar_url: string }>('/auth/me/avatar', form)
  },
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
  updateProfile: (body: { first_name?: string; last_name?: string; phone?: string; backup_phone?: string; address?: string; city?: string; commune?: string; country?: string; latitude?: number | null; longitude?: number | null }) =>
    patch<BuyerProfile>('/buyer/profile', body),
  points: () => get<unknown>('/buyer/points'),

  /* order pipeline — identical contract to the web app; the backend owns pricing */
  previewOrder: (shopId: string, items: OrderLineInput[], usePoints: boolean) =>
    post<PointRedemptionPreview>('/buyer/orders/preview', { shop_id: shopId, items, use_points: usePoints }),
  createOrder: (shopId: string, items: OrderLineInput[], usePoints: boolean, idempotencyKey: string) =>
    post<OrderWithLines>('/buyer/orders', { shop_id: shopId, items, use_points: usePoints, idempotency_key: idempotencyKey }),
  deliveryOptions: (orderId: string) =>
    get<DeliveryOptionsResponse>(`/buyer/orders/${orderId}/delivery-options`),
  deliveryPointsPreview: (orderId: string, usePointsForDelivery: boolean) =>
    post<DeliveryPointsPreview>(`/buyer/orders/${orderId}/delivery-points-preview`, { use_points_for_delivery: usePointsForDelivery }),
  selectDelivery: (orderId: string, body: SelectDeliveryRequest) =>
    post<DeliverySelectResponse>(`/buyer/orders/${orderId}/delivery`, body),

  orders: () => get<BuyerOrder[]>('/buyer/orders'),
  order: (id: string) => get<OrderDetail>(`/buyer/orders/${id}`),
  tracking: (id: string) => get<TrackingResponse>(`/buyer/orders/${id}/tracking`),
  confirmReceived: (id: string) => post(`/buyer/orders/${id}/received`),
  cancelOrder: (id: string) => post(`/buyer/orders/${id}/cancel`),
  createPayment: (id: string) => post<BuyerPayment>(`/buyer/orders/${id}/payment`),
  getPayment: (id: string) => get<BuyerPayment>(`/buyer/orders/${id}/payment`),
  buyerConfirmPayment: (paymentId: string) => post<BuyerPayment>(`/buyer/payments/${paymentId}/buyer-confirm`),
  reviewEligibility: (orderId: string, lineId?: string) => get<ReviewEligibility>(`/buyer/orders/${orderId}/review-eligibility${lineId ? `?order_line_id=${encodeURIComponent(lineId)}` : ''}`),
  createReview: (orderId: string, lineId: string, rating: number, comment: string) => post(`/buyer/orders/${orderId}/review`, { order_line_id: lineId, rating, comment }),
  createServiceReview: (orderId: string, deliveryRating: number, serviceRating: number, experienceRating: number, comment: string) => post(`/buyer/orders/${orderId}/service-review`, { delivery_rating: deliveryRating, service_rating: serviceRating, order_experience_rating: experienceRating, comment }),
  updateReview: (id: string, rating: number, comment: string) => patch(`/buyer/reviews/${id}`, { rating, comment }),
  withdrawReview: (id: string) => del(`/buyer/reviews/${id}`),
  reviews: () => get<BuyerReviewsResponse>('/buyer/reviews?page=1&per_page=50'),
}
export const sellerApi = {
  businesses: async () => list<Business>(await get<unknown>('/businesses')),
  createBusiness: (body: { name: string; business_type: string; category: string; phone: string; whatsapp?: string; email: string; country: string; city: string; default_currency: string }) => post<Business>('/businesses', body),
  shops: async (businessId: string) => list<Shop>(await get<unknown>(`/businesses/${businessId}/shops`)),
  createShop: (businessId: string, body: { name: string; type: 'PHYSICAL' | 'ONLINE'; city: string; address: string; phone: string }) =>
    post<Shop>(`/businesses/${businessId}/shops`, body),
  businessOrders: async (businessId: string) => list<SellerOrder>(await get<unknown>(`/businesses/${businessId}/orders`)),
  shopOrders: async (shopId: string) => list<SellerOrder>(await get<unknown>(`/shops/${shopId}/orders`)),
  order: (id: string) => get<OrderDetail>(`/orders/${id}`),
  sellerTransition: (id: string, status: string, notes?: string) => post(`/orders/${id}/tracking/status`, { status, notes }),
  getOrderPayment: (id: string) => get<BuyerPayment>(`/orders/${id}/payment`),
  sellerConfirmPayment: (paymentId: string) => post<BuyerPayment>(`/payments/${paymentId}/seller-confirm`),
  reviews: (shopId: string) => get<ShopReviewsResponse>(`/marketplace/shops/${shopId}/reviews?page=1&per_page=50&sort=newest`),
}
