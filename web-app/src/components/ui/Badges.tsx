import type { OrderStatus } from '@/api/types'
import { formatMoney } from '@/lib/format'
import { useI18n } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n()
  const key = `status.${status}` as TranslationKey
  // An unknown status from the API still has to render something readable, so
  // fall back to prettifying the raw value rather than showing the key.
  const translated = t(key)
  const label =
    translated === key
      ? status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
      : translated
  return <span className={`badge badge-status badge-${status}`}>{label}</span>
}

export function StockChip({ stock, quantity }: { stock: string; quantity?: number }) {
  const { t } = useI18n()
  const cls =
    stock === 'OUT_OF_STOCK' ? 'out' : stock === 'LOW_STOCK' ? 'low' : 'ok'
  // Naming the remaining count is a stronger signal than "Low stock" alone,
  // but only when we actually know it.
  const scarce = stock === 'LOW_STOCK' && typeof quantity === 'number' && quantity > 0
  const label =
    stock === 'OUT_OF_STOCK'
      ? t('stock.outOfStock')
      : scarce
        ? t('stock.onlyLeft', { count: quantity as number })
        : stock === 'LOW_STOCK'
          ? t('stock.lowStock')
          : t('stock.inStock')
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