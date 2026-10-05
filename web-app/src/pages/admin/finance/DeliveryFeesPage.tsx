import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi } from '@/api/admin'
import { API_BASE } from '@/api/client'
import { dateLocale, formatMoney } from '@/lib/format'
import { useT } from '@/store/i18n'

type Zone = { city_id: string; city_name: string; province_name: string; fee: number; active: boolean; updated_at: string }
type HistoryItem = { id: string; scope: 'DEFAULT' | 'THRESHOLD' | 'CITY'; city_name?: string; old_value: number | null; new_value: number | null; reason: string; admin_name: string; created_at: string }
type Config = {
  default_fee: number
  currency: string
  free_delivery_threshold: number | null
  updated_at: string
  updated_by_name: string
  zones: Zone[]
  history?: HistoryItem[]
}
type Ledger = {
  currency: string
  orders: number
  fees_charged: number
  points_discount: number
  fees_billed: number
  fees_collected: number
  fees_outstanding: number
  free_deliveries: number
  by_city: { city: string; orders: number; fees_billed: number; fees_collected: number }[]
}
type City = { id: string; name: string; province_id: string }

const api = {
  get: () => adminApi<Config>('/admin/finance/delivery-fees'),
  update: (body: { default_fee?: number; free_delivery_threshold?: number; clear_threshold?: boolean; reason: string }) =>
    adminApi<Config>('/admin/finance/delivery-fees', { method: 'PATCH', body: JSON.stringify(body) }),
  upsertZone: (cityId: string, fee: number, active: boolean, reason: string) =>
    adminApi<Config>(`/admin/finance/delivery-fees/zones/${cityId}`, { method: 'PUT', body: JSON.stringify({ fee, active, reason }) }),
  deleteZone: (cityId: string, reason: string) =>
    adminApi<Config>(`/admin/finance/delivery-fees/zones/${cityId}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),
  ledger: (from?: string, to?: string) => {
    const q = new URLSearchParams()
    if (from) q.set('date_from', from)
    if (to) q.set('date_to', to)
    return adminApi<Ledger>(`/admin/finance/delivery-fees/ledger?${q}`)
  }
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const inputStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--admin-border)', background: 'var(--admin-surface-2)', color: 'var(--admin-text)', fontSize: 13 } as const
const card = { background: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 12, padding: 18, marginBottom: 18 } as const

/** Finance-owned TBK delivery tariff. What is saved here is what checkout
 *  charges on the next delivery selection (web and Android), what the seller
 *  sees, and — frozen on each order — what the ledger below sums. */
export default function DeliveryFeesPage() {
  const t = useT()
  const [config, setConfig] = useState<Config | null>(null)
  const [cities, setCities] = useState<City[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [defaultFee, setDefaultFee] = useState('')
  const [threshold, setThreshold] = useState('')
  const [reason, setReason] = useState('')

  const [zoneCity, setZoneCity] = useState('')
  const [zoneFee, setZoneFee] = useState('')
  const [zoneReason, setZoneReason] = useState('')

  const [range, setRange] = useState<'month' | 'all' | 'custom'>('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [ledger, setLedger] = useState<Ledger | null>(null)

  const apply = (c: Config) => {
    setConfig(c)
    setDefaultFee(String(c.default_fee))
    setThreshold(c.free_delivery_threshold != null ? String(c.free_delivery_threshold) : '')
  }

  const load = useCallback(async () => {
    setError(null)
    try { apply(await api.get()) } catch (err) { setError((err as Error).message) }
  }, [])

  const loadLedger = useCallback(async () => {
    const now = new Date()
    const params = range === 'month'
      ? [iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(now)]
      : range === 'custom' ? [from || undefined, to || undefined] : [undefined, undefined]
    try { setLedger(await api.ledger(params[0], params[1])) } catch (err) { setError((err as Error).message) }
  }, [range, from, to])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void loadLedger() }, [loadLedger])
  useEffect(() => {
    fetch(`${API_BASE}/locations/cities`).then((r) => r.json()).then((b) => setCities((b?.items ?? b?.data?.items ?? []) as City[])).catch(() => setCities([]))
  }, [])

  const run = async (action: () => Promise<Config>, success: string) => {
    setBusy(true); setError(null); setNotice(null)
    try { apply(await action()); setNotice(success); void loadLedger() } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  const saveSettings = () => {
    const fee = Number(defaultFee)
    if (!Number.isFinite(fee) || fee < 0) { setError(t('adminFinanceDeliveryFeesPage.invalidDefaultFee')); return }
    const th = threshold.trim() === '' ? null : Number(threshold)
    if (th !== null && (!Number.isFinite(th) || th <= 0)) { setError(t('adminFinanceDeliveryFeesPage.invalidThreshold')); return }
    if (reason.trim().length < 5) { setError(t('adminFinanceDeliveryFeesPage.reasonRequired')); return }
    void run(() => api.update({ default_fee: fee, ...(th === null ? { clear_threshold: true } : { free_delivery_threshold: th }), reason: reason.trim() }).then((c) => { setReason(''); return c }),
      t('adminFinanceDeliveryFeesPage.feeSaved'))
  }

  const saveZone = () => {
    const fee = Number(zoneFee)
    if (!zoneCity) { setError(t('adminFinanceDeliveryFeesPage.chooseCity')); return }
    if (!Number.isFinite(fee) || fee < 0) { setError(t('adminFinanceDeliveryFeesPage.invalidCityFee')); return }
    if (zoneReason.trim().length < 5) { setError(t('adminFinanceDeliveryFeesPage.reasonRequired')); return }
    void run(() => api.upsertZone(zoneCity, fee, true, zoneReason.trim()).then((c) => { setZoneCity(''); setZoneFee(''); setZoneReason(''); return c }), t('adminFinanceDeliveryFeesPage.cityFeeSaved'))
  }

  const editZone = (z: Zone) => {
    const raw = window.prompt(t('adminFinanceDeliveryFeesPage.promptNewFee', { city: z.city_name, currency: config?.currency || 'USD' }), String(z.fee))
    if (raw == null) return
    const fee = Number(raw)
    if (!Number.isFinite(fee) || fee < 0) { setError(t('adminFinanceDeliveryFeesPage.invalidCityFee')); return }
    const why = window.prompt(t('adminFinanceDeliveryFeesPage.promptReason'))
    if (!why || why.trim().length < 5) return
    void run(() => api.upsertZone(z.city_id, fee, z.active, why.trim()), t('adminFinanceDeliveryFeesPage.cityFeeUpdated', { city: z.city_name }))
  }

  const toggleZone = (z: Zone) => {
    const why = window.prompt(t(z.active ? 'adminFinanceDeliveryFeesPage.promptSuspend' : 'adminFinanceDeliveryFeesPage.promptReactivate', { city: z.city_name }))
    if (!why || why.trim().length < 5) return
    void run(() => api.upsertZone(z.city_id, z.fee, !z.active, why.trim()), t(z.active ? 'adminFinanceDeliveryFeesPage.citySuspended' : 'adminFinanceDeliveryFeesPage.cityReactivated', { city: z.city_name }))
  }

  const removeZone = (z: Zone) => {
    const why = window.prompt(t('adminFinanceDeliveryFeesPage.promptRemove', { city: z.city_name }))
    if (!why || why.trim().length < 5) return
    void run(() => api.deleteZone(z.city_id, why.trim()), t('adminFinanceDeliveryFeesPage.cityRemoved', { city: z.city_name }))
  }

  const cur = config?.currency || 'USD'
  const configured = useMemo(() => new Set(config?.zones.map((z) => z.city_id)), [config])
  const scopeLabel = (h: HistoryItem) => h.scope === 'DEFAULT' ? t('adminFinanceDeliveryFeesPage.defaultFee') : h.scope === 'THRESHOLD' ? t('adminFinanceDeliveryFeesPage.freeThreshold') : t('adminFinanceDeliveryFeesPage.scopeCity', { city: h.city_name || '—' })
  const value = (v: number | null) => (v == null ? '—' : formatMoney(v, cur))

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">{t('admin.layout.navFinance')}</p>
          <h1>{t('adminFinanceDeliveryFeesPage.title')}</h1>
          <p>{t('adminFinanceDeliveryFeesPage.subtitle')}</p>
        </div>
        <div className="admin-page-actions">
          <button className="admin-button" onClick={() => { void load(); void loadLedger() }} disabled={busy}>{t('common.refresh')}</button>
        </div>
      </div>

      {error && <div className="admin-alert" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
      {notice && <div className="admin-alert admin-alert-success" role="status">{notice}</div>}

      <section style={card}>
        <h3 style={{ marginTop: 0 }}>{t('adminFinanceDeliveryFeesPage.defaultFee')}</h3>
        {config && <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, marginTop: 0 }}>
          {t('adminFinanceDeliveryFeesPage.current')} <strong style={{ color: 'var(--admin-text)' }}>{formatMoney(config.default_fee, cur)}</strong> {t('adminFinanceDeliveryFeesPage.perOrder')}
          {config.free_delivery_threshold != null && <> · {t('adminFinanceDeliveryFeesPage.freeFrom')} <strong style={{ color: 'var(--admin-text)' }}>{formatMoney(config.free_delivery_threshold, cur)}</strong> {t('adminFinanceDeliveryFeesPage.ofProducts')}</>}
          {' '}· {config.updated_by_name
            ? t('adminFinanceDeliveryFeesPage.updatedAtBy', { date: new Date(config.updated_at).toLocaleString(dateLocale()), name: config.updated_by_name })
            : t('adminFinanceDeliveryFeesPage.updatedAt', { date: new Date(config.updated_at).toLocaleString(dateLocale()) })}
        </p>}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--admin-text-muted)' }}>{t('adminFinanceDeliveryFeesPage.feePerOrderLabel', { currency: cur })}
            <input type="number" min={0} step="0.01" value={defaultFee} onChange={(e) => setDefaultFee(e.target.value)} style={{ ...inputStyle, width: 140 }} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--admin-text-muted)' }}>{t('adminFinanceDeliveryFeesPage.freeFromLabel', { currency: cur })}
            <input type="number" min={0} step="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)} style={{ ...inputStyle, width: 200 }} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--admin-text-muted)', flex: '1 1 240px' }}>{t('adminFinanceDeliveryFeesPage.reasonLogged')}
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('adminFinanceDeliveryFeesPage.reasonPlaceholder')} style={inputStyle} />
          </label>
          <button className="admin-button admin-button-primary" onClick={saveSettings} disabled={busy}>{t('common.save')}</button>
        </div>
      </section>

      <section style={card}>
        <h3 style={{ marginTop: 0 }}>{t('adminFinanceDeliveryFeesPage.cityFeesTitle')}</h3>
        <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, marginTop: 0 }}>{t('adminFinanceDeliveryFeesPage.cityFeesHint')}</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--admin-text-muted)' }}>{t('common.city')}
            <select value={zoneCity} onChange={(e) => setZoneCity(e.target.value)} style={{ ...inputStyle, minWidth: 220 }}>
              <option value="">{t('adminFinanceDeliveryFeesPage.choose')}</option>
              {cities.filter((c) => !configured.has(c.id)).sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--admin-text-muted)' }}>{t('adminFinanceDeliveryFeesPage.feeLabel', { currency: cur })}
            <input type="number" min={0} step="0.01" value={zoneFee} onChange={(e) => setZoneFee(e.target.value)} style={{ ...inputStyle, width: 120 }} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--admin-text-muted)', flex: '1 1 220px' }}>{t('adminFinanceDeliveryFeesPage.reason')}
            <input value={zoneReason} onChange={(e) => setZoneReason(e.target.value)} style={inputStyle} />
          </label>
          <button className="admin-button admin-button-primary" onClick={saveZone} disabled={busy}>{t('adminFinanceDeliveryFeesPage.add')}</button>
        </div>
        {config && config.zones.length === 0 ? <p style={{ color: 'var(--admin-text-muted)', fontSize: 13 }}>{t('adminFinanceDeliveryFeesPage.noCities')}</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--admin-text-muted)' }}>
                <th style={{ padding: '8px' }}>{t('common.city')}</th><th style={{ padding: '8px' }}>{t('adminFinanceDeliveryFeesPage.province')}</th><th style={{ padding: '8px' }}>{t('adminFinanceDeliveryFeesPage.fee')}</th><th style={{ padding: '8px' }}>{t('common.status')}</th><th style={{ padding: '8px', textAlign: 'right' }}>{t('admin.direction.thActions')}</th>
              </tr></thead>
              <tbody>
                {config?.zones.map((z) => (
                  <tr key={z.city_id} style={{ borderTop: '1px solid var(--admin-border-soft)' }}>
                    <td style={{ padding: '8px', fontWeight: 700 }}>{z.city_name}</td>
                    <td style={{ padding: '8px' }}>{z.province_name}</td>
                    <td style={{ padding: '8px' }}>{formatMoney(z.fee, cur)}</td>
                    <td style={{ padding: '8px' }}><span className={`admin-status status-${z.active ? 'active' : 'inactive'}`}>{z.active ? t('adminFinanceDeliveryFeesPage.statusActive') : t('adminFinanceDeliveryFeesPage.statusSuspended')}</span></td>
                    <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="admin-button admin-button-small" onClick={() => editZone(z)}>{t('common.edit')}</button>{' '}
                      <button className="admin-button admin-button-small" onClick={() => toggleZone(z)}>{z.active ? t('admin.direction.suspend') : t('admin.direction.reactivate')}</button>{' '}
                      <button className="admin-button admin-button-small admin-button-danger" onClick={() => removeZone(z)}>{t('common.delete')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>{t('adminFinanceDeliveryFeesPage.ledgerTitle')}</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(['month', 'all', 'custom'] as const).map((r) => (
              <button key={r} className={`admin-button admin-button-small ${range === r ? 'admin-button-primary' : ''}`} onClick={() => setRange(r)}>
                {r === 'month' ? t('adminFinanceDeliveryFeesPage.rangeMonth') : r === 'all' ? t('adminFinanceDeliveryFeesPage.rangeAll') : t('adminFinanceDeliveryFeesPage.rangeCustom')}
              </button>
            ))}
            {range === 'custom' && <>
              <input type="date" aria-label={t('adminFinanceDeliveryFeesPage.from')} value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
              <input type="date" aria-label={t('adminFinanceDeliveryFeesPage.to')} value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
            </>}
          </div>
        </div>
        <p style={{ color: 'var(--admin-text-muted)', fontSize: 13 }}>{t('adminFinanceDeliveryFeesPage.ledgerHint')}</p>
        {ledger && <>
          <div className="admin-kpi-grid" style={{ marginBottom: 14 }}>
            {[
              [t('adminFinanceDeliveryFeesPage.kpiOrders'), String(ledger.orders)],
              [t('adminFinanceDeliveryFeesPage.kpiCharged'), formatMoney(ledger.fees_charged, ledger.currency)],
              [t('adminFinanceDeliveryFeesPage.kpiPoints'), formatMoney(ledger.points_discount, ledger.currency)],
              [t('adminFinanceDeliveryFeesPage.kpiBilled'), formatMoney(ledger.fees_billed, ledger.currency)],
              [t('adminFinanceDeliveryFeesPage.kpiCollected'), formatMoney(ledger.fees_collected, ledger.currency)],
              [t('adminFinanceDeliveryFeesPage.kpiOutstanding'), formatMoney(ledger.fees_outstanding, ledger.currency)],
              [t('adminFinanceDeliveryFeesPage.kpiFree'), String(ledger.free_deliveries)]
            ].map(([k, v]) => (
              <div key={k} style={{ background: 'var(--admin-surface-2)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>{k}</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{v}</div>
              </div>
            ))}
          </div>
          {ledger.by_city.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--admin-text-muted)' }}><th style={{ padding: 8 }}>{t('adminFinanceDeliveryFeesPage.thDeliveryCity')}</th><th style={{ padding: 8 }}>{t('adminFinanceDeliveryFeesPage.thOrders')}</th><th style={{ padding: 8 }}>{t('adminFinanceDeliveryFeesPage.thFeesOwed')}</th><th style={{ padding: 8 }}>{t('adminFinanceDeliveryFeesPage.thCollected')}</th></tr></thead>
              <tbody>{ledger.by_city.map((r) => (
                <tr key={r.city} style={{ borderTop: '1px solid var(--admin-border-soft)' }}>
                  <td style={{ padding: 8 }}>{r.city}</td><td style={{ padding: 8 }}>{r.orders}</td>
                  <td style={{ padding: 8 }}>{formatMoney(r.fees_billed, ledger.currency)}</td><td style={{ padding: 8 }}>{formatMoney(r.fees_collected, ledger.currency)}</td>
                </tr>
              ))}</tbody>
            </table>
            </div>
          )}
        </>}
      </section>

      {config?.history && config.history.length > 0 && (
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>{t('adminFinanceDeliveryFeesPage.historyTitle')}</h3>
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--admin-text-muted)' }}><th style={{ padding: 6 }}>{t('common.date')}</th><th style={{ padding: 6 }}>{t('adminFinanceDeliveryFeesPage.thItem')}</th><th style={{ padding: 6 }}>{t('adminFinanceDeliveryFeesPage.thOldNew')}</th><th style={{ padding: 6 }}>{t('adminFinanceDeliveryFeesPage.thBy')}</th><th style={{ padding: 6 }}>{t('adminFinanceDeliveryFeesPage.reason')}</th></tr></thead>
            <tbody>{config.history.map((h) => (
              <tr key={h.id} style={{ borderTop: '1px solid var(--admin-border-soft)' }}>
                <td style={{ padding: 6 }}>{new Date(h.created_at).toLocaleString(dateLocale())}</td>
                <td style={{ padding: 6 }}>{scopeLabel(h)}</td>
                <td style={{ padding: 6, fontWeight: 700 }}>{value(h.old_value)} → {value(h.new_value)}</td>
                <td style={{ padding: 6 }}>{h.admin_name || '—'}</td>
                <td style={{ padding: 6, color: 'var(--admin-text-muted)' }}>{h.reason}</td>
              </tr>
            ))}</tbody>
          </table>
          </div>
        </section>
      )}
    </div>
  )
}
