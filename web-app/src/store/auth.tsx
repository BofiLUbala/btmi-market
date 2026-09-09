import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { onSessionInvalidated, tokenStore } from '@/api/client'
import { authApi } from '@/api/auth'
import { buyerApi } from '@/api/buyer'
import { sellerAuthApi } from '@/api/seller'
import type { BuyerProfile, User, AccountType, LoginResponseWithUser, SellerBusiness } from '@/api/types'

interface AuthState {
  user: User | null
  buyerProfile: BuyerProfile | null
  accountType: AccountType | null
  loading: boolean
  sellerBusinesses: SellerBusiness[]
  activeBusiness: SellerBusiness | null
  activeShop: string | null
  setActiveShop: (shopId: string | null) => void
  login: (email: string, password: string) => Promise<{ accountType: AccountType; user: User }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  setActiveBusiness: (business: SellerBusiness | null) => void
  setSellerBusinesses: (businesses: SellerBusiness[]) => void
}

const AuthContext = createContext<AuthState | null>(null)

const ACTIVE_BUSINESS_KEY = 'btmi.activeBusiness'
const ACTIVE_SHOP_KEY = 'btmi.activeShop'

export function isAdminRoute(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [buyerProfile, setBuyerProfile] = useState<BuyerProfile | null>(null)
  const [accountType, setAccountType] = useState<AccountType | null>(null)
  const [loading, setLoading] = useState(true)
  const [sellerBusinesses, setSellerBusinesses] = useState<SellerBusiness[]>([])
  const [activeBusiness, setActiveBusiness] = useState<SellerBusiness | null>(null)
  const [activeShop, setActiveShopState] = useState<string | null>(() => localStorage.getItem(ACTIVE_SHOP_KEY))

  const resetState = useCallback(() => {
    setUser(null)
    setBuyerProfile(null)
    setAccountType(null)
    setSellerBusinesses([])
    setActiveBusiness(null)
    setActiveShopState(null)
    localStorage.removeItem(ACTIVE_BUSINESS_KEY)
    localStorage.removeItem(ACTIVE_SHOP_KEY)
  }, [])

  const loadSession = useCallback(async (): Promise<{ user: User; accountType: AccountType } | null> => {
    if (!tokenStore.getAccess() && !tokenStore.getRefresh()) {
      resetState()
      setLoading(false)
      return null
    }
    try {
      const me = await authApi.me()
      setUser(me)
      setAccountType(me.account_type)

      if (me.capabilities?.seller || me.account_type === 'SELLER') {
        setBuyerProfile(null)
        try {
          const rawBiz = await sellerAuthApi.listSellerBusinesses()
          const businesses = Array.isArray(rawBiz) ? rawBiz : []
          setSellerBusinesses(businesses)
          let selected: SellerBusiness | null = null
          const storedId = localStorage.getItem(ACTIVE_BUSINESS_KEY)
          if (storedId) {
            selected = businesses.find((b) => b.id === storedId) ?? null
          }
          if (!selected && businesses.length > 0) {
            selected = businesses[0]
          }
          setActiveBusiness(selected)
        } catch {
          setSellerBusinesses([])
          setActiveBusiness(null)
        }
      } else {
        setSellerBusinesses([])
        setActiveBusiness(null)
      }

      if (me.capabilities?.buyer || me.account_type === 'BUYER') {
        try {
          const profile = await buyerApi.getProfile()
          setBuyerProfile(profile)
        } catch {
          setBuyerProfile(null)
        }
      } else {
        setBuyerProfile(null)
      }
      return { user: me, accountType: me.account_type }
    } catch {
      // /auth/me failed even after client-side refresh: session is gone
      tokenStore.clear()
      resetState()
      return null
    } finally {
      setLoading(false)
    }
  }, [resetState])

  useEffect(() => {
    // Admin authentication uses a separate token pair and /admin/auth/me.
    // Hydrating the consumer session here causes an unrelated /auth/me 401
    // whenever an expired buyer/seller token is still present in storage.
    if (isAdminRoute(window.location.pathname)) {
      setLoading(false)
      return
    }
    void loadSession()
  }, [loadSession])

  useEffect(() => onSessionInvalidated(resetState), [resetState])

  const refreshUser = useCallback(async () => {
    await loadSession()
  }, [loadSession])

  const login = useCallback(
    async (email: string, password: string) => {
      // Reset current state prior to setting fresh credentials
      resetState()

      const res = await authApi.login(email, password) as LoginResponseWithUser
      tokenStore.set(res.access_token, res.refresh_token)

      // Resolve buyer/seller capabilities via loadSession rather than
      // duplicating the branching here -- a user can be both BUYER and
      // SELLER, and capabilities (not the legacy account_type) is the
      // source of truth for which profiles/businesses to fetch.
      const session = await loadSession()
      if (!session) throw new Error('Login succeeded but session could not be established')
      return { accountType: session.accountType, user: session.user }
    },
    [loadSession, resetState]
  )

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.getRefresh()
    try {
      if (refreshToken) await authApi.logout(refreshToken)
    } catch {
      /* ignore */
    }
    tokenStore.clear()
    resetState()
  }, [resetState])

  const setActiveBusinessImpl = useCallback((business: SellerBusiness | null) => {
    setActiveBusiness(business)
    if (business) localStorage.setItem(ACTIVE_BUSINESS_KEY, business.id)
    else localStorage.removeItem(ACTIVE_BUSINESS_KEY)
  }, [])

  const setSellerBusinessesImpl = useCallback((businesses: SellerBusiness[]) => {
    setSellerBusinesses(businesses)
  }, [])

  const setActiveShopImpl = useCallback((shopId: string | null) => {
    setActiveShopState(shopId)
    if (shopId) {
      localStorage.setItem(ACTIVE_SHOP_KEY, shopId)
    } else {
      localStorage.removeItem(ACTIVE_SHOP_KEY)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      buyerProfile,
      accountType,
      loading,
      sellerBusinesses,
      activeBusiness,
      activeShop,
      setActiveShop: setActiveShopImpl,
      login,
      logout,
      refreshUser,
      setActiveBusiness: setActiveBusinessImpl,
      setSellerBusinesses: setSellerBusinessesImpl,
    }),
    [
      user,
      buyerProfile,
      accountType,
      loading,
      sellerBusinesses,
      activeBusiness,
      activeShop,
      login,
      logout,
      refreshUser,
      setActiveBusinessImpl,
      setSellerBusinessesImpl,
      setActiveShopImpl,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
