import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { adminCommerceApi, type AdminBusinessListItem } from '@/api/admin'
import { useT } from '@/store/i18n'
import { EntityStatusDialog, type EntityStatusTarget } from '../shops/EntityStatusDialog'

const LIMIT = 20
const money = (value: number, currency: string) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'USD' }).format(value || 0)

/** Real business entities: the registered name, owner and live counters, read
 *  from /admin/commerce/businesses. Suspending one hides all its shops and
 *  products from the marketplace. */
export default function CommerceBusinessesPage() {
  const t = useT()
  const [items, setItems] = useState<AdminBusinessListItem[]>([])
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
      const res = await adminCommerceApi.listBusinesses({ search: search || undefined, status: status || undefined, limit: LIMIT, offset: page * LIMIT })
      setItems(res.businesses ?? [])
      setTotal(res.total ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [search, status, page])

  useEffect(() => { void fetchData() }, [fetchData])

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">{t('admin.layout.navCommerce')}</p>
          <h1>{t('admin.commerce.businessesTitle')}</h1>
          <p>{total} entreprise(s) enregistrée(s) · données en direct</p>
        </div>
        <div className="admin-page-actions">
          <Link className="admin-button" to="/admin/commerce/shops">Boutiques</Link>
          <button className="admin-button" onClick={() => void fetchData()} disabled={loading}>Actualiser</button>
        </div>
      </div>

      {notice && <div className="admin-alert admin-alert-success" role="status">{notice}</div>}
      {error && <div className="admin-alert" role="alert">{error} <button onClick={() => void fetchData()}>Réessayer</button></div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <input
          aria-label="Rechercher une entreprise"
          placeholder="Nom, e-mail, ville ou propriétaire…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{ flex: '1 1 260px', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--admin-border)', background: 'var(--admin-surface)', color: 'var(--admin-text)' }}
        />
        <select aria-label="Statut" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--admin-border)', background: 'var(--admin-surface)', color: 'var(--admin-text)' }}>
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actives</option>
          <option value="SUSPENDED">Suspendues</option>
          <option value="DEACTIVATED">Désactivées</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)' }}>Chargement…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)', backgroundColor: 'var(--admin-surface)', borderRadius: 10 }}>
          Aucune entreprise ne correspond à ces filtres.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-surface-2)', color: 'var(--admin-text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '12px 14px' }}>Entreprise</th>
                <th style={{ padding: '12px 14px' }}>Propriétaire</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Boutiques</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Produits en ligne</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Commandes</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Ventes terminées</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Statut</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} style={{ borderBottom: '1px solid var(--admin-border-soft)' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--admin-text)' }}>{b.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>{b.business_type} · {b.category || '—'} · {b.city}{b.country ? `, ${b.country}` : ''}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-faint)' }}>{b.email} · {b.phone}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ color: 'var(--admin-text)' }}>{b.owner_name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{b.owner_email}</div>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <Link to={`/admin/commerce/shops?business_id=${b.id}`} style={{ color: 'var(--admin-primary)', fontWeight: 700 }}>
                      {b.active_shop_count}/{b.shop_count}
                    </Link>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>{b.published_product_count}/{b.product_count}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>{b.order_count}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{money(b.completed_sales, b.currency)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span className={`admin-status status-${b.status.toLowerCase()}`}>{b.status}</span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Link className="admin-button admin-button-small" to={`/admin/commerce/products?business_id=${b.id}`}>Produits</Link>{' '}
                    <Link className="admin-button admin-button-small" to={`/admin/commerce/orders?business_id=${b.id}`}>Commandes</Link>{' '}
                    {b.status === 'ACTIVE' ? (
                      <button className="admin-button admin-button-small admin-button-danger"
                        onClick={() => setTarget({ kind: 'BUSINESS', id: b.id, name: b.name, status: 'SUSPENDED' })}>Suspendre</button>
                    ) : (
                      <button className="admin-button admin-button-small"
                        onClick={() => setTarget({ kind: 'BUSINESS', id: b.id, name: b.name, status: 'ACTIVE' })}>Réactiver</button>
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
        <EntityStatusDialog
          target={target}
          onClose={() => setTarget(null)}
          onDone={(message) => { setTarget(null); setNotice(message); void fetchData() }}
        />
      )}
    </div>
  )
}
