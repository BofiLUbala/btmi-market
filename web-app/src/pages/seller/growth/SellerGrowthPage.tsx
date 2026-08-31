import { useAuth } from '@/store/auth'
import { growthApi } from '@/api/seller'
import { Card, CardGrid } from '@/components/ui/Card'
import { useEffect, useState } from 'react'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import type { SellerGrowth as SellerGrowthData } from '@/api/types'
import { useT } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

const TRUST_STATUS_KEYS: Record<string, TranslationKey> = {
  HIGH: 'seller.growth.trust.HIGH',
  NORMAL: 'seller.growth.trust.NORMAL',
  LOW: 'seller.growth.trust.LOW',
  SUSPENDED: 'seller.growth.trust.SUSPENDED',
}

const BENEFIT_TYPE_KEYS: Record<string, TranslationKey> = {
  SEARCH_BOOST: 'seller.growth.benefit.SEARCH_BOOST',
  HIGH_VALUE_BUYER_ACCESS: 'seller.growth.benefit.HIGH_VALUE_BUYER_ACCESS',
}

export default function SellerGrowthPage() {
  const t = useT()
  const { activeBusiness } = useAuth()
  const [growth, setGrowth] = useState<SellerGrowthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (activeBusiness) {
      loadGrowth()
    }
  }, [activeBusiness])

  async function loadGrowth() {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const data = await growthApi.getLevel(activeBusiness.id)
      setGrowth(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('seller.growth.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <div className="empty-icon" style={{ fontSize: 64 }}>📈</div>
        <h2>{t('seller.noBusinessSelected')}</h2>
        <p className="muted">{t('seller.growth.noBusinessSelectedHint')}</p>
      </div>
    )
  }

  if (loading) return <LoadingBlock label={t('seller.growth.loading')} />
  if (error) return <ErrorBox error={error} />
  if (!growth) return <ErrorBox error={t('seller.growth.noData')} />

  const progressPercent = Math.min(100, Math.max(0, growth.level.progress_to_next_level_percent))

  return (
    <div className="seller-growth">
      <div className="page-header">
        <h1>{t('seller.growth.title')}</h1>
      </div>

      <CardGrid>
        <Card>
          <h3>{t('seller.growth.currentPoints')}</h3>
          <div className="stat-value">{growth.points.current_points.toLocaleString()}</div>
          <p className="muted small">{t('seller.growth.lifetime', { count: growth.points.lifetime_points.toLocaleString() })}</p>
        </Card>
        <Card>
          <h3>{t('seller.growth.currentLevel')}</h3>
          <div className="stat-value">{growth.level.name}</div>
          <p className="muted small">{t('seller.growth.searchBoost', { value: growth.level.search_boost })}</p>
        </Card>
        <Card>
          <h3>{t('seller.growth.trustStatus')}</h3>
          <div className="stat-value">
            <span className={`badge badge-${growth.trust.trust_status === 'HIGH' ? 'success' : growth.trust.trust_status === 'NORMAL' ? 'primary' : growth.trust.trust_status === 'LOW' ? 'warning' : 'danger'}`}>
              {t(TRUST_STATUS_KEYS[growth.trust.trust_status] ?? 'seller.growth.trust.NORMAL')}
            </span>
          </div>
        </Card>
      </CardGrid>

      <div style={{ marginBottom: 24 }}>
        <Card>
          <h3>{t('seller.growth.progressToNextLevel')}</h3>
          <div
            className="progress-bar mt-2"
            role="progressbar"
            aria-valuenow={Math.round(progressPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('seller.growth.progressLabel')}
          >
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>
            {t('seller.growth.pointsProgress', { current: growth.points.current_points.toLocaleString(), max: growth.level.max_points.toLocaleString(), description: growth.level.description })}
          </p>
        </Card>
      </div>

      <div className="dashboard-sections" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
        <Card>
          <h3>{t('seller.growth.trustMetrics')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 16 }}>
            <div>
              <div className="stat-value">{growth.trust.verified_sales_count}</div>
              <div className="muted small">{t('seller.growth.verifiedSales')}</div>
            </div>
            <div>
              <div className="stat-value">{growth.trust.order_completion_rate.toFixed(1)}%</div>
              <div className="muted small">{t('seller.growth.completionRate')}</div>
            </div>
            <div>
              <div className="stat-value">{growth.trust.cancellation_rate.toFixed(1)}%</div>
              <div className="muted small">{t('seller.growth.cancellationRate')}</div>
            </div>
            <div>
              <div className="stat-value">{growth.trust.purchase_confirmation_rate.toFixed(1)}%</div>
              <div className="muted small">{t('seller.growth.confirmationRate')}</div>
            </div>
            <div>
              <div className="stat-value">{growth.trust.stock_reliability_rate.toFixed(1)}%</div>
              <div className="muted small">{t('seller.growth.stockReliability')}</div>
            </div>
          </div>
        </Card>

        <Card>
          <h3>{t('seller.growth.levelBenefits')}</h3>
          <ul style={{ marginTop: 16 }}>
            {growth.benefits.map((benefit) => (
              <li key={benefit.benefit_type} style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
                <span className="badge badge-primary">✓</span>
                <div>
                  <strong>
                    {benefit.benefit_type in BENEFIT_TYPE_KEYS
                      ? t(BENEFIT_TYPE_KEYS[benefit.benefit_type])
                      : benefit.benefit_type.split('_').join(' ')}
                  </strong>
                  {benefit.benefit_value > 0 && (
                    <>
                      {' '}
                      <span className="muted small">({benefit.benefit_value})</span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}