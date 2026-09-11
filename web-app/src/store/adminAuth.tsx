import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  adminAuthApi,
  adminTokenStore,
  ADMIN_ROLE_STALE_EVENT,
  ADMIN_SESSION_EXPIRED_EVENT,
  type AdminRole,
  type AdminUser,
} from '@/api/admin'

interface AdminAuthState {
  admin: AdminUser | null
  role: AdminRole | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<AdminUser>
  logout: () => Promise<void>
  hasRole: (roles: AdminRole[]) => boolean
  canAccessDashboard: (dashboard: 'direction' | 'commerce' | 'finance' | 'technical') => boolean
  /** Replaces the cached admin after a self-service edit, so the sidebar shows
   *  the new value without a full reload. */
  applyAdmin: (next: AdminUser) => void
}

const AdminAuthContext = createContext<AdminAuthState | null>(null)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  const resetState = useCallback(() => {
    setAdmin(null)
    adminTokenStore.clear()
  }, [])

  const loadSession = useCallback(async (): Promise<AdminUser | null> => {
    if (!adminTokenStore.getAccess()) {
      resetState()
      setLoading(false)
      return null
    }

    try {
      const currentAdmin = await adminAuthApi.me()
      setAdmin(currentAdmin)
      return currentAdmin
    } catch {
      resetState()
      return null
    } finally {
      setLoading(false)
    }
  }, [resetState])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  useEffect(() => {
    const invalidateSession = () => resetState()
    const syncRemovedTokens = (event: StorageEvent) => {
      if ((event.key === 'btmi.admin.access' || event.key === 'btmi.admin.refresh') && !event.newValue) {
        resetState()
      }
    }
    // The server refusing on role means the account it sees is not the one this
    // session is rendering. Re-reading it swaps the navigation, the badge and
    // the route guards over to the real role, instead of leaving the operator
    // on a dashboard that answers every request with "permission denied".
    const resyncRole = () => { void loadSession() }
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, invalidateSession)
    window.addEventListener(ADMIN_ROLE_STALE_EVENT, resyncRole)
    window.addEventListener('storage', syncRemovedTokens)
    return () => {
      window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, invalidateSession)
      window.removeEventListener(ADMIN_ROLE_STALE_EVENT, resyncRole)
      window.removeEventListener('storage', syncRemovedTokens)
    }
  }, [resetState, loadSession])

  const login = useCallback(async (email: string, password: string): Promise<AdminUser> => {
    const res = await adminAuthApi.login(email, password)
    adminTokenStore.set(res.access_token, res.refresh_token)
    setAdmin(res.admin)
    return res.admin
  }, [])

  const logout = useCallback(async () => {
    setLoading(true)
    try {
      await adminAuthApi.logout()
    } finally {
      resetState()
      setLoading(false)
    }
  }, [resetState])

  const applyAdmin = useCallback((next: AdminUser) => {
    setAdmin(next)
  }, [])

  const role = admin?.role ?? null
  const isAuthenticated = Boolean(admin)

  const hasRole = useCallback((allowedRoles: AdminRole[]) => {
    if (!role) return false
    if (role === 'SUPER_ADMIN') return true
    return allowedRoles.includes(role)
  }, [role])

  const canAccessDashboard = useCallback((dashboard: 'direction' | 'commerce' | 'finance' | 'technical'): boolean => {
    if (!role) return false
    if (role === 'SUPER_ADMIN') return true
    switch (dashboard) {
      case 'direction':
        return role === 'DIRECTION_ADMIN'
      case 'commerce':
        return role === 'COMMERCE_ADMIN'
      case 'finance':
        return role === 'FINANCE_SUPPORT_ADMIN'
      case 'technical':
        return role === 'TECHNICAL_ADMIN'
      default:
        return false
    }
  }, [role])

  const value = useMemo<AdminAuthState>(() => ({
    admin,
    role,
    loading,
    isAuthenticated,
    login,
    logout,
    hasRole,
    canAccessDashboard,
    applyAdmin,
  }), [admin, role, loading, isAuthenticated, login, logout, hasRole, canAccessDashboard, applyAdmin])

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  }
  return ctx
}
