import { useEffect, useState } from 'react'
import { buyerApi } from '@/api/buyer'
import type { PendingPurchase } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { formatMoney, formatDateTime, asArray } from '@/lib/format'
import { RequireAuth } from '@/components/auth/Guards'
import { useI18n } from '@/store/i18n'

function PendingInner() {
  const { t } = useI18n()
  const [items, setItems] = useState<PendingPurchase[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    buyerApi.pendingPurchases().then(
      (p) => {
        setItems(asArray(p))
        setLoading(false)
      },
      (e: unknown) => {
        setError(e instanceof Error ? e.message : t('orders.loadPurchasesFailed'))
        setLoading(false)
      }
    )
  }

  useEffect(load, [])

  async function confirm(p: PendingPurchase) {
    setBusy(p.order_id)
    setError('')
    try {
      await buyerApi.confirmPurchase(p.order_id, p.order_id)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('orders.confirmPurchaseFailed'))
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <LoadingBlock label={t('orders.loadingPurchases')} />
  if (error) return <ErrorBox error={error} onRetry={load} />

  if (items.length === 0) {
    return (
      <EmptyState
        icon="🤝"
        title={t('orders.nothingToConfirm')}
        description={t('orders.nothingToConfirmDesc')}
      />
    )
  }

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 12 }}>{t('orders.confirmPurchases')}</h1>
      <p className="muted small">
        {t('orders.confirmPurchasesDesc')}
      </p>
      <div className="stack">
        {items.map((p) => (
          <div key={p.order_id} className="card row-between">
            <div className="stack" style={{ gap: 2 }}>
              <div className="bold">{p.shop_name}</div>
              <div className="small muted">{p.business_name} · {t('orders.byEmployee', { employee: p.employee_name })}</div>
              <div className="small muted">{formatDateTime(p.created_at)}</div>
              <div className="bold">{formatMoney(p.amount, p.currency)}</div>
            </div>
            <Button loading={busy === p.order_id} onClick={() => confirm(p)}>
              {t('common.confirm')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PendingPurchasesPage() {
  return (
    <RequireAuth>
      <PendingInner />
    </RequireAuth>
  )
}