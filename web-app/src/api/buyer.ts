import { del, get, patch, post } from './client'
import type {
  BuyerOrder,
  BuyerPayment,
  CheckoutQuote,
  PaymentInitiation,
  BuyerProfile,
  BuyerPointsSummary,
  BuyerReviewsResponse,
  CreateBuyerProfileRequest,
  DeliveryOptionsResponse,
  DeliveryPointsPreviewResponse,
  HandoverLineAcknowledgement,
  HandoverState,
  DeliverySelectResponse,
  OrderWithLines,
  OrderLineInput,
  PendingPurchase,
  PointHistoryResponse,
  PointRedemptionPreviewResponse,
  ReviewEligibilityResponse,
  ReviewResponse,
  SelectDeliveryRequest,
  TrackingResponse, ProductVerification,
  DeliveryPackageQR,
  UpdateBuyerProfileRequest
} from './types'

export const buyerApi = {
  /* profile */
  getProfile: () => get<{ profile: BuyerProfile }>('/buyer/profile').then((view) => view.profile),
  createProfile: (body: CreateBuyerProfileRequest) => post<BuyerProfile>('/buyer/profile', body),
  updateProfile: (body: UpdateBuyerProfileRequest) => patch<BuyerProfile>('/buyer/profile', body),

  /* points */
  getPoints: () => get<BuyerPointsSummary>('/buyer/points'),
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

  // The server prices the selected method; the client never adds a markup.
  checkoutQuote: (orderId: string, paymentMethod?: string) =>
    get<CheckoutQuote>(`/buyer/orders/${orderId}/checkout-quote${paymentMethod ? `?payment_method=${encodeURIComponent(paymentMethod)}` : ''}`),

  createPayment: (orderId: string, paymentMethod = 'CASH_ON_DELIVERY') => post<BuyerPayment>(`/buyer/orders/${orderId}/payment`, { payment_method: paymentMethod }),

  getPayment: (orderId: string) => get<BuyerPayment>(`/buyer/orders/${orderId}/payment`),

  /** Asks the provider to charge the buyer. Only its webhook can settle it. */
  initiatePayment: (orderId: string) => post<PaymentInitiation>(`/buyer/orders/${orderId}/payment/initiate`, {}),

  buyerConfirmPayment: (paymentId: string) =>
    post<BuyerPayment>(`/buyer/payments/${paymentId}/buyer-confirm`, {}),

  confirmReceived: (orderId: string) =>
    post<BuyerOrder>(`/buyer/orders/${orderId}/confirm-receipt`, {}),

  tracking: (orderId: string) => get<TrackingResponse>(`/buyer/orders/${orderId}/tracking`),
  deliveryQR: (orderId: string) => get<DeliveryPackageQR>(`/buyer/orders/${orderId}/delivery-qr`),
  confirmReceipt: (orderId: string) => post<{ delivery_status: string }>(`/buyer/orders/${orderId}/confirm-receipt`, {}),
  verifyProduct: (orderId: string, body: { token?: string; product_number?: string }) =>
    post<ProductVerification>(`/buyer/orders/${orderId}/verify-product`, body),

  /** Where the handover stands, and what the buyer is allowed to do next. */
  handover: (orderId: string) => get<HandoverState>(`/buyer/orders/${orderId}/handover`),

  /**
   * The buyer's per-line receipt form: for each product, that it is in their
   * hands, that it is what they ordered, and that the quantity is right.
   * Answering does not close the delivery; confirming receipt does.
   */
  acknowledgeHandover: (orderId: string, lines: HandoverLineAcknowledgement[]) =>
    post<HandoverState>(`/buyer/orders/${orderId}/handover/acknowledge`, { lines }),

  /* reviews */
  reviewEligibility: (orderId: string, orderLineId?: string) =>
    get<ReviewEligibilityResponse>(`/buyer/orders/${orderId}/review-eligibility`, orderLineId ? { order_line_id: orderLineId } : undefined),

  createReview: (orderId: string, orderLineId: string, rating: number, comment: string) =>
    post<ReviewResponse>(`/buyer/orders/${orderId}/review`, { order_line_id: orderLineId, rating, comment }),

  createServiceReview: (orderId: string, deliveryRating: number, serviceRating: number, experienceRating: number, comment: string) =>
    post<ReviewResponse>(`/buyer/orders/${orderId}/service-review`, {
      delivery_rating: deliveryRating,
      service_rating: serviceRating,
      order_experience_rating: experienceRating,
      comment
    }),

  updateReview: (reviewId: string, rating: number, comment: string) =>
    patch<ReviewResponse>(`/buyer/reviews/${reviewId}`, { rating, comment }),

  withdrawReview: (reviewId: string) => del<null>(`/buyer/reviews/${reviewId}`),

  myReviews: () => get<BuyerReviewsResponse>('/buyer/reviews')
}
