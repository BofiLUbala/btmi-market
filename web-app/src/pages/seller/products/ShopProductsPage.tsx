import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { inventoryApi, productImageApi, shopApi } from '@/api/seller'
import type { InventoryItem, Product, ProductImageResponse, ProductVariant, Shop } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'

type Availability = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
type ShopInventoryRow = { inventory: InventoryItem; variant: ProductVariant; product: Product }
interface ShopProductRow { product: Product; variants: ShopInventoryRow[]; image?: ProductImageResponse; total: number; reserved: number; available: number }

const availableOf = (i: InventoryItem) => Number(i.available)
const stockStatus = (available: number) => available <= 0 ? 'OUT OF STOCK' : available <= 5 ? 'LOW STOCK' : 'IN STOCK'
const variantLabel = (variant: ProductVariant) => {
  const attrs = Object.entries(variant.attributes ?? {}).map(([key, value]) => `${key}: ${value}`)
  return attrs.length ? attrs.join(' / ') : variant.name || variant.sku || 'Default variant'
}

export default function ShopProductsPage() {
  const { shopId = '' } = useParams()
  const navigate = useNavigate()
  const { activeBusiness } = useAuth()
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
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load Shop inventory.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [activeBusiness?.id, shopId])

  const categories = useMemo(() => {
    const entries = rows.filter(row => row.product.category_id).map(row => [row.product.category_id!, row.product.category_name || 'Category'] as const)
    return Array.from(new Map(entries).entries())
  }, [rows])
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
    if (!Number.isInteger(quantity) || quantity <= 0) { setError('Enter a valid stock quantity.'); return }
    setBusyVariant(row.variant.id); setError('')
    try {
      await inventoryApi.addStock(shopId, { variant_id: row.variant.id, quantity, notes: 'Restock from Shop Products' })
      setRestock(prev => ({ ...prev, [row.variant.id]: '' })); await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to add stock.') }
    finally { setBusyVariant(null) }
  }

  if (!activeBusiness) return <div className="empty-state"><h2>No Business Selected</h2></div>
  return <div className="shop-products-page">
    <div className="page-header"><div><Link className="small section-link" to="/seller/shops">← Shops</Link><h1>{shop?.name ?? 'Shop'} inventory</h1><p className="muted">Products and exact Variant stock in this Shop only{shop?.city ? ` · ${shop.city}` : ''}</p></div><Button onClick={() => navigate(`/seller/shops/${shopId}/products/new`)}>+ Create Product</Button></div>
    {error && <ErrorBox error={error} />}
    <div className="shop-inventory-filters card"><input className="input" placeholder="Search product, SKU or Variant attribute…" value={search} onChange={e => setSearch(e.target.value)} /><select className="input" value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select><select className="input" value={availability} onChange={e => setAvailability(e.target.value as Availability)}><option value="all">All availability</option><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option></select><Button variant="outline" onClick={() => void load()}>Refresh</Button></div>
    {loading ? <LoadingBlock label="Loading real-time Shop inventory…" /> : visibleRows.length === 0 ? <div className="card empty-state"><h3>No matching Products</h3><p className="muted">Stock assigned to this Shop will appear here.</p></div> : <div className="shop-inventory-grid">{visibleRows.map(row => {
      const open = expanded.has(row.product.id); const status = stockStatus(row.available)
      return <article className="card shop-inventory-card" key={row.product.id}><div className="shop-product-main"><div className="shop-product-thumb">{row.image ? <img src={row.image.url} alt="" /> : <span>{row.product.name.slice(0,2).toUpperCase()}</span>}</div><div><div className="row-between"><div><h2>{row.product.name}</h2><p className="small muted">{row.product.category_name || 'Uncategorized'} · SKU {row.product.sku || '—'}</p></div><span className={`badge badge-${row.product.publication_status === 'PUBLISHED' ? 'success' : 'warning'}`}>{row.product.publication_status}</span></div><div className="stock-metrics"><span><small>Total</small><strong>{row.total}</strong></span><span><small>Reserved</small><strong>{row.reserved}</strong></span><span><small>Available</small><strong>{row.available}</strong></span><span className={`stock-state ${status.replace(/ /g,'-').toLowerCase()}`}>{status}</span></div><div className="row-between"><span className="small muted">{row.variants.length} Variant{row.variants.length === 1 ? '' : 's'}</span><div className="row"><Button size="sm" variant="outline" onClick={() => setExpanded(prev => { const next=new Set(prev); next.has(row.product.id)?next.delete(row.product.id):next.add(row.product.id); return next })}>{open ? 'Hide Variants' : 'View Variants'}</Button><Link to={`/seller/products/${row.product.id}?shop=${shopId}`}><Button size="sm" variant="ghost">Product detail</Button></Link></div></div></div></div>
        {open && <div className="table-responsive variant-stock-table"><table className="data-table"><thead><tr><th>Variant</th><th>SKU</th><th>Total</th><th>Reserved</th><th>Available</th><th>Status</th><th>Add stock</th></tr></thead><tbody>{row.variants.map(item => { const av=availableOf(item.inventory); const state=stockStatus(av); return <tr key={item.variant.id}><td><strong>{variantLabel(item.variant)}</strong></td><td className="mono small">{item.variant.sku}</td><td>{item.inventory.quantity}</td><td>{item.inventory.reserved_quantity}</td><td><strong>{av}</strong></td><td><span className={`stock-state ${state.replace(/ /g,'-').toLowerCase()}`}>{state}</span></td><td><div className="row"><input className="input input-sm" type="number" min="1" placeholder="Qty" value={restock[item.variant.id] ?? ''} onChange={e => setRestock(prev => ({...prev,[item.variant.id]:e.target.value}))}/><Button size="sm" disabled={busyVariant===item.variant.id} onClick={() => void addStock(item)}>Add</Button></div></td></tr>})}</tbody></table></div>}
      </article>
    })}</div>}
  </div>
}
