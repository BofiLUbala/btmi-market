import { useState, useEffect, useCallback } from 'react'
import {
  adminTechnicalApi,
  type TechnicalOverviewKPIs,
  type GlobalSystemHealth,
  type PostgresHealth,
  type RedisHealth,
  type WorkerMetrics,
  type EmailHealth,
  type MigrationSummary,
  type SecurityEventItem,
  type AdminSessionItem,
  type AppVersionItem,
} from '../../../api/admin'

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color: Record<string, { bg: string; text: string; dot: string }> = {
    HEALTHY:      { bg: '#052e16', text: '#4ade80', dot: '#4ade80' },
    UP_TO_DATE:   { bg: '#052e16', text: '#4ade80', dot: '#4ade80' },
    OK:           { bg: '#052e16', text: '#4ade80', dot: '#4ade80' },
    DEGRADED:     { bg: '#451a03', text: '#fb923c', dot: '#fb923c' },
    DOWN:         { bg: '#3f0a0a', text: '#f87171', dot: '#f87171' },
    UNKNOWN:      { bg: '#1e1b4b', text: '#a5b4fc', dot: '#a5b4fc' },
    NOT_DEPLOYED: { bg: '#1c1917', text: '#a8a29e', dot: '#a8a29e' },
    NOT_CONFIGURED: { bg: '#1c1917', text: '#a8a29e', dot: '#a8a29e' },
    CRITICAL:     { bg: '#3f0a0a', text: '#f87171', dot: '#f87171' },
    WARNING:      { bg: '#451a03', text: '#fb923c', dot: '#fb923c' },
    HIGH:         { bg: '#3f0a0a', text: '#f87171', dot: '#f87171' },
    INFO:         { bg: '#0c1a2e', text: '#60a5fa', dot: '#60a5fa' },
    NEW:          { bg: '#0c1a2e', text: '#60a5fa', dot: '#60a5fa' },
    ACKNOWLEDGED: { bg: '#1e1b4b', text: '#a5b4fc', dot: '#a5b4fc' },
    RESOLVED:     { bg: '#052e16', text: '#4ade80', dot: '#4ade80' },
    IGNORED:      { bg: '#1c1917', text: '#a8a29e', dot: '#a8a29e' },
    APPLIED:      { bg: '#052e16', text: '#4ade80', dot: '#4ade80' },
  }
  const c = color[status] ?? { bg: '#1c1917', text: '#a8a29e', dot: '#a8a29e' }
  return (
    <span style={{ background: c.bg, color: c.text, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, display: 'inline-block' }} />
      {status}
    </span>
  )
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, icon, children, onRefresh }: { title: string; icon: string; children: React.ReactNode; onRefresh?: () => void }) {
  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{icon}</span>{title}
        </h3>
        {onRefresh && (
          <button onClick={onRefresh} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}>
            ↻ Refresh
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, status, icon }: { label: string; value: string | number; status?: string; icon: string }) {
  const isGood = status === 'HEALTHY' || status === 'UP_TO_DATE' || status === 'OK'
  const isBad = status === 'DOWN' || status === 'CRITICAL'
  const borderColor = isBad ? '#7f1d1d' : isGood ? '#134e4a' : '#1e293b'
  return (
    <div style={{ background: '#0f172a', border: `1px solid ${borderColor}`, borderRadius: 12, padding: '14px 18px', minWidth: 0 }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: isBad ? '#f87171' : isGood ? '#4ade80' : '#f1f5f9', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{label}</div>
    </div>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────

function DataTable({ columns, rows }: { columns: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #1e293b' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#1e293b' }}>
            {columns.map((col) => (
              <th key={col} style={{ padding: '8px 12px', color: '#94a3b8', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ padding: 16, textAlign: 'center', color: '#475569' }}>No data</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} style={{ borderTop: '1px solid #1e293b', background: i % 2 === 0 ? 'transparent' : '#0a0f1a' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '7px 12px', color: '#e2e8f0', verticalAlign: 'middle' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function TechnicalDashboardPage() {
  const [kpis, setKpis] = useState<TechnicalOverviewKPIs | null>(null)
  const [health, setHealth] = useState<GlobalSystemHealth | null>(null)
  const [db, setDb] = useState<PostgresHealth | null>(null)
  const [redis, setRedis] = useState<RedisHealth | null>(null)
  const [workers, setWorkers] = useState<WorkerMetrics | null>(null)
  const [email, setEmail] = useState<EmailHealth | null>(null)
  const [migrations, setMigrations] = useState<MigrationSummary | null>(null)
  const [sessions, setSessions] = useState<AdminSessionItem[]>([])
  const [securityEvents, setSecurityEvents] = useState<SecurityEventItem[]>([])
  const [versions, setVersions] = useState<AppVersionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'database' | 'redis' | 'workers' | 'security' | 'sessions' | 'versions'>('overview')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [kpisRes, healthRes, dbRes, redisRes, workersRes, emailRes, migrRes, sessRes, secRes, versRes] = await Promise.allSettled([
        adminTechnicalApi.getOverview(),
        adminTechnicalApi.getSystemHealth(),
        adminTechnicalApi.getPostgresHealth(),
        adminTechnicalApi.getRedisHealth(),
        adminTechnicalApi.getWorkerMetrics(),
        adminTechnicalApi.getEmailHealth(),
        adminTechnicalApi.getMigrationSummary(),
        adminTechnicalApi.getAdminSessions(),
        adminTechnicalApi.getSecurityEvents({ limit: 20 }),
        adminTechnicalApi.getAppVersions(),
      ])
      if (kpisRes.status === 'fulfilled') setKpis(kpisRes.value)
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value)
      if (dbRes.status === 'fulfilled') setDb(dbRes.value)
      if (redisRes.status === 'fulfilled') setRedis(redisRes.value)
      if (workersRes.status === 'fulfilled') setWorkers(workersRes.value)
      if (emailRes.status === 'fulfilled') setEmail(emailRes.value)
      if (migrRes.status === 'fulfilled') setMigrations(migrRes.value)
      if (sessRes.status === 'fulfilled') setSessions(sessRes.value.sessions ?? [])
      if (secRes.status === 'fulfilled') setSecurityEvents(secRes.value.events ?? [])
      if (versRes.status === 'fulfilled') setVersions(versRes.value.versions ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const tabs = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'database', label: '🗄️ Database' },
    { key: 'redis', label: '⚡ Redis' },
    { key: 'workers', label: '⚙️ Workers' },
    { key: 'security', label: '🔐 Security' },
    { key: 'sessions', label: '🔑 Sessions' },
    { key: 'versions', label: '🏷️ Versions' },
  ]

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
          🛡️ Dashboard 4 — Technical &amp; Security
        </h1>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
          Real-time infrastructure observability • Zero credential exposure • RBAC-enforced
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as typeof activeTab)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: '1px solid',
              background: activeTab === t.key ? '#2dd4bf' : '#0f172a',
              color: activeTab === t.key ? '#0f172a' : '#94a3b8',
              borderColor: activeTab === t.key ? '#2dd4bf' : '#1e293b',
            }}
          >
            {t.label}
          </button>
        ))}
        <button onClick={loadAll} disabled={loading} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', marginLeft: 'auto' }}>
          {loading ? '⏳ Loading…' : '↻ Refresh All'}
        </button>
      </div>

      {/* ── OVERVIEW TAB ────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <>
          {/* KPI Grid */}
          {kpis && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
              <KPICard label="API" value={kpis.api_status} status={kpis.api_status} icon="🌐" />
              <KPICard label="PostgreSQL" value={kpis.db_status} status={kpis.db_status} icon="🗄️" />
              <KPICard label="Redis" value={kpis.redis_status} status={kpis.redis_status} icon="⚡" />
              <KPICard label="Workers" value={kpis.worker_status} status={kpis.worker_status} icon="⚙️" />
              <KPICard label="Failed Jobs" value={kpis.failed_jobs_count} icon="❌" />
              <KPICard label="Security Alerts" value={kpis.security_alerts_count} icon="🚨" />
              <KPICard label="Active Sessions" value={kpis.active_sessions_count} icon="🔑" />
              <KPICard label="Backup" value={kpis.backup_status} status={kpis.backup_status === 'OK' ? 'HEALTHY' : 'NOT_CONFIGURED'} icon="💾" />
              <KPICard label="Migrations" value={kpis.migration_status} status={kpis.migration_status === 'UP_TO_DATE' ? 'HEALTHY' : 'WARNING'} icon="🔄" />
              <KPICard label="Web Version" value={kpis.web_version || '—'} icon="🌐" />
              <KPICard label="Android Version" value={kpis.android_version || '—'} icon="📱" />
            </div>
          )}

          {/* Services Health Grid */}
          {health && (
            <SectionCard title="Service Health Fan-Out" icon="🏥" onRefresh={loadAll}>
              <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <StatusBadge status={health.overall_status} />
                <span style={{ fontSize: 12, color: '#64748b' }}>Checked {new Date(health.checked_at).toLocaleTimeString()}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {health.services.map((svc) => (
                  <div key={svc.service_name} style={{ background: '#1e293b', borderRadius: 10, padding: 14, border: `1px solid ${svc.status === 'DOWN' ? '#7f1d1d' : svc.status === 'HEALTHY' ? '#134e4a' : '#374151'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 13 }}>{svc.service_name}</span>
                      <StatusBadge status={svc.status} />
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Latency: {svc.latency_ms}ms</div>
                    {svc.error_message_summary && (
                      <div style={{ fontSize: 11, color: '#f87171', marginTop: 4, wordBreak: 'break-word' }}>{svc.error_message_summary}</div>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Migrations overview */}
          {migrations && (
            <SectionCard title="Schema Migrations" icon="🔄">
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Current: <strong style={{ color: '#f1f5f9' }}>{migrations.current_version}</strong></div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Applied: <strong style={{ color: '#4ade80' }}>{migrations.applied_count}</strong></div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Pending: <strong style={{ color: migrations.pending_count > 0 ? '#fb923c' : '#4ade80' }}>{migrations.pending_count}</strong></div>
              </div>
              <DataTable
                columns={['Version', 'Name', 'Status', 'Applied At']}
                rows={(migrations.applied_migrations ?? []).slice(-5).reverse().map((m) => [
                  m.version,
                  m.name,
                  <StatusBadge key={m.version} status={m.status} />,
                  new Date(m.applied_at).toLocaleString()
                ])}
              />
            </SectionCard>
          )}

          {/* Email health */}
          {email && (
            <SectionCard title="SMTP / Email Health" icon="📧">
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>SMTP: <StatusBadge status={email.smtp_reachable ? 'HEALTHY' : 'DOWN'} /></div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Queued: <strong style={{ color: '#f1f5f9' }}>{email.queued_emails}</strong></div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Recent Failures: <strong style={{ color: email.recent_failures_count > 0 ? '#f87171' : '#4ade80' }}>{email.recent_failures_count}</strong></div>
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* ── DATABASE TAB ────────────────────────────────────────────────── */}
      {activeTab === 'database' && db && (
        <SectionCard title="PostgreSQL Health" icon="🗄️" onRefresh={() => adminTechnicalApi.getPostgresHealth().then(setDb)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            <KPICard label="Status" value={db.reachable ? 'HEALTHY' : 'DOWN'} status={db.reachable ? 'HEALTHY' : 'DOWN'} icon="✅" />
            <KPICard label="Total Connections" value={db.connection_count} icon="🔗" />
            <KPICard label="Active" value={db.active_connections} icon="▶️" />
            <KPICard label="Idle" value={db.idle_connections} icon="⏸️" />
            <KPICard label="DB Size" value={db.database_size_formatted || '—'} icon="💾" />
            <KPICard label="Migration" value={db.migration_version} icon="🔄" />
          </div>

          {db.long_running_queries && db.long_running_queries.length > 0 ? (
            <>
              <h4 style={{ fontSize: 13, color: '#fb923c', margin: '0 0 10px' }}>⚠️ Long-Running Queries (&gt;5s)</h4>
              <DataTable
                columns={['PID', 'Duration', 'State', 'Query (sanitized)']}
                rows={db.long_running_queries.map((q) => [
                  String(q.pid),
                  `${q.duration_seconds.toFixed(1)}s`,
                  q.state,
                  <code key={q.pid} style={{ fontSize: 10, color: '#94a3b8', wordBreak: 'break-all' }}>{q.query_sanitized}</code>
                ])}
              />
            </>
          ) : (
            <div style={{ color: '#4ade80', fontSize: 13 }}>✅ No long-running queries detected</div>
          )}
        </SectionCard>
      )}

      {/* ── REDIS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'redis' && redis && (
        <SectionCard title="Redis Cache Health" icon="⚡" onRefresh={() => adminTechnicalApi.getRedisHealth().then(setRedis)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            <KPICard label="Status" value={redis.reachable ? 'HEALTHY' : 'DOWN'} status={redis.reachable ? 'HEALTHY' : 'DOWN'} icon="✅" />
            <KPICard label="Latency" value={`${redis.latency_ms}ms`} icon="⚡" />
            <KPICard label="Memory Used" value={redis.memory_used_formatted || '—'} icon="💾" />
            <KPICard label="Keys" value={redis.key_count} icon="🔑" />
            <KPICard label="Connected Clients" value={redis.connected_clients} icon="👥" />
            <KPICard label="Evictions" value={redis.eviction_count} icon="♻️" />
            <KPICard label="Cache Hit Rate" value={`${redis.cache_hit_rate.toFixed(1)}%`} icon="🎯" />
          </div>
        </SectionCard>
      )}

      {/* ── WORKERS TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'workers' && workers && (
        <SectionCard title="Background Workers (Asynq)" icon="⚙️" onRefresh={() => adminTechnicalApi.getWorkerMetrics().then(setWorkers)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
            <KPICard label="Queued" value={workers.queued_jobs} icon="📋" />
            <KPICard label="Active" value={workers.active_jobs} icon="▶️" />
            <KPICard label="Failed" value={workers.failed_jobs} icon="❌" />
            <KPICard label="Retrying" value={workers.retrying_jobs} icon="🔄" />
            <KPICard label="Dead" value={workers.dead_jobs} icon="☠️" />
          </div>
          {workers.queue_stats && workers.queue_stats.length > 0 && (
            <DataTable
              columns={['Queue', 'Pending', 'Processing', 'Failed']}
              rows={workers.queue_stats.map((q) => [
                q.queue_name,
                String(q.pending_count),
                String(q.processing_count),
                <span key={q.queue_name} style={{ color: q.failed_count > 0 ? '#f87171' : '#4ade80' }}>{q.failed_count}</span>
              ])}
            />
          )}
          {(!workers.queue_stats || workers.queue_stats.length === 0) && (
            <div style={{ color: '#4ade80', fontSize: 13 }}>✅ All queues idle — no active jobs</div>
          )}
        </SectionCard>
      )}

      {/* ── SECURITY TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <SectionCard title="Security Events" icon="🔐" onRefresh={() => adminTechnicalApi.getSecurityEvents({ limit: 20 }).then((r) => setSecurityEvents(r.events ?? []))}>
          <DataTable
            columns={['Severity', 'Event Type', 'IP', 'Status', 'Time']}
            rows={securityEvents.map((e) => [
              <StatusBadge key={e.id} status={e.severity} />,
              e.event_type,
              e.ip_address || '—',
              <StatusBadge key={`s-${e.id}`} status={e.status} />,
              new Date(e.created_at).toLocaleString()
            ])}
          />
          {securityEvents.length === 0 && !loading && (
            <div style={{ color: '#4ade80', fontSize: 13, marginTop: 8 }}>✅ No security events recorded</div>
          )}
        </SectionCard>
      )}

      {/* ── SESSIONS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'sessions' && (
        <SectionCard title="Active Admin Sessions" icon="🔑" onRefresh={() => adminTechnicalApi.getAdminSessions().then((r) => setSessions(r.sessions ?? []))}>
          <div style={{ marginBottom: 10, color: '#64748b', fontSize: 12 }}>
            {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
          </div>
          <DataTable
            columns={['Admin Email', 'Role', 'IP', 'Device', 'Created', 'Expires']}
            rows={sessions.map((s) => [
              s.admin_email,
              <span key={s.session_id} style={{ fontSize: 11, color: '#2dd4bf', background: '#134e4a', padding: '2px 6px', borderRadius: 4 }}>{s.admin_role}</span>,
              s.ip_address,
              <span key={`d-${s.session_id}`} style={{ fontSize: 10, color: '#64748b', wordBreak: 'break-all' }}>{s.device_info.substring(0, 30)}…</span>,
              new Date(s.created_at).toLocaleDateString(),
              new Date(s.expires_at).toLocaleDateString()
            ])}
          />
        </SectionCard>
      )}

      {/* ── VERSIONS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'versions' && (
        <SectionCard title="App Version Control" icon="🏷️" onRefresh={() => adminTechnicalApi.getAppVersions().then((r) => setVersions(r.versions ?? []))}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {versions.map((v) => (
              <div key={v.id} style={{ background: '#1e293b', borderRadius: 12, padding: 16, border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
                    {v.platform === 'WEB' ? '🌐' : v.platform === 'ANDROID' ? '📱' : '🔌'} {v.platform}
                  </h4>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Updated {new Date(v.updated_at).toLocaleDateString()}</span>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>Current: <strong style={{ color: '#2dd4bf' }}>{v.current_version}</strong></div>
                  <div>Min Supported: <strong style={{ color: '#f1f5f9' }}>{v.min_supported_version}</strong></div>
                  <div>Recommended: <strong style={{ color: '#f1f5f9' }}>{v.recommended_version}</strong></div>
                </div>
              </div>
            ))}
          </div>
          {versions.length === 0 && (
            <div style={{ color: '#64748b', fontSize: 13 }}>No version configs found</div>
          )}
        </SectionCard>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b', fontSize: 14 }}>
          ⏳ Loading technical data…
        </div>
      )}
    </div>
  )
}
