import { API_BASE } from './client'

export type AdminRole =
  | 'SUPER_ADMIN'
  | 'DIRECTION_ADMIN'
  | 'COMMERCE_ADMIN'
  | 'FINANCE_SUPPORT_ADMIN'
  | 'TECHNICAL_ADMIN'

export interface AdminUser {
  id: string
  first_name: string
  last_name: string
  email: string
  role: AdminRole
  status: string
  mfa_enabled: boolean
  last_login_at?: string
  created_at: string
}

export interface DirectionOverviewStats {
  total_users: number
  total_buyers: number
  total_sellers: number
  total_employees: number
  total_businesses: number
  total_shops: number
  active_shops: number
  total_products: number
  published_products: number
  out_of_stock_products: number
  total_orders: number
  orders_today: number
  completed_orders: number
  pending_orders: number
  confirmed_cash: number
  open_disputes: number
  critical_alerts: number
  platform_health: string
}

export interface AdminUserListItem {
  id: string
  first_name: string
  middle_name?: string
  last_name: string
  phone: string
  email: string
  status: string
  email_verified: boolean
  account_type: 'BUYER' | 'SELLER' | 'EMPLOYEE'
  created_at: string
  business_count: number
  shop_count: number
  order_count: number
  total_points: number
}

export interface AdminAuditLog {
  id: string
  actor_admin_id: string
  actor_admin_name?: string
  actor_admin_email?: string
  actor_role: AdminRole
  action: string
  target_type: string
  target_id: string
  reason: string
  old_value?: Record<string, unknown>
  new_value?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  created_at: string
}

// Commerce Types
export interface CommerceOverviewStats {
  total_products: number
  published_products: number
  draft_products: number
  archived_products: number
  out_of_stock_products: number
  total_categories: number
  total_subcategories: number
  total_orders: number
  orders_today: number
  completed_orders: number
  pending_orders: number
  stuck_orders: number
  stock_anomalies_count: number
  confirmed_cash: number
}

export interface AdminProductListItem {
  id: string
  name: string
  sku: string
  business_id: string
  business_name: string
  category_id?: string
  category_name: string
  subcategory_id?: string
  subcategory_name: string
  publication_status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  status: string
  unit_price: number
  effective_price: number
  discount_active: boolean
  discount_type: string
  discount_value: number
  primary_image?: string
  image_count: number
  variant_count: number
  total_available: number
  created_at: string
  updated_at: string
}

export interface AdminProductDetail {
  product: {
    id: string
    business_id: string
    name: string
    sku: string
    description: string
    unit_price: number
    cost_price: number
    unit: string
    status: string
    publication_status: string
    category_id?: string
    subcategory_id?: string
    discount_active: boolean
    discount_type: string
    discount_value: number
    created_at: string
  }
  business_name: string
  category_name: string
  subcategory_name: string
  variants: Array<{
    id: string
    sku: string
    name: string
    attributes: Record<string, string>
    sale_price: number
    purchase_price: number
    barcode: string
    unit: string
    status: string
  }>
  images: Array<{
    id: string
    url: string
    file_name: string
    is_primary: boolean
  }>
  inventory: Array<{
    shop_id: string
    shop_name: string
    variant_id: string
    variant_name: string
    sku: string
    quantity: number
    reserved_quantity: number
    available: number
  }>
  visibility_report: {
    is_visible: boolean
    reasons_not_shown: string[]
    business_status: string
    product_status: string
    publication_status: string
    stock_available: number
  }
}

export interface AdminCategoryItem {
  ID: string
  Name: string
  Slug: string
  Status: string
  SortOrder: number
  Subcategories: Array<{
    id: string
    category_id: string
    name: string
    slug: string
    status: string
    sort_order: number
  }>
}

export interface AdminInventoryItem {
  inventory_id: string
  business_id: string
  business_name: string
  shop_id: string
  shop_name: string
  product_id: string
  product_name: string
  variant_id: string
  variant_name: string
  sku: string
  quantity: number
  reserved_quantity: number
  available: number
  stock_status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  updated_at: string
}

export interface StockAnomaly {
  type: string
  shop_id: string
  shop_name: string
  product_id: string
  product_name: string
  variant_id: string
  quantity: number
  reserved_quantity: number
  description: string
}

export interface AdminStockMovementItem {
  id: string
  business_id: string
  business_name: string
  shop_id: string
  shop_name: string
  product_id: string
  product_name: string
  variant_id?: string
  variant_name: string
  variant_sku: string
  movement_type: string
  quantity: number
  previous_quantity: number
  new_quantity: number
  notes: string
  performed_by?: string
  performer_name: string
  employee_id?: string
  employee_name: string
  reference_type: string
  reference_id?: string
  created_at: string
}

export interface AdminMarketplaceVisibility {
  product_id: string
  is_visible: boolean
  reasons_not_shown: string[]
  business_status: string
  shop_status: string
  product_status: string
  publication_status: string
  shop_offer_status: string
  stock_available: number
  policy_status: string
  moderation_status: string
}

export interface AdminSearchAnalytics {
  available: boolean
  message: string
  total_queries?: number
  zero_results?: number
  failed_searches?: number
}

export interface AdminSearchQueryLog {
  query: string
  results_count: number
  search_type: string
  created_at: string
}

export interface AdminMarketplaceRanking {
  available: boolean
  message: string
  ranking_factors?: string[]
  category_weights?: Record<string, number>
}

export interface AdminProductCardQuality {
  product_id: string
  product_name: string
  has_primary_image: boolean
  primary_image_url: string
  image_count: number
  has_effective_price: boolean
  effective_price: number
  has_regular_price: boolean
  regular_price: number
  has_off_badge: boolean
  discount_percent: number
  shop_name: string
  availability: number
  rating: number
  review_count: number
  issues: string[]
}

export interface AdminPromotionVisibility {
  product_id: string
  product_name: string
  shop_id: string
  shop_name: string
  regular_price: number
  sale_price: number
  discount_type: string
  discount_value: number
  off_badge: boolean
  start_date?: string
  end_date?: string
  status: string
  is_active: boolean
}

export interface AdminSellerPerformance {
  seller_id: string
  seller_name: string
  business_id: string
  business_name: string
  orders_received: number
  orders_accepted: number
  orders_rejected: number
  acceptance_rate: number
  rejection_rate: number
  avg_preparation_time_hours: number
  completion_rate: number
  cancellations: number
  review_score: number
  dispute_rate: number
  stock_accuracy_score: number
  cash_confirmation_rate: number
}

export interface AdminProductPerformance {
  product_id: string
  product_name: string
  sku: string
  views: number
  favorites: number
  add_to_cart: number
  orders: number
  conversion_rate: number
  sales_value: number
  review_score: number
  stock_state: string
}

export interface AdminCategoryPerformance {
  category_id: string
  category_name: string
  product_count: number
  published_products: number
  active_sellers: number
  orders: number
  sales_value: number
  availability_score: number
  search_volume: number
  conversion_rate: number
}

export interface AdminShopPerformance {
  shop_id: string
  shop_name: string
  business_id: string
  business_name: string
  orders: number
  completed_orders: number
  cancellations: number
  products: number
  stock_availability_score: number
  review_score: number
  cash_confirmation_rate: number
  avg_fulfillment_time_hours: number
}

export interface AdminEmployeeShopAuth {
  employee_id: string
  employee_name: string
  business_id: string
  shop_id: string
  shop_name: string
  can_operate: boolean
  reason?: string
}

export interface AdminShopPageControl {
  shop_id: string
  shop_name: string
  business_id: string
  business_name: string
  location: string
  latitude: number
  longitude: number
  status: string
  active_categories: string[]
  product_count: number
  published_products: number
  rating: number
  review_count: number
  marketplace_visibility: boolean
  created_at: string
  updated_at: string
}

export interface AdminOrderItem {
  id: string
  order_number: string
  business_id: string
  business_name: string
  shop_id: string
  shop_name: string
  buyer_id?: string
  buyer_name: string
  buyer_phone: string
  status: string
  total_items: number
  base_total: number
  points_discount: number
  delivery_fee: number
  final_total: number
  delivery_method: string
  payment_status: string
  is_stuck: boolean
  stuck_reason?: string
  created_at: string
  updated_at: string
}

export interface AdminOrderDetail {
  order: AdminOrderItem
  lines: Array<{
    id: string
    product_id: string
    variant_id: string
    quantity: number
    unit_price: number
    final_unit_price: number
    product_name: string
  }>
  status_history: Array<{
    id: string
    status: string
    changed_by?: string
    notes: string
    created_at: string
  }>
}

export interface AdminEmployeeItem {
  id: string
  business_id: string
  business_name: string
  linked_user_id?: string
  first_name: string
  last_name: string
  email: string
  role: string
  status: string
  shops: string[]
  created_at: string
}

const ADMIN_ACCESS_KEY = 'btmi.admin.access'
const ADMIN_REFRESH_KEY = 'btmi.admin.refresh'

export const adminTokenStore = {
  getAccess: () => localStorage.getItem(ADMIN_ACCESS_KEY),
  getRefresh: () => localStorage.getItem(ADMIN_REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ADMIN_ACCESS_KEY, access)
    localStorage.setItem(ADMIN_REFRESH_KEY, refresh)
  },
  clear: () => {
    localStorage.removeItem(ADMIN_ACCESS_KEY)
    localStorage.removeItem(ADMIN_REFRESH_KEY)
  }
}

let refreshPromise: Promise<boolean> | null = null

async function refreshAdminTokens(): Promise<boolean> {
  const refresh = adminTokenStore.getRefresh()
  if (!refresh) return false

  try {
    const res = await fetch(`${API_BASE}/admin/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh })
    })

    if (!res.ok) {
      adminTokenStore.clear()
      return false
    }

    const json = await res.json()
    const d = json?.data as { access_token: string; refresh_token: string } | undefined
    if (!d?.access_token || !d?.refresh_token) {
      adminTokenStore.clear()
      return false
    }

    adminTokenStore.set(d.access_token, d.refresh_token)
    return true
  } catch {
    adminTokenStore.clear()
    return false
  }
}

export async function adminApi<T>(
  path: string,
  options: RequestInit = {},
  allowRefresh = true
): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const access = adminTokenStore.getAccess()
  if (access) {
    headers.set('Authorization', `Bearer ${access}`)
  }

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  })

  if (res.status === 401 && allowRefresh && adminTokenStore.getRefresh()) {
    if (!refreshPromise) {
      refreshPromise = refreshAdminTokens().finally(() => {
        refreshPromise = null
      })
    }
    const refreshed = await refreshPromise
    if (refreshed) {
      const newAccess = adminTokenStore.getAccess()
      if (newAccess) headers.set('Authorization', `Bearer ${newAccess}`)
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers
      })
    }
  }

  const json = await res.json().catch(() => null)

  if (!res.ok) {
    const message = json?.error?.message || json?.message || 'Administrative request failed'
    const error = new Error(message) as Error & { code?: string; status?: number }
    error.code = json?.error?.code
    error.status = res.status
    throw error
  }

  return (json?.data !== undefined ? json.data : json) as T
}

export const adminAuthApi = {
  login: async (email: string, password: string) => {
    return adminApi<{ access_token: string; refresh_token: string; admin: AdminUser }>(
      '/admin/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password })
      },
      false
    )
  },
  me: async () => {
    return adminApi<AdminUser>('/admin/auth/me')
  },
  logout: async () => {
    const refresh = adminTokenStore.getRefresh()
    if (refresh) {
      try {
        await adminApi('/admin/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refresh })
        })
      } catch {
        // Ignored during client cleanup
      }
    }
    adminTokenStore.clear()
  }
}

export const adminDirectionApi = {
  getOverview: async () => {
    return adminApi<DirectionOverviewStats>('/admin/direction/overview')
  },
  listUsers: async (params?: { search?: string; account_type?: string; status?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.account_type) q.set('account_type', params.account_type)
    if (params?.status) q.set('status', params.status)
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.offset) q.set('offset', String(params.offset))
    return adminApi<{ users: AdminUserListItem[]; total: number; limit: number; offset: number }>(
      `/admin/direction/users?${q.toString()}`
    )
  },
  suspendUser: async (id: string, reason: string) => {
    return adminApi<{ message: string }>(`/admin/direction/users/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    })
  },
  reactivateUser: async (id: string, reason: string) => {
    return adminApi<{ message: string }>(`/admin/direction/users/${id}/reactivate`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    })
  },
  forceLogoutUser: async (id: string, reason: string) => {
    return adminApi<{ message: string }>(`/admin/direction/users/${id}/force-logout`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    })
  },
  listAuditLogs: async (params?: { action?: string; role?: string; target_type?: string; target_id?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.action) q.set('action', params.action)
    if (params?.role) q.set('role', params.role)
    if (params?.target_type) q.set('target_type', params.target_type)
    if (params?.target_id) q.set('target_id', params.target_id)
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.offset) q.set('offset', String(params.offset))
    return adminApi<{ logs: AdminAuditLog[]; total: number; limit: number; offset: number }>(
      `/admin/direction/audit-log?${q.toString()}`
    )
  }
}

export const adminCommerceApi = {
  getOverview: async () => {
    return adminApi<CommerceOverviewStats>('/admin/commerce/overview')
  },
  listProducts: async (params?: { search?: string; business_id?: string; category_id?: string; subcategory_id?: string; publication_status?: string; stock_status?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.business_id) q.set('business_id', params.business_id)
    if (params?.category_id) q.set('category_id', params.category_id)
    if (params?.subcategory_id) q.set('subcategory_id', params.subcategory_id)
    if (params?.publication_status) q.set('publication_status', params.publication_status)
    if (params?.stock_status) q.set('stock_status', params.stock_status)
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.offset) q.set('offset', String(params.offset))
    return adminApi<{ products: AdminProductListItem[]; total: number; limit: number; offset: number }>(
      `/admin/commerce/products?${q.toString()}`
    )
  },
  getProduct: async (id: string) => {
    return adminApi<AdminProductDetail>(`/admin/commerce/products/${id}`)
  },
  unpublishProduct: async (id: string, reason: string) => {
    return adminApi<{ message: string }>(`/admin/commerce/products/${id}/unpublish`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    })
  },
  archiveProduct: async (id: string, reason: string) => {
    return adminApi<{ message: string }>(`/admin/commerce/products/${id}/archive`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    })
  },
  listCategories: async () => {
    return adminApi<AdminCategoryItem[]>('/admin/commerce/categories')
  },
  createCategory: async (name: string, slug: string, sort_order: number) => {
    return adminApi<unknown>('/admin/commerce/categories', {
      method: 'POST',
      body: JSON.stringify({ name, slug, sort_order })
    })
  },
  updateCategory: async (id: string, data: { name?: string; slug?: string; status?: string; sort_order?: number }) => {
    return adminApi<unknown>(`/admin/commerce/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },
  createSubcategory: async (category_id: string, name: string, slug: string, sort_order: number) => {
    return adminApi<unknown>('/admin/commerce/subcategories', {
      method: 'POST',
      body: JSON.stringify({ category_id, name, slug, sort_order })
    })
  },
  updateSubcategory: async (id: string, data: { name?: string; slug?: string; status?: string; sort_order?: number }) => {
    return adminApi<unknown>(`/admin/commerce/subcategories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },
  getAttributeSuggestions: async () => {
    return adminApi<Record<string, string[]>>('/admin/commerce/attribute-suggestions')
  },
  listInventory: async (params?: { business_id?: string; shop_id?: string; stock_status?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.business_id) q.set('business_id', params.business_id)
    if (params?.shop_id) q.set('shop_id', params.shop_id)
    if (params?.stock_status) q.set('stock_status', params.stock_status)
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.offset) q.set('offset', String(params.offset))
    return adminApi<{ inventory: AdminInventoryItem[]; total: number; limit: number; offset: number }>(
      `/admin/commerce/inventory?${q.toString()}`
    )
  },
  listStockAnomalies: async () => {
    return adminApi<StockAnomaly[]>('/admin/commerce/inventory/anomalies')
  },
  listStockMovementHistory: async (params?: { business_id?: string; shop_id?: string; product_id?: string; variant_id?: string; movement_type?: string; employee_id?: string; from?: string; to?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.business_id) q.set('business_id', params.business_id)
    if (params?.shop_id) q.set('shop_id', params.shop_id)
    if (params?.product_id) q.set('product_id', params.product_id)
    if (params?.variant_id) q.set('variant_id', params.variant_id)
    if (params?.movement_type) q.set('movement_type', params.movement_type)
    if (params?.employee_id) q.set('employee_id', params.employee_id)
    if (params?.from) q.set('from', params.from)
    if (params?.to) q.set('to', params.to)
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.offset) q.set('offset', String(params.offset))
    return adminApi<{ movements: AdminStockMovementItem[]; total: number; limit: number; offset: number }>(
      `/admin/commerce/inventory/history?${q.toString()}`
    )
  },
  getMarketplaceVisibility: async (productId: string) => {
    return adminApi<AdminMarketplaceVisibility>(`/admin/commerce/marketplace/visibility/${productId}`)
  },
  getShopPageControl: async (shopId: string) => {
    return adminApi<AdminShopPageControl>(`/admin/commerce/shops/${shopId}/page-control`)
  },
  getSearchAnalytics: async () => {
    return adminApi<AdminSearchAnalytics>('/admin/commerce/search/analytics')
  },
  listSearchQueries: async (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.offset) q.set('offset', String(params.offset))
    return adminApi<{ queries: AdminSearchQueryLog[]; total: number; limit: number; offset: number }>(
      `/admin/commerce/search/queries?${q.toString()}`
    )
  },
  getMarketplaceRanking: async () => {
    return adminApi<AdminMarketplaceRanking>('/admin/commerce/marketplace/ranking')
  },
  getProductCardQuality: async (productId: string) => {
    return adminApi<AdminProductCardQuality>(`/admin/commerce/products/${productId}/card-quality`)
  },
  listPromotionVisibility: async (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.offset) q.set('offset', String(params.offset))
    return adminApi<{ promotions: AdminPromotionVisibility[]; total: number; limit: number; offset: number }>(
      `/admin/commerce/promotions?${q.toString()}`
    )
  },
  adjustStock: async (shop_id: string, variant_id: string, new_quantity: number, reason: string) => {
    return adminApi<{ message: string }>('/admin/commerce/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({ shop_id, variant_id, new_quantity, reason })
    })
  },
  listOrders: async (params?: { status?: string; delivery_method?: string; shop_id?: string; business_id?: string; search?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.delivery_method) q.set('delivery_method', params.delivery_method)
    if (params?.shop_id) q.set('shop_id', params.shop_id)
    if (params?.business_id) q.set('business_id', params.business_id)
    if (params?.search) q.set('search', params.search)
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.offset) q.set('offset', String(params.offset))
    return adminApi<{ orders: AdminOrderItem[]; total: number; limit: number; offset: number }>(
      `/admin/commerce/orders?${q.toString()}`
    )
  },
  getOrder: async (id: string) => {
    return adminApi<AdminOrderDetail>(`/admin/commerce/orders/${id}`)
  },
  listEmployees: async (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.offset) q.set('offset', String(params.offset))
    return adminApi<{ employees: AdminEmployeeItem[]; total: number; limit: number; offset: number }>(
      `/admin/commerce/employees?${q.toString()}`
    )
  },
  revokeEmployeeAccess: async (id: string, reason: string) => {
    return adminApi<{ message: string }>(`/admin/commerce/employees/${id}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    })
  },
  getSellerPerformance: async (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.offset) q.set('offset', String(params.offset))
    return adminApi<{ performance: AdminSellerPerformance[]; total: number; limit: number; offset: number }>(
      `/admin/commerce/sellers/performance?${q.toString()}`
    )
  },
  getProductPerformance: async (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.offset) q.set('offset', String(params.offset))
    return adminApi<{ performance: AdminProductPerformance[]; total: number; limit: number; offset: number }>(
      `/admin/commerce/products/performance?${q.toString()}`
    )
  },
  getCategoryPerformance: async () => {
    return adminApi<AdminCategoryPerformance[]>('/admin/commerce/categories/performance')
  },
  getShopPerformance: async (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.offset) q.set('offset', String(params.offset))
    return adminApi<{ performance: AdminShopPerformance[]; total: number; limit: number; offset: number }>(
      `/admin/commerce/shops/performance?${q.toString()}`
    )
  },
  checkEmployeeShopAuth: async (employeeId: string, shopId: string) => {
    return adminApi<AdminEmployeeShopAuth>(`/admin/commerce/employees/${employeeId}/shop-auth/${shopId}`)
  }
}

// Phase 3 Finance & Support Interfaces
export interface AdminFinancialSummary {
  total_order_value: number
  verified_cash: number
  unverified_cash: number
  disputed_cash: number
  points_discount_value: number
  total_orders: number
  pending_payments_count: number
  verified_payments_count: number
  disputed_payments_count: number
  open_cases_count: number
  flagged_reviews_count: number
  risk_alerts_count: number
}

export interface AdminPaymentListItem {
  payment_id: string
  order_id: string
  order_number: string
  buyer_id: string
  buyer_name: string
  buyer_email: string
  seller_id?: string
  seller_name: string
  business_id: string
  business_name: string
  shop_id: string
  shop_name: string
  subtotal_amount: number
  discount_amount: number
  points_discount_amount: number
  delivery_fee: number
  total_amount: number
  cash_due: number
  buyer_confirmed_paid: boolean
  buyer_confirmed_at?: string
  seller_confirmed_received: boolean
  seller_confirmed_at?: string
  payment_status: string
  created_at: string
  verified_at?: string
  anomaly_flag: boolean
  anomaly_reason?: string
}

export interface AdminPaymentDetail extends AdminPaymentListItem {
  product_lines: Array<{
    id: string
    product_id: string
    product_name: string
    variant_id?: string
    variant_name?: string
    sku: string
    quantity: number
    unit_price: number
    total_price: number
  }>
  order_history: Array<{
    status: string
    note: string
    timestamp: string
  }>
}

export interface AdminBuyerPointsItem {
  buyer_id: string
  buyer_name: string
  buyer_email: string
  account_id: string
  available_points: number
  reserved_points: number
  lifetime_points: number
  current_level: string
  last_updated: string
  anomaly_flag: boolean
  anomaly_reason?: string
}

export interface AdminPointTransaction {
  id: string
  point_account_id: string
  type: 'EARNED' | 'RESERVED' | 'RELEASED' | 'CONSUMED' | 'ADJUSTED'
  amount: number
  balance_after: number
  order_id?: string
  order_number?: string
  reason: string
  created_at: string
}

export interface AdminSellerGrowthItem {
  seller_id: string
  seller_name: string
  seller_email: string
  business_id: string
  business_name: string
  shop_count: number
  total_orders: number
  completed_orders: number
  cancelled_orders: number
  total_gmv: number
  average_rating: number
  review_count: number
  dispute_count: number
  trust_status: string
  level: string
  cash_confirmation_rate: number
  growth_points: number
}

export interface AdminProductReviewItem {
  review_id: string
  buyer_id: string
  buyer_name: string
  order_id: string
  order_number: string
  product_id: string
  product_name: string
  variant_id?: string
  variant_name?: string
  shop_id: string
  shop_name: string
  business_id: string
  business_name: string
  rating: number
  comment: string
  is_verified_purchase: boolean
  helpful_count: number
  moderation_status: 'VISIBLE' | 'FLAGGED' | 'UNDER_REVIEW' | 'HIDDEN'
  created_at: string
}

export interface AdminShopReviewItem {
  review_id: string
  buyer_id: string
  buyer_name: string
  order_id: string
  order_number: string
  shop_id: string
  shop_name: string
  seller_id: string
  seller_name: string
  rating: number
  comment: string
  moderation_status: 'VISIBLE' | 'FLAGGED' | 'UNDER_REVIEW' | 'HIDDEN'
  created_at: string
}

export interface AdminCaseListItem {
  id: string
  case_number: string
  case_type: string
  status: string
  priority: string
  buyer_id?: string
  buyer_name?: string
  seller_id?: string
  seller_name?: string
  business_id?: string
  business_name?: string
  shop_id?: string
  shop_name?: string
  order_id?: string
  order_number?: string
  payment_id?: string
  product_id?: string
  review_id?: string
  assigned_admin_id?: string
  assigned_admin?: string
  created_by_type: string
  created_by_id?: string
  title: string
  description: string
  resolution?: string
  created_at: string
  updated_at: string
  resolved_at?: string
}

export interface AdminCaseDetail extends AdminCaseListItem {
  messages: Array<{
    id: string
    case_id: string
    sender_type: 'ADMIN' | 'BUYER' | 'SELLER' | 'SYSTEM'
    sender_id?: string
    sender_name?: string
    visibility: 'INTERNAL_ADMIN_NOTE' | 'USER_VISIBLE'
    message: string
    created_at: string
  }>
}

export interface AdminRiskEvent {
  id: string
  event_type: string
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL'
  target_type: string
  target_id: string
  target_name: string
  rule_code: string
  details?: Record<string, unknown>
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED'
  created_at: string
  resolved_at?: string
  resolved_by?: string
}

export const adminFinanceApi = {
  getSummary: async (params?: { business_id?: string; shop_id?: string; seller_id?: string; date_from?: string; date_to?: string }) => {
    const q = new URLSearchParams()
    if (params?.business_id) q.set('business_id', params.business_id)
    if (params?.shop_id) q.set('shop_id', params.shop_id)
    if (params?.seller_id) q.set('seller_id', params.seller_id)
    if (params?.date_from) q.set('date_from', params.date_from)
    if (params?.date_to) q.set('date_to', params.date_to)
    return adminApi<AdminFinancialSummary>(`/admin/finance/summary?${q.toString()}`)
  },
  listPayments: async (params?: { payment_status?: string; buyer_confirmed?: boolean; seller_confirmed?: boolean; business_id?: string; shop_id?: string; order_number?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.payment_status) q.set('payment_status', params.payment_status)
    if (params?.buyer_confirmed !== undefined) q.set('buyer_confirmed', String(params.buyer_confirmed))
    if (params?.seller_confirmed !== undefined) q.set('seller_confirmed', String(params.seller_confirmed))
    if (params?.business_id) q.set('business_id', params.business_id)
    if (params?.shop_id) q.set('shop_id', params.shop_id)
    if (params?.order_number) q.set('order_number', params.order_number)
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    return adminApi<{ items: AdminPaymentListItem[]; total: number; page: number; limit: number }>(`/admin/finance/payments?${q.toString()}`)
  },
  getPaymentDetail: async (id: string) => {
    return adminApi<AdminPaymentDetail>(`/admin/finance/payments/${id}`)
  },
  listBuyerPoints: async (params?: { page?: number; limit?: number; search?: string }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.search) q.set('search', params.search)
    return adminApi<{ items: AdminBuyerPointsItem[]; total: number; page: number; limit: number }>(`/admin/finance/points/buyers?${q.toString()}`)
  },
  getBuyerPointHistory: async (buyerId: string) => {
    return adminApi<{ history: AdminPointTransaction[] }>(`/admin/finance/points/buyers/${buyerId}/history`)
  },
  adjustBuyerPoints: async (buyerId: string, type: 'ADD' | 'REMOVE', amount: number, reason: string) => {
    return adminApi<{ message: string; old_balance: number; new_balance: number }>(`/admin/finance/points/buyers/${buyerId}/adjust`, {
      method: 'POST',
      body: JSON.stringify({ type, amount, reason })
    })
  },
  listSellerGrowth: async (params?: { page?: number; limit?: number; search?: string }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.search) q.set('search', params.search)
    return adminApi<{ items: AdminSellerGrowthItem[]; total: number; page: number; limit: number }>(`/admin/finance/growth/sellers?${q.toString()}`)
  },
  listProductReviews: async (params?: { page?: number; limit?: number; status?: string }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.status) q.set('status', params.status)
    return adminApi<{ items: AdminProductReviewItem[]; total: number; page: number; limit: number }>(`/admin/finance/reviews/products?${q.toString()}`)
  },
  hideProductReview: async (id: string, reason: string) => {
    return adminApi<{ message: string }>(`/admin/finance/reviews/products/${id}/hide`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    })
  },
  restoreProductReview: async (id: string, reason: string) => {
    return adminApi<{ message: string }>(`/admin/finance/reviews/products/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    })
  },
  listShopReviews: async (params?: { page?: number; limit?: number; status?: string }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.status) q.set('status', params.status)
    return adminApi<{ items: AdminShopReviewItem[]; total: number; page: number; limit: number }>(`/admin/finance/reviews/shops?${q.toString()}`)
  },
  hideShopReview: async (id: string, reason: string) => {
    return adminApi<{ message: string }>(`/admin/finance/reviews/shops/${id}/hide`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    })
  },
  restoreShopReview: async (id: string, reason: string) => {
    return adminApi<{ message: string }>(`/admin/finance/reviews/shops/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    })
  },
  listCases: async (params?: { case_type?: string; status?: string; priority?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.case_type) q.set('case_type', params.case_type)
    if (params?.status) q.set('status', params.status)
    if (params?.priority) q.set('priority', params.priority)
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    return adminApi<{ items: AdminCaseListItem[]; total: number; page: number; limit: number }>(`/admin/finance/cases?${q.toString()}`)
  },
  createCase: async (payload: { case_type: string; priority: string; title: string; description: string; buyer_id?: string; seller_id?: string; order_id?: string }) => {
    return adminApi<AdminCaseListItem>('/admin/finance/cases', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },
  getCaseDetail: async (id: string) => {
    return adminApi<AdminCaseDetail>(`/admin/finance/cases/${id}`)
  },
  assignCase: async (id: string, admin_id: string) => {
    return adminApi<{ message: string }>(`/admin/finance/cases/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ admin_id })
    })
  },
  resolveCase: async (id: string, status: string, resolution: string) => {
    return adminApi<{ message: string }>(`/admin/finance/cases/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ status, resolution })
    })
  },
  addCaseMessage: async (id: string, visibility: 'INTERNAL_ADMIN_NOTE' | 'USER_VISIBLE', message: string) => {
    return adminApi<{ message: string }>(`/admin/finance/cases/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ visibility, message })
    })
  },
  listRiskEvents: async (params?: { status?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    return adminApi<{ items: AdminRiskEvent[]; total: number; page: number; limit: number }>(`/admin/finance/risk?${q.toString()}`)
  },
  resolveRiskEvent: async (id: string, status: 'RESOLVED' | 'DISMISSED', reason: string) => {
    return adminApi<{ message: string }>(`/admin/finance/risk/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ status, reason })
    })
  }
}

// ─── PHASE 4: TECHNICAL & SECURITY ───────────────────────────────────────────

export interface ServiceHealthItem {
  service_name: string
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN' | 'NOT_DEPLOYED'
  latency_ms: number
  last_check: string
  last_failure?: string
  error_message_summary?: string
  uptime_percent: number
  dependency_status: string
}

export interface GlobalSystemHealth {
  overall_status: string
  services: ServiceHealthItem[]
  checked_at: string
}

export interface LongQueryItem {
  pid: number
  duration_seconds: number
  query_sanitized: string
  state: string
}

export interface PostgresHealth {
  reachable: boolean
  connection_count: number
  active_connections: number
  idle_connections: number
  database_size_bytes: number
  database_size_formatted: string
  storage_usage_percent: number
  migration_version: string
  last_backup_status: string
  long_running_queries: LongQueryItem[]
}

export interface RedisHealth {
  reachable: boolean
  latency_ms: number
  memory_used_bytes: number
  memory_used_formatted: string
  key_count: number
  connected_clients: number
  eviction_count: number
  cache_hit_rate: number
}

export interface QueueStatItem {
  queue_name: string
  pending_count: number
  processing_count: number
  failed_count: number
}

export interface WorkerMetrics {
  queued_jobs: number
  active_jobs: number
  completed_jobs: number
  failed_jobs: number
  retrying_jobs: number
  dead_jobs: number
  queue_stats: QueueStatItem[]
}

export interface WorkerJobItem {
  job_id: string
  job_type: string
  queue: string
  created_at: string
  started_at?: string
  finished_at?: string
  retry_count: number
  status: string
  last_error?: string
}

export interface VisualSearchHealth {
  service_name: string
  status: string
  latency_ms: number
  reachable: boolean
  error_count?: number
  last_successful_request?: string
}

export interface BackupSummary {
  last_successful_backup?: string
  backup_size_formatted: string
  next_scheduled_backup?: string
  last_failure?: string
  retention_policy: string
  backup_status: string
}

export interface MigrationItem {
  version: string
  name: string
  applied_at: string
  status: string
}

export interface MigrationSummary {
  current_version: string
  applied_count: number
  pending_count: number
  failed_count: number
  last_applied_at?: string
  applied_migrations: MigrationItem[]
}

export interface SanitizedEmailLog {
  recipient_masked: string
  email_type: string
  timestamp: string
  status: string
  failure_category?: string
}

export interface EmailHealth {
  smtp_reachable: boolean
  activation_email_success_rate: number
  employee_invite_success_rate: number
  queued_emails: number
  last_successful_email?: string
  recent_failures_count: number
  recent_logs: SanitizedEmailLog[]
}

export interface AdminSessionItem {
  session_id: string
  admin_id: string
  admin_email: string
  admin_role: string
  device_info: string
  ip_address: string
  created_at: string
  last_seen: string
  expires_at: string
  revoked: boolean
}

export interface SecurityEventItem {
  id: string
  event_type: string
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL'
  actor_id?: string
  target_id?: string
  ip_address?: string
  user_agent?: string
  details?: Record<string, unknown>
  status: 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED' | 'IGNORED'
  created_at: string
}

export interface AppVersionItem {
  id: string
  platform: string
  current_version: string
  min_supported_version: string
  recommended_version: string
  updated_by?: string
  updated_at: string
}

export interface TechnicalOverviewKPIs {
  api_status: string
  db_status: string
  redis_status: string
  worker_status: string
  failed_jobs_count: number
  critical_errors_count: number
  backup_status: string
  migration_status: string
  security_alerts_count: number
  active_sessions_count: number
  web_version: string
  android_version: string
}

export const adminTechnicalApi = {
  getOverview: () =>
    adminApi<TechnicalOverviewKPIs>('/admin/technical/overview'),

  getSystemHealth: () =>
    adminApi<GlobalSystemHealth>('/admin/technical/health'),

  getPostgresHealth: () =>
    adminApi<PostgresHealth>('/admin/technical/database'),

  getRedisHealth: () =>
    adminApi<RedisHealth>('/admin/technical/redis'),

  getWorkerMetrics: () =>
    adminApi<WorkerMetrics>('/admin/technical/workers'),

  listFailedJobs: (queue = 'default', limit = 20, offset = 0) => {
    const q = new URLSearchParams({ queue, limit: String(limit), offset: String(offset) })
    return adminApi<{ items: WorkerJobItem[] }>(`/admin/technical/workers/failed?${q}`)
  },

  retryJob: (jobId: string, reason: string) =>
    adminApi<{ message: string }>(`/admin/technical/workers/${jobId}/retry`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),

  getVisualSearchHealth: () =>
    adminApi<VisualSearchHealth>('/admin/technical/visual-search'),

  getBackupSummary: () =>
    adminApi<BackupSummary>('/admin/technical/backups'),

  getMigrationSummary: () =>
    adminApi<MigrationSummary>('/admin/technical/migrations'),

  getEmailHealth: () =>
    adminApi<EmailHealth>('/admin/technical/email/health'),

  getAdminSessions: () =>
    adminApi<{ sessions: AdminSessionItem[]; total: number }>('/admin/technical/sessions'),

  revokeSession: (sessionId: string, reason: string) =>
    adminApi<{ message: string }>(`/admin/technical/sessions/${sessionId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),

  getSecurityEvents: (params?: { severity?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.severity) q.set('severity', params.severity)
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.offset) q.set('offset', String(params.offset))
    return adminApi<{ events: SecurityEventItem[]; total: number }>(`/admin/technical/security/events?${q}`)
  },

  acknowledgeSecurityEvent: (id: string, status: string, reason: string) =>
    adminApi<{ message: string }>(`/admin/technical/security/events/${id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ status, reason })
    }),

  getAppVersions: () =>
    adminApi<{ versions: AppVersionItem[] }>('/admin/technical/versions'),

  updateAppVersion: (platform: string, body: { current_version: string; min_supported_version: string; recommended_version: string; reason: string }) =>
    adminApi<{ message: string }>(`/admin/technical/versions/${platform}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    })
}

// ─── PHASE 5A: FEATURE FLAGS & GLOBAL CONFIGURATION ──────────────────────────

export interface FeatureFlag {
  id: string
  key: string
  description: string
  enabled: boolean
  scope: string
  category: 'COMMERCE' | 'FINANCE' | 'TECHNICAL' | 'GENERAL'
  is_high_risk: boolean
  environment: string
  updated_by?: string
  created_at: string
  updated_at: string
  can_write: boolean
}

export interface GlobalConfigItem {
  id: string
  key: string
  description: string
  value_type: 'NUMBER' | 'STRING' | 'BOOLEAN'
  value: string
  category: 'COMMERCE' | 'FINANCE' | 'TECHNICAL' | 'GENERAL'
  updated_by?: string
  created_at: string
  updated_at: string
  can_write: boolean
}

export class HighRiskConfirmError extends Error {
  impactWarning: string
  constructor(message: string, impactWarning: string) {
    super(message)
    this.impactWarning = impactWarning
  }
}

export const adminPlatformApi = {
  listFeatureFlags: () =>
    adminApi<{ flags: FeatureFlag[] }>('/admin/platform/feature-flags'),

  updateFeatureFlag: async (key: string, enabled: boolean, reason: string, confirm = false) => {
    try {
      return await adminApi<{ message: string }>(`/admin/platform/feature-flags/${key}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled, reason, confirm })
      })
    } catch (err) {
      const e = err as Error & { status?: number }
      if (e.status === 409) {
        throw new HighRiskConfirmError(e.message, 'This flag is marked high-risk. Changing it may break a critical business flow.')
      }
      throw err
    }
  },

  listGlobalConfigs: () =>
    adminApi<{ configs: GlobalConfigItem[] }>('/admin/platform/config'),

  updateGlobalConfig: (key: string, value: string, reason: string) =>
    adminApi<{ message: string }>(`/admin/platform/config/${key}`, {
      method: 'PATCH',
      body: JSON.stringify({ value, reason })
    })
}

export interface MaintenanceState { status: 'OFF'|'PARTIAL'|'FULL'; message: string; affected_clients: string[]; reason: string; updated_at: string }
export interface Announcement { id:string; title:string; message:string; audience:string; status:string; starts_at?:string; ends_at?:string; created_at:string }
export interface ApprovalRequest { id:string; action_type:string; requested_by:string; target_type:string; target_id:string; payload:Record<string,unknown>; reason:string; status:string; created_at:string }
export interface ExportJob { id:string; dataset:string; status:string; filters:Record<string,unknown>; created_at:string; completed_at?:string; error_message?:string }
export interface AnalyticsMetric { key:string; label:string; value?:number; unit:string; available:boolean; trend:{date:string;value:number}[] }

export const adminAdvancedApi = {
  maintenance: () => adminApi<MaintenanceState>('/admin/platform/maintenance'),
  updateMaintenance: (body: Partial<MaintenanceState> & { reason:string; confirm?:boolean }) => adminApi('/admin/platform/maintenance',{method:'PATCH',body:JSON.stringify(body)}),
  announcements: () => adminApi<{announcements:Announcement[]}>('/admin/platform/announcements'),
  createAnnouncement: (body: Partial<Announcement>) => adminApi<Announcement>('/admin/platform/announcements',{method:'POST',body:JSON.stringify(body)}),
  updateAnnouncement: (id:string, body: Partial<Announcement>) => adminApi(`/admin/platform/announcements/${id}`,{method:'PATCH',body:JSON.stringify(body)}),
  approvals: () => adminApi<{approvals:ApprovalRequest[]}>('/admin/approvals'),
  decideApproval: (id:string, approve:boolean, reason:string) => adminApi(`/admin/approvals/${id}/${approve?'approve':'reject'}`,{method:'POST',body:JSON.stringify({reason})}),
  exports: () => adminApi<{exports:ExportJob[]}>('/admin/exports'),
  createExport: (dataset:string, reason:string, filters:Record<string,unknown>={}) => adminApi<{id:string;status:string}>('/admin/exports',{method:'POST',body:JSON.stringify({dataset,reason,filters})}),
  analytics: (dashboard:string, days:number) => adminApi<{metrics:AnalyticsMetric[];days:number}>(`/admin/analytics/${dashboard}?days=${days}`),
}
