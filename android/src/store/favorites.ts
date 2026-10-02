import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { tokenStore } from '../api/tokenStore'
import { watchesApi } from '../lib/push'

/**
 * Device-local favourites, the mobile counterpart of
 * web-app/src/store/favorites.tsx (same item shape). Kept on the phone, and
 * mirrored as followed products on the server when signed in, so a price
 * drop or restock can be announced to buyers who opted in.
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

async function follow(productId: string, on: boolean) {
  if (!(await tokenStore.getAccess())) return
  await (on ? watchesApi.watch(productId) : watchesApi.unwatch(productId)).catch(() => undefined)
}

/** Called at sign-in: favourites saved before are followed by the account. */
export function syncFavoritesToAccount() {
  const ids = useFavorites.getState().items.map((i) => i.productId)
  if (ids.length) void watchesApi.sync(ids).catch(() => undefined)
}

export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (item) => {
        const adding = !get().items.some((i) => i.productId === item.productId)
        set((state) =>
          state.items.some((i) => i.productId === item.productId)
            ? { items: state.items.filter((i) => i.productId !== item.productId) }
            : { items: [item, ...state.items] }
        )
        void follow(item.productId, adding)
      },
      remove: (productId) => {
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) }))
        void follow(productId, false)
      },
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
