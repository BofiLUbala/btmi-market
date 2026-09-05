import { useState, useEffect, useCallback } from 'react'
import { adminCommerceApi, type AdminInventoryItem } from '@/api/admin'
import { useT } from '@/store/i18n'

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
        offset: page,
      })
      setItems(res.inventory)
      setTotal(res.total)
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

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; fg: string }> = {
      IN_STOCK: { bg: '#064e3b', fg: '#a7f3d0' },
      LOW_STOCK: { bg: '#78350f', fg: '#fde68a' },
      OUT_OF_STOCK: { bg: '#7f1d1d', fg: '#fca5a5' },
      RESERVED: { bg: '#1e3a5f', fg: '#93c5fd' },
    }
    const c = colors[status] || { bg: '#334155', fg: '#f1f5f9' }
    return (
      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, backgroundColor: c.bg, color: c.fg }}>
        {status}
      </span>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{t('admin.inventory.title')}</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{t('admin.inventory.subtitle')}</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" placeholder={t('admin.inventory.searchPlaceholder')}
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          style={{ flex: '1 1 200px', padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13 }}
        />
        <input
          type="text" placeholder={t('admin.common.shopIdPlaceholder')}
          value={shopId} onChange={(e) => { setShopId(e.target.value); setPage(0) }}
          style={{ width: 180, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13 }}
        />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13, minWidth: 130 }}
        >
          <option value="">{t('admin.inventory.allStatusOption')}</option>
          <option value="IN_STOCK">{t('admin.inventory.inStockOption')}</option>
          <option value="LOW_STOCK">{t('admin.inventory.lowStockOption')}</option>
          <option value="OUT_OF_STOCK">{t('admin.inventory.outOfStockOption')}</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#94a3b8', cursor: 'pointer' }}>
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => { setLowStockOnly(e.target.checked); setPage(0) }} />
          {t('admin.inventory.lowStockOnlyLabel')}
        </label>
        <span style={{ color: '#64748b', fontSize: 12 }}>{t('admin.inventory.itemsCount', { count: total })}</span>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('common.loading')}</div>
      ) : visibleItems.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('admin.inventory.noRecordsFound')}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {[t('admin.common.shopColumn'), t('admin.inventory.productColumn'), t('admin.inventory.variantSkuColumn'), t('admin.inventory.onHandColumn'), t('admin.inventory.reservedColumn'), t('admin.inventory.availableColumn'), t('common.status'), t('admin.inventory.lastUpdatedColumn')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((inv) => (
                <tr key={inv.inventory_id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '10px 12px', color: '#f8fafc', fontWeight: 600, fontSize: 12 }}>{inv.shop_name || inv.shop_id}</td>
                  <td style={{ padding: '10px 12px', color: '#f8fafc' }}>{inv.product_name || '-'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ color: '#f8fafc', fontSize: 12 }}>{inv.variant_name || '-'}</div>
                    <div style={{ color: '#64748b', fontSize: 11 }}>{t('admin.inventory.skuLabel', { sku: inv.sku })}</div>
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#f8fafc' }}>{inv.quantity}</td>
                  <td style={{ padding: '10px 12px', color: '#fbbf24', fontWeight: 600 }}>{inv.reserved_quantity}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: inv.available > 0 ? '#34d399' : '#ef4444' }}>{inv.available}</td>
                  <td style={{ padding: '10px 12px' }}>{statusBadge(inv.stock_status)}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>
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
          <button onClick={() => setPage(Math.max(0, page - limit))} disabled={page === 0}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#0f172a', color: page === 0 ? '#475569' : '#f8fafc', cursor: page === 0 ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}
          >{t('common.previous')}</button>
          <span style={{ padding: '6px 14px', color: '#94a3b8', fontSize: 12 }}>{t('admin.common.pageOf', { page: Math.floor(page / limit) + 1, total: totalPages })}</span>
          <button onClick={() => setPage(Math.min(total - limit, page + limit))} disabled={page + limit >= total}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#0f172a', color: page + limit >= total ? '#475569' : '#f8fafc', cursor: page + limit >= total ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}
          >{t('common.next')}</button>
        </div>
      )}
    </div>
  )
}
