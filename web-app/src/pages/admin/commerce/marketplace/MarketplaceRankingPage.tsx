import { useState, useEffect } from 'react'
import { adminCommerceApi, type AdminMarketplaceRanking } from '@/api/admin'

export default function MarketplaceRankingPage() {
  const [ranking, setRanking] = useState<AdminMarketplaceRanking | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    adminCommerceApi.getMarketplaceRanking()
      .then(setRanking)
      .catch(() => setRanking(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading...</div>
  if (!ranking) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No ranking data available</div>

  const rankColor = (rank: number) => {
    if (rank === 1) return '#fbbf24'
    if (rank === 2) return '#94a3b8'
    if (rank === 3) return '#cd7f32'
    return '#64748b'
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Marketplace Ranking</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Inspect current marketplace visibility ranking and weights.</p>
      </div>

      {/* Ranking Configuration */}
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#94a3b8' }}>Ranking Weights</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {ranking.weights && Object.entries(ranking.weights).map(([key, val]) => (
            <div key={key} style={{ backgroundColor: '#1e293b', borderRadius: 8, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>{key.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc' }}>{((val as number) * 100).toFixed(0)}%</div>
            </div>
          ))}
          {!ranking.weights && (
            <div style={{ color: '#64748b', fontSize: 13 }}>No weight configuration available</div>
          )}
        </div>
      </div>

      {/* Top Ranked Products */}
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#94a3b8' }}>Top Ranked Products</h4>
        {ranking.top_ranked && ranking.top_ranked.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ranking.top_ranked.map((item, idx) => (
              <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, backgroundColor: '#1e293b', borderRadius: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: rankColor(idx + 1), fontSize: 14 }}>
                  #{idx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>{item.product_name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Score: {item.ranking_score.toFixed(2)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: '#f8fafc', fontWeight: 600 }}>${item.price?.toFixed(2) ?? '-'}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.shop_name}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#64748b', fontSize: 13 }}>No ranked products available</div>
        )}
      </div>

      <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 16 }}>
        Last updated: {ranking.last_updated ? new Date(ranking.last_updated).toLocaleString() : 'Unknown'}
      </div>
    </div>
  )
}
