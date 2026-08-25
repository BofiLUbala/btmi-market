import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { marketplaceApi } from '@/api/marketplace'
import { ApiError } from '@/api/types'
import type { ProductReviewsResponse, PublicProduct, PublicProductDetail, PublicVariantDetail } from '@/api/types'
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
  const [reviewSummary, setReviewSummary] = useState<ProductReviewsResponse['summary'] | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError('')
    setNotFound(false)
    setAdded(false)
    setQty(1)
    Promise.allSettled([
      marketplaceApi.productDetail(id),
      marketplaceApi.similarProducts(id),
      marketplaceApi.productReviews(id, { page: 1, per_page: 1 })
    ]).then(([d, s, r]) => {
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
      setReviewSummary(r.status === 'fulfilled' ? r.value.summary : null)
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
    if (groups.length === 0 && variants.length > 1) {
      sel.__variant_id = (variants.find((v) => v.stock !== 'OUT_OF_STOCK') ?? variants[0]).id
      return sel
    }
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
    if (groups.length === 0 && variants.length > 1) {
      return variants.find((item) => item.id === selection.__variant_id)
        ?? variants.find((item) => item.stock !== 'OUT_OF_STOCK')
        ?? variants[0]
    }
    if (!multiVariant) return variants[0]
    return resolveVariant(variants, selection)
  }, [variants, groups, multiVariant, selection])

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
  const personalized = Boolean(user && p.final_price !== undefined && p.discount_percent)
  const exactDiscount = personalized && Math.abs(p.base_price - unitPrice) < 0.01 && (p.final_price ?? unitPrice) < unitPrice
  const displayPrice = exactDiscount ? p.final_price! : unitPrice
  const isFav = favorites.has(p.id)
  const descriptionParts = (p.description || '')
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((part) => part.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
  const highlights = descriptionParts.slice(0, 5)
  const shortDescription = descriptionParts[0] || `Discover ${p.name}, available from verified local sellers.`

  function selectValue(key: string, value: string) {
    const matching = variants.find(
      (candidate) => candidate.stock !== 'OUT_OF_STOCK' && candidate.attributes?.[key] === value
    ) ?? variants.find((candidate) => candidate.attributes?.[key] === value)
    setSelection(matching ? { ...matching.attributes } : (prev) => ({ ...prev, [key]: value }))
    setQty(1)
    setAdded(false)
  }

  function changeQty(next: number) {
    setQty(Math.min(Math.max(1, next), maxQty))
  }

  function selectVariantId(variantId: string) {
    setSelection({ __variant_id: variantId })
    setQty(1)
    setAdded(false)
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
      shopName: p.shop_name,
      image: p.images?.find((img) => img.is_primary)?.url ?? p.images?.[0]?.url
    })
    setAdded(true)
  }

  function buyNow() {
    if (outOfStock) return
    addToCart()
    navigate('/cart')
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
      <nav className="pd-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Marketplace</Link><span>›</span>
        {p.category && <><Link to={`/categories/${p.category.slug}`}>{p.category.name}</Link><span>›</span></>}
        <span aria-current="page">{p.name}</span>
      </nav>

      <div className="pd-grid" style={{ marginTop: 12 }}>
        <Gallery
          name={p.name}
          badge={<StockChip stock={v.stock} />}
          images={(p.images ?? []).map((img) => ({ url: img.url, alt: img.file_name || p.name }))}
        />

        <div className="pd-details">
          <header className="pd-header">
            <h1>{p.name}</h1>
            <div className="pd-seller-line">Sold by <Link to={`/shops/${p.shop_id}`}>{p.shop_name}</Link> · {p.seller_level} seller</div>
            <a className="pd-rating-link" href="#customer-reviews">
              <strong>{(reviewSummary?.average_rating ?? 0).toFixed(1)} ★</strong>
              <span>{reviewSummary?.total_reviews ?? 0} reviews</span>
            </a>
          </header>

          <section className="pd-price-block" aria-label="Price" aria-live="polite">
            {exactDiscount && <span className="pd-discount-badge">{Math.round(p.discount_percent ?? 0)}% OFF</span>}
            <div><strong>{formatMoney(displayPrice)}</strong><span>per {p.unit}</span></div>
            {exactDiscount && <del>{formatMoney(unitPrice)}</del>}
            {personalized && !exactDiscount && <p>Your buyer-level discount is calculated at checkout.</p>}
          </section>

          <p className="pd-summary">{shortDescription}</p>

          {multiVariant &&
            groups.map((g) => (
              <section className="pd-option-group" key={g.key} aria-labelledby={`option-${g.key}`}>
                <div id={`option-${g.key}`} className="pd-option-label">{g.label}: <strong>{selection[g.key]}</strong></div>
                <div className="attr-options" role="group" aria-label={g.label}>
                  {g.values.map((val) => {
                    const selectedVal = selection[g.key] === val
                    const usable = variants.some(
                      (candidate) => candidate.stock !== 'OUT_OF_STOCK' && candidate.attributes?.[g.key] === val
                    )
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
              </section>
            ))}

          {!multiVariant && variants.length > 1 && (
            <section className="pd-option-group" aria-labelledby="option-variant">
              <div id="option-variant" className="pd-option-label">Variant: <strong>{v.name || v.sku}</strong></div>
              <div className="attr-options" role="group" aria-label="Variant">
                {variants.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={item.id === v.id}
                    disabled={item.stock === 'OUT_OF_STOCK'}
                    className={`attr-option ${item.id === v.id ? 'selected' : ''} ${item.stock === 'OUT_OF_STOCK' ? 'unavailable' : ''}`}
                    onClick={() => selectVariantId(item.id)}
                  >
                    {item.name || item.sku || `Variant ${variants.indexOf(item) + 1}`}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className={`pd-stock ${outOfStock ? 'out' : lowStock ? 'low' : 'in'}`} aria-live="polite">
            <strong>{outOfStock ? 'Out of stock' : lowStock ? `Only ${v.stock_quantity} left` : `In stock — ${v.stock_quantity} available`}</strong>
            <span>Selected SKU: {v.sku || p.sku}</span>
          </section>

          <div className="pd-quantity-row">
            <strong>Quantity</strong>
            <div className="stepper" role="group" aria-label="Quantity">
              <button onClick={() => changeQty(qty - 1)} disabled={qty <= 1} aria-label="Decrease quantity">
                −
              </button>
              <span className="stepper-qty" aria-live="polite">{qty}</span>
              <button onClick={() => changeQty(qty + 1)} disabled={qty >= maxQty} aria-label="Increase quantity">
                +
              </button>
            </div>
          </div>

          <section className="pd-delivery">
            <strong>Delivery</strong>
            <span>{p.free_delivery ? 'Free delivery included for your buyer level.' : 'Location, fee and delivery date are confirmed at checkout.'}</span>
            {Boolean(p.delivery_discount_percent) && <small>{p.delivery_discount_percent}% delivery discount applies.</small>}
          </section>

          <div className="pd-subtotal"><span>Subtotal ({qty} {qty === 1 ? p.unit : `${p.unit}s`})</span><strong aria-live="polite">{formatMoney(displayPrice * qty)}</strong></div>

          {added && <SuccessBox message="Added to cart ✓" />}

          <div className="pd-actions">
            <Button variant="outline" size="lg" block disabled={outOfStock} onClick={addToCart}>Add to Cart</Button>
            <Button variant="accent" size="lg" block disabled={outOfStock} onClick={buyNow}>{outOfStock ? 'Unavailable' : 'Buy Now'}</Button>
          </div>
          <div className="pd-favorite">
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

      <div className="pd-mobile-purchase" aria-label="Purchase actions">
        <div><small>{outOfStock ? 'Unavailable' : `${qty} × ${formatMoney(displayPrice)}`}</small><strong>{formatMoney(displayPrice * qty)}</strong></div>
        <Button variant="outline" disabled={outOfStock} onClick={addToCart}>Add to Cart</Button>
        <Button variant="accent" disabled={outOfStock} onClick={buyNow}>Buy Now</Button>
      </div>

      <div className="pd-information">
        <section className="pd-info-section" aria-labelledby="product-highlights">
          <h2 id="product-highlights">Product highlights</h2>
          <ul className="pd-highlights">
            {(highlights.length > 0 ? highlights : [shortDescription]).map((highlight, index) => (
              <li key={`${highlight}-${index}`}>{highlight}</li>
            ))}
            <li>{v.stock_quantity > 0 ? `${v.stock_quantity} units currently available` : 'Currently out of stock'}</li>
          </ul>
        </section>

        <section className="pd-info-section" aria-labelledby="product-description">
          <h2 id="product-description">Product description</h2>
          <div className="pd-description-copy">
            {descriptionParts.length > 0 ? descriptionParts.map((paragraph, index) => (
              <p key={`${paragraph}-${index}`}>{paragraph}</p>
            )) : <p>{shortDescription}</p>}
          </div>
        </section>

        <section className="pd-info-section" aria-labelledby="product-specifications">
          <h2 id="product-specifications">Specifications</h2>
          <dl className="pd-specifications">
            <div><dt>Product</dt><dd>{p.name}</dd></div>
            <div><dt>Category</dt><dd>{p.category?.name ?? 'General'}</dd></div>
            {p.subcategory && <div><dt>Subcategory</dt><dd>{p.subcategory.name}</dd></div>}
            {Object.entries(v.attributes ?? {}).map(([key, value]) => (
              <div key={key}><dt>{key.replace(/[_-]+/g, ' ')}</dt><dd>{value}</dd></div>
            ))}
            <div><dt>SKU</dt><dd className="mono">{v.sku || p.sku}</dd></div>
            <div><dt>Unit</dt><dd>{p.unit}</dd></div>
            <div><dt>Seller</dt><dd><Link to={`/shops/${p.shop_id}`}>{p.shop_name}</Link></dd></div>
            <div><dt>Seller level</dt><dd>{p.seller_level}</dd></div>
            <div><dt>Listed</dt><dd>{formatDate(p.created_at)}</dd></div>
          </dl>
        </section>
      </div>

      <ProductReviews productId={p.id} signedIn={Boolean(user)} onRequireLogin={() => navigate(loginWithReturnTo(`/products/${p.id}`))} />

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

function ProductReviews({ productId, signedIn, onRequireLogin }: { productId: string; signedIn: boolean; onRequireLogin: () => void }) {
  const [data, setData] = useState<ProductReviewsResponse | null>(null)
  const [sort, setSort] = useState('newest')
  const [rating, setRating] = useState<number | undefined>()
  const [replying, setReplying] = useState<string | null>(null)
  const [reply, setReply] = useState('')

  const load = () => marketplaceApi.productReviews(productId, { sort, rating }).then(setData).catch(() => setData(null))
  useEffect(() => { void load() }, [productId, sort, rating])

  async function helpful(reviewId: string, active: boolean) {
    if (!signedIn) return onRequireLogin()
    if (active) await marketplaceApi.unmarkReviewHelpful(reviewId)
    else await marketplaceApi.markReviewHelpful(reviewId)
    load()
  }

  async function sendReply(reviewId: string) {
    if (!signedIn) return onRequireLogin()
    if (!reply.trim()) return
    await marketplaceApi.replyToReview(reviewId, reply)
    setReply(''); setReplying(null); load()
  }

  const summary = data?.summary
  return (
    <section className="product-reviews" aria-labelledby="customer-reviews">
      <div className="section-head"><h2 id="customer-reviews">Customer reviews</h2></div>
      <div className="review-layout">
        <aside className="review-summary card">
          <div className="review-score">{(summary?.average_rating ?? 0).toFixed(1)} <span>★</span></div>
          <div className="muted">{summary?.total_reviews ?? 0} verified product reviews</div>
          {[5,4,3,2,1].map((n) => {
            const count = summary?.[`rating_${n}_count` as keyof typeof summary] as number ?? 0
            const pct = summary?.total_reviews ? count / summary.total_reviews * 100 : 0
            return <button className="rating-row" key={n} onClick={() => setRating(rating === n ? undefined : n)} aria-pressed={rating === n}><span>{n} ★</span><i><b style={{ width: `${pct}%` }} /></i><span>{count}</span></button>
          })}
        </aside>
        <div className="review-feed">
          <div className="row-between"><strong>Ratings & reviews</strong><select className="input review-sort" value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Most recent</option><option value="helpful">Most helpful</option><option value="highest_rating">Highest rated</option><option value="lowest_rating">Lowest rated</option></select></div>
          {data?.reviews.length ? data.reviews.map((review) => (
            <article className="review-card" key={review.id}>
              <div className="review-meta"><span className="review-stars">{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</span><strong>{review.buyer_display_name || 'Verified buyer'}</strong><span className="verified-badge">✓ Verified purchase</span><span className="muted">{formatDate(review.created_at)}</span></div>
              {review.comment && <p>{review.comment}</p>}
              <div className="review-actions"><button onClick={() => helpful(review.id, review.helpful_by_me)} aria-pressed={review.helpful_by_me}>{review.helpful_by_me ? 'Helpful ✓' : 'Helpful'} ({review.helpful_count})</button><button onClick={() => signedIn ? setReplying(replying === review.id ? null : review.id) : onRequireLogin()}>Reply</button></div>
              {review.replies?.map((r) => <div className="review-reply" key={r.id}><strong>{r.author_display_name}</strong><span className="muted"> · {formatDate(r.created_at)}</span><p>{r.body}</p></div>)}
              {replying === review.id && <div className="review-reply-form"><textarea className="input" rows={2} maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a respectful reply…" /><Button size="sm" onClick={() => sendReply(review.id)}>Post reply</Button></div>}
            </article>
          )) : <div className="card muted">No product reviews yet. Reviews appear here after a verified purchase.</div>}
        </div>
      </div>
    </section>
  )
}
