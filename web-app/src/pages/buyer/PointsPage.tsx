import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import type { BuyerPointsSummary } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { RequireAuth } from '@/components/auth/Guards'
import { useI18n } from '@/store/i18n'

function PointsInner() {
  const { t } = useI18n()
  const [account, setAccount] = useState<BuyerPointsSummary | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    buyerApi.getPoints().then(
      (p) => {
        setAccount(p)
        setLoading(false)
      },
      (e: unknown) => {
        setError(e instanceof Error ? e.message : t('points.loadFailed'))
        setLoading(false)
      }
    )
  }, [])

  if (loading) return <LoadingBlock label={t('points.loading')} />
  if (error) return <ErrorBox error={error} onRetry={() => window.location.reload()} />
  const points = account ?? { available_points: 0, reserved_points: 0, lifetime_points: 0, level: 'BRONZE' }

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 12 }}>{t('points.myPoints')}</h1>
      <div className="pay-big" style={{ marginBottom: 16 }}>
        <div className="small muted">{t('points.currentBalance')}</div>
        <div className="amount">{points.available_points.toLocaleString()} pts</div>
        <div className="pay-note">
          {t('points.summary', { lifetime: points.lifetime_points.toLocaleString(), reserved: points.reserved_points.toLocaleString(), level: points.level })}
        </div>
        {points.available_points === 0 && <p className="small muted">{t('points.earnByPurchase')}</p>}
      </div>

      <div className="order-summary-grid">
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>{t('points.howItWorks')}</h2>
          <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
            <li>{t('points.howEarn')}</li>
            <li>{t('points.howRedeem')}</li>
            <li>{t('points.howDelivery')}</li>
            <li>{t('points.howLevels')}</li>
          </ul>
        </div>
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>{t('points.redeem')}</h2>
          <p className="small muted" style={{ margin: 0 }}>
            {t('points.redeemNote')}
          </p>
          <Link to="/search">
            <Button block style={{ marginTop: 12 }}>{t('points.startShopping')}</Button>
          </Link>
        </div>
      </div>

      <div className="section-head">
        <h2>{t('points.history')}</h2>
        <Link to="/points/history" className="section-link">{t('points.fullHistory')} →</Link>
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
