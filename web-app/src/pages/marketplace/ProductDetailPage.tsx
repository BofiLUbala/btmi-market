import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { marketplaceApi } from '@/api/marketplace'
import { ApiError } from '@/api/types'
import type { PublicProduct, PublicProductDetail, PublicVariantDetail } from '@/api/types'
import { ErrorBox, LoadingBlock, SuccessBox } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { StockChip } from '@/components/ui/Badges'
import { ProductCard } from '@/components/ui/ProductCard'
import { Gallery } from '@/components/ui/Gallery'
import { formatMoney, formatDate } from '@/lib/format'
import {
  buildAttributeGroups,
  describeAttributes,
  hasRealVariants,
  isValueAvailable,
  resolveVariant,
  type VariantSelection
} from '@/lib/variants'
import { loginWithReturnTo } from '@/lib/returnTo'
import { useCart } from '@/store/cart'
import { useAuth } from '@/store/auth'
import { useFavorites } from '@/store/favorites'

function productErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 404) return 'This product does not exist or is no longer available.'
    if (e.status === 0) return 'Cannot reach BTMI Market right now. Check your connection and retry.'
    return e.message
  }
  return 'Could not load this product.'
}

export default function ProductDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const cart = useCart()
  const favorites = useFavorites()

  const [product, setProduct] = useState<PublicProductDetail | null>(null)
  const [similar, setSimilar] = useState<PublicProduct[]>([])
  const [selection, setSelection] = useState<VariantSelection>({})
  const [qty, setQty] = useState(1)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError('')
    setNotFound(false)
    setAdded(false)
    setQty(1)
    Promise.allSettled([
      marketplaceApi.productDetail(id),
      marketplaceApi.similarProducts(id)
    ]).then(([d, s]) => {
      if (!mounted) return
      if (d.status === 'fulfilled') {
        setProduct(d.value)
        setSelection(initialSelection(d.value.variants ?? []))
      } else {
        setProduct(null)
        setNotFound(d.reason instanceof ApiError && d.reason.status === 404)
        setError(productErrorMessage(d.reason))
      }
      setSimilar(s.status === 'fulfilled' ? s.value.products ?? [] : [])
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [id])

  // Keep selection valid whenever product changes.
  function initialSelection(variants: PublicVariantDetail[]): VariantSelection {
    const groups = buildAttributeGroups(variants)
    const sel: VariantSelection = {}
    for (const g of groups) {
      const firstUsable =
        variants.find(
          (v) => v.stock !== 'OUT_OF_STOCK' && (v.attributes ?? {})[g.key]
        ) ??
        variants.find((v) => (v.attributes ?? {})[g.key])
      if (firstUsable) sel[g.key] = firstUsable.attributes[g.key]
    }
    return sel
  }

  const variants = useMemo(() => product?.variants ?? [], [product])
  const multiVariant = useMemo(() => hasRealVariants(variants), [variants])
  const groups = useMemo(() => buildAttributeGroups(variants), [variants])

  const variant: PublicVariantDetail | null = useMemo(() => {
    if (variants.length === 0) return null
    if (!multiVariant) return variants[0]
    return resolveVariant(variants, selection)
  }, [variants, multiVariant, selection])

  if (loading) return <LoadingBlock label="Loading product…" />
  if (!product)
    return (
      <ErrorBox
        error={error || 'Product not found'}
        onRetry={notFound ? undefined : () => window.location.reload()}
      />
    )

  const p = product
  const v = variant
  if (!v) return <ErrorBox error="This product has no purchasable configuration." />

  const outOfStock = v.stock === 'OUT_OF_STOCK'
  const lowStock = v.stock === 'LOW_STOCK'
  const maxQty = v.stock_quantity > 0 ? v.stock_quantity : 1
  const unitPrice = v.unit_price
  const subtotal = unitPrice * qty
  const personalized = Boolean(user && p.final_price !== undefined && p.discount_percent)
  const isFav = favorites.has(p.id)

  function selectValue(key: string, value: string) {
    setSelection((prev) => ({ ...prev, [key]: value }))
    setQty(1)
    setAdded(false)
  }

  function changeQty(next: number) {
    setQty(Math.min(Math.max(1, next), maxQty))
  }

  function addToCart() {
    if (!v || outOfStock) return
    cart.add({
      productId: p.id,
      variantId: v.id,
      quantity: qty,
      name: p.name,
      variantName: describeAttributes(v),
      attributes: v.attributes,
      unit: p.unit,
      unitPrice,
      currency: 'FC',
      shopId: p.shop_id,
      shopName: p.shop_name
    })
    setAdded(true)
  }

  function toggleFavorite() {
    if (!user) {
      navigate(loginWithReturnTo(`/products/${p.id}`))
      return
    }
    favorites.toggle({
      productId: p.id,
      name: p.name,
      shopId: p.shop_id,
      shopName: p.shop_name,
      price: unitPrice,
      currency: 'FC',
      unit: p.unit,
      addedAt: new Date().toISOString()
    })
  }

  return (
    <div className="fade-in">
      <Link to={`/shops/${p.shop_id}`} className="small section-link">
        ← {p.shop_name}
      </Link>

      <div className="pd-grid" style={{ marginTop: 12 }}>
        <Gallery
          name={p.name}
          badge={<StockChip stock={v.stock} />}
          images={(p.images ?? []).map((img) => ({ url: img.url, alt: img.file_name || p.name }))}
        />

        <div className="stack">
          <div>
            <div className="small muted">
              {p.category?.name ?? 'General'}
              {p.subcategory ? ` › ${p.subcategory.name}` : ''}
            </div>
            <h1 style={{ fontSize: '1.9rem', marginTop: 4 }}>{p.name}</h1>
            <div className="small muted">
              Sold by{' '}
              <Link to={`/shops/${p.shop_id}`} className="section-link">
                {p.shop_name}
              </Link>{' '}
              · Level {p.seller_level} · Trust {p.seller_trust}
            </div>
          </div>

          <div className="pd-price" aria-live="polite">
            {formatMoney(unitPrice)}
            <span className="small muted" style={{ marginLeft: 6 }}>per {p.unit}</span>
            {personalized && (
              <span className="pd-discount" style={{ marginLeft: 10 }}>
                Your level saves {Math.round(p.discount_percent ?? 0)}% at checkout
              </span>
            )}
          </div>
          {personalized && p.free_delivery && (
            <div className="pd-discount small">Free delivery included for your level</div>
          )}

          {multiVariant &&
            groups.map((g) => (
              <div key={g.key}>
                <div className="bold small" style={{ marginBottom: 6 }}>{g.label}</div>
                <div className="attr-options" role="group" aria-label={g.label}>
                  {g.values.map((val) => {
                    const selectedVal = selection[g.key] === val
                    const usable = isValueAvailable(variants, selection, g.key, val, true)
                    return (
                      <button
                        key={val}
                        type="button"
                        aria-pressed={selectedVal}
                        disabled={!usable && !selectedVal}
                        title={!usable ? `${val} — out of stock` : val}
                        className={`attr-option ${selectedVal ? 'selected' : ''} ${!usable ? 'unavailable' : ''}`}
                        onClick={() => selectValue(g.key, val)}
                      >
                        {val}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

          <div className="row-between" style={{ maxWidth: 360 }}>
            <div className="stepper" role="group" aria-label="Quantity">
              <button onClick={() => changeQty(qty - 1)} disabled={qty <= 1} aria-label="Decrease quantity">
                −
              </button>
              <span className="stepper-qty" aria-live="polite">{qty}</span>
              <button onClick={() => changeQty(qty + 1)} disabled={qty >= maxQty} aria-label="Increase quantity">
                +
              </button>
            </div>
            <div className="small">
              {outOfStock ? (
                <span className="muted">Out of stock</span>
              ) : lowStock ? (
                <span style={{ color: 'var(--warning)' }}>Only {v.stock_quantity} left</span>
              ) : (
                <span className="muted">{v.stock_quantity} available</span>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 12, maxWidth: 360 }}>
            <div className="row-between small">
              <span className="muted">Unit price</span>
              <span>{formatMoney(unitPrice)}</span>
            </div>
            <div className="row-between bold" style={{ marginTop: 4 }}>
              <span>Subtotal</span>
              <span aria-live="polite">{formatMoney(subtotal)}</span>
            </div>
          </div>

          {added && <SuccessBox message="Added to cart ✓" />}

          <div className="stack" style={{ gap: 8, maxWidth: 360 }}>
            <Button size="lg" block disabled={outOfStock} onClick={addToCart}>
              {outOfStock ? 'Out of stock' : 'Add to cart'}
            </Button>
            <Button variant="outline" block onClick={toggleFavorite} aria-pressed={isFav}>
              {isFav ? '♥ In favorites' : '♡ Add to favorites'}
            </Button>
          </div>

          {!user && (
            <p className="small muted">
              <Link to={loginWithReturnTo(`/products/${p.id}`)} className="section-link">
                Sign in
              </Link>{' '}
              to see your buyer-level price and earn points.
            </p>
          )}
        </div>
      </div>

      <div className="dashboard-sections" style={{ marginTop: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {p.description && (
          <div className="card">
            <h3>Description</h3>
            <p className="small muted" style={{ whiteSpace: 'pre-line' }}>{p.description}</p>
          </div>
        )}

        {Object.keys(v.attributes ?? {}).length > 0 && (
          <div className="card">
            <h3>Specifications</h3>
            <table className="data-table small">
              <tbody>
                {Object.entries(v.attributes).map(([k, val]) => (
                  <tr key={k}>
                    <td className="muted">{k.replace(/[_-]+/g, ' ')}</td>
                    <td className="bold">{val}</td>
                  </tr>
                ))}
                <tr>
                  <td className="muted">SKU</td>
                  <td className="mono">{v.sku}</td>
                </tr>
                <tr>
                  <td className="muted">Sold by</td>
                  <td>{p.shop_name}</td>
                </tr>
                <tr>
                  <td className="muted">Listed</td>
                  <td>{formatDate(p.created_at)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {similar.length > 0 && (
        <>
          <div className="section-head">
            <h2>Similar products</h2>
          </div>
          <div className="product-grid">
            {similar.map((sp) => (
              <ProductCard key={sp.id} product={sp} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
