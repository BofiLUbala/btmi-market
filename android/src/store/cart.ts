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

/**
 * A line is identified by product + variant + shop, the same identity the
 * backend uses in POST /buyer/cart/preview. Keying by variant alone let a
 * second shop's line overwrite or merge into the first.
 */
export const cartLineKey = (line: Pick<CartLine, 'productId' | 'variantId' | 'shopId'>) =>
  `${line.shopId}:${line.productId}:${line.variantId}`

interface CartState {
  lines: CartLine[]
  /** Always succeeds: a cart may hold products from several shops (one order per shop at checkout). */
  add: (line: CartLine) => boolean
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  /** Drops only the given lines, e.g. the ones that became orders. */
  removeMany: (keys: string[]) => void
  clear: () => void
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (line) => {
        set((state) => {
          const key = cartLineKey(line)
          const found = state.lines.some((item) => cartLineKey(item) === key)
          const lines = found
            ? state.lines.map((item) =>
                cartLineKey(item) === key ? { ...item, quantity: item.quantity + line.quantity } : item
              )
            : [...state.lines, line]
          return { lines }
        })
        return true
      },
      setQuantity: (key, quantity) =>
        set((state) => ({
          lines: state.lines
            .map((item) => (cartLineKey(item) === key ? { ...item, quantity } : item))
            .filter((item) => item.quantity > 0),
        })),
      remove: (key) => set((state) => ({ lines: state.lines.filter((item) => cartLineKey(item) !== key) })),
      removeMany: (keys) => set((state) => ({ lines: state.lines.filter((item) => !keys.includes(cartLineKey(item))) })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: 'btmi.cart',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ lines: state.lines }) as unknown as CartState,
    }
  )
)
