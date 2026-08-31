import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import type { BuyerOrder, BuyerPointsSummary, PendingPurchase } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { LoadingBlock } from '@/components/ui/Feedback'
import { AvatarUpload } from '@/components/ui/AvatarUpload'
import { formatDate, asArray } from '@/lib/format'
import { useAuth } from '@/store/auth'
import { useI18n } from '@/store/i18n'
import { RequireAuth } from '@/components/auth/Guards'

function AccountInner() {
  const { user, buyerProfile, logout, refreshUser } = useAuth()
  const { t } = useI18n()
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

  if (loading) return <LoadingBlock label={t('account.loadingPage')} />

  return (
    <div className="fade-in">
      <div className="order-summary-grid">
        <div className="card stack">
          <div className="row-between">
            <AvatarUpload
              url={user?.avatar_url}
              name={user ? `${user.first_name} ${user.last_name}` : ''}
              size={56}
              onUploaded={refreshUser}
            />
            <Link to="/account/edit">
              <Button variant="outline" size="sm">{t('common.edit')}</Button>
            </Link>
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem' }}>
              {buyerProfile?.first_name} {buyerProfile?.last_name}
            </h1>
            <div className="small muted">{buyerProfile?.email}</div>
          </div>
          <div className="profile-contact-block"><div className="eyebrow">{t('account.contact')}</div><div className="info-row"><span className="k">{t('account.primary')}</span><span className="v">{buyerProfile?.phone || '—'}</span></div><div className="info-row"><span className="k">{t('account.backup')}</span><span className="v">{buyerProfile?.backup_phone || '—'}</span></div></div>
          <div className="profile-contact-block"><div className="eyebrow">{t('account.location')}</div><div className="profile-address">{buyerProfile?.address || t('account.noAddress')}</div><div className="small muted">{[buyerProfile?.commune, buyerProfile?.city].filter(Boolean).join(', ') || t('account.noLocation')}</div></div>
          <div className="info-row">
            <span className="k">{t('common.memberSince')}</span>
            <span className="v">{user ? formatDate(user.created_at) : '—'}</span>
          </div>
        </div>

        <div className="stack">
          <section className="card account-points" aria-labelledby="my-points-title">
            <div className="row-between"><div><div className="eyebrow">{t('points.myPoints')}</div><h2 id="my-points-title">{t('points.available', { count: (points?.available_points ?? 0).toLocaleString() })}</h2></div><Link to="/points" className="section-link">{t('points.viewHistory')} →</Link></div>
            <div className="account-points-grid"><div><span>{t('points.availableLabel')}</span><strong>{(points?.available_points ?? 0).toLocaleString()}</strong></div><div><span>{t('points.reserved')}</span><strong>{(points?.reserved_points ?? 0).toLocaleString()}</strong></div><div><span>{t('points.lifetimeEarned')}</span><strong>{(points?.lifetime_points ?? 0).toLocaleString()}</strong></div><div><span>{t('points.level')}</span><strong>{points?.level ?? 'BRONZE'}</strong></div></div>
            {(points?.available_points ?? 0) === 0 && <p className="small muted">{t('points.earnByPurchase')}</p>}
          </section>

          <Link to="/orders" className="card card-hover row-between">
            <div>
              <div className="muted small">{t('account.myOrders')}</div>
              <div className="bold">{t('account.ordersCount', { count: orders.length })}</div>
              {orders[0] && <div className="small muted">{t('account.lastOrder', { date: formatDate(orders[0].created_at) })}</div>}
            </div>
            <span className="section-link">{t('common.viewAll')} →</span>
          </Link>

          <Link to="/favorites" className="card card-hover row-between">
            <div>
              <div className="muted small">{t('nav.favorites')}</div>
              <div className="bold">{t('account.savedProducts')}</div>
            </div>
            <span className="section-link">{t('common.view')} →</span>
          </Link>

          <Link to="/reviews" className="card card-hover row-between">
            <div>
              <div className="muted small">{t('account.myReviews')}</div>
              <div className="bold">{t('account.reviewsSubtitle')}</div>
            </div>
            <span className="section-link">{t('common.view')} →</span>
          </Link>

          {pending.length > 0 && (
            <Link to="/account/purchases" className="card card-hover row-between">
              <div>
                <div className="muted small">{t('account.pendingPurchases')}</div>
                <div className="bold">{t('account.pendingToConfirm', { count: pending.length })}</div>
              </div>
              <span className="section-link">{t('account.reviewPending')} →</span>
            </Link>
          )}

          <Button variant="danger" onClick={onLogout}>
            {t('common.signOut')}
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
