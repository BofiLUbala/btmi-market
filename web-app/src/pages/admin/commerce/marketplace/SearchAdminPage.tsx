import { useState, useEffect } from 'react'
import { adminCommerceApi, type AdminSearchAnalytics, type AdminSearchQueryLog } from '@/api/admin'

export default function SearchAdminPage() {
  const [analytics, setAnalytics] = useState<AdminSearchAnalytics | null>(null)
  const [queries, setQueries] = useState<AdminSearchQueryLog[]>([])
  const [queriesTotal, setQueriesTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'analytics' | 'queries'>('analytics')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      adminCommerceApi.getSearchAnalytics().catch(() => null),
      adminCommerceApi.listSearchQueries({ limit: 50 }).catch(() => ({ queries: [], total: 0, limit: 50, offset: 0 })),
    ]).then(([analyticsRes, queriesRes]) => {
      setAnalytics(analyticsRes)
      setQueries(queriesRes.queries || [])
      setQueriesTotal(queriesRes.total || 0)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading search analytics...</div>

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Search Admin</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Monitor search analytics and recent query logs.</p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['analytics', 'queries'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              backgroundColor: tab === t ? '#10b981' : '#1e293b', color: tab === t ? '#fff' : '#94a3b8',
              textTransform: 'capitalize'
            }}
          >{t}</button>
        ))}
      </div>

      {tab === 'analytics' && analytics && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Status', value: analytics.available ? 'ONLINE' : 'OFFLINE', color: analytics.available ? '#34d399' : '#ef4444' },
              { label: 'Total Queries', value: analytics.total_queries?.toLocaleString() ?? '0' },
              { label: 'Zero Results', value: analytics.zero_results?.toLocaleString() ?? '0', color: analytics.zero_results && analytics.zero_results > 0 ? '#fbbf24' : '#f8fafc' },
              { label: 'Failed Searches', value: analytics.failed_searches?.toLocaleString() ?? '0', color: analytics.failed_searches && analytics.failed_searches > 0 ? '#ef4444' : '#f8fafc' },
            ].map((stat) => (
              <div key={stat.label} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: stat.color || '#f8fafc' }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {analytics.message && (
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', color: '#94a3b8' }}>Search Engine Status</h4>
              <p style={{ margin: 0, color: '#f8fafc', fontSize: 13 }}>{analytics.message}</p>
            </div>
          )}
        </>
      )}

      {tab === 'queries' && (
        <div>
          <div style={{ marginBottom: 8, color: '#64748b', fontSize: 12 }}>{queriesTotal} queries logged</div>
          {queries.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No search queries logged yet</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e293b' }}>
                    {['Timestamp', 'Query', 'Results Count', 'Search Type'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queries.map((q, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(q.created_at).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', color: '#f8fafc', fontWeight: 600 }}>{q.query}</td>
                      <td style={{ padding: '10px 12px', color: q.results_count === 0 ? '#ef4444' : '#34d399', fontWeight: 700 }}>{q.results_count}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, backgroundColor: '#1e293b', color: '#93c5fd' }}>
                          {q.search_type || 'TEXT'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'analytics' && !analytics && (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Search analytics not available</div>
      )}
    </div>
  )
}
