import { useMemo, type CSSProperties } from 'react'
import { formatMoney } from '@/lib/format'

/** One bucket of a finance series. Matches the backend's
 *  FinanceTimeseriesPoint on both the admin and the seller side. */
export interface FinanceTrendPoint {
  period: string
  gross_sales: number
  commission_amount: number
  seller_net_amount: number
  currency: string
}

interface Props {
  points: FinanceTrendPoint[]
  /** Rendered when the backend returned an empty series, so an empty chart is
   *  never mistaken for a broken one. */
  emptyLabel?: string
  height?: number
}

const SERIES = [
  { key: 'gross_sales', label: 'Ventes brutes', color: '#60a5fa' },
  { key: 'commission_amount', label: 'Commission TBK', color: '#f87171' },
  { key: 'seller_net_amount', label: 'Net vendeur', color: '#34d399' }
] as const

const VIEW_W = 720
const PAD_L = 8
const PAD_R = 8

const legendStyle: CSSProperties = {
  display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
  fontSize: 11, color: 'var(--color-text-muted, #94a3b8)', marginTop: 8
}

/**
 * Line chart of the real finance series returned by the backend. It holds no
 * data of its own: given an empty `points` array it says so rather than
 * drawing a placeholder curve.
 *
 * Buckets of different currencies are drawn as separate series groups would
 * be misleading, so the caller filters to one currency before passing points.
 */
export default function FinanceTrendChart({ points, emptyLabel = 'Aucune donnée sur cette période.', height = 180 }: Props) {
  const geometry = useMemo(() => {
    if (points.length === 0) return null
    const max = Math.max(
      ...points.map((p) => Math.max(p.gross_sales, p.commission_amount, p.seller_net_amount)),
      0
    )
    // A flat all-zero series still needs a non-zero scale to draw a baseline.
    const scaleMax = max > 0 ? max : 1
    const usable = VIEW_W - PAD_L - PAD_R
    // A single bucket has no span to spread across, so it sits mid-chart.
    const step = points.length > 1 ? usable / (points.length - 1) : 0
    const x = (i: number) => (points.length > 1 ? PAD_L + i * step : VIEW_W / 2)
    const y = (value: number) => height - 12 - (value / scaleMax) * (height - 28)
    return { x, y, scaleMax }
  }, [points, height])

  if (!geometry) {
    return (
      <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted, #94a3b8)' }}>
        {emptyLabel}
      </div>
    )
  }

  const currency = points[0]?.currency || 'USD'
  const money = (value: number) => formatMoney(value, currency)

  return (
    <div>
      <svg
        viewBox={`0 0 ${VIEW_W} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Évolution des ventes, de la commission TBK et du net vendeur sur ${points.length} période(s)`}
        style={{ width: '100%', height, display: 'block' }}
      >
        <line x1={0} y1={height - 12} x2={VIEW_W} y2={height - 12} stroke="var(--color-border, #334155)" strokeWidth={1} />
        {SERIES.map((series) => {
          const path = points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${geometry.x(i).toFixed(2)} ${geometry.y(p[series.key]).toFixed(2)}`)
            .join(' ')
          return (
            <g key={series.key}>
              <path d={path} fill="none" stroke={series.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
              {points.map((p, i) => (
                <circle key={p.period} cx={geometry.x(i)} cy={geometry.y(p[series.key])} r={2.5} fill={series.color}>
                  <title>{`${p.period} — ${series.label}: ${money(p[series.key])}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
      </svg>
      <div style={legendStyle}>
        {SERIES.map((series) => (
          <span key={series.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 2, backgroundColor: series.color, display: 'inline-block' }} />
            {series.label}
          </span>
        ))}
        <span style={{ marginLeft: 'auto' }}>
          {points[0].period} → {points[points.length - 1].period} · max {money(geometry.scaleMax)}
        </span>
      </div>
    </div>
  )
}
