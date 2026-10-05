import { useState, useEffect, type FormEvent, type ReactNode } from 'react'
import { adminCommerceApi, type AdminSearchAnalytics, type AdminSearchQueryLog, type AdminSearchSynonym } from '@/api/admin'
import { useT } from '@/store/i18n'
import { dateLocale } from '@/lib/format'

type Tab = 'analytics' | 'queries' | 'synonyms'

const card = { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16 } as const
const th = { textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontWeight: 600 } as const
const td = { padding: '10px 12px', color: '#f8fafc' } as const

function percent(value: number | null | undefined) {
  return (value ?? 0).toLocaleString(dateLocale(), { style: 'percent', maximumFractionDigits: 1 })
}

function Table({ headers, rows, empty }: { headers: string[]; rows: ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>{empty}</div>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1e293b' }}>{headers.map((h) => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>{row.map((cell, j) => <td key={j} style={td}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ ...card, marginBottom: 16 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', color: '#94a3b8' }}>{title}</h4>
      {children}
    </section>
  )
}

export default function SearchAdminPage() {
  const t = useT()
  const [analytics, setAnalytics] = useState<AdminSearchAnalytics | null>(null)
  const [queries, setQueries] = useState<AdminSearchQueryLog[]>([])
  const [queriesTotal, setQueriesTotal] = useState(0)
  const [synonyms, setSynonyms] = useState<AdminSearchSynonym[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('analytics')
  const [term, setTerm] = useState('')
  const [group, setGroup] = useState('')
  const [synonymError, setSynonymError] = useState('')

  function loadSynonyms() {
    return adminCommerceApi.listSearchSynonyms().then((list) => setSynonyms(list ?? [])).catch(() => setSynonyms([]))
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      adminCommerceApi.getSearchAnalytics().catch(() => null),
      adminCommerceApi.listSearchQueries({ limit: 50 }).catch(() => ({ queries: [], total: 0, limit: 50, offset: 0 })),
      loadSynonyms(),
    ]).then(([analyticsRes, queriesRes]) => {
      setAnalytics(analyticsRes)
      setQueries(queriesRes.queries || [])
      setQueriesTotal(queriesRes.total || 0)
    }).finally(() => setLoading(false))
  }, [])

  async function addSynonym(event: FormEvent) {
    event.preventDefault()
    setSynonymError('')
    try {
      await adminCommerceApi.upsertSearchSynonym({ term, canonical_term: group })
      setTerm('')
      await loadSynonyms()
    } catch {
      setSynonymError(t('admin.searchAdmin.synonymError'))
    }
  }

  async function toggleSynonym(s: AdminSearchSynonym) {
    await adminCommerceApi.upsertSearchSynonym({ term: s.term, canonical_term: s.canonical_term, language_code: s.language_code, active: !s.active }).catch(() => setSynonymError(t('admin.searchAdmin.synonymError')))
    await loadSynonyms()
  }

  async function deleteSynonym(s: AdminSearchSynonym) {
    await adminCommerceApi.deleteSearchSynonym(s.term).catch(() => setSynonymError(t('admin.searchAdmin.synonymError')))
    await loadSynonyms()
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('admin.searchAdmin.loadingAnalytics')}</div>

  const tabLabels: Record<Tab, string> = {
    analytics: t('admin.searchAdmin.tabAnalytics'),
    queries: t('admin.searchAdmin.tabQueries'),
    synonyms: t('admin.searchAdmin.tabSynonyms'),
  }
  const unavailable = t('admin.searchAdmin.unavailable')
  const noData = t('admin.searchAdmin.noData')
  const rate = (value: number | null | undefined) => (value == null ? unavailable : percent(value))
  const groups = Array.from(new Set(synonyms.map((s) => s.canonical_term)))

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{t('admin.searchAdmin.title')}</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{t('admin.searchAdmin.subtitle')}</p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }} role="tablist">
        {(['analytics', 'queries', 'synonyms'] as const).map(tabKey => (
          <button key={tabKey} role="tab" aria-selected={tab === tabKey} onClick={() => setTab(tabKey)}
            style={{
              padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              backgroundColor: tab === tabKey ? '#10b981' : '#1e293b', color: tab === tabKey ? '#fff' : '#94a3b8',
            }}
          >{tabLabels[tabKey]}</button>
        ))}
      </div>

      {tab === 'analytics' && analytics && (
        <>
          <div className="admin-kpi-grid" style={{ marginBottom: 8 }}>
            {[
              { label: t('common.status'), value: analytics.available ? t('admin.searchAdmin.online') : t('admin.searchAdmin.offline'), color: analytics.available ? '#34d399' : '#ef4444' },
              { label: t('admin.searchAdmin.searches'), value: (analytics.searches ?? 0).toLocaleString(dateLocale()) },
              { label: t('admin.searchAdmin.zeroResultSearches'), value: (analytics.zero_result_searches ?? 0).toLocaleString(dateLocale()), color: analytics.zero_result_searches ? '#fbbf24' : undefined },
              { label: t('admin.searchAdmin.approximateSearches'), value: (analytics.approximate_searches ?? 0).toLocaleString(dateLocale()) },
              { label: t('admin.searchAdmin.ctr'), value: rate(analytics.click_through_rate), color: analytics.click_through_rate == null ? '#64748b' : undefined },
              { label: t('admin.searchAdmin.addToCartRate'), value: rate(analytics.add_to_cart_rate), color: analytics.add_to_cart_rate == null ? '#64748b' : undefined },
              { label: t('admin.searchAdmin.totalQueries'), value: analytics.total_queries?.toLocaleString(dateLocale()) ?? '0' },
              { label: t('admin.searchAdmin.failedSearches'), value: analytics.failed_searches?.toLocaleString(dateLocale()) ?? '0', color: analytics.failed_searches ? '#ef4444' : undefined },
            ].map((stat) => (
              <div key={stat.label} style={{ ...card, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: stat.color || '#f8fafc' }}>{stat.value}</div>
              </div>
            ))}
          </div>
          <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 16px' }}>{t('admin.searchAdmin.period', { days: analytics.period_days ?? 30 })}</p>

          <Section title={t('admin.searchAdmin.topQueries')}>
            <Table empty={noData}
              headers={[t('admin.searchAdmin.colQuery'), t('admin.searchAdmin.colSearches'), t('admin.searchAdmin.colAvgResults'), t('admin.searchAdmin.colClicks'), t('admin.searchAdmin.colCtr')]}
              rows={(analytics.top_queries ?? []).map((q) => [q.query, q.searches, q.avg_results.toLocaleString(dateLocale(), { maximumFractionDigits: 1 }), analytics.clicks_collected ? q.clicks : unavailable, rate(q.ctr)])} />
          </Section>
          <Section title={t('admin.searchAdmin.zeroResultQueries')}>
            <Table empty={noData}
              headers={[t('admin.searchAdmin.colQuery'), t('admin.searchAdmin.colSearches')]}
              rows={(analytics.zero_result_queries ?? []).map((q) => [q.query, q.searches])} />
          </Section>
          <Section title={t('admin.searchAdmin.reformulations')}>
            {analytics.reformulations_collected === false ? <div style={{ color: '#64748b', fontSize: 13 }}>{unavailable}</div> : (
              <Table empty={noData}
                headers={[t('admin.searchAdmin.colFrom'), t('admin.searchAdmin.colTo'), t('admin.searchAdmin.colCount')]}
                rows={(analytics.reformulations ?? []).map((r) => [r.from_query, r.to_query, r.count])} />
            )}
          </Section>
          <Section title={t('admin.searchAdmin.lowClickProducts')}>
            {!analytics.clicks_collected ? <div style={{ color: '#64748b', fontSize: 13 }}>{unavailable}</div> : (
              <Table empty={noData}
                headers={[t('admin.searchAdmin.colProduct'), t('admin.searchAdmin.colImpressions'), t('admin.searchAdmin.colClicks'), t('admin.searchAdmin.colCtr')]}
                rows={(analytics.low_click_products ?? []).map((p) => [p.name || p.product_id, p.impressions, p.clicks, percent(p.ctr)])} />
            )}
          </Section>
        </>
      )}

      {tab === 'queries' && (
        <div>
          <div style={{ marginBottom: 8, color: '#64748b', fontSize: 12 }}>{t('admin.searchAdmin.queriesLogged', { count: queriesTotal })}</div>
          <Table empty={t('admin.searchAdmin.noQueriesLogged')}
            headers={[t('admin.searchAdmin.colTimestamp'), t('admin.searchAdmin.colQuery'), t('admin.searchAdmin.colNormalized'), t('admin.searchAdmin.colResultsCount'), t('admin.searchAdmin.colMatchMode'), t('admin.searchAdmin.colClicks'), t('admin.searchAdmin.colSearchType')]}
            rows={queries.map((q) => [
              <span style={{ color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(q.created_at).toLocaleString(dateLocale())}</span>,
              <strong>{q.query}</strong>,
              <span style={{ color: '#94a3b8' }}>{q.normalized_query || '—'}</span>,
              <span style={{ color: q.results_count === 0 ? '#ef4444' : '#34d399', fontWeight: 700 }}>{q.results_count}</span>,
              q.match_mode === 'approximate' ? t('admin.searchAdmin.approximate') : q.match_mode ? t('admin.searchAdmin.exact') : '—',
              q.clicks ?? 0,
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, backgroundColor: '#1e293b', color: '#93c5fd' }}>{q.search_type || t('admin.searchAdmin.searchTypeText')}</span>,
            ])} />
        </div>
      )}

      {tab === 'synonyms' && (
        <div>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 4px' }}>{t('admin.searchAdmin.synonymsHelp')}</p>
          <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 12px' }}>{t('admin.searchAdmin.cacheNote')}</p>
          <form onSubmit={addSynonym} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <input className="input" style={{ maxWidth: 220 }} value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('admin.searchAdmin.synonymTerm')} aria-label={t('admin.searchAdmin.synonymTerm')} maxLength={60} required />
            <input className="input" style={{ maxWidth: 220 }} value={group} onChange={(e) => setGroup(e.target.value)} placeholder={t('admin.searchAdmin.synonymGroup')} aria-label={t('admin.searchAdmin.synonymGroup')} maxLength={60} list="search-synonym-groups" required />
            <datalist id="search-synonym-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
            <button type="submit" className="btn btn-primary">{t('admin.searchAdmin.synonymAdd')}</button>
          </form>
          {synonymError && <div role="alert" style={{ color: '#ef4444', fontSize: 13, marginBottom: 8 }}>{synonymError}</div>}
          <Table empty={t('admin.searchAdmin.synonymsEmpty')}
            headers={[t('admin.searchAdmin.synonymGroup'), t('admin.searchAdmin.synonymTerm'), t('admin.searchAdmin.synonymActive'), '']}
            rows={synonyms.map((s) => [
              <strong>{s.canonical_term}</strong>,
              s.term,
              <input type="checkbox" checked={s.active} onChange={() => void toggleSynonym(s)} aria-label={`${t('admin.searchAdmin.synonymActive')} ${s.term}`} />,
              <button type="button" className="btn btn-outline" onClick={() => void deleteSynonym(s)}>{t('admin.searchAdmin.synonymDelete')}</button>,
            ])} />
        </div>
      )}

      {tab === 'analytics' && !analytics && (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('admin.searchAdmin.analyticsNotAvailable')}</div>
      )}
    </div>
  )
}
