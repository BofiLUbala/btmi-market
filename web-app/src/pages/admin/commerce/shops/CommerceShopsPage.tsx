import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { adminCommerceApi, type AdminShopListItem } from '@/api/admin'
import { useT } from '@/store/i18n'
import { EntityStatusDialog, type EntityStatusTarget } from './EntityStatusDialog'

const LIMIT = 20

/** Every shop with its owning business and live activity, from
 *  /admin/commerce/shops. `?business_id=` scopes it to one business. */
export default function CommerceShopsPage() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  const businessId = params.get('business_id') || ''
  const [items, setItems] = useState<AdminShopListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [target, setTarget] = useState<EntityStatusTarget | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput.trim()); setPage(0) }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminCommerceApi.listShops({ search: search || undefined, status: status || undefined, business_id: businessId || undefined, limit: LIMIT, offset: page * LIMIT })
      setItems(res.shops ?? [])
      setTotal(res.total ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [search, status, businessId, page])

  useEffect(() => { void fetchData() }, [fetchData])

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))
  const scopedTo = businessId ? items[0]?.business_name : ''

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">{t('admin.layout.navCommerce')}</p>
          <h1>{t('admin.layout.itemShops')}</h1>
          <p>{total} boutique(s){scopedTo ? ` · ${scopedTo}` : ''} · données en direct</p>
        </div>
        <div className="admin-page-actions">
          {businessId && <button className="admin-button" onClick={() => { params.delete('business_id'); setParams(params) }}>Toutes les entreprises</button>}
          <Link className="admin-button" to="/admin/commerce/performance/shops">Performance</Link>
          <button className="admin-button" onClick={() => void fetchData()} disabled={loading}>Actualiser</button>
        </div>
      </div>

      {notice && <div className="admin-alert admin-alert-success" role="status">{notice}</div>}
      {error && <div className="admin-alert" role="alert">{error} <button onClick={() => void fetchData()}>Réessayer</button></div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <input aria-label="Rechercher une boutique" placeholder="Boutique, entreprise ou ville…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
          style={{ flex: '1 1 260px', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--admin-border)', background: 'var(--admin-surface)', color: 'var(--admin-text)' }} />
        <select aria-label="Statut" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--admin-border)', background: 'var(--admin-surface)', color: 'var(--admin-text)' }}>
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actives</option>
          <option value="INACTIVE">Inactives</option>
          <option value="SUSPENDED">Suspendues</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)' }}>Chargement…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)', backgroundColor: 'var(--admin-surface)', borderRadius: 10 }}>
          Aucune boutique ne correspond à ces filtres.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-surface-2)', color: 'var(--admin-text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '12px 14px' }}>Boutique</th>
                <th style={{ padding: '12px 14px' }}>Entreprise</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Produits</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Unités dispo.</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Commandes (en cours)</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Avis</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Statut</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--admin-border-soft)' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--admin-text)' }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>{s.type} · {s.city || '—'} · {s.phone || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-faint)' }}>
                      Livraison : {[s.supports_shop_delivery && 'boutique', s.supports_partner_delivery && 'partenaire'].filter(Boolean).join(', ') || 'retrait uniquement'}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div>{s.business_name}</div>
                    {s.business_status !== 'ACTIVE' && <span className={`admin-status status-${s.business_status.toLowerCase()}`}>Entreprise {s.business_status}</span>}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>{s.product_count}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', color: s.available_units > 0 ? 'inherit' : '#f87171' }}>{s.available_units}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>{s.order_count} ({s.open_order_count})</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>{s.review_count > 0 ? `★ ${s.review_score.toFixed(1)} (${s.review_count})` : '—'}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}><span className={`admin-status status-${s.status.toLowerCase()}`}>{s.status}</span></td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Link className="admin-button admin-button-small" to={`/admin/commerce/inventory?shop_id=${s.id}`}>Stock</Link>{' '}
                    <Link className="admin-button admin-button-small" to={`/admin/commerce/orders?shop_id=${s.id}`}>Commandes</Link>{' '}
                    {s.status === 'ACTIVE' ? (
                      <button className="admin-button admin-button-small admin-button-danger" onClick={() => setTarget({ kind: 'SHOP', id: s.id, name: s.name, status: 'SUSPENDED' })}>Suspendre</button>
                    ) : (
                      <button className="admin-button admin-button-small" onClick={() => setTarget({ kind: 'SHOP', id: s.id, name: s.name, status: 'ACTIVE' })}>Réactiver</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <button className="admin-button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Précédent</button>
          <span style={{ color: 'var(--admin-text-muted)', fontSize: 13 }}>Page {page + 1} / {totalPages}</span>
          <button className="admin-button" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Suivant</button>
        </div>
      )}

      {target && (
        <EntityStatusDialog target={target} onClose={() => setTarget(null)} onDone={(m) => { setTarget(null); setNotice(m); void fetchData() }} />
      )}
    </div>
  )
}
