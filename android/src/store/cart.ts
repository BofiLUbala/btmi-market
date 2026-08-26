import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CartLine {
  productId: string
  variantId: string
  name: string
  /** Human label for the chosen variant, e.g. "Black / 41". Display only. */
  variantName?: string
  shopId: string
  shopName: string
  /** Price captured when added. The backend preview is authoritative. */
  price: number
  quantity: number
  image?: string
}

interface CartState {
  lines: CartLine[]
  /** Orders are shop-scoped, so a cart always belongs to exactly one shop. */
  shopId: string | null
  shopName: string | null
  add: (line: CartLine) => boolean
  setQuantity: (variantId: string, quantity: number) => void
  remove: (variantId: string) => void
  clear: () => void
}

/** Shop context always follows the first remaining line. */
function withShop(lines: CartLine[]) {
  return {
    lines,
    shopId: lines[0]?.shopId ?? null,
    shopName: lines[0]?.shopName ?? null,
  }
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      shopId: null,
      shopName: null,
      add: (line) => {
        let accepted = true
        set((state) => {
          if (state.lines.length && state.lines[0].shopId !== line.shopId) {
            accepted = false
            return state
          }
          const found = state.lines.find((item) => item.variantId === line.variantId)
          const lines = found
            ? state.lines.map((item) =>
                item.variantId === line.variantId
                  ? { ...item, quantity: item.quantity + line.quantity }
                  : item
              )
            : [...state.lines, line]
          return withShop(lines)
        })
        return accepted
      },
      setQuantity: (variantId, quantity) =>
        set((state) =>
          withShop(
            state.lines
              .map((item) => (item.variantId === variantId ? { ...item, quantity } : item))
              .filter((item) => item.quantity > 0)
          )
        ),
      remove: (variantId) =>
        set((state) => withShop(state.lines.filter((item) => item.variantId !== variantId))),
      clear: () => set({ lines: [], shopId: null, shopName: null }),
    }),
    {
      name: 'btmi.cart',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ lines: state.lines }) as unknown as CartState,
      // Rebuild the derived shop context after rehydrating from storage.
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.shopId = state.lines[0]?.shopId ?? null
          state.shopName = state.lines[0]?.shopName ?? null
        }
      },
    }
  )
)
