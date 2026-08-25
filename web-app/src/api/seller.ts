import {
  post,
  get,
  patch,
  del,
  upload,
} from './client'
import type {
  RegisterResponse,
  SellerBusiness,
  BusinessLifecycleSummary,
  ArchiveBusinessResponse,
  Shop,
  CategoryResponse,
  CreateBusinessRequest,
  CreateShopRequest,
  UpdateShopRequest,
  Employee,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  EmployeeShopAssignment,
  AssignEmployeeRequest,
  CreateEmployeeInvitationRequest,
  EmployeeInvitationResponse,
  AcceptEmployeeInvitationRequest,
  Product,
  ProductImageResponse,
  CreateProductRequest,
  UpdateProductRequest,
  ProductVariant,
  CreateVariantRequest,
  UpdateVariantRequest,
  InventoryItem,
  StockMovement,
  StockReceipt,
  CreateStockReceiptRequest,
  AddStockRequest,
  RecordSaleRequest,
  SellerOrder,
  SellerCreateOrderRequest,
  Customer,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CashSession,
  CashPayment,
  CashSummary,
  SellerGrowth,
  SellerPointsHistory,
  SellerReviewsResponse,
  PublicationStatus,
  OrderStatus,
  BuyerPayment,
} from './types'

async function safeList<T>(p: Promise<T[]>): Promise<T[]> {
  try {
    const res = await p
    return Array.isArray(res) ? res : []
  } catch {
    return []
  }
}

export const sellerAuthApi = {
  registerSeller: (body: {
    first_name: string
    last_name: string
    middle_name?: string
    phone: string
    email: string
    password: string
    password_confirmation: string
  }) => post<RegisterResponse>('/auth/register/seller', body),

  listSellerBusinesses: () => safeList(get<SellerBusiness[]>('/businesses')),
}

export const businessApi = {
  create: (body: CreateBusinessRequest) => post<SellerBusiness>('/businesses', body),
  list: () => safeList(get<SellerBusiness[]>('/businesses')),
  get: (id: string) => get<SellerBusiness>(`/businesses/${id}`),
  update: (id: string, body: Partial<SellerBusiness>) => patch<SellerBusiness>(`/businesses/${id}`, body),
  lifecycleSummary: (id: string) => get<BusinessLifecycleSummary>(`/businesses/${id}/lifecycle-summary`),
  archive: (id: string, confirmName: string) => post<ArchiveBusinessResponse>(`/businesses/${id}/archive`, { confirm_name: confirmName }),
}

export const shopApi = {
  listByBusiness: (businessId: string) => safeList(get<Shop[]>(`/businesses/${businessId}/shops`)),
  create: (businessId: string, body: CreateShopRequest) => post<Shop>(`/businesses/${businessId}/shops`, body),
  get: (id: string) => get<Shop>(`/shops/${id}`),
  update: (id: string, body: UpdateShopRequest) => patch<Shop>(`/shops/${id}`, body),
  // Archives the Shop when it holds commercial history; deletes it when empty.
  delete: (id: string) => del<{ action: 'archived' | 'deleted' }>(`/shops/${id}`),
}

export const employeeApi = {
  listByBusiness: (businessId: string) => safeList(get<Employee[]>(`/businesses/${businessId}/employees`)),
  create: (businessId: string, body: CreateEmployeeRequest) => post<Employee>(`/businesses/${businessId}/employees`, body),
  get: (id: string) => get<Employee>(`/employees/${id}`),
  update: (id: string, body: UpdateEmployeeRequest) => patch<Employee>(`/employees/${id}`, body),
  assignToShop: (employeeId: string, body: AssignEmployeeRequest) => post<EmployeeShopAssignment>(`/employees/${employeeId}/shops`, body),
  removeFromShop: (employeeId: string, shopId: string) => del<void>(`/employees/${employeeId}/shops/${shopId}`),
  listShops: (employeeId: string) => safeList(get<Shop[]>(`/employees/${employeeId}/shops`)),
  listByShop: (shopId: string) => safeList(get<Employee[]>(`/shops/${shopId}/employees`)),
  createInvitation: (employeeId: string, body: CreateEmployeeInvitationRequest) => post<EmployeeInvitationResponse>(`/employees/${employeeId}/invite`, body),
}

export const employeeAuthApi = {
  acceptInvitation: (body: AcceptEmployeeInvitationRequest) => post<RegisterResponse>('/auth/employee/invite/accept', body),
}

export const productApi = {
  listByBusiness: (businessId: string, params?: { category_id?: string; publication_status?: PublicationStatus; search?: string }) =>
    safeList(get<Product[]>(`/businesses/${businessId}/products`, params)),
  create: (businessId: string, body: CreateProductRequest) => post<Product>(`/businesses/${businessId}/products`, body),
  get: (businessId: string, productId: string) => get<Product>(`/businesses/${businessId}/products/${productId}`),
  update: (businessId: string, productId: string, body: UpdateProductRequest) => patch<Product>(`/businesses/${businessId}/products/${productId}`, body),
  listVariants: (businessId: string, productId: string) => safeList(get<ProductVariant[]>(`/businesses/${businessId}/products/${productId}/variants`)),
  createVariant: (businessId: string, productId: string, body: CreateVariantRequest) => post<ProductVariant>(`/businesses/${businessId}/products/${productId}/variants`, body),
  getVariant: (id: string) => get<ProductVariant>(`/variants/${id}`),
  updateVariant: (id: string, body: UpdateVariantRequest) => patch<ProductVariant>(`/variants/${id}`, body),
  getVariantInventory: (variantId: string) => safeList(get<InventoryItem[]>(`/variants/${variantId}/inventory`)),
  getVariantStockHistory: (variantId: string, params?: { shop_id?: string; page?: number; limit?: number }) =>
    safeList(get<StockMovement[]>(`/variants/${variantId}/stock/history`, params)),
}

export const productImageApi = {
  upload: (businessId: string, productId: string, file: File, isPrimary = false) => {
    const formData = new FormData()
    formData.append('file', file)
    if (isPrimary) formData.append('is_primary', 'true')
    return upload<ProductImageResponse>(`/businesses/${businessId}/products/${productId}/images`, formData)
  },
  list: (businessId: string, productId: string) =>
    safeList(get<ProductImageResponse[]>(`/businesses/${businessId}/products/${productId}/images`)),
  delete: (businessId: string, productId: string, imageId: string) =>
    del<void>(`/businesses/${businessId}/products/${productId}/images/${imageId}`),
}

export const categoryApi = {
  // Global BTMI taxonomy with embedded subcategories (used by the create form).
  list: () => safeList(get<CategoryResponse[]>('/categories', { with_subcategories: true })),
}

export const inventoryApi = {
  getShopInventory: (shopId: string, params?: { page?: number; limit?: number; search?: string }) =>
    safeList(get<InventoryItem[]>(`/shops/${shopId}/inventory`, params)),
  addStock: (shopId: string, body: AddStockRequest) => post<InventoryItem>(`/shops/${shopId}/stock`, body),
  recordSale: (shopId: string, body: RecordSaleRequest) => post<any>(`/shops/${shopId}/sales`, body),
  getStockMovements: (shopId: string, params?: { variant_id?: string; movement_type?: string; date_from?: string; date_to?: string; page?: number; limit?: number }) =>
    safeList(get<StockMovement[]>(`/shops/${shopId}/movements`, params)),
  getBusinessStockHistory: (businessId: string, params?: { variant_id?: string; shop_id?: string; movement_type?: string; date_from?: string; date_to?: string; page?: number; limit?: number }) =>
    safeList(get<StockMovement[]>(`/businesses/${businessId}/stock/history`, params)),
  // Stops selling one Product at one Shop (removes that Shop's stock rows only).
  removeProduct: (shopId: string, productId: string) =>
    del<{ variants_removed: number }>(`/shops/${shopId}/products/${productId}`),
  receiveStock: (businessId: string, body: CreateStockReceiptRequest) => post<StockReceipt>(`/businesses/${businessId}/receipts`, body),
  listReceipts: (businessId: string, params?: { page?: number; limit?: number }) => safeList(get<StockReceipt[]>(`/businesses/${businessId}/receipts`, params)),
  getReceipt: (id: string) => get<StockReceipt>(`/receipts/${id}`),
}

export const orderApi = {
  listByBusiness: (businessId: string, params?: { shop_id?: string; status?: OrderStatus; page?: number; limit?: number }) =>
    safeList(get<SellerOrder[]>(`/businesses/${businessId}/orders`, params)),
  listByShop: (shopId: string, params?: { status?: OrderStatus; page?: number; limit?: number }) =>
    safeList(get<SellerOrder[]>(`/shops/${shopId}/orders`, params)),
  create: (shopId: string, body: SellerCreateOrderRequest) => post<SellerOrder>(`/shops/${shopId}/orders`, body),
  get: (id: string) => get<SellerOrder>(`/orders/${id}`),
  accept: (id: string) => post<SellerOrder>(`/orders/${id}/accept`, {}),
  reject: (id: string) => post<SellerOrder>(`/orders/${id}/reject`, {}),
  prepare: (id: string) => post<SellerOrder>(`/orders/${id}/prepare`, {}),
  cancel: (id: string) => post<SellerOrder>(`/orders/${id}/cancel`, {}),
  sellerTransition: (id: string, body: { status: OrderStatus }) => post<SellerOrder>(`/orders/${id}/tracking/status`, body),
  sellerConfirmPayment: (paymentId: string) => post<any>(`/payments/${paymentId}/seller-confirm`, {}),
  getOrderPayment: (orderId: string) => get<BuyerPayment>(`/orders/${orderId}/payment`),
}

export const customerApi = {
  listByBusiness: (businessId: string, params?: { page?: number; limit?: number; search?: string }) =>
    safeList(get<Customer[]>(`/businesses/${businessId}/customers`, params)),
  create: (businessId: string, body: CreateCustomerRequest) => post<Customer>(`/businesses/${businessId}/customers`, body),
  get: (id: string) => get<Customer>(`/customers/${id}`),
  update: (id: string, body: UpdateCustomerRequest) => patch<Customer>(`/customers/${id}`, body),
  getOrders: (customerId: string, params?: { shop_id?: string; status?: OrderStatus; date_from?: string; date_to?: string; page?: number; limit?: number }) =>
    safeList(get<SellerOrder[]>(`/customers/${customerId}/orders`, params)),
}

export const cashApi = {
  listBusinessSessions: (businessId: string, params?: { page?: number; limit?: number }) =>
    safeList(get<CashSession[]>(`/businesses/${businessId}/cash-sessions`, params)),
  getBusinessCashSummary: (businessId: string) => get<CashSummary>(`/businesses/${businessId}/cash-summary`),
  listShopSessions: (shopId: string, params?: { page?: number; limit?: number }) =>
    safeList(get<CashSession[]>(`/shops/${shopId}/cash-sessions`, params)),
  getOpenSession: (shopId: string) => get<CashSession>(`/shops/${shopId}/cash-sessions/open`),
  openSession: (shopId: string, openingAmount: number, currency?: string) =>
    post<CashSession>(`/shops/${shopId}/cash-sessions/open`, { opening_amount: openingAmount, ...(currency ? { currency } : {}) }),
  closeSession: (sessionId: string, declaredClosingAmount: number) => post<CashSession>(`/cash-sessions/${sessionId}/close`, { declared_closing_amount: declaredClosingAmount }),
  reconcileSession: (sessionId: string) => post<CashSession>(`/cash-sessions/${sessionId}/reconcile`, {}),
  getSession: (sessionId: string) => get<CashSession>(`/cash-sessions/${sessionId}`),
  getSessionPayments: (sessionId: string) => safeList(get<CashPayment[]>(`/cash-sessions/${sessionId}/payments`)),
  listShopPayments: (shopId: string, params?: { page?: number; limit?: number }) => safeList(get<CashPayment[]>(`/shops/${shopId}/cash-payments`, params)),
  getPayment: (paymentId: string) => get<CashPayment>(`/cash-payments/${paymentId}`),
}

export const growthApi = {
  getPoints: (businessId: string) => get<any>(`/businesses/${businessId}/growth/points`),
  getLevel: (businessId: string) => get<SellerGrowth>(`/businesses/${businessId}/growth/level`),
  getBenefits: (businessId: string) => get<any>(`/businesses/${businessId}/growth/benefits`),
  getHistory: (businessId: string, params?: { page?: number; limit?: number }) =>
    get<SellerPointsHistory>(`/businesses/${businessId}/growth/history`, params),
}

export const reviewApi = {
  getShopReviews: (shopId: string, params?: { page?: number; limit?: number; rating?: number; sort?: string }) =>
    get<SellerReviewsResponse>(`/marketplace/shops/${shopId}/reviews`, params),
}
