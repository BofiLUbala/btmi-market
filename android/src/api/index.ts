import { del, get, patch, post, postForm, uploadFile } from './client'
import type { UploadFile } from '../lib/imageUpload'
import type {
  AcceptEmployeeInvitationRequest, AddStockRequest, ArchiveBusinessResponse, AssignEmployeeRequest,
  Business, BusinessLifecycleSummary, BuyerOrder, BuyerPayment, BuyerPointsSummary, BuyerProfile, PendingPurchase, PointHistoryResponse, BuyerReviewsResponse, CheckoutQuote,
  CashPayment, CashSession, CashSummary, Category, CategoryAttributeDefinition, Customer,
  CreateCustomerRequest, CreateEmployeeInvitationRequest,
  CreateEmployeeRequest, CreateProductRequest, CreateShopRequest, CreateStockReceiptRequest, CreateVariantRequest,
  DeliveryOptionsResponse, DeliveryPointsPreview, DeliverySelectResponse, Employee, EmployeeInvitationResponse,
  EmployeeShopAssignment, InventoryItem, LoginResponse, OrderDetail, OrderLineInput, OrderWithLines,
  PointRedemptionPreview, Product, ProductDetail, ProductImageResponse, ProductReviewsResponse, ProductVariant,
  PublicationStatus, PublicProduct, RecordSaleRequest, RegisterInput, ReviewEligibility, SelectDeliveryRequest,
  SellerGrowth, SellerOrder, SellerPointsHistory, Shop, ShopReviewsResponse, StockMovement, StockReceipt,
  SellerFinanceSummary, SellerSaleCommissionItem, SellerSaleCommissionDetail,
  SellerFinanceDashboard, SellerFinanceBreakdownItem, SellerFinanceTimeseriesPoint, SellerBreakdownGroup, SellerFinanceParams, SaleHistoryItem, SaleFinanceDetail,
  QRScanRequest, QRScanResponse, ProductVerification, OrderItemQRResolution, OrderItemQR, VariantInventoryRow,
  TrackingResponse, UpdateCustomerRequest, UpdateEmployeeRequest, UpdateShopRequest, UpdateVariantRequest, User, PackageQR,
  CartLineInput, CartPreview, CheckoutCreated, PaymentProviderCode, PaymentInitiation, HandoverState, HandoverLineAcknowledgement,
  HandoverVerificationResult, ConfirmCashResponse, CourierMission, CourierProfile, CourierAvailability, CourierHistoryItem } from '../types'

/** Query string from defined params only, in the web client's style. */
const qs = (params?: object) => {
  const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}` : ''
}

const list = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]
  const object = value as Record<string, unknown> | null
  for (const key of ['data', 'products', 'shops', 'categories', 'items', 'sessions', 'payments', 'sales']) if (Array.isArray(object?.[key])) return object![key] as T[]
  return []
}

/** The customer endpoints nest the record under `customer` alongside order
 *  stats (`{customer: {...}, total_orders, total_purchased, ...}`) instead of
 *  returning it flat -- confirmed against the live API. Flatten here so every
 *  screen can just read `customer.first_name` etc. */
const normalizeCustomer = (value: unknown): Customer => {
  const object = value as (Record<string, unknown> & { customer?: Record<string, unknown> }) | null
  const base = (object?.customer ?? object ?? {}) as unknown as Customer
  return { ...base, total_orders: (object?.total_orders as number) ?? base.total_orders, total_purchased: (object?.total_purchased as number) ?? base.total_purchased }
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
  reinitializeRegistration: (email: string) => post('/auth/reinitialize-registration', { email }),
  forgotPassword: (identifier: string) => post('/auth/forgot-password', { identifier }),
  resetPassword: (token: string, password: string, passwordConfirmation: string) => post('/auth/reset-password', { token, password, password_confirmation: passwordConfirmation }),
  me: () => get<User>('/auth/me'),
  logout: (refresh_token: string) => post('/auth/logout', { refresh_token }),
  becomeSeller: () => post<User>('/auth/become-seller'),
  uploadAvatar: (file: UploadFile) => uploadFile<{ avatar_url: string }>('/auth/me/avatar', file),
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
  updateProfile: (body: { first_name?: string; last_name?: string; phone?: string; backup_phone?: string; address?: string; province?: string; province_id?: string; city?: string; city_id?: string; commune?: string; commune_id?: string; street?: string; building_number?: string; landmark?: string; country?: string; latitude?: number | null; longitude?: number | null }) =>
    patch<BuyerProfile>('/buyer/profile', body),
  points: () => get<BuyerPointsSummary>('/buyer/points'),
  pointsHistory: () => get<PointHistoryResponse>('/buyer/points/history'),
  /* in-store purchases recorded by a shop employee, awaiting the buyer's confirmation */
  pendingPurchases: async () => list<PendingPurchase>(await get<unknown>('/buyer/purchases/pending')),
  confirmPurchase: (purchaseId: string, orderId: string) => post(`/buyer/purchases/${purchaseId}/confirm`, { order_id: orderId }),

  /* multi-shop cart — the whole cart is priced in one call, across every shop in it */
  previewCart: (items: CartLineInput[], usePoints: boolean) =>
    post<CartPreview>('/buyer/cart/preview', { items, use_points: usePoints }),
  /** Turns the cart into one order per shop, tied together by a checkout group. */
  createCheckout: (items: CartLineInput[], usePoints: boolean, idempotencyKey: string) =>
    post<CheckoutCreated>('/buyer/checkout', { items, use_points: usePoints, idempotency_key: idempotencyKey }),

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
  confirmReceived: (id: string) => post(`/buyer/orders/${id}/confirm-receipt`),
  /** Where the handover stands, and what the buyer may do next. */
  handover: (id: string) => get<HandoverState>(`/buyer/orders/${id}/handover`),
  /** Per-line receipt form. Answering does not close the delivery; confirming receipt does. */
  acknowledgeHandover: (id: string, lines: HandoverLineAcknowledgement[]) =>
    post<HandoverState>(`/buyer/orders/${id}/handover/acknowledge`, { lines }),
  verifyProduct: (id: string, body: { token?: string; product_number?: string }) => post<ProductVerification>(`/buyer/orders/${id}/verify-product`, body),
  /** The buyer's own view of one line's ORDER_ITEM QR. */
  orderItemQR: (orderId: string, itemId: string) => get<OrderItemQR>(`/buyer/orders/${orderId}/items/${itemId}/qr`),
  orderItemQRImagePath: (orderId: string, itemId: string) => `/buyer/orders/${orderId}/items/${itemId}/qr/image`,
  cancelOrder: (id: string) => post(`/buyer/orders/${id}/cancel`),
  // The server prices the selected method; the client never adds a markup.
  checkoutQuote: (id: string, paymentMethod?: string) =>
    get<CheckoutQuote>(`/buyer/orders/${id}/checkout-quote${paymentMethod ? `?payment_method=${encodeURIComponent(paymentMethod)}` : ''}`),
  /**
   * Records how the buyer intends to pay. Provider is required for both mobile
   * methods and must be absent for cash. The payment is created DUE: selecting is not paying.
   */
  createPayment: (id: string, paymentMethod = 'CASH_ON_DELIVERY', provider?: PaymentProviderCode | '', payerPhone?: string) =>
    post<BuyerPayment>(`/buyer/orders/${id}/payment`, {
      payment_method: paymentMethod,
      ...(provider ? { provider } : {}),
      ...(payerPhone ? { payer_phone: payerPhone } : {}),
    }),
  /** Asks the operator to charge the buyer. Only its signed webhook can settle it. */
  initiatePayment: (id: string, payerPhone?: string) =>
    post<PaymentInitiation>(`/buyer/orders/${id}/payment/initiate`, payerPhone ? { payer_phone: payerPhone } : {}),
  getPayment: (id: string) => get<BuyerPayment>(`/buyer/orders/${id}/payment`),
  // No buyerConfirmPayment: choosing cash at delivery is not paying, and the buyer
  // saying they paid is not evidence. The courier confirms the cash at the door.
  reviewEligibility: (orderId: string, lineId?: string) => get<ReviewEligibility>(`/buyer/orders/${orderId}/review-eligibility${lineId ? `?order_line_id=${encodeURIComponent(lineId)}` : ''}`),
  createReview: (orderId: string, lineId: string, rating: number, comment: string) => post(`/buyer/orders/${orderId}/review`, { order_line_id: lineId, rating, comment }),
  createServiceReview: (orderId: string, deliveryRating: number, serviceRating: number, experienceRating: number, comment: string) => post(`/buyer/orders/${orderId}/service-review`, { delivery_rating: deliveryRating, service_rating: serviceRating, order_experience_rating: experienceRating, comment }),
  updateReview: (id: string, rating: number, comment: string) => patch(`/buyer/reviews/${id}`, { rating, comment }),
  withdrawReview: (id: string) => del(`/buyer/reviews/${id}`),
  reviews: () => get<BuyerReviewsResponse>('/buyer/reviews?page=1&per_page=50'),
}
export const sellerApi = {
  /* Business */
  businesses: async () => list<Business>(await get<unknown>('/businesses')),
  createBusiness: (body: { name: string; business_type: string; category: string; phone: string; whatsapp?: string; email: string; country: string; city: string; default_currency: string; province?: string; commune?: string; street?: string; building_number?: string; landmark?: string }) => post<Business>('/businesses', body),
  business: (id: string) => get<Business>(`/businesses/${id}`),
  updateBusiness: (id: string, body: Partial<Business>) => patch<Business>(`/businesses/${id}`, body),
  businessLifecycleSummary: (id: string) => get<BusinessLifecycleSummary>(`/businesses/${id}/lifecycle-summary`),
  archiveBusiness: (id: string, confirmName: string) => post<ArchiveBusinessResponse>(`/businesses/${id}/archive`, { confirm_name: confirmName }),

  /* Shops */
  shops: async (businessId: string) => list<Shop>(await get<unknown>(`/businesses/${businessId}/shops`)),
  createShop: (businessId: string, body: CreateShopRequest) =>
    post<Shop>(`/businesses/${businessId}/shops`, body),
  shop: (id: string) => get<Shop>(`/shops/${id}`),
  updateShop: (id: string, body: UpdateShopRequest) => patch<Shop>(`/shops/${id}`, body),
  deleteShop: (id: string) => del<{ action: 'archived' | 'deleted' }>(`/shops/${id}`),

  /* Employees */
  employees: async (businessId: string) => list<Employee>(await get<unknown>(`/businesses/${businessId}/employees`)),
  createEmployee: (businessId: string, body: CreateEmployeeRequest) => post<Employee>(`/businesses/${businessId}/employees`, body),
  employee: (id: string) => get<Employee>(`/employees/${id}`),
  updateEmployee: (id: string, body: UpdateEmployeeRequest) => patch<Employee>(`/employees/${id}`, body),
  assignEmployeeShop: (employeeId: string, body: AssignEmployeeRequest) => post<EmployeeShopAssignment>(`/employees/${employeeId}/shops`, body),
  removeEmployeeShop: (employeeId: string, shopId: string) => del<void>(`/employees/${employeeId}/shops/${shopId}`),
  employeeShops: async (employeeId: string) => list<Shop>(await get<unknown>(`/employees/${employeeId}/shops`)),
  createEmployeeInvitation: (employeeId: string, body: CreateEmployeeInvitationRequest) => post<EmployeeInvitationResponse>(`/employees/${employeeId}/invite`, body),

  /* Categories */
  categories: async () => list<Category>(await get<unknown>('/categories?with_subcategories=true')),
  /** DB-backed attribute definitions — primary source of truth, matches web-app and backend. */
  categoryAttributes: async (categoryId: string, subcategoryId?: string): Promise<CategoryAttributeDefinition[]> => {
    const query = subcategoryId ? `?subcategory_id=${encodeURIComponent(subcategoryId)}` : ''
    return list<CategoryAttributeDefinition>(await get<unknown>(`/categories/${encodeURIComponent(categoryId)}/attributes${query}`))
  },


  /* Products & variants */
  products: async (businessId: string, params?: { category_id?: string; publication_status?: PublicationStatus; search?: string }) => {
    const query = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString() : ''
    return list<Product>(await get<unknown>(`/businesses/${businessId}/products${query}`))
  },
  createProduct: (businessId: string, body: CreateProductRequest) => post<Product>(`/businesses/${businessId}/products`, body),
  product: (businessId: string, productId: string) => get<Product>(`/businesses/${businessId}/products/${productId}`),
  updateProduct: (businessId: string, productId: string, body: Partial<CreateProductRequest & { status: string }>) => patch<Product>(`/businesses/${businessId}/products/${productId}`, body),
  variants: async (businessId: string, productId: string) => list<ProductVariant>(await get<unknown>(`/businesses/${businessId}/products/${productId}/variants`)),
  /** Stock rows of one variant across every shop (flat rows, not nested under `inventory`). */
  variantInventory: async (variantId: string) => list<VariantInventoryRow>(await get<unknown>(`/variants/${variantId}/inventory`)),
  /** The product's TBK QR identity; its PNG label is …/qr/label. */
  productQR: (businessId: string, productId: string) => get<{ reference: string; token?: string; status: string; label_url?: string; created_at?: string }>(`/businesses/${businessId}/products/${productId}/qr`),
  /** Link an image to one variant, or pass null to make it product-wide again. */
  assignImageVariant: (businessId: string, productId: string, imageId: string, variantId: string | null) =>
    patch<ProductImageResponse>(`/businesses/${businessId}/products/${productId}/images/${imageId}/variant`, { variant_id: variantId }),
  createVariant: (businessId: string, productId: string, body: CreateVariantRequest) => post<ProductVariant>(`/businesses/${businessId}/products/${productId}/variants`, body),
  updateVariant: (id: string, body: UpdateVariantRequest) => patch<ProductVariant>(`/variants/${id}`, body),
  productImages: async (businessId: string, productId: string) => list<ProductImageResponse>(await get<unknown>(`/businesses/${businessId}/products/${productId}/images`)),
  /** Goes through the native uploader for the same reason the avatar does: a
   *  React Native `FormData` file part streams chunked with no Content-Length,
   *  and any failure along that path collapses into a bare `0 NETWORK_ERROR`
   *  with no request reaching the API. Callers pass a file already normalised
   *  by `prepareProductImageUpload`, so the API always receives a JPEG inside
   *  its size cap. */
  uploadProductImage: (businessId: string, productId: string, file: UploadFile, isPrimary = false) =>
    uploadFile<ProductImageResponse>(
      `/businesses/${businessId}/products/${productId}/images`,
      file,
      { fieldName: 'file', ...(isPrimary ? { parameters: { is_primary: 'true' } } : {}) },
    ),
  deleteProductImage: (businessId: string, productId: string, imageId: string) => del<void>(`/businesses/${businessId}/products/${productId}/images/${imageId}`),

  /* Inventory & stock */
  shopInventory: async (shopId: string, params?: { limit?: number }) => list<InventoryItem>(await get<unknown>(`/shops/${shopId}/inventory${qs(params)}`)),
  addStock: (shopId: string, body: AddStockRequest) => post<InventoryItem>(`/shops/${shopId}/stock`, body),
  recordSale: (shopId: string, body: RecordSaleRequest) => post(`/shops/${shopId}/sales`, body),
  stockMovements: async (shopId: string, params?: { limit?: number }) => list<StockMovement>(await get<unknown>(`/shops/${shopId}/movements${params?.limit ? `?limit=${params.limit}` : ''}`)),
  createStockReceipt: (businessId: string, body: CreateStockReceiptRequest) => post<StockReceipt>(`/businesses/${businessId}/receipts`, body),
  stockReceipts: async (businessId: string) => list<StockReceipt>(await get<unknown>(`/businesses/${businessId}/receipts`)),

  /* Orders (business/shop listing + seller lifecycle actions) */
  businessOrders: async (businessId: string, params?: { limit?: number }) => list<SellerOrder>(await get<unknown>(`/businesses/${businessId}/orders${params?.limit ? `?limit=${params.limit}` : ''}`)),
  shopOrders: async (shopId: string) => list<SellerOrder>(await get<unknown>(`/shops/${shopId}/orders`)),
  order: (id: string) => get<OrderDetail>(`/orders/${id}`),
  acceptOrder: (id: string) => post<SellerOrder>(`/orders/${id}/accept`, {}),
  rejectOrder: (id: string) => post<SellerOrder>(`/orders/${id}/reject`, {}),
  prepareOrder: (id: string) => post<SellerOrder>(`/orders/${id}/prepare`, {}),
  /** The parcel of a cancelled order is back at the shop; its stock goes back on sale. */
  confirmReturn: (id: string) => post(`/orders/${id}/confirm-return`, {}),
  cancelOrder: (id: string) => post<SellerOrder>(`/orders/${id}/cancel`, {}),
  sellerTransition: (id: string, status: string, notes?: string) => post(`/orders/${id}/tracking/status`, { status, notes }),
  getOrderPayment: (id: string) => get<BuyerPayment>(`/orders/${id}/payment`),
  /** Package label metadata; the PNG itself is /orders/:id/package-qr/label. */
  packageQR: (id: string) => get<PackageQR>(`/orders/${id}/package-qr`),
  /** ORDER_ITEM QR of one line of a seller's order (one QR per ordered item). */
  orderItemQR: (orderId: string, itemId: string) => get<OrderItemQR>(`/orders/${orderId}/items/${itemId}/qr`),
  orderItemQRImagePath: (orderId: string, itemId: string) => `/orders/${orderId}/items/${itemId}/qr/image`,
  // No sellerConfirmPayment: a seller is not at the handover, so they cannot attest
  // that cash changed hands. The assigned courier confirms it from their own app.

  /* Customers */
  customers: async (businessId: string) => list<unknown>(await get<unknown>(`/businesses/${businessId}/customers`)).map(normalizeCustomer),
  createCustomer: (businessId: string, body: CreateCustomerRequest) => post<Customer>(`/businesses/${businessId}/customers`, body),
  customer: async (id: string) => normalizeCustomer(await get<unknown>(`/customers/${id}`)),
  updateCustomer: (id: string, body: UpdateCustomerRequest) => patch<Customer>(`/customers/${id}`, body),
  customerOrders: async (customerId: string) => list<SellerOrder>(await get<unknown>(`/customers/${customerId}/orders`)),

  /* Cash management */
  businessCashSessions: async (businessId: string) => list<CashSession>(await get<unknown>(`/businesses/${businessId}/cash-sessions?limit=20`)),
  businessCashSummary: (businessId: string) => get<CashSummary>(`/businesses/${businessId}/cash-summary`),
  openCashSession: (shopId: string, openingAmount: number, currency?: string) => post<CashSession>(`/shops/${shopId}/cash-sessions/open`, { opening_amount: openingAmount, ...(currency ? { currency } : {}) }),
  closeCashSession: (sessionId: string, declaredClosingAmount: number) => post<CashSession>(`/cash-sessions/${sessionId}/close`, { declared_closing_amount: declaredClosingAmount }),
  reconcileCashSession: (sessionId: string) => post<CashSession>(`/cash-sessions/${sessionId}/reconcile`, {}),
  cashSessionPayments: async (sessionId: string) => list<CashPayment>(await get<unknown>(`/cash-sessions/${sessionId}/payments`)),

  /* Growth */
  growthLevel: (businessId: string) => get<SellerGrowth>(`/businesses/${businessId}/growth/level`),
  growthHistory: (businessId: string) => get<SellerPointsHistory>(`/businesses/${businessId}/growth/history`),

  /* Reviews */
  reviews: (shopId: string, type?: 'shop' | 'product') => get<ShopReviewsResponse>(`/marketplace/shops/${shopId}/reviews${type ? `?type=${type}` : '?page=1&per_page=50&sort=newest'}`),

  /* Finances & Platform Commissions */
  financeSummary: (businessId?: string, shopId?: string) => {
    const q = new URLSearchParams()
    if (businessId) q.set('business_id', businessId)
    if (shopId) q.set('shop_id', shopId)
    return get<SellerFinanceSummary>(`/seller/finances/summary?${q.toString()}`)
  },
  financeSales: (params?: { business_id?: string; shop_id?: string; status?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.business_id) q.set('business_id', params.business_id)
    if (params?.shop_id) q.set('shop_id', params.shop_id)
    if (params?.status) q.set('status', params.status)
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.offset) q.set('offset', String(params.offset))
    return get<{ sales: SellerSaleCommissionItem[]; total: number }>(`/seller/finances/sales?${q.toString()}`)
  },
  financeSaleDetail: (orderId: string) => get<SellerSaleCommissionDetail>(`/seller/finances/sales/${orderId}`),

  /* Finances — the endpoints the web finances page reads (sellerFinanceApi). The
   * backend pins seller and business to the caller, so no business_id here. */
  financeDashboard: (params?: SellerFinanceParams) => get<SellerFinanceDashboard>(`/seller/finances/dashboard${qs(params)}`),
  financeBreakdown: (params?: SellerFinanceParams & { group?: SellerBreakdownGroup }) =>
    get<{ group: string; items: SellerFinanceBreakdownItem[] }>(`/seller/finances/breakdown${qs(params)}`),
  financeTimeseries: (params?: SellerFinanceParams & { interval?: 'day' | 'week' | 'month' }) =>
    get<{ interval: string; points: SellerFinanceTimeseriesPoint[] }>(`/seller/finances/timeseries${qs(params)}`),
  financeSalesHistory: (params?: SellerFinanceParams & { status?: string; search?: string; limit?: number; offset?: number }) =>
    get<{ sales: SaleHistoryItem[]; total: number }>(`/seller/finances/sales${qs(params)}`),
  financeSaleFullDetail: (orderId: string) => get<SaleFinanceDetail>(`/seller/finances/sales/${orderId}`),
}

export const employeeAuthApi = {
  acceptInvitation: (body: AcceptEmployeeInvitationRequest) => post<{ user_id: string }>('/auth/employee/invite/accept', body),
}

/**
 * Courier handover scanning.
 *
 * Both endpoints are idempotent on the server: re-scanning the same package returns a
 * DUPLICATE result rather than recording a second handover, so a retry after a flaky
 * network is always safe. `idempotency_key` lets the client make that guarantee explicit.
 */
export const courierApi = {
  scanPickup: (payload: QRScanRequest) => post<QRScanResponse>('/courier/scans/pickup', payload),
  scanDelivery: (payload: QRScanRequest) => post<QRScanResponse>('/courier/scans/delivery', payload),

  /** 404 for accounts that are not couriers; used to show the courier space. */
  profile: () => get<CourierProfile>('/courier/profile'),
  /** AVAILABLE / UNAVAILABLE; the backend refuses it for a non-active courier. */
  updateAvailability: (availability: CourierAvailability) => patch('/courier/availability', { availability }),
  history: async (limit = 50) => list<CourierHistoryItem>(await get<unknown>(`/courier/history?limit=${limit}`)),

  /* missions — the same endpoints the web courier dashboard uses */
  missions: async () => list<CourierMission>(await get<unknown>('/courier/missions')),
  mission: (orderId: string) => get<CourierMission>(`/courier/missions/${orderId}`),
  acceptMission: (orderId: string) => post(`/courier/missions/${orderId}/accept`, {}),
  rejectMission: (orderId: string, reason: string) => post(`/courier/missions/${orderId}/reject`, { order_id: orderId, reason }),
  failDelivery: (orderId: string, reason: string, notes: string) => post(`/courier/missions/${orderId}/fail`, { order_id: orderId, reason, notes }),
  confirmPickup: (orderId: string) => post(`/courier/missions/${orderId}/pickup`, {}),
  /** Day and slot the buyer will receive the parcel; required before leaving. */
  setExpectedDelivery: (orderId: string, date: string, slot: string) => post(`/courier/missions/${orderId}/expected-delivery`, { date, slot }),
  /** Nobody took the parcel: a new attempt at the given day and slot, or a return after the last one. */
  buyerNotFound: (orderId: string, body: { reason: string; notes?: string; next_date?: string; next_slot?: string }) =>
    post<{ outcome: 'RESCHEDULED' | 'RETURNING_TO_SELLER'; delivery_attempts: number }>(`/courier/missions/${orderId}/buyer-not-found`, body),
  startDelivery: (orderId: string) => post(`/courier/missions/${orderId}/start`, {}),
  arrive: (orderId: string) => post(`/courier/missions/${orderId}/arrive`, {}),

  /* handover at the door */
  handover: (orderId: string) => get<HandoverState>(`/courier/missions/${orderId}/handover`),
  /** By QR token or by the printed PRD-/VAR- reference. A mismatch is a verdict, not an error. */
  verifyProduct: (orderId: string, body: { token?: string; product_number?: string }) =>
    post<HandoverVerificationResult>(`/courier/missions/${orderId}/verify-product`, body),
  /** Records cash actually received. There is deliberately no mobile-money equivalent. */
  confirmCash: (orderId: string, idempotencyKey: string) =>
    post<ConfirmCashResponse>(`/courier/missions/${orderId}/confirm-cash`, { confirmed: true, idempotency_key: idempotencyKey }),
}

/**
 * ORDER_ITEM QR resolution, for any authenticated platform user.
 *
 * The token is opaque: it goes over the wire exactly as the camera read it and
 * is never parsed, decoded or stored. The backend validates the signature,
 * identifies the caller from their session, derives their role against the order
 * and returns only what that role may see. There is no client-side masking —
 * a field the courier may not have simply is not in the response.
 *
 * This is a separate flow from the package/handover scans above: it reads an
 * item's identity and mutates no order state.
 */
export const qrApi = {
  resolve: (token: string) => post<OrderItemQRResolution>('/qr/resolve', { token }),
}

export interface LocationProvince { id: string; name: string; code?: string }
export interface LocationCity { id: string; province_id: string; name: string; code?: string }
export interface LocationCommune { id: string; city_id: string; name: string; code?: string }

export const locationsApi = {
  provinces: async (): Promise<LocationProvince[]> => list<LocationProvince>(await get<unknown>('/locations/provinces')),
  cities: async (provinceId: string): Promise<LocationCity[]> => list<LocationCity>(await get<unknown>(`/locations/provinces/${provinceId}/cities`)),
  communes: async (cityId: string): Promise<LocationCommune[]> => list<LocationCommune>(await get<unknown>(`/locations/cities/${cityId}/communes`)),
}
