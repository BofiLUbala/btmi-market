import { del, get, patch, post, postForm, uploadFile } from './client'
import type { UploadFile } from '../lib/imageUpload'
import type {
  AcceptEmployeeInvitationRequest, AddStockRequest, ArchiveBusinessResponse, AssignEmployeeRequest,
  Business, BusinessLifecycleSummary, BuyerOrder, BuyerPayment, BuyerProfile, BuyerReviewsResponse,
  CashPayment, CashSession, CashSummary, Category, Customer, CreateCustomerRequest, CreateEmployeeInvitationRequest,
  CreateEmployeeRequest, CreateProductRequest, CreateShopRequest, CreateStockReceiptRequest, CreateVariantRequest,
  DeliveryOptionsResponse, DeliveryPointsPreview, DeliverySelectResponse, Employee, EmployeeInvitationResponse,
  EmployeeShopAssignment, InventoryItem, LoginResponse, OrderDetail, OrderLineInput, OrderWithLines,
  PointRedemptionPreview, Product, ProductDetail, ProductImageResponse, ProductReviewsResponse, ProductVariant,
  PublicationStatus, PublicProduct, RecordSaleRequest, RegisterInput, ReviewEligibility, SelectDeliveryRequest,
  SellerGrowth, SellerOrder, SellerPointsHistory, Shop, ShopReviewsResponse, StockMovement, StockReceipt,
  TrackingResponse, UpdateCustomerRequest, UpdateEmployeeRequest, UpdateShopRequest, UpdateVariantRequest, User,
} from '../types'

const list = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]
  const object = value as Record<string, unknown> | null
  for (const key of ['data', 'products', 'shops', 'categories', 'items', 'sessions', 'payments']) if (Array.isArray(object?.[key])) return object![key] as T[]
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
  /* Business */
  businesses: async () => list<Business>(await get<unknown>('/businesses')),
  createBusiness: (body: { name: string; business_type: string; category: string; phone: string; whatsapp?: string; email: string; country: string; city: string; default_currency: string }) => post<Business>('/businesses', body),
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

  /* Products & variants */
  products: async (businessId: string, params?: { category_id?: string; publication_status?: PublicationStatus; search?: string }) => {
    const query = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString() : ''
    return list<Product>(await get<unknown>(`/businesses/${businessId}/products${query}`))
  },
  createProduct: (businessId: string, body: CreateProductRequest) => post<Product>(`/businesses/${businessId}/products`, body),
  product: (businessId: string, productId: string) => get<Product>(`/businesses/${businessId}/products/${productId}`),
  updateProduct: (businessId: string, productId: string, body: Partial<CreateProductRequest & { status: string }>) => patch<Product>(`/businesses/${businessId}/products/${productId}`, body),
  variants: async (businessId: string, productId: string) => list<ProductVariant>(await get<unknown>(`/businesses/${businessId}/products/${productId}/variants`)),
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
  shopInventory: async (shopId: string) => list<InventoryItem>(await get<unknown>(`/shops/${shopId}/inventory`)),
  addStock: (shopId: string, body: AddStockRequest) => post<InventoryItem>(`/shops/${shopId}/stock`, body),
  recordSale: (shopId: string, body: RecordSaleRequest) => post(`/shops/${shopId}/sales`, body),
  stockMovements: async (shopId: string, params?: { limit?: number }) => list<StockMovement>(await get<unknown>(`/shops/${shopId}/movements${params?.limit ? `?limit=${params.limit}` : ''}`)),
  createStockReceipt: (businessId: string, body: CreateStockReceiptRequest) => post<StockReceipt>(`/businesses/${businessId}/receipts`, body),
  stockReceipts: async (businessId: string) => list<StockReceipt>(await get<unknown>(`/businesses/${businessId}/receipts`)),

  /* Orders (business/shop listing + seller lifecycle actions) */
  businessOrders: async (businessId: string) => list<SellerOrder>(await get<unknown>(`/businesses/${businessId}/orders`)),
  shopOrders: async (shopId: string) => list<SellerOrder>(await get<unknown>(`/shops/${shopId}/orders`)),
  order: (id: string) => get<OrderDetail>(`/orders/${id}`),
  acceptOrder: (id: string) => post<SellerOrder>(`/orders/${id}/accept`, {}),
  rejectOrder: (id: string) => post<SellerOrder>(`/orders/${id}/reject`, {}),
  prepareOrder: (id: string) => post<SellerOrder>(`/orders/${id}/prepare`, {}),
  cancelOrder: (id: string) => post<SellerOrder>(`/orders/${id}/cancel`, {}),
  sellerTransition: (id: string, status: string, notes?: string) => post(`/orders/${id}/tracking/status`, { status, notes }),
  getOrderPayment: (id: string) => get<BuyerPayment>(`/orders/${id}/payment`),
  sellerConfirmPayment: (paymentId: string) => post<BuyerPayment>(`/payments/${paymentId}/seller-confirm`),

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
  reviews: (shopId: string) => get<ShopReviewsResponse>(`/marketplace/shops/${shopId}/reviews?page=1&per_page=50&sort=newest`),
}

export const employeeAuthApi = {
  acceptInvitation: (body: AcceptEmployeeInvitationRequest) => post<{ user_id: string }>('/auth/employee/invite/accept', body),
}
