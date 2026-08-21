import { del, get, patch, post } from './client'
import type {
  BuyerOrder,
  BuyerPayment,
  BuyerProfile,
  BuyerReviewsResponse,
  CreateBuyerProfileRequest,
  DeliveryOptionsResponse,
  DeliveryPointsPreviewResponse,
  DeliverySelectResponse,
  OrderWithLines,
  OrderLineInput,
  PendingPurchase,
  PointAccount,
  PointHistoryResponse,
  PointRedemptionPreviewResponse,
  ReviewEligibilityResponse,
  ReviewResponse,
  SelectDeliveryRequest,
  TrackingResponse,
  UpdateBuyerProfileRequest
} from './types'

export const buyerApi = {
  /* profile */
  getProfile: () => get<BuyerProfile>('/buyer/profile'),
  createProfile: (body: CreateBuyerProfileRequest) => post<BuyerProfile>('/buyer/profile', body),
  updateProfile: (body: UpdateBuyerProfileRequest) => patch<BuyerProfile>('/buyer/profile', body),

  /* points */
  getPoints: () => get<PointAccount>('/buyer/points'),
  getPointsHistory: () => get<PointHistoryResponse>('/buyer/points/history'),

  /* purchases (in-store confirmation) */
  pendingPurchases: () => get<PendingPurchase[]>('/buyer/purchases/pending'),
  confirmPurchase: (purchaseId: string, orderId: string) =>
    post<unknown>(`/buyer/purchases/${purchaseId}/confirm`, { order_id: orderId }),

  /* order pipeline */
  previewOrder: (shopId: string, items: OrderLineInput[], usePoints: boolean) =>
    post<PointRedemptionPreviewResponse>('/buyer/orders/preview', {
      shop_id: shopId,
      items,
      use_points: usePoints
    }),

  createOrder: (shopId: string, items: OrderLineInput[], usePoints: boolean, idempotencyKey: string) =>
    post<OrderWithLines>('/buyer/orders', {
      shop_id: shopId,
      items,
      use_points: usePoints,
      idempotency_key: idempotencyKey
    }),

  orders: () => get<BuyerOrder[]>('/buyer/orders'),

  orderDetail: (orderId: string) => get<OrderWithLines>(`/buyer/orders/${orderId}`),

  cancelOrder: (orderId: string) => post<BuyerOrder>(`/buyer/orders/${orderId}/cancel`, {}),

  deliveryOptions: (orderId: string) =>
    get<DeliveryOptionsResponse>(`/buyer/orders/${orderId}/delivery-options`),

  selectDelivery: (orderId: string, body: SelectDeliveryRequest) =>
    post<DeliverySelectResponse>(`/buyer/orders/${orderId}/delivery`, body),

  deliveryPointsPreview: (orderId: string, usePointsForDelivery: boolean) =>
    post<DeliveryPointsPreviewResponse>(
      `/buyer/orders/${orderId}/delivery-points-preview`,
      { use_points_for_delivery: usePointsForDelivery }
    ),

  orderPointsPreview: (orderId: string, usePoints: boolean) =>
    post<PointRedemptionPreviewResponse>(`/buyer/orders/${orderId}/points-preview`, {
      use_points: usePoints
    }),

  createPayment: (orderId: string) => post<BuyerPayment>(`/buyer/orders/${orderId}/payment`, {}),

  getPayment: (orderId: string) => get<BuyerPayment>(`/buyer/orders/${orderId}/payment`),

  buyerConfirmPayment: (paymentId: string) =>
    post<BuyerPayment>(`/buyer/payments/${paymentId}/buyer-confirm`, {}),

  confirmReceived: (orderId: string) =>
    post<BuyerOrder>(`/buyer/orders/${orderId}/received`, {}),

  tracking: (orderId: string) => get<TrackingResponse>(`/buyer/orders/${orderId}/tracking`),

  /* reviews */
  reviewEligibility: (orderId: string) =>
    get<ReviewEligibilityResponse>(`/buyer/orders/${orderId}/review-eligibility`),

  createReview: (orderId: string, rating: number, comment: string) =>
    post<ReviewResponse>(`/buyer/orders/${orderId}/review`, { rating, comment }),

  updateReview: (reviewId: string, rating: number, comment: string) =>
    patch<ReviewResponse>(`/buyer/reviews/${reviewId}`, { rating, comment }),

  withdrawReview: (reviewId: string) => del<null>(`/buyer/reviews/${reviewId}`),

  myReviews: () => get<BuyerReviewsResponse>('/buyer/reviews')
}