import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import type { TrackingResponse } from '@/api/types'
import { StatusBadge } from '@/components/ui/Badges'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { formatDateTime, asArray } from '@/lib/format'
import { RequireAuth } from '@/components/auth/Guards'

const STATUS_STEPS = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RECEIVED', 'COMPLETED']

function TrackInner() {
  const { orderId = '' } = useParams()
  const [data, setData] = useState<TrackingResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    buyerApi.tracking(orderId).then(
      (t) => {
        if (!mounted) return
        setData(t ? { ...t, history: asArray(t.history) } : t)
        setLoading(false)
      },
      (e: unknown) => {
        if (!mounted) return
        setError(e instanceof Error ? e.message : 'Could not load tracking')
        setLoading(false)
      }
    )
    return () => {
      mounted = false
    }
  }, [orderId])

  if (loading) return <LoadingBlock label="Loading tracking…" />
  if (error || !data) return <ErrorBox error={error || 'No tracking data'} onRetry={() => window.location.reload()} />

  const currentIdx = STATUS_STEPS.indexOf(data.current_status)

  return (
    <div className="fade-in">
      <Link to={`/orders/${orderId}`} className="small section-link">← Order details</Link>

      <div className="row-between" style={{ marginTop: 8 }}>
        <h1 style={{ fontSize: '1.5rem' }}>Tracking</h1>
        <StatusBadge status={data.current_status} />
      </div>
      <div className="small muted">
        Order {data.order_number} · {data.delivery_method.replace(/_/g, ' ').toLowerCase()} ·{' '}
        Payment: {data.payment_status.replace(/_/g, ' ').toLowerCase()}
      </div>

      {data.latest_update && (
        <div className="card" style={{ marginTop: 12, background: 'var(--color-accent-soft)', border: 'none' }}>
          <div className="bold small">Latest update</div>
          <p className="small mt-0">{data.latest_update}</p>
          <div className="t-time">{formatDateTime(data.latest_update_at)}</div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>Progress</h2>
        <ul className="timeline">
          {STATUS_STEPS.map((s, i) => {
            const reached = i <= currentIdx
            const isCurrent = i === currentIdx
            return (
              <li key={s} className={`${reached ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
                <div className="t-status small">
                  {s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                  {isCurrent && ' — current'}
                </div>
                {data.history.filter((h) => h.status === s).length > 0 && (
                  <div className="t-time">
                    {formatDateTime([...data.history].reverse().find((h) => h.status === s)?.created_at)}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <p className="pay-note" style={{ marginTop: 12 }}>
        Tracking is updated by the shop and delivery partner. Cash payment is confirmed when the seller verifies it.
      </p>
    </div>
  )
}

export default function TrackOrderPage() {
  return (
    <RequireAuth>
      <TrackInner />
    </RequireAuth>
  )
}