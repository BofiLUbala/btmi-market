import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode
} from 'react'
import type { CartLineInput } from '@/api/types'

export interface CartLine {
  productId: string
  variantId: string
  quantity: number
  name: string
  variantName: string
  /** Attribute snapshot for display only (e.g. Color/Size). Not authoritative. */
  attributes?: Record<string, string>
  unit: string
  /** Display price captured when added. Backend preview is authoritative. */
  unitPrice: number
  currency: string
  shopId: string
  shopName: string
  image?: string
}

/**
 * A cart line's identity: the same product, in the same variant, from the same
 * shop.
 *
 * The cart used to key lines on variantId alone. That is subtly wrong even when
 * variant ids are globally unique, because it encodes "a variant can only ever
 * come from one shop" - and it made the shop a property of the cart rather than
 * of the line, which is what led the client to send every line to the first
 * line's shop at checkout.
 */
export function lineKey(line: Pick<CartLine, 'productId' | 'variantId' | 'shopId'>): string {
  return `${line.productId}::${line.variantId}::${line.shopId}`
}

export interface CartShop {
  shopId: string
  shopName: string
  lines: CartLine[]
  subtotal: number
  itemCount: number
}

interface CartState {
  lines: CartLine[]
  /** The cart grouped the way it will be ordered: one group per shop. */
  shops: CartShop[]
  /** True when the cart spans more than one shop, i.e. checkout will split. */
  isMultiShop: boolean
  usePoints: boolean
  add: (line: CartLine) => void
  buyNow: (line: CartLine) => void
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  setUsePoints: (v: boolean) => void
  clear: () => void
  totalQty: number
  subtotal: number
  items: CartLineInput[]
}

const CartContext = createContext<CartState | null>(null)

const STORAGE_KEY = 'btmi.cart'

type Persisted = { lines: CartLine[]; usePoints: boolean }

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { lines: [], usePoints: false }
    const parsed = JSON.parse(raw) as Persisted
    if (!Array.isArray(parsed.lines)) return { lines: [], usePoints: false }
    return {
      // A line with no shop cannot be ordered - the server would not know who is
      // selling it - so a cart persisted before lines carried a shop drops those
      // rather than failing at checkout.
      lines: parsed.lines.filter(
        (l) => l && l.productId && l.variantId && l.shopId && l.quantity > 0
      ),
      usePoints: Boolean(parsed.usePoints)
    }
  } catch {
    return { lines: [], usePoints: false }
  }
}

type Action =
  | { type: 'ADD'; line: CartLine }
  | { type: 'BUY_NOW'; line: CartLine }
  | { type: 'SET_QTY'; key: string; quantity: number }
  | { type: 'REMOVE'; key: string }
  | { type: 'USE_POINTS'; value: boolean }
  | { type: 'CLEAR' }

function reducer(state: Persisted, action: Action): Persisted {
  switch (action.type) {
    case 'ADD': {
      // Same product, same variant, same shop: one line, more of it. Anything
      // else is a new line. A cart already holding one product never refuses
      // another - there is no shop check here, because a second shop is a second
      // order at checkout, not an error.
      const key = lineKey(action.line)
      const existing = state.lines.find((l) => lineKey(l) === key)
      if (existing) {
        return {
          ...state,
          lines: state.lines.map((l) =>
            lineKey(l) === key
              ? { ...l, quantity: l.quantity + action.line.quantity, unitPrice: action.line.unitPrice }
              : l
          )
        }
      }
      return { ...state, lines: [...state.lines, action.line] }
    }
    case 'BUY_NOW':
      return { lines: [action.line], usePoints: false }
    case 'SET_QTY':
      return {
        ...state,
        lines: state.lines
          .map((l) => (lineKey(l) === action.key ? { ...l, quantity: action.quantity } : l))
          .filter((l) => l.quantity > 0)
      }
    case 'REMOVE':
      return { ...state, lines: state.lines.filter((l) => lineKey(l) !== action.key) }
    case 'USE_POINTS':
      return { ...state, usePoints: action.value }
    case 'CLEAR':
      return { lines: [], usePoints: false }
    default:
      return state
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* storage unavailable — cart stays in memory */
    }
  }, [state])

  const value = useMemo<CartState>(() => {
    const add = (line: CartLine) => dispatch({ type: 'ADD', line })
    const buyNow = (line: CartLine) => dispatch({ type: 'BUY_NOW', line })
    const setQuantity = (key: string, quantity: number) =>
      dispatch({ type: 'SET_QTY', key, quantity })
    const remove = (key: string) => dispatch({ type: 'REMOVE', key })
    const setUsePoints = (v: boolean) => dispatch({ type: 'USE_POINTS', value: v })
    const clear = () => dispatch({ type: 'CLEAR' })

    // Grouped by shop in first-added order, which is the order checkout will
    // create the orders in and the order the cart renders them in.
    const shops: CartShop[] = []
    const shopIndex = new Map<string, number>()
    for (const line of state.lines) {
      let position = shopIndex.get(line.shopId)
      if (position === undefined) {
        position = shops.length
        shopIndex.set(line.shopId, position)
        shops.push({ shopId: line.shopId, shopName: line.shopName, lines: [], subtotal: 0, itemCount: 0 })
      }
      shops[position].lines.push(line)
      shops[position].subtotal += line.quantity * line.unitPrice
      shops[position].itemCount += line.quantity
    }

    const totalQty = state.lines.reduce((s, l) => s + l.quantity, 0)
    const subtotal = state.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
    // Every line names its own shop, so the server never has to infer one.
    const items: CartLineInput[] = state.lines.map((l) => ({
      product_id: l.productId,
      variant_id: l.variantId,
      shop_id: l.shopId,
      quantity: l.quantity
    }))

    return {
      lines: state.lines,
      shops,
      isMultiShop: shops.length > 1,
      usePoints: state.usePoints,
      add,
      buyNow,
      setQuantity,
      remove,
      setUsePoints,
      clear,
      totalQty,
      subtotal,
      items
    }
  }, [state])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartState {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
