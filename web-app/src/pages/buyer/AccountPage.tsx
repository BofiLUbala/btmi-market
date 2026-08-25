import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import type { BuyerOrder, BuyerPointsSummary, PendingPurchase } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { LoadingBlock } from '@/components/ui/Feedback'
import { formatDate, initials, asArray } from '@/lib/format'
import { useAuth } from '@/store/auth'
import { RequireAuth } from '@/components/auth/Guards'

function AccountInner() {
  const { user, buyerProfile, logout } = useAuth()
  const navigate = useNavigate()
  const [points, setPoints] = useState<BuyerPointsSummary | null>(null)
  const [pending, setPending] = useState<PendingPurchase[]>([])
  const [orders, setOrders] = useState<BuyerOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.allSettled([buyerApi.getPoints(), buyerApi.pendingPurchases(), buyerApi.orders()]).then(([p, pc, orderResult]) => {
      if (!mounted) return
      if (p.status === 'fulfilled') setPoints(p.value)
      if (pc.status === 'fulfilled') setPending(asArray(pc.value))
      if (orderResult.status === 'fulfilled') setOrders(asArray(orderResult.value))
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
              {buyerProfile?.first_name} {buyerProfile?.last_name}
            </h1>
            <div className="small muted">{buyerProfile?.email}</div>
          </div>
          <div className="profile-contact-block"><div className="eyebrow">CONTACT</div><div className="info-row"><span className="k">Primary</span><span className="v">{buyerProfile?.phone || '—'}</span></div><div className="info-row"><span className="k">Backup</span><span className="v">{buyerProfile?.backup_phone || '—'}</span></div></div>
          <div className="profile-contact-block"><div className="eyebrow">LOCATION</div><div className="profile-address">{buyerProfile?.address || 'No address provided'}</div><div className="small muted">{[buyerProfile?.commune, buyerProfile?.city].filter(Boolean).join(', ') || 'No location provided'}</div></div>
          <div className="info-row">
            <span className="k">Member since</span>
            <span className="v">{user ? formatDate(user.created_at) : '—'}</span>
          </div>
        </div>

        <div className="stack">
          <section className="card account-points" aria-labelledby="my-points-title">
            <div className="row-between"><div><div className="eyebrow">MY POINTS</div><h2 id="my-points-title">{(points?.available_points ?? 0).toLocaleString()} points available</h2></div><Link to="/points" className="section-link">View history →</Link></div>
            <div className="account-points-grid"><div><span>Available</span><strong>{(points?.available_points ?? 0).toLocaleString()}</strong></div><div><span>Reserved</span><strong>{(points?.reserved_points ?? 0).toLocaleString()}</strong></div><div><span>Lifetime earned</span><strong>{(points?.lifetime_points ?? 0).toLocaleString()}</strong></div><div><span>Level</span><strong>{points?.level ?? 'BRONZE'}</strong></div></div>
            {(points?.available_points ?? 0) === 0 && <p className="small muted">Complete verified purchases to earn points.</p>}
          </section>

          <Link to="/orders" className="card card-hover row-between">
            <div>
              <div className="muted small">My Orders</div>
              <div className="bold">{orders.length} order{orders.length === 1 ? '' : 's'}</div>
              {orders[0] && <div className="small muted">Last order: {formatDate(orders[0].created_at)}</div>}
            </div>
            <span className="section-link">View all →</span>
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
