import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import type { PointHistoryResponse, PointTransaction } from '@/api/types'
import { EmptyState, ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { formatDateTime, asArray } from '@/lib/format'
import { RequireAuth } from '@/components/auth/Guards'

function PointsHistoryInner() {
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
        setError(e instanceof Error ? e.message : 'Could not load history')
        setLoading(false)
      }
    )
  }, [])

  if (loading) return <LoadingBlock label="Loading history…" />
  if (error || !data) return <ErrorBox error={error || 'No data'} onRetry={() => window.location.reload()} />

  const next = data.buyer_next_level

  return (
    <div className="fade-in">
      <Link to="/points" className="small section-link">← Points</Link>
      <h1 style={{ marginTop: 8 }}>Points history</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row-between">
          <div>
            <div className="small muted">Level</div>
            <div className="bold">{data.level_name}</div>
          </div>
          <div>
            <div className="small muted">Balance</div>
            <div className="bold">{data.account.current_points.toLocaleString()}</div>
          </div>
          <div>
            <div className="small muted">Lifetime</div>
            <div className="bold">{data.account.lifetime_points.toLocaleString()}</div>
          </div>
        </div>
        {next && (
          <div style={{ marginTop: 12 }}>
            <div className="small muted">
              Next level <strong>{next.name}</strong> — {next.discount_percent}% discount,
              {next.free_delivery ? ' free delivery' : ` ${next.delivery_discount_percent}% off delivery`}
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
            <div className="t-time">{Math.round(next.progress_to_next_level_percent)}% of the way there</div>
          </div>
        )}
      </div>

      {data.transactions.length === 0 ? (
        <EmptyState icon="⭐" title="No transactions yet" description="Your points activity will show here." />
      ) : (
        <div className="card">
          {data.transactions.map((t) => (
            <TransactionRow key={t.id} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function TransactionRow({ t }: { t: PointTransaction }) {
  const credit = t.type === 'CREDIT'
  return (
    <div className="cart-line" style={{ borderBottom: '1px dashed var(--color-border)', alignItems: 'center' }}>
      <div className="stack" style={{ gap: 0, flex: 1 }}>
        <div className="bold small">{t.reference_type.replace(/_/g, ' ').toLowerCase()}</div>
        <div className="t-time">
          Balance {t.previous_points.toLocaleString()} → {t.new_points.toLocaleString()}
        </div>
        <div className="t-time">{formatDateTime(t.created_at)}</div>
      </div>
      <div className="bold" style={{ color: credit ? 'var(--color-success)' : 'var(--color-danger)' }}>
        {credit ? '+' : ''}{t.points_change.toLocaleString()} pts
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