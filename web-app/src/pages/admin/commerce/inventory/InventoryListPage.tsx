import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminCommerceApi, type AdminInventoryItem, type StockAnomaly } from '@/api/admin'
import { useT } from '@/store/i18n'
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge'

export default function InventoryListPage() {
  const t = useT()
  const [params] = useSearchParams()
  const [items, setItems] = useState<AdminInventoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [shopId, setShopId] = useState(params.get('shop_id') || '')
  const [search, setSearch] = useState(params.get('search') || '')
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const [statusFilter, setStatusFilter] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [limit] = useState(25)

  const fetchInventory = useCallback(async () => {
    setLoading(true)
    try {
      // Search and "low stock only" run in SQL so they cover every page,
      // not just the rows already loaded.
      const res = await adminCommerceApi.listInventory({
        shop_id: shopId || undefined,
        search: debouncedSearch || undefined,
        stock_status: lowStockOnly && !statusFilter ? 'LOW_OR_OUT' : statusFilter || undefined,
        limit,
        offset: page,
      })
      setItems(res.inventory ?? [])
      setTotal(res.total ?? 0)
    } catch (err) {
      console.error('Failed to load inventory', err)
    } finally {
      setLoading(false)
    }
  }, [shopId, debouncedSearch, statusFilter, lowStockOnly, page, limit])

  useEffect(() => { fetchInventory() }, [fetchInventory])
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(0) }, 350)
    return () => clearTimeout(timer)
  }, [search])

  // Integrity problems (negative or over-reserved stock) found server-side.
  const [anomalies, setAnomalies] = useState<StockAnomaly[]>([])
  const loadAnomalies = useCallback(async () => {
    try { setAnomalies((await adminCommerceApi.listStockAnomalies()) ?? []) } catch { setAnomalies([]) }
  }, [])
  useEffect(() => { void loadAnomalies() }, [loadAnomalies])

  // Audited stock correction: the new on-hand quantity plus a mandatory reason.
  const [adjusting, setAdjusting] = useState<AdminInventoryItem | null>(null)
  const [newQty, setNewQty] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustError, setAdjustError] = useState<string | null>(null)
  const [adjustBusy, setAdjustBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const openAdjust = (inv: AdminInventoryItem) => { setAdjusting(inv); setNewQty(String(inv.quantity)); setAdjustReason(''); setAdjustError(null) }
  const submitAdjust = async () => {
    if (!adjusting) return
    const qty = Number(newQty)
    if (!Number.isInteger(qty) || qty < adjusting.reserved_quantity) { setAdjustError(`Quantité entière ≥ ${adjusting.reserved_quantity} (déjà réservée) requise.`); return }
    if (adjustReason.trim().length < 5) { setAdjustError('Motif obligatoire (5 caractères minimum).'); return }
    setAdjustBusy(true); setAdjustError(null)
    try {
      await adminCommerceApi.adjustStock(adjusting.shop_id, adjusting.variant_id, qty, adjustReason.trim())
      setNotice(`Stock de ${adjusting.product_name} ajusté : ${adjusting.quantity} → ${qty}.`)
      setAdjusting(null)
      await Promise.all([fetchInventory(), loadAnomalies()])
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'Ajustement impossible')
    } finally {
      setAdjustBusy(false)
    }
  }

  // Every filter is applied server-side, so the rows are shown as returned.
  const visibleItems = items

  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', color: 'var(--admin-text)' }}>
          {t('admin.inventory.title')}
        </h2>
        <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, margin: 0 }}>
          {t('admin.inventory.subtitle')}
        </p>
      </div>

      {notice && <div className="admin-alert admin-alert-success" role="status">{notice} <button onClick={() => setNotice(null)} aria-label="Fermer">✕</button></div>}

      {anomalies.length > 0 && (
        <div role="alert" style={{ border: '1px solid #b91c1c', background: 'rgba(127,29,29,.25)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <strong style={{ color: '#fca5a5' }}>{anomalies.length} anomalie(s) de stock détectée(s)</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--admin-text)' }}>
            {anomalies.slice(0, 10).map((a) => (
              <li key={`${a.shop_id}-${a.variant_id}-${a.type}`}>
                <b>{a.type}</b> · {a.shop_name} · {a.product_name} — stock {a.quantity}, réservé {a.reserved_quantity}. {a.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder={t('admin.inventory.searchPlaceholder')}
          aria-label={t('admin.inventory.searchPlaceholder')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          style={{
            flex: '1 1 200px',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--admin-border)',
            backgroundColor: 'var(--admin-surface)',
            color: 'var(--admin-text)',
            fontSize: 13
          }}
        />
        <input
          type="text"
          placeholder={t('admin.common.shopIdPlaceholder')}
          aria-label={t('admin.common.shopIdPlaceholder')}
          value={shopId}
          onChange={(e) => { setShopId(e.target.value); setPage(0) }}
          style={{
            width: 180,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--admin-border)',
            backgroundColor: 'var(--admin-surface)',
            color: 'var(--admin-text)',
            fontSize: 13
          }}
        />
        <select
          value={statusFilter}
          aria-label={t('admin.inventory.allStatusOption')}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--admin-border)',
            backgroundColor: 'var(--admin-surface)',
            color: 'var(--admin-text)',
            fontSize: 13,
            minWidth: 130
          }}
        >
          <option value="">{t('admin.inventory.allStatusOption')}</option>
          <option value="IN_STOCK">{t('admin.inventory.inStockOption')}</option>
          <option value="LOW_STOCK">{t('admin.inventory.lowStockOption')}</option>
          <option value="OUT_OF_STOCK">{t('admin.inventory.outOfStockOption')}</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--admin-text-muted)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={lowStockOnly}
            aria-label={t('admin.inventory.lowStockOnlyLabel')}
            onChange={(e) => { setLowStockOnly(e.target.checked); setPage(0) }}
          />
          {t('admin.inventory.lowStockOnlyLabel')}
        </label>
        <span style={{ color: 'var(--admin-text-faint)', fontSize: 12 }}>
          {t('admin.inventory.itemsCount', { count: total })}
        </span>
      </div>


      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--admin-text-faint)' }}>{t('common.loading')}</div>
      ) : visibleItems.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--admin-text-faint)' }}>{t('admin.inventory.noRecordsFound')}</div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--admin-border-soft)', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border-soft)', backgroundColor: 'var(--admin-surface)' }}>
                {[t('admin.common.shopColumn'), t('admin.inventory.productColumn'), t('admin.inventory.variantSkuColumn'), t('admin.inventory.onHandColumn'), t('admin.inventory.reservedColumn'), t('admin.inventory.availableColumn'), t('common.status'), t('admin.inventory.lastUpdatedColumn'), 'Action'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--admin-text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((inv) => (
                <tr key={inv.inventory_id} style={{ borderBottom: '1px solid var(--admin-border-soft)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--admin-text)', fontWeight: 600, fontSize: 12 }}>{inv.shop_name || inv.shop_id}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--admin-text)' }}>{inv.product_name || '-'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ color: 'var(--admin-text)', fontSize: 12 }}>{inv.variant_name || '-'}</div>
                    <div style={{ color: 'var(--admin-text-faint)', fontSize: 11 }}>{t('admin.inventory.skuLabel', { sku: inv.sku })}</div>
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--admin-text)' }}>{inv.quantity}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--admin-warning)', fontWeight: 600 }}>{inv.reserved_quantity}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: inv.available > 0 ? 'var(--admin-success)' : 'var(--admin-danger)' }}>{inv.available}</td>
                  <td style={{ padding: '10px 12px' }}><AdminStatusBadge status={inv.stock_status} /></td>
                  <td style={{ padding: '10px 12px', color: 'var(--admin-text-faint)', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {inv.updated_at ? new Date(inv.updated_at).toLocaleString() : '-'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button className="admin-button admin-button-small" onClick={() => openAdjust(inv)}>Ajuster</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button
            onClick={() => setPage(Math.max(0, page - limit))}
            disabled={page === 0}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--admin-border)',
              backgroundColor: 'var(--admin-surface)',
              color: page === 0 ? 'var(--admin-text-faint)' : 'var(--admin-text)',
              cursor: page === 0 ? 'default' : 'pointer',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            {t('common.previous')}
          </button>
          <span style={{ padding: '6px 14px', color: 'var(--admin-text-muted)', fontSize: 12 }}>
            {t('admin.common.pageOf', { page: Math.floor(page / limit) + 1, total: totalPages })}
          </span>
          <button
            onClick={() => setPage(Math.min(total - limit, page + limit))}
            disabled={page + limit >= total}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--admin-border)',
              backgroundColor: 'var(--admin-surface)',
              color: page + limit >= total ? 'var(--admin-text-faint)' : 'var(--admin-text)',
              cursor: page + limit >= total ? 'default' : 'pointer',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            {t('common.next')}
          </button>
        </div>
      )}
      {adjusting && (
        <div role="dialog" aria-modal="true" aria-label="Ajuster le stock"
          style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.7)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--admin-surface)', border: '1px solid var(--admin-border)', borderRadius: 12, padding: 20, width: 'min(440px, 100%)' }}>
            <h3 style={{ marginTop: 0 }}>Ajuster le stock</h3>
            <p style={{ color: 'var(--admin-text-muted)', fontSize: 13 }}>
              {adjusting.product_name} · {adjusting.variant_name || adjusting.sku} · {adjusting.shop_name}<br />
              En stock : {adjusting.quantity} · réservé : {adjusting.reserved_quantity}
            </p>
            <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Nouvelle quantité en stock
              <input type="number" min={adjusting.reserved_quantity} step={1} value={newQty} onChange={(e) => setNewQty(e.target.value)}
                style={{ padding: 8, borderRadius: 8, border: '1px solid var(--admin-border)', background: 'var(--admin-surface-2)', color: 'var(--admin-text)' }} />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, marginTop: 10 }}>Motif (journalisé)
              <textarea rows={3} value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}
                style={{ padding: 8, borderRadius: 8, border: '1px solid var(--admin-border)', background: 'var(--admin-surface-2)', color: 'var(--admin-text)' }} />
            </label>
            {adjustError && <p role="alert" style={{ color: '#f87171', fontSize: 13 }}>{adjustError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button className="admin-button" onClick={() => setAdjusting(null)} disabled={adjustBusy}>Annuler</button>
              <button className="admin-button admin-button-primary" onClick={() => void submitAdjust()} disabled={adjustBusy}>{adjustBusy ? '…' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
