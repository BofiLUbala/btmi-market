import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

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

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items))
  }, [items])

  const value = useMemo<FavoritesState>(() => {
    const has = (productId: string) => items.some((i) => i.productId === productId)
    const toggle = (item: FavoritesItem) => {
      setItems((prev) =>
        prev.some((i) => i.productId === item.productId)
          ? prev.filter((i) => i.productId !== item.productId)
          : [...prev, item]
      )
    }
    const remove = (productId: string) =>
      setItems((prev) => prev.filter((i) => i.productId !== productId))
    const clear = () => setItems([])
    return { items, has, toggle, remove, clear }
  }, [items])

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites(): FavoritesState {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider')
  return ctx
}
