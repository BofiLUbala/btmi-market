import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CartLine { productId: string; variantId: string; name: string; shopId: string; shopName: string; price: number; quantity: number; image?: string }
interface CartState {
  lines: CartLine[]
  add: (line: CartLine) => boolean
  setQuantity: (variantId: string, quantity: number) => void
  remove: (variantId: string) => void
  clear: () => void
}
export const useCart = create<CartState>()(persist((set) => ({
  lines: [],
  add: (line) => {
    let accepted = true
    set((state) => {
      if (state.lines.length && state.lines[0].shopId !== line.shopId) { accepted = false; return state }
      const found = state.lines.find((item) => item.variantId === line.variantId)
      return { lines: found ? state.lines.map((item) => item.variantId === line.variantId ? { ...item, quantity: item.quantity + line.quantity } : item) : [...state.lines, line] }
    })
    return accepted
  },
  setQuantity: (variantId, quantity) => set((state) => ({ lines: state.lines.map((item) => item.variantId === variantId ? { ...item, quantity } : item).filter((item) => item.quantity > 0) })),
  remove: (variantId) => set((state) => ({ lines: state.lines.filter((item) => item.variantId !== variantId) })),
  clear: () => set({ lines: [] }),
}), { name: 'btmi.cart', storage: createJSONStorage(() => AsyncStorage) }))
