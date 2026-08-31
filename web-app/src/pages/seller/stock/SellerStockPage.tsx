import { useAuth } from '@/store/auth'
import { inventoryApi } from '@/api/seller'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useEffect, useState } from 'react'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'

interface InventoryRow {
  inventory: {
    id: string
    variant_id: string
    quantity: number
    reserved_quantity: number
    available: number
    updated_at: string
  }
  variant?: {
    id: string
    name?: string
    sku?: string
    sale_price?: number
    attribute_values?: Record<string, string>
  }
  product?: {
    id: string
    name: string
  }
}

interface MovementRow {
  id: string
  movement_type: string
  quantity: number
  previous_quantity: number
  new_quantity: number
  notes?: string
  created_at: string
}

export default function SellerStockPage() {
  const t = useT()
  const { activeShop } = useAuth()
  const [tab, setTab] = useState<'inventory' | 'movements'>('inventory')
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [restock, setRestock] = useState<Record<string, string>>({})
  const [actingId, setActingId] = useState<string | null>(null)

  useEffect(() => {
    if (activeShop) {
      load()
    }
  }, [activeShop, tab])

  async function load() {
    if (!activeShop) return
    setLoading(true)
    setError('')
    try {
      if (tab === 'inventory') {
        const data = await inventoryApi.getShopInventory(activeShop)
        setRows(Array.isArray(data) ? data as unknown as InventoryRow[] : [])
      } else {
        const data = await inventoryApi.getStockMovements(activeShop, { limit: 50 })
        setMovements(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('seller.stockPage.loadFailed'))
      setRows([])
      setMovements([])
    } finally {
      setLoading(false)
    }
  }

  async function addStock(row: InventoryRow) {
    if (!activeShop) return
    const qty = parseInt(restock[row.inventory.id], 10)
    if (isNaN(qty) || qty <= 0) {
      setActionError(t('seller.stockPage.validQty'))
      return
    }
    setActingId(row.inventory.id)
    setActionError('')
    try {
      await inventoryApi.addStock(activeShop, {
        variant_id: row.inventory.variant_id,
        quantity: qty,
        notes: t('seller.stockPage.noteWebRestock'),
      })
      setRestock((prev) => ({ ...prev, [row.inventory.id]: '' }))
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('seller.stockPage.addFailed'))
    } finally {
      setActingId(null)
    }
  }

  if (!activeShop) {
    return (
      <div className="seller-stock">
        <div className="page-header">
          <h1>{t('seller.stockPage.title')}</h1>
        </div>
        <Card>
          <h2>{t('seller.stockPage.noShopTitle')}</h2>
          <p className="muted">{t('seller.stockPage.noShopDesc')}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="seller-stock">
      <div className="page-header">
        <h1>{t('seller.stockPage.title')}</h1>
      </div>

      <div className="row-sm mb-4">
        <Button variant={tab === 'inventory' ? 'primary' : 'outline'} onClick={() => setTab('inventory')}>
          {t('seller.stockPage.tabInventory')}
        </Button>
        <Button variant={tab === 'movements' ? 'primary' : 'outline'} onClick={() => setTab('movements')}>
          {t('seller.stockPage.tabMovements')}
        </Button>
      </div>

      {loading ? (
        <LoadingBlock label={t('seller.stockPage.loading')} />
      ) : error ? (
        <ErrorBox error={error} />
      ) : tab === 'inventory' ? (
        <>
          {actionError && <ErrorBox error={actionError} />}
          {rows.length === 0 ? (
            <Card>
              <div className="empty-state" style={{ padding: '48px 0', textAlign: 'center' }}>
                <div className="empty-icon" style={{ fontSize: 48 }}>📦</div>
                <h3>{t('seller.stockPage.noInventoryTitle')}</h3>
                <p className="muted">{t('seller.stockPage.noInventoryDesc')}</p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('product.product')}</th>
                      <th>{t('product.variant')}</th>
                      <th className="num">{t('seller.stockPage.onHand')}</th>
                      <th className="num">{t('points.reserved')}</th>
                      <th className="num">{t('seller.productList.availableLabel')}</th>
                      <th>{t('seller.stockPage.restock')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.inventory.id}>
                        <td className="wrap"><strong>{row.product?.name || row.inventory.variant_id.slice(0, 8)}</strong></td>
                        <td className="wrap small">
                          {row.variant?.sku || row.variant?.name || row.inventory.variant_id.slice(0, 8)}
                          {row.variant?.sale_price != null && (
                            <span className="muted"> · {Number(row.variant.sale_price).toLocaleString()} FC</span>
                          )}
                        </td>
                        <td className="num">{row.inventory.quantity}</td>
                        <td className="num">{row.inventory.reserved_quantity}</td>
                        <td className={`num ${row.inventory.available <= 5 ? 'danger' : 'success'}`}>{row.inventory.available}</td>
                        <td>
                          <div className="row-sm" style={{ flexWrap: 'nowrap' }}>
                            <input
                              className="input input-sm"
                              type="number"
                              min="1"
                              placeholder={t('seller.productDetail.qtyPlaceholder')}
                              aria-label={t('seller.stockPage.restockAria', { product: row.product?.name ?? t('product.variant') })}
                              value={restock[row.inventory.id] ?? ''}
                              onChange={(e) => setRestock((prev) => ({ ...prev, [row.inventory.id]: e.target.value }))}
                              style={{ width: 72 }}
                            />
                            <Button size="sm" disabled={actingId === row.inventory.id} onClick={() => addStock(row)}>
                              {actingId === row.inventory.id ? '…' : t('seller.stockPage.add')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card>
          {movements.length === 0 ? (
            <p className="muted small" style={{ padding: 16, textAlign: 'center' }}>{t('seller.stockPage.noMovements')}</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('seller.onboarding.shopType')}</th>
                    <th className="num">{t('seller.stockPage.change')}</th>
                    <th className="num">{t('common.previous')}</th>
                    <th className="num">{t('seller.stockPage.new')}</th>
                    <th>{t('seller.orders.notesLabel')}</th>
                    <th>{t('common.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td><span className="badge badge-primary">{m.movement_type}</span></td>
                      <td className={`num ${m.quantity > 0 ? 'success' : 'danger'}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                      <td className="num">{m.previous_quantity}</td>
                      <td className="num">{m.new_quantity}</td>
                      <td className="wrap small muted">{m.notes || '—'}</td>
                      <td className="small" style={{ whiteSpace: 'nowrap' }}>{new Date(m.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
