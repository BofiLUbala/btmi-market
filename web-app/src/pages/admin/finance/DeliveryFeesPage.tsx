import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi } from '@/api/admin'
import { API_BASE } from '@/api/client'
import { formatMoney } from '@/lib/format'
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
    if (!Number.isFinite(fee) || fee < 0) { setError('Tarif par défaut invalide.'); return }
    const th = threshold.trim() === '' ? null : Number(threshold)
    if (th !== null && (!Number.isFinite(th) || th <= 0)) { setError('Seuil de gratuité invalide (laisser vide pour désactiver).'); return }
    if (reason.trim().length < 5) { setError('Motif obligatoire (5 caractères minimum).'); return }
    void run(() => api.update({ default_fee: fee, ...(th === null ? { clear_threshold: true } : { free_delivery_threshold: th }), reason: reason.trim() }).then((c) => { setReason(''); return c }),
      'Tarif enregistré — appliqué aux prochaines sélections de livraison.')
  }

  const saveZone = () => {
    const fee = Number(zoneFee)
    if (!zoneCity) { setError('Choisissez une ville.'); return }
    if (!Number.isFinite(fee) || fee < 0) { setError('Tarif de ville invalide.'); return }
    if (zoneReason.trim().length < 5) { setError('Motif obligatoire (5 caractères minimum).'); return }
    void run(() => api.upsertZone(zoneCity, fee, true, zoneReason.trim()).then((c) => { setZoneCity(''); setZoneFee(''); setZoneReason(''); return c }), 'Tarif de ville enregistré.')
  }

  const editZone = (z: Zone) => {
    const raw = window.prompt(`Nouveau tarif pour ${z.city_name} (${config?.currency || 'USD'}) :`, String(z.fee))
    if (raw == null) return
    const fee = Number(raw)
    if (!Number.isFinite(fee) || fee < 0) { setError('Tarif de ville invalide.'); return }
    const why = window.prompt('Motif (5 caractères minimum) :')
    if (!why || why.trim().length < 5) return
    void run(() => api.upsertZone(z.city_id, fee, z.active, why.trim()), `Tarif de ${z.city_name} modifié.`)
  }

  const toggleZone = (z: Zone) => {
    const why = window.prompt(`${z.active ? 'Suspendre' : 'Réactiver'} le tarif de ${z.city_name} — motif :`)
    if (!why || why.trim().length < 5) return
    void run(() => api.upsertZone(z.city_id, z.fee, !z.active, why.trim()), `Tarif de ${z.city_name} ${z.active ? 'suspendu' : 'réactivé'}.`)
  }

  const removeZone = (z: Zone) => {
    const why = window.prompt(`Supprimer le tarif de ${z.city_name} (retour au tarif par défaut) — motif :`)
    if (!why || why.trim().length < 5) return
    void run(() => api.deleteZone(z.city_id, why.trim()), `${z.city_name} revient au tarif par défaut.`)
  }

  const cur = config?.currency || 'USD'
  const configured = useMemo(() => new Set(config?.zones.map((z) => z.city_id)), [config])
  const scopeLabel = (h: HistoryItem) => h.scope === 'DEFAULT' ? 'Tarif par défaut' : h.scope === 'THRESHOLD' ? 'Seuil de gratuité' : `Ville · ${h.city_name || '—'}`
  const value = (v: number | null) => (v == null ? '—' : formatMoney(v, cur))

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">{t('admin.layout.navFinance')}</p>
          <h1>Frais de livraison</h1>
          <p>Tarif de la livraison TBK. Il est appliqué au checkout (web et Android), montré aux vendeurs et figé sur chaque commande pour la comptabilité.</p>
        </div>
        <div className="admin-page-actions">
          <button className="admin-button" onClick={() => { void load(); void loadLedger() }} disabled={busy}>Actualiser</button>
        </div>
      </div>

      {error && <div className="admin-alert" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
      {notice && <div className="admin-alert admin-alert-success" role="status">{notice}</div>}

      <section style={card}>
        <h3 style={{ marginTop: 0 }}>Tarif par défaut</h3>
        {config && <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, marginTop: 0 }}>
          Actuel : <strong style={{ color: 'var(--admin-text)' }}>{formatMoney(config.default_fee, cur)}</strong> par commande
          {config.free_delivery_threshold != null && <> · gratuit dès <strong style={{ color: 'var(--admin-text)' }}>{formatMoney(config.free_delivery_threshold, cur)}</strong> de produits</>}
          {' '}· modifié le {new Date(config.updated_at).toLocaleString()}{config.updated_by_name ? ` par ${config.updated_by_name}` : ''}
        </p>}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--admin-text-muted)' }}>Tarif par commande ({cur})
            <input type="number" min={0} step="0.01" value={defaultFee} onChange={(e) => setDefaultFee(e.target.value)} style={{ ...inputStyle, width: 140 }} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--admin-text-muted)' }}>Livraison gratuite dès ({cur}, vide = jamais)
            <input type="number" min={0} step="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)} style={{ ...inputStyle, width: 200 }} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--admin-text-muted)', flex: '1 1 240px' }}>Motif (journalisé)
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. révision tarifaire carburant" style={inputStyle} />
          </label>
          <button className="admin-button admin-button-primary" onClick={saveSettings} disabled={busy}>Enregistrer</button>
        </div>
      </section>

      <section style={card}>
        <h3 style={{ marginTop: 0 }}>Tarifs par ville</h3>
        <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, marginTop: 0 }}>Une ville listée ici remplace le tarif par défaut pour les livraisons vers cette ville.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--admin-text-muted)' }}>Ville
            <select value={zoneCity} onChange={(e) => setZoneCity(e.target.value)} style={{ ...inputStyle, minWidth: 220 }}>
              <option value="">Choisir…</option>
              {cities.filter((c) => !configured.has(c.id)).sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--admin-text-muted)' }}>Tarif ({cur})
            <input type="number" min={0} step="0.01" value={zoneFee} onChange={(e) => setZoneFee(e.target.value)} style={{ ...inputStyle, width: 120 }} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--admin-text-muted)', flex: '1 1 220px' }}>Motif
            <input value={zoneReason} onChange={(e) => setZoneReason(e.target.value)} style={inputStyle} />
          </label>
          <button className="admin-button admin-button-primary" onClick={saveZone} disabled={busy}>Ajouter</button>
        </div>
        {config && config.zones.length === 0 ? <p style={{ color: 'var(--admin-text-muted)', fontSize: 13 }}>Aucune ville particulière : toutes les livraisons utilisent le tarif par défaut.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--admin-text-muted)' }}>
                <th style={{ padding: '8px' }}>Ville</th><th style={{ padding: '8px' }}>Province</th><th style={{ padding: '8px' }}>Tarif</th><th style={{ padding: '8px' }}>Statut</th><th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
              </tr></thead>
              <tbody>
                {config?.zones.map((z) => (
                  <tr key={z.city_id} style={{ borderTop: '1px solid var(--admin-border-soft)' }}>
                    <td style={{ padding: '8px', fontWeight: 700 }}>{z.city_name}</td>
                    <td style={{ padding: '8px' }}>{z.province_name}</td>
                    <td style={{ padding: '8px' }}>{formatMoney(z.fee, cur)}</td>
                    <td style={{ padding: '8px' }}><span className={`admin-status status-${z.active ? 'active' : 'inactive'}`}>{z.active ? 'ACTIF' : 'SUSPENDU'}</span></td>
                    <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="admin-button admin-button-small" onClick={() => editZone(z)}>Modifier</button>{' '}
                      <button className="admin-button admin-button-small" onClick={() => toggleZone(z)}>{z.active ? 'Suspendre' : 'Réactiver'}</button>{' '}
                      <button className="admin-button admin-button-small admin-button-danger" onClick={() => removeZone(z)}>Supprimer</button>
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
          <h3 style={{ margin: 0 }}>Comptabilité des frais de livraison</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(['month', 'all', 'custom'] as const).map((r) => (
              <button key={r} className={`admin-button admin-button-small ${range === r ? 'admin-button-primary' : ''}`} onClick={() => setRange(r)}>
                {r === 'month' ? 'Ce mois' : r === 'all' ? 'Tout' : 'Période'}
              </button>
            ))}
            {range === 'custom' && <>
              <input type="date" aria-label="Du" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
              <input type="date" aria-label="Au" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
            </>}
          </div>
        </div>
        <p style={{ color: 'var(--admin-text-muted)', fontSize: 13 }}>Calculé sur les montants figés de chaque commande livrée par TBK (hors commandes annulées). C'est un revenu TBK (la livraison est assurée par TBK, pas le vendeur) : exclu de la commission vendeur, jamais mélangé à ses ventes. Vue résumée aussi disponible dans l'onglet Aperçu.</p>
        {ledger && <>
          <div className="admin-kpi-grid" style={{ marginBottom: 14 }}>
            {[
              ['Commandes livrées par TBK', String(ledger.orders)],
              ['Frais facturés (brut)', formatMoney(ledger.fees_charged, ledger.currency)],
              ['Remises points', formatMoney(ledger.points_discount, ledger.currency)],
              ['Frais dus par les acheteurs', formatMoney(ledger.fees_billed, ledger.currency)],
              ['Frais encaissés', formatMoney(ledger.fees_collected, ledger.currency)],
              ['Reste à encaisser', formatMoney(ledger.fees_outstanding, ledger.currency)],
              ['Livraisons gratuites', String(ledger.free_deliveries)]
            ].map(([k, v]) => (
              <div key={k} style={{ background: 'var(--admin-surface-2)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>{k}</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{v}</div>
              </div>
            ))}
          </div>
          {ledger.by_city.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--admin-text-muted)' }}><th style={{ padding: 8 }}>Ville de livraison</th><th style={{ padding: 8 }}>Commandes</th><th style={{ padding: 8 }}>Frais dus</th><th style={{ padding: 8 }}>Encaissés</th></tr></thead>
              <tbody>{ledger.by_city.map((r) => (
                <tr key={r.city} style={{ borderTop: '1px solid var(--admin-border-soft)' }}>
                  <td style={{ padding: 8 }}>{r.city}</td><td style={{ padding: 8 }}>{r.orders}</td>
                  <td style={{ padding: 8 }}>{formatMoney(r.fees_billed, ledger.currency)}</td><td style={{ padding: 8 }}>{formatMoney(r.fees_collected, ledger.currency)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </>}
      </section>

      {config?.history && config.history.length > 0 && (
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>Historique des changements</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--admin-text-muted)' }}><th style={{ padding: 6 }}>Date</th><th style={{ padding: 6 }}>Élément</th><th style={{ padding: 6 }}>Ancien → nouveau</th><th style={{ padding: 6 }}>Par</th><th style={{ padding: 6 }}>Motif</th></tr></thead>
            <tbody>{config.history.map((h) => (
              <tr key={h.id} style={{ borderTop: '1px solid var(--admin-border-soft)' }}>
                <td style={{ padding: 6 }}>{new Date(h.created_at).toLocaleString()}</td>
                <td style={{ padding: 6 }}>{scopeLabel(h)}</td>
                <td style={{ padding: 6, fontWeight: 700 }}>{value(h.old_value)} → {value(h.new_value)}</td>
                <td style={{ padding: 6 }}>{h.admin_name || '—'}</td>
                <td style={{ padding: 6, color: 'var(--admin-text-muted)' }}>{h.reason}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}
    </div>
  )
}
