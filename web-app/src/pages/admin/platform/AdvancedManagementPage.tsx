import { useCallback, useEffect, useState } from 'react'
import { useAdminAuth } from '@/store/adminAuth'
import { adminAdvancedApi, Announcement, ApprovalRequest, ExportJob, MaintenanceState, AnalyticsMetric } from '@/api/admin'
import { useT } from '@/store/i18n'

const CLIENTS = ['WEB', 'ANDROID', 'BUYER', 'SELLER']
const AUDIENCES = ['ALL', 'BUYERS', 'SELLERS', 'EMPLOYEES', 'ADMINS']
/** Datasets each role may export — mirrors exportRoles in the backend. */
const DATASETS: Record<string, string[]> = {
  SUPER_ADMIN: ['USERS', 'BUSINESSES', 'SHOPS', 'PRODUCTS', 'INVENTORY', 'ORDERS', 'CASH_SUMMARIES', 'POINTS_HISTORY', 'REVIEWS', 'CASES', 'RISK_EVENTS', 'AUDIT_LOGS'],
  DIRECTION_ADMIN: ['USERS', 'BUSINESSES', 'AUDIT_LOGS'],
  COMMERCE_ADMIN: ['BUSINESSES', 'SHOPS', 'PRODUCTS', 'INVENTORY', 'ORDERS'],
  FINANCE_SUPPORT_ADMIN: ['ORDERS', 'CASH_SUMMARIES', 'POINTS_HISTORY', 'REVIEWS', 'CASES', 'RISK_EVENTS'],
  TECHNICAL_ADMIN: ['RISK_EVENTS', 'AUDIT_LOGS']
}
const fmtDate = (v?: string) => (v ? new Date(v).toLocaleString('fr-FR') : '—')
/** <input type="datetime-local"> wants local time without seconds or zone. */
const toLocalInput = (v?: string) => {
  if (!v) return ''
  const d = new Date(v)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : undefined)

type Draft = { id?: string; title: string; message: string; audience: string; status: string; starts_at: string; ends_at: string }
const EMPTY_DRAFT: Draft = { title: '', message: '', audience: 'ALL', status: 'DRAFT', starts_at: '', ends_at: '' }

export default function AdvancedManagementPage() {
  const t = useT()
  const { role } = useAdminAuth()
  const dashboard = role === 'COMMERCE_ADMIN' ? 'commerce' : role === 'FINANCE_SUPPORT_ADMIN' ? 'finance' : role === 'TECHNICAL_ADMIN' ? 'technical' : 'direction'
  const canWriteAnnouncements = role === 'SUPER_ADMIN' || role === 'DIRECTION_ADMIN'
  const canWriteMaintenance = role === 'SUPER_ADMIN' || role === 'TECHNICAL_ADMIN'
  const canDecide = role === 'SUPER_ADMIN' || role === 'DIRECTION_ADMIN'
  const datasets = DATASETS[role ?? ''] ?? []

  const [maintenance, setMaintenance] = useState<MaintenanceState>()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [exports, setExports] = useState<ExportJob[]>([])
  const [metrics, setMetrics] = useState<AnalyticsMetric[]>([])
  const [days, setDays] = useState(30)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [reason, setReason] = useState('')
  const [maintMessage, setMaintMessage] = useState('')
  const [maintClients, setMaintClients] = useState<string[]>([])

  const [draft, setDraft] = useState<Draft | null>(null)
  const [dataset, setDataset] = useState('')
  const [exportReason, setExportReason] = useState('')
  const [decisionReason, setDecisionReason] = useState('')

  const load = useCallback(async (silent = false) => {
    if (!silent) setError('')
    try {
      const [m, a, p, e, x] = await Promise.all([
        adminAdvancedApi.maintenance(), adminAdvancedApi.announcements(), adminAdvancedApi.approvals(),
        adminAdvancedApi.exports(), adminAdvancedApi.analytics(dashboard, days)
      ])
      setMaintenance(m); setAnnouncements(a.announcements || []); setApprovals(p.approvals || [])
      setExports(e.exports || []); setMetrics(x.metrics || [])
    } catch (err) { if (!silent) setError((err as Error).message) }
  }, [dashboard, days])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { void load(true) }, 30_000)
    const refresh = () => { if (document.visibilityState === 'visible') void load(true) }
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [load])

  useEffect(() => {
    if (!maintenance) return
    setMaintMessage(maintenance.message || '')
    setMaintClients(maintenance.affected_clients || [])
  }, [maintenance])

  // An export is built in the background; poll quickly until it settles.
  const exportInFlight = exports.some((x) => x.status === 'QUEUED' || x.status === 'RUNNING')
  useEffect(() => {
    if (!exportInFlight) return
    const timer = window.setInterval(() => {
      void adminAdvancedApi.exports().then((e) => setExports(e.exports || [])).catch(() => undefined)
    }, 2000)
    return () => window.clearInterval(timer)
  }, [exportInFlight])

  const run = async (action: () => Promise<unknown>, success: string) => {
    setError(''); setNotice('')
    try { await action(); setNotice(success); await load() } catch (err) { setError((err as Error).message) }
  }

  const changeMaintenance = (status: 'OFF' | 'PARTIAL' | 'FULL') => {
    if (!reason.trim()) { setError(t('admin.advanced.maintenanceReasonRequired')); return }
    if (status === 'FULL' && !window.confirm('Maintenance COMPLÈTE : toutes les apps publiques seront coupées. Confirmer ?')) return
    void run(() => adminAdvancedApi.updateMaintenance({
      status, reason: reason.trim(), message: maintMessage.trim(), affected_clients: maintClients, confirm: status === 'FULL'
    }).then(() => setReason('')), `Maintenance : ${status}`)
  }

  const saveDraft = () => {
    if (!draft) return
    if (!draft.title.trim() || !draft.message.trim()) { setError('Titre et message requis.'); return }
    const body = { title: draft.title.trim(), message: draft.message.trim(), audience: draft.audience, status: draft.status,
      starts_at: fromLocalInput(draft.starts_at), ends_at: fromLocalInput(draft.ends_at) }
    void run(() => (draft.id ? adminAdvancedApi.updateAnnouncement(draft.id, body) : adminAdvancedApi.createAnnouncement(body))
      .then(() => setDraft(null)), draft.status === 'ACTIVE' ? 'Annonce publiée' : 'Annonce enregistrée')
  }

  const setAnnouncementStatus = (a: Announcement, status: string) =>
    void run(() => adminAdvancedApi.updateAnnouncement(a.id, { title: a.title, message: a.message, audience: a.audience, status, starts_at: a.starts_at, ends_at: a.ends_at }),
      status === 'ACTIVE' ? 'Annonce publiée' : status === 'ARCHIVED' ? 'Annonce archivée' : 'Annonce repassée en brouillon')

  const requestExport = () => {
    if (!dataset || exportReason.trim().length < 3) { setError('Choisissez un jeu de données et indiquez un motif.'); return }
    void run(() => adminAdvancedApi.createExport(dataset, exportReason.trim()).then(() => setExportReason('')), `Export ${dataset} demandé`)
  }

  const decide = (a: ApprovalRequest, approve: boolean) => {
    const why = decisionReason.trim() || (approve ? t('admin.advanced.approvedReason') : t('admin.advanced.rejectedReason'))
    void run(() => adminAdvancedApi.decideApproval(a.id, approve, why).then(() => setDecisionReason('')), approve ? 'Demande approuvée' : 'Demande rejetée')
  }

  return (
    <div className="admin-advanced">
      <div className="admin-page-heading">
        <div><p className="admin-eyebrow">{t('admin.advanced.eyebrow')}</p><h1>{t('admin.advanced.title')}</h1><p>{t('admin.advanced.subtitle')}</p></div>
        <button onClick={() => void load()}>{t('admin.advanced.refresh')}</button>
      </div>
      {error && <div className="admin-alert" role="alert">{error}</div>}
      {notice && <div className="admin-alert admin-alert-success" role="status">{notice}</div>}

      <section className="admin-panel">
        <div className="admin-section-title">
          <div><h2>{t('admin.advanced.maintenanceTitle')}</h2><p>{t('admin.advanced.maintenanceDesc')} Appliquée par l’API : PARTIELLE bloque les écritures, COMPLÈTE bloque tout.</p></div>
          <span className={`admin-status status-${maintenance?.status?.toLowerCase()}`}>{maintenance?.status || '—'}</span>
        </div>
        {canWriteMaintenance ? (
          <>
            <textarea aria-label="Message affiché aux utilisateurs" value={maintMessage} onChange={(e) => setMaintMessage(e.target.value)} placeholder="Message affiché aux utilisateurs (bannière)" />
            <div className="admin-actions" role="group" aria-label="Clients concernés">
              {CLIENTS.map((c) => (
                <label key={c} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                  <input type="checkbox" checked={maintClients.includes(c)}
                    onChange={(e) => setMaintClients((cur) => (e.target.checked ? [...cur, c] : cur.filter((x) => x !== c)))} />{c}
                </label>
              ))}
              <span className="admin-muted" style={{ fontSize: 12 }}>(aucun coché = tous les clients)</span>
            </div>
            <textarea aria-label="Motif" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('admin.advanced.maintenanceReasonPlaceholder')} />
            <div className="admin-actions">
              {(['OFF', 'PARTIAL', 'FULL'] as const).map((s) => (
                <button key={s} disabled={!maintenance || (s === maintenance.status && maintMessage === maintenance.message)} onClick={() => changeMaintenance(s)}>{s}</button>
              ))}
            </div>
          </>
        ) : <p className="admin-muted">Lecture seule pour votre rôle.</p>}
        <p className="admin-muted">{t('admin.advanced.affected', { clients: (maintenance?.affected_clients?.length ? maintenance.affected_clients : CLIENTS).join(', ') })}</p>
      </section>

      <section className="admin-panel">
        <div className="admin-section-title">
          <div><h2>{t('admin.advanced.analyticsTitle', { dashboard: dashboard[0].toUpperCase() + dashboard.slice(1) })}</h2><p>{t('admin.advanced.analyticsDesc')}</p></div>
          <select aria-label="Période" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[1, 7, 30, 90].map((x) => <option key={x} value={x}>{x === 1 ? t('admin.advanced.today') : t('admin.advanced.daysOption', { days: x })}</option>)}
          </select>
        </div>
        <div className="admin-metric-grid">
          {metrics.map((m) => (
            <article key={m.key}>
              <span>{m.label}</span>
              <strong>{m.available ? m.value?.toLocaleString() : t('admin.advanced.dataNotAvailable')}</strong>
              <Sparkline points={m.trend} />
              <small>{m.available ? t('admin.advanced.dailyPoints', { count: m.trend.length }) : t('admin.advanced.trackingUnavailable')}</small>
            </article>
          ))}
        </div>
      </section>

      <div className="admin-two-col">
        <section className="admin-panel">
          <div className="admin-section-title">
            <h2>{t('admin.advanced.announcementsTitle')}</h2>
            {canWriteAnnouncements && <button onClick={() => setDraft({ ...EMPTY_DRAFT })}>{t('admin.advanced.newDraft')}</button>}
          </div>
          {draft && (
            <div style={{ display: 'grid', gap: 8, padding: '10px 0' }}>
              <input aria-label="Titre" placeholder="Titre" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={inputStyle} />
              <textarea aria-label="Message" placeholder="Message" value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} />
              <div className="admin-actions">
                <label style={labelStyle}>Audience
                  <select value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value })}>{AUDIENCES.map((a) => <option key={a}>{a}</option>)}</select>
                </label>
                <label style={labelStyle}>Début<input type="datetime-local" value={draft.starts_at} onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })} style={inputStyle} /></label>
                <label style={labelStyle}>Fin<input type="datetime-local" value={draft.ends_at} onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })} style={inputStyle} /></label>
              </div>
              <div className="admin-actions">
                <button onClick={() => { setDraft({ ...draft, status: 'DRAFT' }); }}>Brouillon</button>
                <button onClick={() => setDraft({ ...draft, status: 'ACTIVE' })}>Publier</button>
                <span className="admin-muted" style={{ fontSize: 12 }}>Statut à l’enregistrement : <b>{draft.status}</b></span>
              </div>
              <div className="admin-actions">
                <button onClick={saveDraft}>Enregistrer</button>
                <button onClick={() => setDraft(null)}>Annuler</button>
              </div>
            </div>
          )}
          {announcements.length === 0 ? <p className="admin-empty">{t('admin.advanced.noAnnouncements')}</p> : announcements.map((a) => (
            <article className="admin-list-row" key={a.id}>
              <div>
                <strong>{a.title}</strong>
                <p>{a.message}</p>
                <p>{a.audience} · {fmtDate(a.starts_at)} → {fmtDate(a.ends_at)}</p>
              </div>
              <div className="admin-actions">
                <span className={`admin-status status-${a.status.toLowerCase()}`}>{a.status}</span>
                {canWriteAnnouncements && (
                  <>
                    {a.status !== 'ACTIVE' && <button onClick={() => setAnnouncementStatus(a, 'ACTIVE')}>Publier</button>}
                    {a.status === 'ACTIVE' && <button onClick={() => setAnnouncementStatus(a, 'DRAFT')}>Dépublier</button>}
                    {a.status !== 'ARCHIVED' && <button onClick={() => setAnnouncementStatus(a, 'ARCHIVED')}>Archiver</button>}
                    <button onClick={() => setDraft({ id: a.id, title: a.title, message: a.message, audience: a.audience, status: a.status, starts_at: toLocalInput(a.starts_at), ends_at: toLocalInput(a.ends_at) })}>Modifier</button>
                  </>
                )}
              </div>
            </article>
          ))}
        </section>

        <section className="admin-panel">
          <div className="admin-section-title">
            <h2>{t('admin.advanced.approvalsTitle')}</h2>
            <span>{t('admin.advanced.pendingCount', { count: approvals.filter((x) => x.status === 'PENDING').length })}</span>
          </div>
          {canDecide && approvals.some((x) => x.status === 'PENDING') && (
            <input aria-label="Motif de décision" placeholder="Motif de la décision (optionnel)" value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} style={inputStyle} />
          )}
          {approvals.length === 0 ? <p className="admin-empty">{t('admin.advanced.noApprovals')}</p> : approvals.map((a) => (
            <article className="admin-list-row" key={a.id}>
              <div><strong>{a.action_type}</strong><p>{a.reason}</p><p>{a.target_type} {a.target_id} · {fmtDate(a.created_at)}</p></div>
              {a.status === 'PENDING' && canDecide ? (
                <div className="admin-actions">
                  <button onClick={() => decide(a, true)}>{t('admin.advanced.approve')}</button>
                  <button onClick={() => decide(a, false)}>{t('admin.advanced.reject')}</button>
                </div>
              ) : <span className={`admin-status status-${a.status.toLowerCase()}`}>{a.status}</span>}
            </article>
          ))}
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-section-title"><div><h2>{t('admin.advanced.exportJobsTitle')}</h2><p>{t('admin.advanced.exportJobsDesc')}</p></div></div>
        {datasets.length > 0 && (
          <div className="admin-actions" style={{ marginBottom: 10 }}>
            <select aria-label="Jeu de données" value={dataset} onChange={(e) => setDataset(e.target.value)}>
              <option value="">Jeu de données…</option>
              {datasets.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <input aria-label="Motif de l’export" placeholder="Motif de l’export" value={exportReason} onChange={(e) => setExportReason(e.target.value)} style={{ ...inputStyle, flex: '1 1 220px' }} />
            <button onClick={requestExport}>{t('admin.advanced.requestExport')}</button>
          </div>
        )}
        {exports.length === 0 ? <p className="admin-empty">{t('admin.advanced.noExports')}</p> : exports.map((x) => (
          <article className="admin-list-row" key={x.id}>
            <div>
              <strong>{x.dataset}</strong>
              <p>{fmtDate(x.created_at)}{x.completed_at ? ` → ${fmtDate(x.completed_at)}` : ''}{typeof x.filters?.row_count === 'number' ? ` · ${x.filters.row_count} ligne(s)` : ''}</p>
              {x.error_message && <p style={{ color: '#fca5a5' }}>{x.error_message}</p>}
            </div>
            <div className="admin-actions">
              <span className={`admin-status status-${x.status.toLowerCase()}`}>{x.status}</span>
              {x.status === 'COMPLETED' && (
                <button onClick={() => void adminAdvancedApi.downloadExport(x.id, `${x.dataset}.csv`).catch((err) => setError((err as Error).message))}>Télécharger CSV</button>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}

const inputStyle = { background: '#0b1120', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '8px 10px' }
const labelStyle = { display: 'grid', gap: 4, fontSize: 12, color: '#94a3b8' } as const

/** Daily trend as a tiny inline bar series — the values the metric totals. */
function Sparkline({ points }: { points: { date: string; value: number }[] }) {
  if (!points?.length) return null
  const max = Math.max(1, ...points.map((p) => p.value))
  return (
    <div aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 28 }}>
      {points.map((p) => (
        <span key={p.date} title={`${p.date} : ${p.value}`}
          style={{ flex: 1, minWidth: 1, height: `${Math.max(4, (p.value / max) * 100)}%`, background: p.value > 0 ? '#818cf8' : '#1e293b', borderRadius: 1 }} />
      ))}
    </div>
  )
}
