import { useState } from 'react'
import { adminPresenceApi, type PresenceSnapshot } from '@/api/admin'
import { useT } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'
import { RoleBadge, cell, deviceLabel, headRow, tableBox, useLiveReload } from './monitoringShared'

const STATUS: Record<string, { key: TranslationKey; color: string }> = {
  SIGNED_IN: { key: 'admin.presence.status.SIGNED_IN', color: '#22c55e' },
  KNOWN_SIGNED_OUT: { key: 'admin.presence.status.KNOWN_SIGNED_OUT', color: '#f59e0b' },
  ANONYMOUS: { key: 'admin.presence.status.ANONYMOUS', color: '#64748b' },
}

const PAGES: Record<string, TranslationKey> = {
  home: 'admin.presence.page.home',
  product: 'admin.presence.page.product',
  shop: 'admin.presence.page.shop',
  browse: 'admin.presence.page.browse',
  checkout: 'admin.presence.page.checkout',
  account: 'admin.presence.page.account',
  seller: 'admin.presence.page.seller',
  courier: 'admin.presence.page.courier',
  auth: 'admin.presence.page.auth',
  other: 'admin.presence.page.other',
}

/** How long a visitor has been here: "45 s", "12 min", "1 h 05". */
function since(date: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

/**
 * Everyone on the site or in the app right now, signed in or not, and the page
 * they are on. Fed by the heartbeat every open tab and app sends; refreshed live.
 */
export function LivePresencePanel() {
  const t = useT()
  const [data, setData] = useState<PresenceSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'' | 'SIGNED_IN' | 'KNOWN_SIGNED_OUT' | 'ANONYMOUS'>('')

  async function load() {
    try {
      setData(await adminPresenceApi.live())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.monitoring.loadFailed'))
    }
  }
  useLiveReload(async () => load(), [])

  const s = data?.summary
  const visitors = (data?.visitors ?? []).filter((v) => !filter || v.status === filter)
  const cards: Array<{ key: typeof filter; label: string; value: number | string; color: string }> = [
    { key: '', label: t('admin.presence.total'), value: s?.total ?? '…', color: '#38bdf8' },
    { key: 'SIGNED_IN', label: t('admin.presence.status.SIGNED_IN'), value: s?.signed_in ?? '…', color: '#22c55e' },
    { key: 'KNOWN_SIGNED_OUT', label: t('admin.presence.status.KNOWN_SIGNED_OUT'), value: s?.known_signed_out ?? '…', color: '#f59e0b' },
    { key: 'ANONYMOUS', label: t('admin.presence.status.ANONYMOUS'), value: s?.anonymous ?? '…', color: '#94a3b8' },
  ]

  return (
    <section aria-labelledby="live-presence-title" style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <h2 id="live-presence-title" style={{ fontSize: 18, margin: 0, color: '#fff' }}>{t('admin.presence.title')}</h2>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#86efac' }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: '#22c55e' }} />
          {t('admin.presence.live')}
        </span>
      </div>
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>{t('admin.presence.hint', { seconds: data?.heartbeat_seconds ?? 30 })}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 12 }}>
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => setFilter(c.key)}
            aria-pressed={filter === c.key}
            style={{
              textAlign: 'left', cursor: 'pointer', backgroundColor: '#0f172a', borderRadius: 12, padding: 14,
              border: `1px solid ${filter === c.key ? c.color : '#1e293b'}`,
            }}
          >
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.color, marginTop: 2 }}>{c.value}</div>
          </button>
        ))}
      </div>

      {s && s.total > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, fontSize: 12 }}>
          {Object.entries(s.by_page).sort((a, b) => b[1] - a[1]).map(([page, n]) => (
            <span key={page} style={{ padding: '4px 10px', borderRadius: 999, backgroundColor: '#1e293b', color: '#cbd5e1' }}>
              {PAGES[page] ? t(PAGES[page]) : page} · <strong style={{ color: '#fff' }}>{n}</strong>
            </span>
          ))}
          {Object.entries(s.by_platform).map(([platform, n]) => (
            <span key={platform} style={{ padding: '4px 10px', borderRadius: 999, backgroundColor: '#172554', color: '#bfdbfe' }}>
              {platform === 'android' ? 'App Android' : platform === 'ios' ? 'App iOS' : 'Web'} · <strong style={{ color: '#fff' }}>{n}</strong>
            </span>
          ))}
        </div>
      )}

      {error && (
        <div role="alert" style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d', color: '#fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>{error}</div>
      )}
      <div style={tableBox}>
        <table style={{ width: '100%', minWidth: 940, borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={headRow}>
              <th style={cell}>{t('admin.presence.thVisitor')}</th>
              <th style={cell}>{t('admin.monitoring.thStatus')}</th>
              <th style={cell}>{t('admin.presence.thPage')}</th>
              <th style={cell}>{t('admin.presence.thOnSite')}</th>
              <th style={cell}>{t('admin.monitoring.thDevice')}</th>
              <th style={cell}>{t('admin.monitoring.thIp')}</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={6} style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>{t('common.loading')}</td></tr>
            ) : visitors.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>{t('admin.presence.none')}</td></tr>
            ) : visitors.map((v) => {
              const st = STATUS[v.status] ?? STATUS.ANONYMOUS
              return (
                <tr key={v.visitor_id} style={{ borderBottom: '1px solid #1e293b', verticalAlign: 'top' }}>
                  <td style={cell}>
                    {v.email ? (
                      <>
                        <div style={{ fontWeight: 700, color: '#fff' }}>{v.name || v.email}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{v.email}</div>
                        {v.role && <div style={{ marginTop: 4 }}><RoleBadge role={v.role} /></div>}
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 700, color: '#cbd5e1' }}>{t('admin.presence.anonymousVisitor')}</div>
                        <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>#{v.visitor_id.slice(0, 8)}</div>
                      </>
                    )}
                  </td>
                  <td style={cell}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: st.color }}>
                      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: st.color }} />
                      {t(st.key)}
                    </span>
                    {v.background && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{t('admin.presence.background')}</div>}
                  </td>
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: 12, color: '#e2e8f0' }}>{v.path}</td>
                  <td style={{ ...cell, fontSize: 12, color: '#cbd5e1', whiteSpace: 'nowrap' }} title={new Date(v.first_seen_at).toLocaleString('fr-FR')}>
                    {since(v.first_seen_at)}
                  </td>
                  <td style={{ ...cell, fontSize: 12, color: '#94a3b8' }} title={v.user_agent}>
                    {v.platform === 'android' ? 'App Android' : deviceLabel(v.user_agent)}
                  </td>
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: 12, color: '#cbd5e1' }}>{v.ip_address || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
