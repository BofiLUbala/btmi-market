import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { useI18n } from '@/store/i18n'
import { inventoryApi, productImageApi, shopApi } from '@/api/seller'
import type { InventoryItem, Product, ProductImageResponse, ProductVariant, Shop } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import type { TranslationKey } from '@/locales/fr'

type Availability = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
type StockState = 'out' | 'low' | 'in'
type ShopInventoryRow = { inventory: InventoryItem; variant: ProductVariant; product: Product }
interface ShopProductRow { product: Product; variants: ShopInventoryRow[]; image?: ProductImageResponse; total: number; reserved: number; available: number }

const availableOf = (i: InventoryItem) => Number(i.available)
/** Returns the state key rather than a label, so the caller translates it and
 *  the CSS class stays a stable, language-independent identifier. */
const stockStatus = (available: number): StockState =>
  available <= 0 ? 'out' : available <= 5 ? 'low' : 'in'
/** The stylesheet keys these off the original English wording; keep the class
 *  names as they are so the existing styles keep matching. */
const STOCK_STATE_CLASS: Record<StockState, string> = {
  out: 'out-of-stock',
  low: 'low-stock',
  in: 'in-stock',
}

export default function ShopProductsPage() {
  const { shopId = '' } = useParams()
  const navigate = useNavigate()
  const { activeBusiness } = useAuth()
  const { t } = useI18n()
  const [shop, setShop] = useState<Shop | null>(null)
  const [rows, setRows] = useState<ShopProductRow[]>([])
  const [category, setCategory] = useState('all')
  const [availability, setAvailability] = useState<Availability>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [restock, setRestock] = useState<Record<string, string>>({})
  const [busyVariant, setBusyVariant] = useState<string | null>(null)

  const variantLabel = (variant: ProductVariant) => {
    const attrs = Object.entries(variant.attributes ?? {}).map(([key, value]) => `${key}: ${value}`)
    return attrs.length ? attrs.join(' / ') : variant.name || variant.sku || t('seller.shopProducts.defaultVariant')
  }

  async function load() {
    if (!activeBusiness || !shopId) return
    setLoading(true); setError('')
    try {
      const [shopData, inventoryData] = await Promise.all([shopApi.get(shopId), inventoryApi.getShopInventory(shopId, { limit: 500 })])
      setShop(shopData)
      const grouped = new Map<string, ShopProductRow>()
      for (const raw of inventoryData as unknown as ShopInventoryRow[]) {
        if (!raw?.inventory?.product_id || !raw.product || !raw.variant) continue
        const current = grouped.get(raw.inventory.product_id) ?? { product: raw.product, variants: [], total: 0, reserved: 0, available: 0 }
        current.variants.push(raw)
        current.total += Number(raw.inventory.quantity || 0)
        current.reserved += Number(raw.inventory.reserved_quantity || 0)
        current.available += availableOf(raw.inventory)
        grouped.set(raw.inventory.product_id, current)
      }
      const list = Array.from(grouped.values())
      await Promise.all(list.map(async row => {
        const images = await productImageApi.list(activeBusiness.id, row.product.id)
        row.image = images.find(img => img.is_primary) ?? images[0]
      }))
      setRows(list)
    } catch (err) { setError(err instanceof Error ? err.message : t('seller.shopProducts.loadFailed')) }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [activeBusiness?.id, shopId])

  const categories = useMemo(() => {
    const entries = rows.filter(row => row.product.category_id).map(row => [row.product.category_id!, row.product.category_name || t('seller.shopProducts.categoryFallback')] as const)
    return Array.from(new Map(entries).entries())
  }, [rows, t])
  const visibleRows = useMemo(() => rows.filter(row => {
    if (category !== 'all' && row.product.category_id !== category) return false
    if (availability === 'in_stock' && row.available <= 5) return false
    if (availability === 'low_stock' && (row.available <= 0 || row.available > 5)) return false
    if (availability === 'out_of_stock' && row.available > 0) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [row.product.name, row.product.sku, ...row.variants.flatMap(v => [v.variant.sku, v.variant.name, ...Object.values(v.variant.attributes ?? {})])].some(value => String(value ?? '').toLowerCase().includes(q))
  }), [rows, category, availability, search])

  async function addStock(row: ShopInventoryRow) {
    const quantity = Number(restock[row.variant.id])
    if (!Number.isInteger(quantity) || quantity <= 0) { setError(t('seller.shopProducts.invalidQuantity')); return }
    setBusyVariant(row.variant.id); setError('')
    try {
      await inventoryApi.addStock(shopId, { variant_id: row.variant.id, quantity, notes: t('seller.shopProducts.restockNote') })
      setRestock(prev => ({ ...prev, [row.variant.id]: '' })); await load()
    } catch (err) { setError(err instanceof Error ? err.message : t('seller.shopProducts.addFailed')) }
    finally { setBusyVariant(null) }
  }

  if (!activeBusiness) return <div className="empty-state"><h2>{t('seller.noBusinessSelected')}</h2></div>
  return <div className="shop-products-page">
    <div className="page-header"><div><Link className="small section-link" to="/seller/shops">{t('seller.shopProducts.backToShops')}</Link><h1>{t('seller.shopProducts.title', { shop: shop?.name ?? t('seller.shopProducts.shopFallback') })}</h1><p className="muted">{t('seller.shopProducts.subtitle')}{shop?.city ? ` · ${shop.city}` : ''}</p></div><Button onClick={() => navigate(`/seller/shops/${shopId}/products/new`)}>{t('seller.shopProducts.createProduct')}</Button></div>
    {error && <ErrorBox error={error} />}
    <div className="shop-inventory-filters card"><input className="input" placeholder={t('seller.shopProducts.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} /><select className="input" value={category} onChange={e => setCategory(e.target.value)}><option value="all">{t('seller.shopProducts.allCategories')}</option>{categories.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select><select className="input" value={availability} onChange={e => setAvailability(e.target.value as Availability)}><option value="all">{t('seller.shopProducts.allAvailability')}</option><option value="in_stock">{t('stock.inStock')}</option><option value="low_stock">{t('stock.lowStock')}</option><option value="out_of_stock">{t('stock.outOfStock')}</option></select><Button variant="outline" onClick={() => void load()}>{t('seller.shopProducts.refresh')}</Button></div>
    {loading ? <LoadingBlock label={t('seller.shopProducts.loading')} /> : visibleRows.length === 0 ? <div className="card empty-state"><h3>{t('seller.shopProducts.emptyTitle')}</h3><p className="muted">{t('seller.shopProducts.emptyBody')}</p></div> : <div className="shop-inventory-grid">{visibleRows.map(row => {
      const open = expanded.has(row.product.id); const status = stockStatus(row.available)
      return <article className="card shop-inventory-card" key={row.product.id}><div className="shop-product-main"><div className="shop-product-thumb">{row.image ? <img src={row.image.url} alt="" /> : <span>{row.product.name.slice(0,2).toUpperCase()}</span>}</div><div><div className="row-between"><div><h2>{row.product.name}</h2><p className="small muted">{row.product.category_name || t('seller.shopProducts.uncategorized')} · SKU {row.product.sku || '—'}</p></div><span className={`badge badge-${row.product.publication_status === 'PUBLISHED' ? 'success' : 'warning'}`}>{t(`seller.publicationStatus.${row.product.publication_status}` as TranslationKey)}</span></div><div className="stock-metrics"><span><small>{t('seller.shopProducts.total')}</small><strong>{row.total}</strong></span><span><small>{t('seller.shopProducts.reserved')}</small><strong>{row.reserved}</strong></span><span><small>{t('seller.shopProducts.available')}</small><strong>{row.available}</strong></span><span className={`stock-state ${STOCK_STATE_CLASS[status]}`}>{t(`stock.state.${status}` as TranslationKey)}</span></div><div className="row-between"><span className="small muted">{t(row.variants.length === 1 ? 'seller.shopProducts.variantCount' : 'seller.shopProducts.variantCountPlural', { count: row.variants.length })}</span><div className="row"><Button size="sm" variant="outline" onClick={() => setExpanded(prev => { const next=new Set(prev); next.has(row.product.id)?next.delete(row.product.id):next.add(row.product.id); return next })}>{open ? t('seller.shopProducts.hideVariants') : t('seller.shopProducts.viewVariants')}</Button><Link to={`/seller/products/${row.product.id}?shop=${shopId}`}><Button size="sm" variant="ghost">{t('seller.shopProducts.productDetail')}</Button></Link></div></div></div></div>
        {open && <div className="table-responsive variant-stock-table"><table className="data-table"><thead><tr><th>{t('seller.shopProducts.colVariant')}</th><th>SKU</th><th>{t('seller.shopProducts.total')}</th><th>{t('seller.shopProducts.reserved')}</th><th>{t('seller.shopProducts.available')}</th><th>{t('seller.shopProducts.colStatus')}</th><th>{t('seller.shopProducts.colAddStock')}</th></tr></thead><tbody>{row.variants.map(item => { const av=availableOf(item.inventory); const state=stockStatus(av); return <tr key={item.variant.id}><td><strong>{variantLabel(item.variant)}</strong></td><td className="mono small">{item.variant.sku}</td><td>{item.inventory.quantity}</td><td>{item.inventory.reserved_quantity}</td><td><strong>{av}</strong></td><td><span className={`stock-state ${STOCK_STATE_CLASS[state]}`}>{t(`stock.state.${state}` as TranslationKey)}</span></td><td><div className="row"><input className="input input-sm" type="number" min="1" placeholder={t('seller.shopProducts.qtyPlaceholder')} value={restock[item.variant.id] ?? ''} onChange={e => setRestock(prev => ({...prev,[item.variant.id]:e.target.value}))}/><Button size="sm" disabled={busyVariant===item.variant.id} onClick={() => void addStock(item)}>{t('seller.shopProducts.add')}</Button></div></td></tr>})}</tbody></table></div>}
      </article>
    })}</div>}
  </div>
}
