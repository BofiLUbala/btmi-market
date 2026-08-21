import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode
} from 'react'
import type { OrderLineInput } from '@/api/types'

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

interface CartState {
  lines: CartLine[]
  shopId: string | null
  shopName: string | null
  usePoints: boolean
  add: (line: CartLine) => void
  setQuantity: (variantId: string, quantity: number) => void
  remove: (variantId: string) => void
  setUsePoints: (v: boolean) => void
  clear: () => void
  totalQty: number
  subtotal: number
  items: OrderLineInput[]
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
      lines: parsed.lines.filter(
        (l) => l && l.productId && l.variantId && l.quantity > 0
      ),
      usePoints: Boolean(parsed.usePoints)
    }
  } catch {
    return { lines: [], usePoints: false }
  }
}

type Action =
  | { type: 'ADD'; line: CartLine }
  | { type: 'SET_QTY'; variantId: string; quantity: number }
  | { type: 'REMOVE'; variantId: string }
  | { type: 'USE_POINTS'; value: boolean }
  | { type: 'CLEAR' }

function reducer(state: Persisted, action: Action): Persisted {
  switch (action.type) {
    case 'ADD': {
      const existing = state.lines.find((l) => l.variantId === action.line.variantId)
      if (existing) {
        return {
          ...state,
          lines: state.lines.map((l) =>
            l.variantId === action.line.variantId
              ? { ...l, quantity: l.quantity + action.line.quantity, unitPrice: action.line.unitPrice }
              : l
          )
        }
      }
      return { ...state, lines: [...state.lines, action.line] }
    }
    case 'SET_QTY':
      return {
        ...state,
        lines: state.lines
          .map((l) =>
            l.variantId === action.variantId ? { ...l, quantity: action.quantity } : l
          )
          .filter((l) => l.quantity > 0)
      }
    case 'REMOVE':
      return { ...state, lines: state.lines.filter((l) => l.variantId !== action.variantId) }
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
    const setQuantity = (variantId: string, quantity: number) =>
      dispatch({ type: 'SET_QTY', variantId, quantity })
    const remove = (variantId: string) => dispatch({ type: 'REMOVE', variantId })
    const setUsePoints = (v: boolean) => dispatch({ type: 'USE_POINTS', value: v })
    const clear = () => dispatch({ type: 'CLEAR' })

    const shopId = state.lines.length ? state.lines[0].shopId : null
    const shopName = state.lines.length ? state.lines[0].shopName : null
    const totalQty = state.lines.reduce((s, l) => s + l.quantity, 0)
    const subtotal = state.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
    const items: OrderLineInput[] = state.lines.map((l) => ({
      product_id: l.productId,
      variant_id: l.variantId,
      quantity: l.quantity
    }))

    return {
      lines: state.lines,
      shopId,
      shopName,
      usePoints: state.usePoints,
      add,
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
