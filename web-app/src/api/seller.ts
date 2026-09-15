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
  CategoryAttributeDefinition,
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
  ShopReviewsResponse,
  PublicationStatus,
  OrderStatus,
  BuyerPayment,
  OrderWithLines,
  QRIdentity,
  DeliveryPackageQR,
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
    backup_phone?: string
    email: string
    password: string
    password_confirmation: string
    address?: string
    city?: string
    commune?: string
    country?: string
    latitude?: number | null
    longitude?: number | null
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
  getQR: (businessId: string, productId: string) => get<QRIdentity>(`/businesses/${businessId}/products/${productId}/qr`),
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
  /** Link an image to one Variant, or pass null to make it Product-wide again. */
  assignVariant: (businessId: string, productId: string, imageId: string, variantId: string | null) =>
    patch<ProductImageResponse>(
      `/businesses/${businessId}/products/${productId}/images/${imageId}/variant`,
      { variant_id: variantId }
    ),
}

export const categoryApi = {
  // Global TBK taxonomy with embedded subcategories (used by the create form).
  list: () => safeList(get<CategoryResponse[]>('/categories', { with_subcategories: true })),
  // DB-backed attribute definitions for a category (primary source of truth).
  getAttributes: (categoryId: string, subcategoryId?: string): Promise<CategoryAttributeDefinition[]> =>
    safeList(
      get<CategoryAttributeDefinition[]>(
        `/categories/${categoryId}/attributes`,
        subcategoryId ? { subcategory_id: subcategoryId } : undefined,
      ),
    ),
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
    get<SellerOrder[]>(`/businesses/${businessId}/orders`, params),
  listByShop: (shopId: string, params?: { status?: OrderStatus; page?: number; limit?: number }) =>
    safeList(get<SellerOrder[]>(`/shops/${shopId}/orders`, params)),
  create: (shopId: string, body: SellerCreateOrderRequest) => post<SellerOrder>(`/shops/${shopId}/orders`, body),
  get: (id: string) => get<OrderWithLines>(`/orders/${id}`),
  accept: (id: string) => post<SellerOrder>(`/orders/${id}/accept`, {}),
  reject: (id: string) => post<SellerOrder>(`/orders/${id}/reject`, {}),
  prepare: (id: string) => post<SellerOrder>(`/orders/${id}/prepare`, {}),
  cancel: (id: string) => post<SellerOrder>(`/orders/${id}/cancel`, {}),
  sellerTransition: (id: string, body: { status: OrderStatus }) => post<SellerOrder>(`/orders/${id}/tracking/status`, body),
  sellerConfirmPayment: (paymentId: string) => post<any>(`/payments/${paymentId}/seller-confirm`, {}),
  getOrderPayment: (orderId: string) => get<BuyerPayment>(`/orders/${orderId}/payment`),
  getPackageQR: (orderId: string) => get<DeliveryPackageQR>(`/orders/${orderId}/package-qr`),
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
  getShopReviews: (shopId: string, params?: { type?: string; page?: number; limit?: number }) =>
    get<ShopReviewsResponse>(`/marketplace/shops/${shopId}/reviews`, params),
}

export interface SellerFinanceSummary {
  gross_sales: number
  tbk_commission_total: number
  seller_net_revenue: number
  commission_due: number
  commission_collected: number
  total_completed_sales: number
}

export interface SellerFinanceDashboard {
  gross_sales: number
  commission_amount: number
  seller_net_amount: number
  collected_commission: number
  due_commission: number
  waived_commission: number
  collected_cash: number
  verified_sales: number
  refunded_sales: number
  pending_orders: number
  commission_rate: number
  currency?: string
  mixed_currency: boolean
  totals_by_currency: Array<{
    currency: string; gross_sales: number; commission_amount: number; seller_net_amount: number
    collected_commission: number; due_commission: number; verified_sales: number
  }>
}

export interface SellerFinanceBreakdownItem {
  id?: string
  label: string
  gross_sales: number
  commission_amount: number
  seller_net_amount: number
  collected: number
  due: number
  sales_count: number
  currency: string
}

export interface SellerSaleCommissionItem {
  id: string
  order_id: string
  order_number: string
  payment_id?: string
  business_id: string
  business_name: string
  shop_id: string
  shop_name: string
  gross_amount: number
  commission_base: number
  commission_rate: number
  commission_amount: number
  seller_net_amount: number
  currency: string
  status: 'DUE' | 'COLLECTED' | 'WAIVED' | 'ADJUSTED'
  calculated_at: string
  collected_at?: string
  notes?: string
}

export interface SaleFinanceLine {
  product_id?: string; product_name: string; product_sku: string
  variant_id?: string; variant_name: string; variant_sku: string
  quantity: number; unit_price: number; points_discount: number
  final_unit_price: number; gross_amount: number
}

// One row of sales history: the shared commission snapshot plus the buyer,
// payment, delivery and line context. Finance Admin reads the same shape.
export interface SaleHistoryItem extends SellerSaleCommissionItem {
  buyer_name: string
  payment_method: string
  payment_status: string
  order_status: string
  delivery_method: string
  delivery_status: string
  total_quantity: number
  lines: SaleFinanceLine[]
}

export interface SaleFinanceDetail {
  sale: SellerSaleCommissionItem
  buyer_name: string
  payment_method: string
  payment_status: string
  order_status: string
  delivery_method: string
  delivery_status: string
  payment_markup: number
  delivery_fee: number
  products_subtotal: number
  final_total: number
  ordered_at: string
  verified_at?: string
  lines: SaleFinanceLine[]
}

export const sellerFinanceApi = {
  getSummary: () => get<SellerFinanceSummary>('/seller/finances/summary'),
  getDashboard: (params?: { shop_id?: string; date_from?: string; date_to?: string }) =>
    get<SellerFinanceDashboard>('/seller/finances/dashboard', params),
  getBreakdown: (params?: { group?: 'shop' | 'product'; shop_id?: string; date_from?: string; date_to?: string }) =>
    get<{ group: string; items: SellerFinanceBreakdownItem[] }>('/seller/finances/breakdown', params),
  listSales: (params?: { status?: string; search?: string; date_from?: string; date_to?: string; limit?: number; offset?: number }) =>
    get<{ sales: SaleHistoryItem[]; total: number }>('/seller/finances/sales', params),
  getSaleDetail: (orderId: string) => get<SaleFinanceDetail>(`/seller/finances/sales/${orderId}`),
}
