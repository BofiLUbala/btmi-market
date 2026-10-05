import { useCallback, useEffect, useMemo, useState } from 'react'
import { inventoryApi, productApi } from '@/api/seller'
import type { Product, ProductVariant, StockReceipt, StockReceiptWithLines } from '@/api/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { dateLocale, formatMoney } from '@/lib/format'
import { useT } from '@/store/i18n'

interface DraftLine {
  key: number
  productId: string
  variantId: string
  quantity: string
  unitCost: string
}

let nextKey = 1
const emptyLine = (): DraftLine => ({ key: nextKey++, productId: '', variantId: '', quantity: '', unitCost: '' })

/**
 * Goods-in notes for the active shop: record a delivery from a supplier as one
 * note with several lines (each line adds to that shop's stock and writes a
 * STOCK_IN movement), and look back at earlier notes line by line.
 */
export function StockReceiptsPanel({ businessId, shopId }: { businessId: string; shopId: string }) {
  const t = useT()
  const [products, setProducts] = useState<Product[]>([])
  const [variants, setVariants] = useState<Record<string, ProductVariant[]>>({})
  const [receipts, setReceipts] = useState<StockReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>(() => [emptyLine()])
  const [saving, setSaving] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, StockReceiptWithLines>>({})

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [p, r] = await Promise.all([
        productApi.listByBusiness(businessId),
        inventoryApi.listReceipts(businessId),
      ])
      setProducts(Array.isArray(p) ? p : [])
      setReceipts((Array.isArray(r) ? r : []).filter((x) => x.shop_id === shopId))
      setError('')
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : t('seller.receipts.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [businessId, shopId, t])

  useEffect(() => { void load() }, [load])

  async function ensureVariants(productId: string): Promise<ProductVariant[]> {
    if (variants[productId]) return variants[productId]
    const list = await productApi.listVariants(businessId, productId)
    const active = (Array.isArray(list) ? list : []).filter((v) => !v.status || v.status === 'ACTIVE')
    setVariants((prev) => ({ ...prev, [productId]: active }))
    return active
  }

  const variantIndex = useMemo(() => {
    const index: Record<string, { product: string; variant: string }> = {}
    for (const p of products) {
      for (const v of variants[p.id] ?? []) index[v.id] = { product: p.name, variant: v.sku || v.name }
    }
    return index
  }, [products, variants])

  function updateLine(key: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  async function pickProduct(key: number, productId: string) {
    updateLine(key, { productId, variantId: '', unitCost: '' })
    if (!productId) return
    try {
      const list = await ensureVariants(productId)
      if (list.length === 1) {
        updateLine(key, { variantId: list[0].id, unitCost: list[0].purchase_price ? String(list[0].purchase_price) : '' })
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('seller.receipts.loadFailed'))
    }
  }

  function pickVariant(line: DraftLine, variantId: string) {
    const v = (variants[line.productId] ?? []).find((x) => x.id === variantId)
    updateLine(line.key, { variantId, unitCost: line.unitCost || (v?.purchase_price ? String(v.purchase_price) : '') })
  }

  const total = lines.reduce((sum, l) => sum + (parseInt(l.quantity, 10) || 0) * (parseFloat(l.unitCost) || 0), 0)
  const currency = products.find((p) => p.id === lines[0]?.productId)?.currency

  async function submit() {
    setFormError('')
    setSuccess('')
    const filled = lines.filter((l) => l.productId || l.variantId || l.quantity)
    if (filled.length === 0) {
      setFormError(t('seller.receipts.needLine'))
      return
    }
    const seen = new Set<string>()
    for (const l of filled) {
      const qty = parseInt(l.quantity, 10)
      const cost = l.unitCost === '' ? 0 : parseFloat(l.unitCost)
      if (!l.variantId) { setFormError(t('seller.receipts.needVariant')); return }
      if (!Number.isInteger(qty) || qty <= 0) { setFormError(t('seller.stockPage.validQty')); return }
      if (isNaN(cost) || cost < 0) { setFormError(t('seller.receipts.invalidCost')); return }
      if (seen.has(l.variantId)) { setFormError(t('seller.receipts.duplicateVariant')); return }
      seen.add(l.variantId)
    }
    setSaving(true)
    try {
      const res = await inventoryApi.receiveStock(businessId, {
        shop_id: shopId,
        reference_number: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        lines: filled.map((l) => ({
          variant_id: l.variantId,
          quantity: parseInt(l.quantity, 10),
          unit_cost: l.unitCost === '' ? 0 : parseFloat(l.unitCost),
        })),
      })
      const units = res.lines.reduce((sum, l) => sum + l.quantity, 0)
      setSuccess(t('seller.receipts.recorded', { lines: res.lines.length, units }))
      setDetails((prev) => ({ ...prev, [res.receipt.id]: res }))
      setReference('')
      setNotes('')
      setLines([emptyLine()])
      await load(true)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('seller.receipts.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function toggle(receipt: StockReceipt) {
    if (openId === receipt.id) { setOpenId(null); return }
    setOpenId(receipt.id)
    if (details[receipt.id]) return
    try {
      const d = await inventoryApi.getReceipt(receipt.id)
      setDetails((prev) => ({ ...prev, [receipt.id]: d }))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('seller.receipts.loadFailed'))
    }
  }

  // Line names come from the variants already loaded; load the rest for an open note.
  useEffect(() => {
    const d = openId ? details[openId] : undefined
    if (!d) return
    const missing = d.lines.some((l) => !variantIndex[l.variant_id])
    if (!missing) return
    for (const p of products) if (!variants[p.id]) void ensureVariants(p.id).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, details, products])

  if (loading) return <LoadingBlock label={t('seller.receipts.loading')} />

  return (
    <div className="stack">
      {error && <ErrorBox error={error} />}
      <Card>
        <h3 style={{ marginTop: 0 }}>{t('seller.receipts.newTitle')}</h3>
        <p className="muted small">{t('seller.receipts.newHint')}</p>
        <div className="row-sm" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
          <input
            className="input"
            aria-label={t('seller.receipts.reference')}
            placeholder={t('seller.receipts.reference')}
            value={reference}
            maxLength={100}
            onChange={(e) => setReference(e.target.value)}
            style={{ flex: '1 1 200px' }}
          />
          <input
            className="input"
            aria-label={t('seller.receipts.notes')}
            placeholder={t('seller.receipts.notes')}
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
            style={{ flex: '2 1 260px' }}
          />
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('product.product')}</th>
                <th>{t('product.variant')}</th>
                <th className="num">{t('seller.receipts.quantity')}</th>
                <th className="num">{t('seller.receipts.unitCost')}</th>
                <th className="num">{t('seller.receipts.lineTotal')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const lineVariants = variants[line.productId] ?? []
                const lineTotal = (parseInt(line.quantity, 10) || 0) * (parseFloat(line.unitCost) || 0)
                return (
                  <tr key={line.key}>
                    <td>
                      <select
                        className="input input-sm"
                        aria-label={t('seller.receipts.productAria', { n: i + 1 })}
                        value={line.productId}
                        onChange={(e) => void pickProduct(line.key, e.target.value)}
                        style={{ minWidth: 180 }}
                      >
                        <option value="">{t('seller.receipts.chooseProduct')}</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select
                        className="input input-sm"
                        aria-label={t('seller.receipts.variantAria', { n: i + 1 })}
                        value={line.variantId}
                        disabled={!line.productId}
                        onChange={(e) => pickVariant(line, e.target.value)}
                        style={{ minWidth: 150 }}
                      >
                        <option value="">{t('seller.receipts.chooseVariant')}</option>
                        {lineVariants.map((v) => <option key={v.id} value={v.id}>{v.sku || v.name}</option>)}
                      </select>
                    </td>
                    <td className="num">
                      <input
                        className="input input-sm"
                        type="number"
                        min="1"
                        step="1"
                        aria-label={t('seller.receipts.quantityAria', { n: i + 1 })}
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                        style={{ width: 80 }}
                      />
                    </td>
                    <td className="num">
                      <input
                        className="input input-sm"
                        type="number"
                        min="0"
                        step="any"
                        aria-label={t('seller.receipts.unitCostAria', { n: i + 1 })}
                        value={line.unitCost}
                        onChange={(e) => updateLine(line.key, { unitCost: e.target.value })}
                        style={{ width: 100 }}
                      />
                    </td>
                    <td className="num">{lineTotal ? formatMoney(lineTotal, currency) : '—'}</td>
                    <td>
                      {lines.length > 1 && (
                        <Button size="sm" variant="outline" onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}>
                          {t('common.remove')}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="row-sm" style={{ justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 12 }}>
          <Button variant="outline" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
            {t('seller.receipts.addLine')}
          </Button>
          <div className="row-sm">
            <strong>{t('seller.receipts.total')}: {formatMoney(total, currency)}</strong>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? t('seller.receipts.saving') : t('seller.receipts.save')}
            </Button>
          </div>
        </div>
        {formError && <div style={{ marginTop: 12 }}><ErrorBox error={formError} /></div>}
        {success && <p role="status" className="success" style={{ marginTop: 12, fontWeight: 600 }}>{success}</p>}
      </Card>

      <Card>
        <h3 style={{ marginTop: 0 }}>{t('seller.receipts.historyTitle')}</h3>
        {receipts.length === 0 ? (
          <p className="muted small" style={{ padding: 16, textAlign: 'center' }}>{t('seller.receipts.none')}</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('seller.receipts.reference')}</th>
                  <th>{t('seller.receipts.notes')}</th>
                  <th>{t('common.status')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => {
                  const d = details[r.id]
                  return [
                    <tr key={r.id}>
                      <td className="small" style={{ whiteSpace: 'nowrap' }}>{new Date(r.received_at || r.created_at).toLocaleString(dateLocale())}</td>
                      <td>{r.reference_number || '—'}</td>
                      <td className="wrap small muted">{r.notes || '—'}</td>
                      <td><span className="badge badge-success">{r.status === 'RECEIVED' ? t('seller.receipts.statusReceived') : r.status}</span></td>
                      <td>
                        <Button size="sm" variant="outline" onClick={() => void toggle(r)} aria-expanded={openId === r.id}>
                          {openId === r.id ? t('seller.receipts.hide') : t('seller.receipts.show')}
                        </Button>
                      </td>
                    </tr>,
                    openId === r.id && (
                      <tr key={`${r.id}-lines`}>
                        <td colSpan={5} style={{ background: 'var(--surface-muted, rgba(0,0,0,.03))' }}>
                          {!d ? <span className="muted small">{t('common.loading')}</span> : (
                            <table className="data-table" style={{ margin: 0 }}>
                              <thead>
                                <tr>
                                  <th>{t('product.product')}</th>
                                  <th>{t('product.variant')}</th>
                                  <th className="num">{t('seller.receipts.quantity')}</th>
                                  <th className="num">{t('seller.receipts.unitCost')}</th>
                                  <th className="num">{t('seller.receipts.lineTotal')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {d.lines.map((l) => (
                                  <tr key={l.id}>
                                    <td>{variantIndex[l.variant_id]?.product ?? '…'}</td>
                                    <td className="small">{variantIndex[l.variant_id]?.variant ?? l.variant_id.slice(0, 8)}</td>
                                    <td className="num">+{l.quantity}</td>
                                    <td className="num">{formatMoney(l.unit_cost)}</td>
                                    <td className="num">{formatMoney(l.unit_cost * l.quantity)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    ),
                  ]
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
