import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { tokenStore } from '@/api/client'
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
  setActiveBusiness: (business: SellerBusiness) => void
  setSellerBusinesses: (businesses: SellerBusiness[]) => void
}

const AuthContext = createContext<AuthState | null>(null)

const ACTIVE_BUSINESS_KEY = 'btmi.activeBusiness'
const ACTIVE_SHOP_KEY = 'btmi.activeShop'

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
    if (!tokenStore.getAccess()) {
      resetState()
      setLoading(false)
      return null
    }
    try {
      const me = await authApi.me()
      setUser(me)
      setAccountType(me.account_type)

      if (me.account_type === 'SELLER') {
        try {
          const businesses = await sellerAuthApi.listSellerBusinesses()
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
          // ignore business load failure; user is still authenticated
        }
      } else {
        try {
          const profile = await buyerApi.getProfile()
          setBuyerProfile(profile)
        } catch {
          setBuyerProfile(null)
        }
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
    loadSession()
  }, [loadSession])

  const refreshUser = useCallback(async () => {
    await loadSession()
  }, [loadSession])

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email, password) as LoginResponseWithUser
      tokenStore.set(res.access_token, res.refresh_token)

      if (res.user) {
        setUser(res.user)
        setAccountType(res.user.account_type)

        if (res.user.account_type === 'SELLER') {
          // Fetch seller businesses
          try {
            const businesses = await sellerAuthApi.listSellerBusinesses()
            setSellerBusinesses(businesses)
            if (businesses.length > 0) {
              setActiveBusiness(businesses[0])
              localStorage.setItem(ACTIVE_BUSINESS_KEY, businesses[0].id)
            }
          } catch {
            // ignore
          }
        } else {
          try {
            const profile = await buyerApi.getProfile()
            setBuyerProfile(profile)
          } catch {
            setBuyerProfile(null)
          }
        }
        return { accountType: res.user.account_type, user: res.user }
      }

      // Fallback: resolve session from the API
      const session = await loadSession()
      if (!session) throw new Error('Login succeeded but session could not be established')
      return { accountType: session.accountType, user: session.user }
    },
    [loadSession]
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      /* ignore */
    }
    tokenStore.clear()
    resetState()
  }, [resetState])

  const setActiveBusinessImpl = useCallback((business: SellerBusiness) => {
    setActiveBusiness(business)
    localStorage.setItem(ACTIVE_BUSINESS_KEY, business.id)
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