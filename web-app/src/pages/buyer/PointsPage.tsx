import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import type { PointAccount } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { RequireAuth } from '@/components/auth/Guards'

function PointsInner() {
  const [account, setAccount] = useState<PointAccount | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    buyerApi.getPoints().then(
      (p) => {
        setAccount(p)
        setLoading(false)
      },
      (e: unknown) => {
        setError(e instanceof Error ? e.message : 'Could not load points')
        setLoading(false)
      }
    )
  }, [])

  if (loading) return <LoadingBlock label="Loading points…" />
  if (error || !account) return <ErrorBox error={error || 'No points account'} onRetry={() => window.location.reload()} />

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 12 }}>My points</h1>
      <div className="pay-big" style={{ marginBottom: 16 }}>
        <div className="small muted">Current balance</div>
        <div className="amount">{account.current_points.toLocaleString()} pts</div>
        <div className="pay-note">
          Lifetime: {account.lifetime_points.toLocaleString()} · Reserved: {account.reserved_points.toLocaleString()}
        </div>
      </div>

      <div className="order-summary-grid">
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>How points work</h2>
          <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
            <li>Earn points on every verified purchase.</li>
            <li>Redeem points at checkout to reduce your cash total.</li>
            <li>Points can also reduce delivery fees.</li>
            <li>Higher levels unlock bigger discounts and free delivery.</li>
          </ul>
        </div>
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>Redeem</h2>
          <p className="small muted" style={{ margin: 0 }}>
            Redemption happens automatically when you enable “Redeem my points” in your cart — the
            backend computes the exact discount.
          </p>
          <Link to="/search">
            <Button block style={{ marginTop: 12 }}>Start shopping</Button>
          </Link>
        </div>
      </div>

      <div className="section-head">
        <h2>History</h2>
        <Link to="/points/history" className="section-link">Full history →</Link>
      </div>
    </div>
  )
}

export default function PointsPage() {
  return (
    <RequireAuth>
      <PointsInner />
    </RequireAuth>
  )
}