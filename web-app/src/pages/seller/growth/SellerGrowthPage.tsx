import { useAuth } from '@/store/auth'
import { growthApi } from '@/api/seller'
import { Card, CardGrid } from '@/components/ui/Card'
import { useEffect, useState } from 'react'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import type { SellerGrowth as SellerGrowthData } from '@/api/types'

export default function SellerGrowthPage() {
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
      setError(err instanceof Error ? err.message : 'Failed to load growth data')
    } finally {
      setLoading(false)
    }
  }

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <div className="empty-icon" style={{ fontSize: 64 }}>📈</div>
        <h2>No Business Selected</h2>
        <p className="muted">Select a business to view growth metrics.</p>
      </div>
    )
  }

  if (loading) return <LoadingBlock label="Loading growth data…" />
  if (error) return <ErrorBox error={error} />
  if (!growth) return <ErrorBox error="No growth data available" />

  const progressPercent = Math.min(100, Math.max(0, growth.level.progress_to_next_level_percent))

  return (
    <div className="seller-growth">
      <div className="page-header">
        <h1>Seller Growth</h1>
      </div>

      <CardGrid>
        <Card>
          <h3>Current Points</h3>
          <div className="stat-value">{growth.points.current_points.toLocaleString()}</div>
          <p className="muted small">Lifetime: {growth.points.lifetime_points.toLocaleString()}</p>
        </Card>
        <Card>
          <h3>Current Level</h3>
          <div className="stat-value">{growth.level.name}</div>
          <p className="muted small">Search boost: +{growth.level.search_boost}%</p>
        </Card>
        <Card>
          <h3>Trust Status</h3>
          <div className="stat-value">
            <span className={`badge badge-${growth.trust.trust_status === 'HIGH' ? 'success' : growth.trust.trust_status === 'NORMAL' ? 'primary' : growth.trust.trust_status === 'LOW' ? 'warning' : 'danger'}`}>
              {growth.trust.trust_status}
            </span>
          </div>
        </Card>
      </CardGrid>

      <div style={{ marginBottom: 24 }}>
        <Card>
          <h3>Progress to Next Level</h3>
          <div
            className="progress-bar mt-2"
            role="progressbar"
            aria-valuenow={Math.round(progressPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress to next seller level"
          >
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>
            {growth.points.current_points.toLocaleString()} / {growth.level.max_points.toLocaleString()} points · {growth.level.description}
          </p>
        </Card>
      </div>

      <div className="dashboard-sections" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
        <Card>
          <h3>Trust Metrics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 16 }}>
            <div>
              <div className="stat-value">{growth.trust.verified_sales_count}</div>
              <div className="muted small">Verified Sales</div>
            </div>
            <div>
              <div className="stat-value">{growth.trust.order_completion_rate.toFixed(1)}%</div>
              <div className="muted small">Completion Rate</div>
            </div>
            <div>
              <div className="stat-value">{growth.trust.cancellation_rate.toFixed(1)}%</div>
              <div className="muted small">Cancellation Rate</div>
            </div>
            <div>
              <div className="stat-value">{growth.trust.purchase_confirmation_rate.toFixed(1)}%</div>
              <div className="muted small">Confirmation Rate</div>
            </div>
            <div>
              <div className="stat-value">{growth.trust.stock_reliability_rate.toFixed(1)}%</div>
              <div className="muted small">Stock Reliability</div>
            </div>
          </div>
        </Card>

        <Card>
          <h3>Level Benefits</h3>
          <ul style={{ marginTop: 16 }}>
            {growth.benefits.map((benefit) => (
              <li key={benefit.benefit_type} style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
                <span className="badge badge-primary">✓</span>
                <div>
                  <strong>{benefit.benefit_type.split('_').join(' ')}</strong>
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