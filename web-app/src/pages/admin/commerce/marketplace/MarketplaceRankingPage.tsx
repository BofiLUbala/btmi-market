import { useState, useEffect } from 'react'
import { adminCommerceApi, type AdminMarketplaceRanking } from '@/api/admin'
import { useT } from '@/store/i18n'

export default function MarketplaceRankingPage() {
  const t = useT()
  const [ranking, setRanking] = useState<AdminMarketplaceRanking | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    adminCommerceApi.getMarketplaceRanking()
      .then(setRanking)
      .catch(() => setRanking(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('common.loading')}</div>
  if (!ranking) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('admin.ranking.noData')}</div>

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{t('admin.ranking.title')}</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{t('admin.ranking.subtitle')}</p>
      </div>

      {/* Engine Status */}
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>{t('admin.ranking.serviceStatus')}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: ranking.available ? '#34d399' : '#fbbf24' }}>
            {ranking.available ? t('admin.ranking.onlineActive') : t('admin.ranking.defaultHeuristic')}
          </div>
        </div>
        {ranking.message && (
          <div style={{ color: '#94a3b8', fontSize: 13 }}>{ranking.message}</div>
        )}
      </div>

      {/* Ranking Factors */}
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#94a3b8' }}>{t('admin.ranking.rankingFactors')}</h4>
        {ranking.ranking_factors && ranking.ranking_factors.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {ranking.ranking_factors.map((factor, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', backgroundColor: '#1e293b', borderRadius: 8 }}>
                <span style={{ color: '#10b981', fontSize: 14 }}>✓</span>
                <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 500 }}>{factor}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#64748b', fontSize: 13 }}>{t('admin.ranking.standardFactors')}</div>
        )}
      </div>

      {/* Category Weights */}
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#94a3b8' }}>{t('admin.ranking.categoryWeights')}</h4>
        {ranking.category_weights && Object.keys(ranking.category_weights).length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {Object.entries(ranking.category_weights).map(([cat, weight]) => (
              <div key={cat} style={{ backgroundColor: '#1e293b', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>{cat}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc' }}>{(weight * 100).toFixed(0)}%</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#64748b', fontSize: 13 }}>{t('admin.ranking.equalWeightDistribution')}</div>
        )}
      </div>
    </div>
  )
}
