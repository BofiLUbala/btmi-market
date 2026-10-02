import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { useAuth } from '@/store/auth'
import { watchesApi } from '@/lib/push'

export interface FavoritesItem {
  productId: string
  name: string
  shopId: string
  shopName: string
  price: number
  currency: string
  unit: string
  addedAt: string
}

interface FavoritesState {
  items: FavoritesItem[]
  has: (productId: string) => boolean
  toggle: (item: FavoritesItem) => void
  remove: (productId: string) => void
  clear: () => void
}

const KEY = 'btmi.favorites'
const FavoritesContext = createContext<FavoritesState | null>(null)

export function parsePersistedFavorites(raw: string | null): FavoritesItem[] {
  if (!raw) return []
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) return []
  return parsed.filter((item): item is FavoritesItem => Boolean(
    item &&
    typeof item === 'object' &&
    typeof (item as Partial<FavoritesItem>).productId === 'string'
  ))
}

function load(): FavoritesItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    return parsePersistedFavorites(raw)
  } catch {
    return []
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FavoritesItem[]>(load)

  const { user } = useAuth()
  const signedIn = Boolean(user)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items))
  }, [items])

  // Favourites are also followed on the server once signed in, so a price
  // drop or a restock can be announced (when the buyer opted in to alerts).
  useEffect(() => {
    if (!user?.id) return
    const ids = load().map((i) => i.productId)
    if (ids.length) void watchesApi.sync(ids).catch(() => undefined)
  }, [user?.id])

  const value = useMemo<FavoritesState>(() => {
    const has = (productId: string) => items.some((i) => i.productId === productId)
    const follow = (productId: string, on: boolean) => {
      if (!signedIn) return
      void (on ? watchesApi.watch(productId) : watchesApi.unwatch(productId)).catch(() => undefined)
    }
    const toggle = (item: FavoritesItem) => {
      const adding = !has(item.productId)
      setItems((prev) =>
        prev.some((i) => i.productId === item.productId)
          ? prev.filter((i) => i.productId !== item.productId)
          : [...prev, item]
      )
      follow(item.productId, adding)
    }
    const remove = (productId: string) => {
      setItems((prev) => prev.filter((i) => i.productId !== productId))
      follow(productId, false)
    }
    const clear = () => {
      items.forEach((i) => follow(i.productId, false))
      setItems([])
    }
    return { items, has, toggle, remove, clear }
  }, [items, signedIn])

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites(): FavoritesState {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider')
  return ctx
}
