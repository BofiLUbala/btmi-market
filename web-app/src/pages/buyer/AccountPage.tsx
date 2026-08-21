import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import type { PointAccount, PendingPurchase } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { LoadingBlock } from '@/components/ui/Feedback'
import { formatDate, initials, asArray } from '@/lib/format'
import { useAuth } from '@/store/auth'
import { RequireAuth } from '@/components/auth/Guards'

function AccountInner() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [points, setPoints] = useState<PointAccount | null>(null)
  const [pending, setPending] = useState<PendingPurchase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.allSettled([buyerApi.getPoints(), buyerApi.pendingPurchases()]).then(([p, pc]) => {
      if (!mounted) return
      if (p.status === 'fulfilled') setPoints(p.value)
      if (pc.status === 'fulfilled') setPending(asArray(pc.value))
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [])

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  if (loading) return <LoadingBlock label="Loading your account…" />

  return (
    <div className="fade-in">
      <div className="order-summary-grid">
        <div className="card stack">
          <div className="row-between">
            <div className="shop-logo" style={{ width: 56, height: 56 }}>
              {user ? initials(`${user.first_name} ${user.last_name}`) : '?'}
            </div>
            <Link to="/account/edit">
              <Button variant="outline" size="sm">Edit</Button>
            </Link>
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem' }}>
              {user?.first_name} {user?.last_name}
            </h1>
            <div className="small muted">{user?.email}</div>
            <div className="small muted">{user?.phone}</div>
          </div>
          <div className="info-row">
            <span className="k">City</span>
            <span className="v">{user?.city || '—'}</span>
          </div>
          <div className="info-row">
            <span className="k">Commune</span>
            <span className="v">{user?.commune || '—'}</span>
          </div>
          <div className="info-row">
            <span className="k">Member since</span>
            <span className="v">{user ? formatDate(user.created_at) : '—'}</span>
          </div>
        </div>

        <div className="stack">
          <Link to="/points" className="card card-hover row-between">
            <div>
              <div className="muted small">My points</div>
              <div className="price-lg">{points?.current_points ?? 0}</div>
            </div>
            <span className="section-link">View →</span>
          </Link>

          <Link to="/orders" className="card card-hover row-between">
            <div>
              <div className="muted small">Orders</div>
              <div className="bold">View my orders</div>
            </div>
            <span className="section-link">View →</span>
          </Link>

          <Link to="/favorites" className="card card-hover row-between">
            <div>
              <div className="muted small">Favorites</div>
              <div className="bold">Saved products</div>
            </div>
            <span className="section-link">View →</span>
          </Link>

          {pending.length > 0 && (
            <Link to="/account/purchases" className="card card-hover row-between">
              <div>
                <div className="muted small">Pending purchase confirmations</div>
                <div className="bold">{pending.length} to confirm</div>
              </div>
              <span className="section-link">Review →</span>
            </Link>
          )}

          <Button variant="danger" onClick={onLogout}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function AccountPage() {
  return (
    <RequireAuth>
      <AccountInner />
    </RequireAuth>
  )
}