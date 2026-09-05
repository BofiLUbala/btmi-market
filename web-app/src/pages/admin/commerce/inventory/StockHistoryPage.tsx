import { useState, useEffect, useCallback } from 'react'
import { adminCommerceApi, type AdminStockMovementItem } from '@/api/admin'
import { useT } from '@/store/i18n'

export default function StockHistoryPage() {
  const t = useT()
  const [movements, setMovements] = useState<AdminStockMovementItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [shopId, setShopId] = useState('')
  const [variantId, setVariantId] = useState('')
  const [movementType, setMovementType] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(0)
  const [limit] = useState(25)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminCommerceApi.listStockMovementHistory({
        shop_id: shopId || undefined,
        variant_id: variantId || undefined,
        movement_type: movementType || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        limit,
        offset: page,
      })
      setMovements(res.movements)
      setTotal(res.total)
    } catch (err) {
      console.error('Failed to load movement history', err)
    } finally {
      setLoading(false)
    }
  }, [shopId, variantId, movementType, fromDate, toDate, page, limit])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const totalPages = Math.ceil(total / limit)

  const typeColor = (type: string) => {
    const map: Record<string, { bg: string; fg: string }> = {
      ADJUSTMENT: { bg: '#1e3a5f', fg: '#93c5fd' },
      SALE: { bg: '#064e3b', fg: '#a7f3d0' },
      RETURN: { bg: '#78350f', fg: '#fde68a' },
      RESTOCK: { bg: '#064e3b', fg: '#a7f3d0' },
      DAMAGE: { bg: '#7f1d1d', fg: '#fca5a5' },
    }
    const c = map[type] || { bg: '#334155', fg: '#f1f5f9' }
    return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, backgroundColor: c.bg, color: c.fg }}>{type}</span>
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{t('admin.stockHistory.title')}</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{t('admin.stockHistory.subtitle')}</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder={t('admin.common.shopIdPlaceholder')} value={shopId} onChange={(e) => { setShopId(e.target.value); setPage(0) }}
          style={{ width: 150, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13 }} />
        <input placeholder={t('admin.stockHistory.variantIdPlaceholder')} value={variantId} onChange={(e) => { setVariantId(e.target.value); setPage(0) }}
          style={{ width: 150, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13 }} />
        <select value={movementType} onChange={(e) => { setMovementType(e.target.value); setPage(0) }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13, minWidth: 130 }}>
          <option value="">{t('admin.stockHistory.allTypesOption')}</option>
          <option value="ADJUSTMENT">{t('admin.stockHistory.adjustmentOption')}</option>
          <option value="SALE">{t('admin.stockHistory.saleOption')}</option>
          <option value="RETURN">{t('admin.stockHistory.returnOption')}</option>
          <option value="RESTOCK">{t('admin.stockHistory.restockOption')}</option>
          <option value="DAMAGE">{t('admin.stockHistory.damageOption')}</option>
        </select>
        <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(0) }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13 }} />
        <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(0) }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 13 }} />
        <span style={{ color: '#64748b', fontSize: 12 }}>{t('admin.stockHistory.movementsCount', { count: total })}</span>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('common.loading')}</div>
      ) : movements.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('admin.stockHistory.noMovementsFound')}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {[t('admin.stockHistory.timestampColumn'), t('admin.stockHistory.typeColumn'), t('admin.common.shopColumn'), t('admin.stockHistory.variantColumn'), t('admin.stockHistory.skuColumn'), t('admin.stockHistory.beforeColumn'), t('admin.stockHistory.afterColumn'), t('admin.stockHistory.deltaColumn'), t('admin.stockHistory.reasonColumn')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements.map((m, idx) => {
                const delta = m.new_quantity - m.previous_quantity
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(m.created_at).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px' }}>{typeColor(m.movement_type)}</td>
                    <td style={{ padding: '10px 12px', color: '#f8fafc', fontSize: 12 }}>{m.shop_name || m.shop_id}</td>
                    <td style={{ padding: '10px 12px', color: '#f8fafc', fontSize: 12 }}>{m.variant_name || m.product_name}</td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 11 }}>{m.variant_sku || '-'}</td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8', fontWeight: 600 }}>{m.previous_quantity}</td>
                    <td style={{ padding: '10px 12px', color: '#f8fafc', fontWeight: 600 }}>{m.new_quantity}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: delta > 0 ? '#34d399' : delta < 0 ? '#ef4444' : '#94a3b8' }}>
                      {delta > 0 ? '+' : ''}{delta}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.notes || ''}>
                      {m.notes || '-'}
                    </td>
                  </tr>
                )
              })}
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
