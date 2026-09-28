import type { SalesTimeseriesPoint } from '@/api/admin'

interface ShopAnalyticsChartProps {
  data: SalesTimeseriesPoint[]
  interval: 'day' | 'week' | 'month' | 'year'
}

export function SalesLineChart({ data }: ShopAnalyticsChartProps) {
  if (!data || data.length === 0) return <div style={{ textAlign: 'center', padding: 24, color: 'var(--admin-text-muted)' }}>Pas de données</div>

  const maxOrders = Math.max(...data.map(d => d.orders_count || 0))
  const maxUnits = Math.max(...data.map(d => d.units_sold || 0))

  return (
    <div style={{ backgroundColor: 'var(--admin-surface-2)', borderRadius: 8, padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--admin-text)' }}>Commandes & Unités vendues</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
          {data.map((point, idx) => (
            <div key={idx} style={{ borderRadius: 8, border: '1px solid var(--admin-border)', padding: 12, backgroundColor: 'var(--admin-surface)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', marginBottom: 8 }}>{point.period}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginBottom: 4 }}>Commandes</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0ea5e9' }}>{point.orders_count}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginBottom: 4 }}>Unités</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>{point.units_sold}</div>
                </div>
              </div>
              <div style={{ height: 4, backgroundColor: 'var(--admin-border)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', backgroundColor: '#0ea5e9', width: `${(point.orders_count / maxOrders) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SalesValueChart({ data }: ShopAnalyticsChartProps) {
  if (!data || data.length === 0) return <div style={{ textAlign: 'center', padding: 24, color: 'var(--admin-text-muted)' }}>Pas de données</div>

  const maxValue = Math.max(...data.map(d => d.sales_value || 0))
  const total = data.reduce((sum, d) => sum + (d.sales_value || 0), 0)

  return (
    <div style={{ backgroundColor: 'var(--admin-surface-2)', borderRadius: 8, padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--admin-text)' }}>Valeur des ventes</h4>
        <div style={{ marginBottom: 16, padding: 12, backgroundColor: 'var(--admin-surface)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', marginBottom: 4 }}>Total</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>{(total / 1000).toFixed(1)}K FBU</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
          {data.map((point, idx) => {
            const percent = (point.sales_value / maxValue) * 100
            return (
              <div key={idx} style={{ borderRadius: 8, border: '1px solid var(--admin-border)', padding: 12, backgroundColor: 'var(--admin-surface)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', marginBottom: 8 }}>{point.period}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0ea5e9', marginBottom: 8 }}>{(point.sales_value / 1000).toFixed(1)}K</div>
                <div style={{ height: 8, backgroundColor: 'var(--admin-border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', backgroundColor: '#0ea5e9', width: `${percent}%`, transition: 'width 0.3s ease' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function AverageOrderValueChart({ data }: ShopAnalyticsChartProps) {
  if (!data || data.length === 0) return <div style={{ textAlign: 'center', padding: 24, color: 'var(--admin-text-muted)' }}>Pas de données</div>

  const avgValue = data.reduce((sum, d) => sum + (d.avg_order_value || 0), 0) / data.length
  const maxAvg = Math.max(...data.map(d => d.avg_order_value || 0))

  return (
    <div style={{ backgroundColor: 'var(--admin-surface-2)', borderRadius: 8, padding: 16 }}>
      <div>
        <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--admin-text)' }}>Panier moyen</h4>
        <div style={{ marginBottom: 16, padding: 12, backgroundColor: 'var(--admin-surface)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', marginBottom: 4 }}>Moyenne</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>{avgValue.toFixed(0)} FBU</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
          {data.map((point, idx) => {
            const percent = (point.avg_order_value / maxAvg) * 100
            return (
              <div key={idx} style={{ borderRadius: 8, border: '1px solid var(--admin-border)', padding: 12, backgroundColor: 'var(--admin-surface)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', marginBottom: 8 }}>{point.period}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b', marginBottom: 8 }}>{point.avg_order_value.toFixed(0)} FBU</div>
                <div style={{ height: 8, backgroundColor: 'var(--admin-border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', backgroundColor: '#f59e0b', width: `${percent}%`, transition: 'width 0.3s ease' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
