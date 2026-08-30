import { create } from 'zustand'
import { authApi } from '../api'
import { tokenStore } from '../api/tokenStore'
import type { User } from '../types'

interface AuthState {
  user: User | null
  ready: boolean
  bootstrap: () => Promise<void>
  refresh: () => Promise<void>
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  bootstrap: async () => {
    try { set({ user: await authApi.me() }) }
    catch { await tokenStore.clear(); set({ user: null }) }
    finally { set({ ready: true }) }
  },
  // Re-fetches the current user without touching `ready`/tokens — used after
  // an in-session change (e.g. avatar upload) that the server now reflects.
  refresh: async () => {
    try { set({ user: await authApi.me() }) } catch {}
  },
  login: async (email, password) => {
    const session = await authApi.login(email, password)
    await tokenStore.set(session.access_token, session.refresh_token)
    const user = session.user ?? await authApi.me()
    set({ user, ready: true })
    return user
  },
  logout: async () => {
    try { await authApi.logout() } catch {}
    await tokenStore.clear(); set({ user: null, ready: true })
  },
}))

