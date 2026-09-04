import { API_URL } from './client'
import { adminTokenStore } from './adminTokenStore'

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
  created_at: string
}

let refreshPromise: Promise<boolean> | null = null

async function refreshAdminTokens(): Promise<boolean> {
  const refresh = await adminTokenStore.getRefresh()
  if (!refresh) return false

  try {
    const res = await fetch(`${API_URL}/admin/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })

    if (!res.ok) {
      await adminTokenStore.clear()
      return false
    }

    const json = await res.json()
    const d = json?.data as { access_token: string; refresh_token: string } | undefined
    if (!d?.access_token || !d?.refresh_token) {
      await adminTokenStore.clear()
      return false
    }

    await adminTokenStore.set(d.access_token, d.refresh_token)
    return true
  } catch {
    await adminTokenStore.clear()
    return false
  }
}

export async function adminApi<T>(path: string, options: RequestInit = {}, allowRefresh = true): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const access = await adminTokenStore.getAccess()
  if (access) {
    headers.set('Authorization', `Bearer ${access}`)
  }

  let res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 401 && allowRefresh) {
    if (!refreshPromise) {
      refreshPromise = refreshAdminTokens().finally(() => {
        refreshPromise = null
      })
    }
    const refreshed = await refreshPromise
    if (refreshed) {
      const newAccess = await adminTokenStore.getAccess()
      if (newAccess) headers.set('Authorization', `Bearer ${newAccess}`)
      res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
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

export const mobileAdminAuthApi = {
  login: async (email: string, password: string) => {
    return adminApi<{ access_token: string; refresh_token: string; admin: AdminUser }>(
      '/admin/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      false
    )
  },
  me: async () => {
    return adminApi<AdminUser>('/admin/auth/me')
  },
  logout: async () => {
    const refresh = await adminTokenStore.getRefresh()
    if (refresh) {
      try {
        await adminApi('/admin/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refresh }),
        })
      } catch {
        // Ignored
      }
    }
    await adminTokenStore.clear()
  },
}

export const mobileAdminDirectionApi = {
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
      body: JSON.stringify({ reason }),
    })
  },
  reactivateUser: async (id: string, reason: string) => {
    return adminApi<{ message: string }>(`/admin/direction/users/${id}/reactivate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  },
  listAuditLogs: async (limit = 20) => {
    return adminApi<{ logs: AdminAuditLog[]; total: number; limit: number; offset: number }>(
      `/admin/direction/audit-log?limit=${limit}`
    )
  },
}

const commerceQuery = (params?: Record<string, unknown>) => {
  const q = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') q.set(key, String(value))
  })
  return q.toString()
}

export const adminCommerceApi = {
  listProducts: (params?: Record<string, unknown>) => adminApi<any>(`/admin/commerce/products?${commerceQuery(params)}`),
  listOrders: (params?: Record<string, unknown>) => adminApi<any>(`/admin/commerce/orders?${commerceQuery(params)}`),
  listInventory: async (params?: Record<string, unknown>) => {
    const result = await adminApi<any>(`/admin/commerce/inventory?${commerceQuery(params)}`)
    return { ...result, items: result.items || result.inventory || [] }
  },
  listEmployees: (params?: Record<string, unknown>) => adminApi<any>(`/admin/commerce/employees?${commerceQuery(params)}`),
  getMarketplaceVisibility: (productId: string) => adminApi<any>(`/admin/commerce/marketplace/visibility/${productId}`),
}

export const mobileAdminFinanceApi = {
  getSummary: async () => {
    return adminApi<{
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
    }>('/admin/finance/summary')
  },
  listPayments: async (params?: { payment_status?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.payment_status) q.set('payment_status', params.payment_status)
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    return adminApi<{ items: any[]; total: number }>(`/admin/finance/payments?${q.toString()}`)
  },
  listCases: async (params?: { status?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    return adminApi<{ items: any[]; total: number }>(`/admin/finance/cases?${q.toString()}`)
  },
  listRiskEvents: async (status?: string) => {
    const q = new URLSearchParams()
    if (status) q.set('status', status)
    return adminApi<{ items: any[]; total: number }>(`/admin/finance/risk?${q.toString()}`)
  }
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

export const mobileAdminPlatformApi = {
  listFeatureFlags: async () => {
    return adminApi<{ flags: FeatureFlag[] }>('/admin/platform/feature-flags')
  },
  // Low-risk flags only: mobile does not surface the high-risk confirm flow,
  // matching the spec's "no complex configuration on mobile" rule.
  toggleLowRiskFlag: async (key: string, enabled: boolean, reason: string) => {
    return adminApi<{ message: string }>(`/admin/platform/feature-flags/${key}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled, reason, confirm: false }),
    })
  },
  listGlobalConfigs: async () => {
    return adminApi<{ configs: GlobalConfigItem[] }>('/admin/platform/config')
  },
}

export const mobileAdminAdvancedApi = {
  maintenance: () => adminApi<any>('/admin/platform/maintenance'),
  updateMaintenance: (status:string, message:string, affected_clients:string[], reason:string) => adminApi('/admin/platform/maintenance',{method:'PATCH',body:JSON.stringify({status,message,affected_clients,reason,confirm:false})}),
  announcements: () => adminApi<{announcements:any[]}>('/admin/platform/announcements'),
  updateAnnouncement: (id:string, body:any) => adminApi(`/admin/platform/announcements/${id}`,{method:'PATCH',body:JSON.stringify(body)}),
  approvals: () => adminApi<{approvals:any[]}>('/admin/approvals'),
  decideApproval: (id:string, approve:boolean, reason:string) => adminApi(`/admin/approvals/${id}/${approve?'approve':'reject'}`,{method:'POST',body:JSON.stringify({reason})}),
  exports: () => adminApi<{exports:any[]}>('/admin/exports'),
  analytics: (dashboard:string, days=7) => adminApi<{metrics:any[]}>(`/admin/analytics/${dashboard}?days=${days}`),
}
