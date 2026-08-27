import type { OrderStatus } from '@/api/types'
import { formatMoney } from '@/lib/format'

export function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  return <span className={`badge badge-status badge-${status}`}>{label}</span>
}

export function StockChip({ stock, quantity }: { stock: string; quantity?: number }) {
  const cls =
    stock === 'OUT_OF_STOCK' ? 'out' : stock === 'LOW_STOCK' ? 'low' : 'ok'
  // Naming the remaining count is a stronger signal than "Low stock" alone,
  // but only when we actually know it.
  const scarce = stock === 'LOW_STOCK' && typeof quantity === 'number' && quantity > 0
  const label =
    stock === 'OUT_OF_STOCK'
      ? 'Out of stock'
      : scarce
        ? `Only ${quantity} left`
        : stock === 'LOW_STOCK'
          ? 'Low stock'
          : 'In stock'
  return <span className={`stock-chip ${cls}`}>{label}</span>
}

export function Money({
  amount,
  currency = 'FC',
  className = ''
}: {
  amount: number
  currency?: string
  className?: string
}) {
  return <span className={className}>{formatMoney(amount, currency)}</span>
}

export const STATUS_ORDER: OrderStatus[] = [
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RECEIVED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED'
]