import { useState, useEffect, useCallback } from 'react'
import { adminCommerceApi, type AdminInventoryItem } from '@/api/admin'
import { useT } from '@/store/i18n'
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge'

export default function InventoryListPage() {
  const t = useT()
  const [items, setItems] = useState<AdminInventoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [shopId, setShopId] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [limit] = useState(25)

  const fetchInventory = useCallback(async () => {
    setLoading(true)
    try {
      // The backend's /admin/commerce/inventory endpoint only supports
      // business_id/shop_id/stock_status/limit/offset - there is no
      // server-side "search" or "low_stock_only" filter, so those are
      // applied client-side below instead of being sent to the API.
      const res = await adminCommerceApi.listInventory({
        shop_id: shopId || undefined,
        stock_status: statusFilter || undefined,
        limit,
        offset: page * limit,
      })
      setItems(res.inventory ?? [])
      setTotal(res.total ?? 0)
    } catch (err) {
      console.error('Failed to load inventory', err)
    } finally {
      setLoading(false)
    }
  }, [shopId, statusFilter, page, limit])

  useEffect(() => { fetchInventory() }, [fetchInventory])

  const visibleItems = items.filter((inv) => {
    if (lowStockOnly && inv.stock_status !== 'LOW_STOCK' && inv.stock_status !== 'OUT_OF_STOCK') return false
    if (search) {
      const q = search.toLowerCase()
      if (!inv.product_name?.toLowerCase().includes(q) && !inv.sku?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const totalPages = Math.ceil(total / limit)
  const hasClientFilter = Boolean(search || lowStockOnly)

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

      {hasClientFilter && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 12px',
          borderRadius: 8,
          backgroundColor: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          color: 'var(--admin-info)',
          fontSize: 12,
          marginBottom: 16
        }}>
          <span>{t('admin.inventory.clientFilterNotice')}</span>
          <button
            type="button"
            onClick={() => { setSearch(''); setLowStockOnly(false) }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--admin-text)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {t('common.reset')}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--admin-text-faint)' }}>{t('common.loading')}</div>
      ) : visibleItems.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--admin-text-faint)' }}>{t('admin.inventory.noRecordsFound')}</div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--admin-border-soft)', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border-soft)', backgroundColor: 'var(--admin-surface)' }}>
                {[t('admin.common.shopColumn'), t('admin.inventory.productColumn'), t('admin.inventory.variantSkuColumn'), t('admin.inventory.onHandColumn'), t('admin.inventory.reservedColumn'), t('admin.inventory.availableColumn'), t('common.status'), t('admin.inventory.lastUpdatedColumn')].map(h => (
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
    </div>
  )
}
