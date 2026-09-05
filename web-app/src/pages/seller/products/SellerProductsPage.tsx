import { inventoryApi, productApi } from '@/api/seller'
import type { InventoryItem, Product, ProductVariant, PublicationStatus } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { useAuth } from '@/store/auth'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

type FilterOption = { label: string; value: '' | PublicationStatus }

function getFilters(t: ReturnType<typeof useT>): FilterOption[] {
  return [
    { label: t('seller.productList.filterAll'), value: '' },
    { label: t('seller.productList.filterPublished'), value: 'PUBLISHED' },
    { label: t('seller.productList.filterDrafts'), value: 'DRAFT' },
  ]
}

function publicationStatusLabel(status: string, t: ReturnType<typeof useT>): string {
  const key = `seller.publicationStatus.${status}`
  const value = t(key as TranslationKey)
  return value === key ? status : value
}

type ShopInventoryRow = {
  inventory: InventoryItem
  variant: ProductVariant
  product: Product
}

export default function SellerProductsPage() {
  const t = useT()
  const { activeBusiness, activeShop } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [availableByProduct, setAvailableByProduct] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<'' | PublicationStatus>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (activeBusiness && activeShop) void loadProducts()
    else {
      setProducts([])
      setAvailableByProduct({})
      setLoading(false)
    }
  }, [activeBusiness?.id, activeShop, debouncedSearch, status])

  async function loadProducts() {
    if (!activeBusiness || !activeShop) return
    setLoading(true)
    setError('')
    try {
      const inventory = await inventoryApi.getShopInventory(activeShop, { limit: 500 })
      const productsById = new Map<string, Product>()
      const stockByProduct: Record<string, number> = {}

      for (const row of inventory as unknown as ShopInventoryRow[]) {
        if (!row.product?.id || !row.inventory) continue
        productsById.set(row.product.id, row.product)
        stockByProduct[row.product.id] = (stockByProduct[row.product.id] || 0) + Math.max(0, row.inventory.available || 0)
      }

      const query = debouncedSearch.toLocaleLowerCase()
      const scopedProducts = Array.from(productsById.values()).filter((product) => {
        if (status && product.publication_status !== status) return false
        if (!query) return true
        return [product.name, product.sku, product.description]
          .some((value) => String(value || '').toLocaleLowerCase().includes(query))
      })

      setProducts(scopedProducts)
      setAvailableByProduct(stockByProduct)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('seller.productList.loadFailed'))
      setProducts([])
      setAvailableByProduct({})
    } finally {
      setLoading(false)
    }
  }

  async function sendToMarketplace(product: Product) {
    if (!activeBusiness) return
    if (!activeShop) {
      setError(t('seller.productList.selectShopFirst'))
      return
    }
    setBusyId(product.id)
    setError('')
    try {
      const variants = await productApi.listVariants(activeBusiness.id, product.id)
      if (variants.length === 0) throw new Error(t('seller.productList.needVariant'))
      await Promise.all(
        variants.map((variant) => inventoryApi.addStock(activeShop, {
          variant_id: variant.id,
          quantity: 0,
          notes: t('seller.productList.noteMarketplaceOffer'),
        }))
      )
      await productApi.update(activeBusiness.id, product.id, { publication_status: 'PUBLISHED', status: 'ACTIVE' })
      await loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('seller.productList.sendFailed'))
    } finally {
      setBusyId('')
    }
  }

  async function unpublishProduct(product: Product) {
    if (!activeBusiness) return
    setBusyId(product.id)
    setError('')
    try {
      await productApi.update(activeBusiness.id, product.id, { publication_status: 'DRAFT' })
      await loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('seller.productList.unpublishFailed'))
    } finally {
      setBusyId('')
    }
  }

  async function archiveProduct(product: Product) {
    if (!activeBusiness) return
    const confirmed = window.confirm(
      t('seller.productList.archiveConfirm', { name: product.name })
    )
    if (!confirmed) return
    setBusyId(product.id)
    setError('')
    try {
      await productApi.update(activeBusiness.id, product.id, {
        status: 'INACTIVE',
        publication_status: 'ARCHIVED',
      })
      setProducts((current) => current.filter((item) => item.id !== product.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('seller.productList.deleteFailed'))
    } finally {
      setBusyId('')
    }
  }

  if (!activeBusiness) {
    return (
      <div className="empty-state seller-products-empty">
        <div className="empty-icon">📦</div>
        <h2>{t('seller.noBusinessSelected')}</h2>
        <p className="muted">{t('seller.productList.noBusinessSubtitle')}</p>
      </div>
    )
  }

  return (
    <div className="seller-products">
      <div className="seller-products-head">
        <div>
          <h1>{t('seller.products')}</h1>
          <p className="muted">{t('seller.productList.scopedDesc')}</p>
        </div>
        <Link to="/seller/products/select-shop" className="btn btn-primary">{t('seller.productList.createProduct')}</Link>
      </div>

      {!activeShop ? (
        <Card>
          <div className="empty-state seller-products-empty">
            <div className="empty-icon">🏪</div>
            <h3>{t('seller.productList.selectShopTitle')}</h3>
            <p className="muted">{t('seller.productList.selectShopDesc')}</p>
          </div>
        </Card>
      ) : <>
      <div className="seller-product-toolbar" role="search">
        <input
          className="input seller-product-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('seller.productList.searchPlaceholder')}
          aria-label={t('seller.productList.searchAria')}
        />
        <div className="seller-product-filters" aria-label={t('seller.productList.filterAria')}>
          {getFilters(t).map((filter) => (
            <button
              key={filter.value || 'all'}
              type="button"
              className={`seller-product-filter${status === filter.value ? ' active' : ''}`}
              onClick={() => setStatus(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBox error={error} />}
      {loading ? (
        <LoadingBlock label={t('seller.productList.loading')} />
      ) : products.length === 0 ? (
        <Card>
          <div className="empty-state seller-products-empty">
            <div className="empty-icon">⌕</div>
            <h3>{search || status ? t('seller.productList.noMatchTitle') : t('seller.productList.noProductsTitle')}</h3>
            <p className="muted">{search || status ? t('seller.productList.noMatchDesc') : t('seller.productList.noProductsDesc')}</p>
          </div>
        </Card>
      ) : (
        <div className="seller-product-grid">
          {products.map((product) => {
            const available = availableByProduct[product.id] ?? 0
            const busy = busyId === product.id
            return (
              <article className="seller-product-card" key={product.id}>
                <div className="seller-product-card-top">
                  <span className="badge badge-outline">{product.category_name || t('seller.productList.generalCategory')}</span>
                  <span className={`badge badge-${product.publication_status === 'PUBLISHED' ? 'success' : 'warning'}`}>
                    {publicationStatusLabel(product.publication_status, t)}
                  </span>
                </div>
                <div className="seller-product-card-main">
                  <h3 title={product.name}>{product.name}</h3>
                  <span className="mono small muted">{product.sku ? t('seller.productDetail.skuInfo', { sku: product.sku }) : t('seller.productList.noSku')}</span>
                </div>
                <div className="seller-product-card-stats">
                  <div>
                    <span>{t('common.price')}</span>
                    <strong>
                      {product.discount_active ? (
                        <span style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: 'var(--color-primary)' }}>
                            {(() => {
                              const base = product.unit_price || 0
                              const val = product.discount_value || 0
                              if (product.discount_type === 'PERCENTAGE') return (base * (1 - val / 100)).toLocaleString()
                              return Math.max(0, base - val).toLocaleString()
                            })()} FC
                          </span>
                          <span style={{ textDecoration: 'line-through', fontSize: '0.85em', color: 'var(--color-text-muted)', fontWeight: 'normal' }}>
                            {Number(product.unit_price).toLocaleString()} FC
                          </span>
                        </span>
                      ) : (
                        product.unit_price ? `${Number(product.unit_price).toLocaleString()} FC` : '—'
                      )}
                    </strong>
                  </div>
                  <div><span>{t('seller.productList.availableLabel')}</span><strong className={available > 0 ? 'success' : 'muted'}>{available}</strong></div>
                  <div><span>{t('seller.productList.variantsLabel')}</span><strong>{product.variant_count || 1}</strong></div>
                </div>
                <div className="seller-product-card-actions">
                  <Link to={`/seller/products/${product.id}`} className="btn btn-outline btn-sm">{t('seller.productList.edit')}</Link>
                  <Button variant="primary" size="sm" disabled={busy} onClick={() => sendToMarketplace(product)}>
                    {product.publication_status === 'PUBLISHED' ? t('seller.productList.syncMarket') : t('seller.productList.sendToMarket')}
                  </Button>
                  {product.publication_status === 'PUBLISHED' && (
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => unpublishProduct(product)}>{t('seller.productList.unpublish')}</Button>
                  )}
                  <Button variant="danger" size="sm" disabled={busy} onClick={() => archiveProduct(product)}>
                    {t('seller.productList.delete')}
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}
      </>}
    </div>
  )
}
