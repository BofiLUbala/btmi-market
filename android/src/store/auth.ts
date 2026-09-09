import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { authApi, sellerApi } from '../api'
import { tokenStore } from '../api/tokenStore'
import { onSessionInvalidated } from '../api/client'
import { canSell, canOnboardSeller, type Business, type User } from '../types'

/* Same storage mechanism as language/theme (AsyncStorage), mirroring the web's
 * localStorage keys `btmi.activeBusiness` / `btmi.activeShop`. */
const ACTIVE_BUSINESS_KEY = 'btmi.activeBusiness'
const ACTIVE_SHOP_KEY = 'btmi.activeShop'

interface AuthState {
  user: User | null
  ready: boolean
  sellerBusinesses: Business[]
  activeBusiness: Business | null
  activeShop: string | null
  bootstrap: () => Promise<void>
  refresh: () => Promise<void>
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  setActiveBusiness: (business: Business | null) => void
  setActiveShop: (shopId: string | null) => void
}

/** Loads the seller's businesses and resolves which one is active, mirroring
 *  web's `loadSession` branching on `capabilities?.seller`. Never throws --
 *  a buyer-only user or a failed fetch just leaves the seller state empty. */
async function loadSellerBusinesses(user: User): Promise<{ sellerBusinesses: Business[]; activeBusiness: Business | null }> {
  if (!canSell(user) && !canOnboardSeller(user)) return { sellerBusinesses: [], activeBusiness: null }
  try {
    const businesses = await sellerApi.businesses()
    const storedId = await AsyncStorage.getItem(ACTIVE_BUSINESS_KEY)
    const selected = (storedId && businesses.find((b) => b.id === storedId)) || businesses[0] || null
    return { sellerBusinesses: businesses, activeBusiness: selected }
  } catch {
    return { sellerBusinesses: [], activeBusiness: null }
  }
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  sellerBusinesses: [],
  activeBusiness: null,
  activeShop: null,
  bootstrap: async () => {
    try {
      const accessToken = await tokenStore.getAccess()
      const refreshToken = await tokenStore.getRefresh()
      if (!accessToken && !refreshToken) {
        set({ user: null })
        return
      }
      const user = await authApi.me()
      const seller = await loadSellerBusinesses(user)
      set({ user, ...seller })
    }
    catch { await tokenStore.clear(); set({ user: null, sellerBusinesses: [], activeBusiness: null }) }
    finally { set({ ready: true }) }
  },
  // Re-fetches the current user without touching `ready`/tokens — used after
  // an in-session change (e.g. avatar upload) that the server now reflects.
  refresh: async () => {
    try {
      const user = await authApi.me()
      const seller = await loadSellerBusinesses(user)
      set({ user, ...seller })
    } catch {}
  },
  login: async (email, password) => {
    const session = await authApi.login(email, password)
    await tokenStore.set(session.access_token, session.refresh_token)
    const user = session.user ?? await authApi.me()
    const seller = await loadSellerBusinesses(user)
    set({ user, ready: true, ...seller })
    return user
  },
  logout: async () => {
    const refreshToken = await tokenStore.getRefresh()
    try { if (refreshToken) await authApi.logout(refreshToken) } catch {}
    await tokenStore.clear()
    await Promise.all([AsyncStorage.removeItem(ACTIVE_BUSINESS_KEY), AsyncStorage.removeItem(ACTIVE_SHOP_KEY)])
    set({ user: null, ready: true, sellerBusinesses: [], activeBusiness: null, activeShop: null })
  },
  setActiveBusiness: (business) => {
    set({ activeBusiness: business, activeShop: null })
    if (business) AsyncStorage.setItem(ACTIVE_BUSINESS_KEY, business.id).catch(() => {})
    else AsyncStorage.removeItem(ACTIVE_BUSINESS_KEY).catch(() => {})
    AsyncStorage.removeItem(ACTIVE_SHOP_KEY).catch(() => {})
  },
  setActiveShop: (shopId) => {
    set({ activeShop: shopId })
    if (shopId) AsyncStorage.setItem(ACTIVE_SHOP_KEY, shopId).catch(() => {})
    else AsyncStorage.removeItem(ACTIVE_SHOP_KEY).catch(() => {})
  },
}))

onSessionInvalidated(() => useAuth.setState({ user: null, ready: true, sellerBusinesses: [], activeBusiness: null, activeShop: null }))

/* Restores the persisted active shop once at module load (business is
 * resolved inside `loadSellerBusinesses` since it needs the fetched list to
 * validate against). */
AsyncStorage.getItem(ACTIVE_SHOP_KEY).then((shopId) => {
  if (shopId) useAuth.setState({ activeShop: shopId })
}).catch(() => {})

