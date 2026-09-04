import { create } from 'zustand'
import { mobileAdminAuthApi, type AdminRole, type AdminUser } from '../api/admin'
import { adminTokenStore } from '../api/adminTokenStore'

interface AdminAuthState {
  admin: AdminUser | null
  role: AdminRole | null
  ready: boolean
  bootstrap: () => Promise<void>
  login: (email: string, password: string) => Promise<AdminUser>
  logout: () => Promise<void>
  hasRole: (allowedRoles: AdminRole[]) => boolean
  canAccessDashboard: (dashboard: 'direction' | 'commerce' | 'finance' | 'technical') => boolean
}

export const useAdminAuth = create<AdminAuthState>((set, get) => ({
  admin: null,
  role: null,
  ready: false,
  bootstrap: async () => {
    try {
      const accessToken = await adminTokenStore.getAccess()
      if (!accessToken) {
        set({ admin: null, role: null, ready: true })
        return
      }
      const admin = await mobileAdminAuthApi.me()
      set({ admin, role: admin.role, ready: true })
    } catch {
      await adminTokenStore.clear()
      set({ admin: null, role: null, ready: true })
    }
  },
  login: async (email, password) => {
    const session = await mobileAdminAuthApi.login(email, password)
    await adminTokenStore.set(session.access_token, session.refresh_token)
    set({ admin: session.admin, role: session.admin.role, ready: true })
    return session.admin
  },
  logout: async () => {
    try {
      await mobileAdminAuthApi.logout()
    } catch {
      // Ignored
    }
    await adminTokenStore.clear()
    set({ admin: null, role: null, ready: true })
  },
  hasRole: (allowedRoles: AdminRole[]) => {
    const admin = get().admin
    if (!admin) return false
    if (admin.role === 'SUPER_ADMIN') return true
    return allowedRoles.includes(admin.role)
  },
  canAccessDashboard: (dashboard: 'direction' | 'commerce' | 'finance' | 'technical') => {
    const admin = get().admin
    if (!admin) return false
    if (admin.role === 'SUPER_ADMIN') return true
    switch (dashboard) {
      case 'direction':
        return admin.role === 'DIRECTION_ADMIN'
      case 'commerce':
        return admin.role === 'COMMERCE_ADMIN'
      case 'finance':
        return admin.role === 'FINANCE_SUPPORT_ADMIN'
      case 'technical':
        return admin.role === 'TECHNICAL_ADMIN'
      default:
        return false
    }
  },
}))
