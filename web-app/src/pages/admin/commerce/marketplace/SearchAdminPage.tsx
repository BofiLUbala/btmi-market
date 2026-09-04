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
              { label: 'Total Searches', value: analytics.total_searches?.toLocaleString() ?? 'N/A' },
              { label: 'Unique Queries', value: analytics.unique_queries?.toLocaleString() ?? 'N/A' },
              { label: 'Zero Result Rate', value: analytics.zero_result_rate != null ? `${analytics.zero_result_rate.toFixed(1)}%` : 'N/A' },
              { label: 'Avg Results', value: analytics.avg_results_per_query?.toFixed(1) ?? 'N/A' },
            ].map((stat) => (
              <div key={stat.label} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc' }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {analytics.top_queries && analytics.top_queries.length > 0 && (
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#94a3b8' }}>Top Queries</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {analytics.top_queries.map((q, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#1e293b', borderRadius: 6 }}>
                    <span style={{ color: '#f8fafc', fontSize: 13 }}>{q.query}</span>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>{q.count} searches</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'queries' && (
        <div>
          <div style={{ marginBottom: 8, color: '#64748b', fontSize: 12 }}>{queriesTotal} queries logged</div>
          {queries.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No search queries logged yet (search_query_log table may not exist)</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e293b' }}>
                    {['Timestamp', 'Query', 'Results', 'User', 'Session'].map(h => (
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
                      <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 12 }}>{q.user_id || 'anonymous'}</td>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.session_id || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'analytics' && !analytics && (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Search analytics not available (search_query_log table may not exist yet)</div>
      )}
    </div>
  )
}
