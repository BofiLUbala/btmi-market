import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import type { PointHistoryResponse, PointTransaction } from '@/api/types'
import { EmptyState, ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { formatDateTime, asArray } from '@/lib/format'
import { RequireAuth } from '@/components/auth/Guards'
import { useI18n } from '@/store/i18n'

function PointsHistoryInner() {
  const { t } = useI18n()
  const [data, setData] = useState<PointHistoryResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    buyerApi.getPointsHistory().then(
      (d) => {
        setData(d ? { ...d, transactions: asArray(d.transactions) } : d)
        setLoading(false)
      },
      (e: unknown) => {
        setError(e instanceof Error ? e.message : t('points.loadHistoryFailed'))
        setLoading(false)
      }
    )
  }, [])

  if (loading) return <LoadingBlock label={t('points.loadingHistory')} />
  if (error || !data) return <ErrorBox error={error || t('points.noData')} onRetry={() => window.location.reload()} />

  const next = data.buyer_next_level

  return (
    <div className="fade-in">
      <Link to="/points" className="small section-link">← {t('points.link')}</Link>
      <h1 style={{ marginTop: 8 }}>{t('points.history')}</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row-between">
          <div>
            <div className="small muted">{t('points.level')}</div>
            <div className="bold">{data.level_name}</div>
          </div>
          <div>
            <div className="small muted">{t('points.balance')}</div>
            <div className="bold">{data.account.current_points.toLocaleString()}</div>
          </div>
          <div>
            <div className="small muted">{t('points.lifetime')}</div>
            <div className="bold">{data.account.lifetime_points.toLocaleString()}</div>
          </div>
        </div>
        {next && (
          <div style={{ marginTop: 12 }}>
            <div className="small muted">
              {t('points.nextLevel')} <strong>{next.name}</strong> — {t('points.nextLevelInfo', { pct: next.discount_percent })},
              {next.free_delivery ? ` ${t('points.freeDelivery')}` : ` ${t('points.deliveryDiscountOff', { pct: next.delivery_discount_percent })}`}
            </div>
            <div
              className="card"
              style={{ marginTop: 6, background: 'var(--color-surface-2)', border: 'none', height: 10, padding: 0, overflow: 'hidden' }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(0, next.progress_to_next_level_percent))}%`,
                  background: 'var(--color-accent)'
                }}
              />
            </div>
            <div className="t-time">{t('points.progress', { pct: Math.round(next.progress_to_next_level_percent) })}</div>
          </div>
        )}
      </div>

      {data.transactions.length === 0 ? (
        <EmptyState icon="⭐" title={t('points.noTransactionsTitle')} description={t('points.noTransactionsDesc')} />
      ) : (
        <div className="card">
          {data.transactions.map((t) => (
            <TransactionRow key={t.id} tr={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function TransactionRow({ tr }: { tr: PointTransaction }) {
  const { t } = useI18n()
  const credit = tr.type === 'CREDIT'
  return (
    <div className="cart-line" style={{ borderBottom: '1px dashed var(--color-border)', alignItems: 'center' }}>
      <div className="stack" style={{ gap: 0, flex: 1 }}>
        <div className="bold small">{tr.reference_type.replace(/_/g, ' ').toLowerCase()}</div>
        <div className="t-time">
          {t('points.balanceChange', { previous: tr.previous_points.toLocaleString(), latest: tr.new_points.toLocaleString() })}
        </div>
        <div className="t-time">{formatDateTime(tr.created_at)}</div>
      </div>
      <div className="bold" style={{ color: credit ? 'var(--color-success)' : 'var(--color-danger)' }}>
        {credit ? '+' : ''}{tr.points_change.toLocaleString()} pts
      </div>
    </div>
  )
}

export default function PointsHistoryPage() {
  return (
    <RequireAuth>
      <PointsHistoryInner />
    </RequireAuth>
  )
}