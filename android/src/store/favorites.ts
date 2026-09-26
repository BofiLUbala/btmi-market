import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * Device-local favourites, the mobile counterpart of
 * web-app/src/store/favorites.tsx (same item shape, same local-only scope:
 * nothing is sent to the API).
 */
export interface FavoritesItem {
  productId: string
  name: string
  shopId: string
  shopName: string
  price: number
  currency: string
  unit: string
  image?: string
  categorySlug?: string
  categoryName?: string
  addedAt: string
}

interface FavoritesState {
  items: FavoritesItem[]
  toggle: (item: FavoritesItem) => void
  remove: (productId: string) => void
}

export const useFavorites = create<FavoritesState>()(
  persist(
    (set) => ({
      items: [],
      toggle: (item) =>
        set((state) =>
          state.items.some((i) => i.productId === item.productId)
            ? { items: state.items.filter((i) => i.productId !== item.productId) }
            : { items: [item, ...state.items] }
        ),
      remove: (productId) => set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
    }),
    {
      name: 'btmi.favorites',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items }) as unknown as FavoritesState,
    }
  )
)

/** Selector hook: re-renders only when this product's membership changes. */
export const useIsFavorite = (productId: string) =>
  useFavorites((state) => state.items.some((i) => i.productId === productId))
