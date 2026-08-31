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
  extractSpecifications,
  hasRealVariants,
  isValueAvailable,
  resolveVariant,
  type VariantSelection
} from '@/lib/variants'
import { resolvePromotion } from '@/lib/promotion'
import { loginWithReturnTo } from '@/lib/returnTo'
import { useCart } from '@/store/cart'
import { useAuth } from '@/store/auth'
import { useFavorites } from '@/store/favorites'
import { useI18n } from '@/store/i18n'

function productErrorMessage(e: unknown, t: ReturnType<typeof useI18n>['t']): string {
  if (e instanceof ApiError) {
    if (e.status === 404) return t('product.errorNotFound')
    if (e.status === 0) return t('feedback.networkError')
    return e.message
  }
  return t('product.errorLoad')
}

export default function ProductDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const cart = useCart()
  const favorites = useFavorites()
  const { t } = useI18n()

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
        setError(productErrorMessage(d.reason, t))
      }
      setSimilar(s.status === 'fulfilled' ? s.value.products ?? [] : [])
      setReviewSummary(r.status === 'fulfilled' ? r.value.summary : null)
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [id, t])

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
  const specifications = useMemo(() => extractSpecifications(variants), [variants])

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

  if (loading) return <LoadingBlock label={t('product.loading')} />
  if (!product)
    return (
      <ErrorBox
        error={error || t('product.notFound')}
        onRetry={notFound ? undefined : () => window.location.reload()}
      />
    )

  const p = product
  const v = variant
  if (!v) return <ErrorBox error={t('product.noPurchasable')} />

  const outOfStock = v.stock === 'OUT_OF_STOCK'
  const lowStock = v.stock === 'LOW_STOCK'
  const maxQty = v.stock_quantity > 0 ? v.stock_quantity : 1
  // Same resolver as the product card and the cart, so the listing, this page
  // and checkout always quote the same effective price.
  const promotion = resolvePromotion({ ...p, seller_sale_price: v.unit_price }, v.base_price)
  const regularPrice = promotion.originalPrice
  const sellerSalePrice = promotion.effectivePrice
  const promotionUpcoming = promotion.phase === 'upcoming'
  const promotionActive = promotion.phase === 'active'
  const hasSellerDiscount = promotionActive && promotion.discountPercent > 0

  // The buyer-level discount stacks on top of the promotion and is computed
  // server-side, so it is only trusted when the server actually sent a price.
  const buyerDiscountPercent = p.discount_percent ?? 0
  const finalPrice = typeof p.final_price === 'number' && p.final_price > 0 ? p.final_price : sellerSalePrice
  const hasBuyerDiscount = Boolean(user && buyerDiscountPercent > 0 && finalPrice < sellerSalePrice)

  const displayPrice = finalPrice
  const isFav = favorites.has(p.id)
  const descriptionParts = (p.description || '')
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((part) => part.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
  const highlights = descriptionParts.slice(0, 5)
  const shortDescription = descriptionParts[0] || t('product.discoverFrom', { name: p.name })

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
      unitPrice: sellerSalePrice,
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
      price: sellerSalePrice,
      currency: 'FC',
      unit: p.unit,
      addedAt: new Date().toISOString()
    })
  }

  return (
    <div className="fade-in">
      <nav className="pd-breadcrumb" aria-label={t('product.breadcrumb')}>
        <Link to="/">{t('nav.marketplace')}</Link><span>›</span>
        {p.category && <><Link to={`/categories/${p.category.slug}`}>{p.category.name}</Link><span>›</span></>}
        <span aria-current="page">{p.name}</span>
      </nav>

      <div className="pd-grid" style={{ marginTop: 12 }}>
        <Gallery
          name={p.name}
          badge={<StockChip stock={v.stock} quantity={v.stock_quantity} />}
          images={(p.images ?? []).map((img) => ({
            url: img.url,
            alt: img.file_name || p.name,
            variantId: img.variant_id
          }))}
          focusUrl={(p.images ?? []).find((img) => img.variant_id === v.id)?.url}
        />

        <div className="pd-details">
          <header className="pd-header">
            <h1>{p.name}</h1>
            {reviewSummary && reviewSummary.total_reviews > 0 ? (
              <a className="pd-rating-link" href="#customer-reviews">
                <strong>{reviewSummary.average_rating.toFixed(1)} ★</strong>
                <span>{reviewSummary.total_reviews} {reviewSummary.total_reviews === 1 ? t('reviews.rating') : t('reviews.ratingsPlural')}</span>
              </a>
            ) : (
              <a className="pd-rating-link pd-rating-link--empty" href="#customer-reviews">
                <span>{t('reviews.noneYet')}</span>
              </a>
            )}
            <div className="pd-seller-line">{t('product.soldBy')} <Link to={`/shops/${p.shop_id}`}>{p.shop_name}</Link> · {p.seller_level} {t('product.sellerLevelSuffix')}</div>
          </header>

          <section className="pd-price-block" aria-label={t('common.price')} aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '2rem', color: 'var(--color-primary)' }}>{formatMoney(displayPrice)}</strong>
              <span className="muted" style={{ fontSize: '1.1rem' }}>{t('product.perUnit', { unit: p.unit })}</span>
              
              {hasSellerDiscount && (
                <span className="badge badge-success" style={{ fontWeight: 'bold' }}>
                  {t('product.discountOff', { percent: promotion.discountPercent })}
                </span>
              )}

              {hasBuyerDiscount && (
                <span className="badge badge-primary" style={{ fontWeight: 'bold' }}>
                  {t('product.loyaltyDiscount', { percent: buyerDiscountPercent })}
                </span>
              )}
            </div>

            {(hasSellerDiscount || hasBuyerDiscount) && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }} className="small muted">
                {hasSellerDiscount && (
                  <span>
                    {t('product.regular')}: <del>{formatMoney(regularPrice)}</del>
                  </span>
                )}
                {hasSellerDiscount && hasBuyerDiscount && (
                  <span>
                    {t('product.promo')}: <strong>{formatMoney(sellerSalePrice)}</strong>
                  </span>
                )}
                {hasBuyerDiscount && (
                  <span>
                    {t('product.levelDiscount')}: <strong>{formatMoney(sellerSalePrice - finalPrice)} {t('product.saved')}</strong>
                  </span>
                )}
              </div>
            )}
            {promotionUpcoming && (
              <div className="notice notice-info small" role="status">
                {p.discount_end
                  ? t('product.promotionStartsEnds', { start: formatDate(p.discount_start), end: formatDate(p.discount_end) })
                  : t('product.promotionStarts', { start: formatDate(p.discount_start) })}
              </div>
            )}
            {hasSellerDiscount && (p.discount_start || p.discount_end) && (
              <div className="small muted">
                {t('product.offerPeriod')}: {p.discount_start ? formatDate(p.discount_start) : t('product.activeNow')}
                {' → '}{p.discount_end ? formatDate(p.discount_end) : t('product.untilFurtherNotice')}
              </div>
            )}
          </section>

          <p className="pd-summary">{shortDescription}</p>

          {multiVariant &&
            groups.map((g) => (
              <section className="pd-option-group" key={g.key} aria-labelledby={`option-${g.key}`}>
                <div id={`option-${g.key}`} className="pd-option-label">{g.label}: <strong>{selection[g.key]}</strong></div>
                <div className="attr-options" role="group" aria-label={g.label}>
                  {g.values.map((val) => {
                    const selectedVal = selection[g.key] === val
                    const exists = isValueAvailable(variants, selection, g.key, val, false)
                    const inStock = isValueAvailable(variants, selection, g.key, val, true)
                    const disabled = !exists
                    return (
                      <button
                        key={val}
                        type="button"
                        aria-pressed={selectedVal}
                        disabled={disabled}
                        title={disabled ? t('product.combinationUnavailable', { name: val }) : !inStock ? t('product.combinationOutOfStock', { name: val }) : val}
                        className={`attr-option ${selectedVal ? 'selected' : ''} ${disabled ? 'unavailable' : !inStock ? 'low-stock' : ''}`}
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
              <div id="option-variant" className="pd-option-label">{t('product.variant')}: <strong>{v.name || v.sku}</strong></div>
              <div className="attr-options" role="group" aria-label={t('product.variant')}>
                {variants.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={item.id === v.id}
                    disabled={item.stock === 'OUT_OF_STOCK'}
                    className={`attr-option ${item.id === v.id ? 'selected' : ''} ${item.stock === 'OUT_OF_STOCK' ? 'unavailable' : ''}`}
                    onClick={() => selectVariantId(item.id)}
                  >
                    {item.name || item.sku || `${t('product.variant')} ${variants.indexOf(item) + 1}`}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className={`pd-stock ${outOfStock ? 'out' : lowStock ? 'low' : 'in'}`} aria-live="polite">
            <strong>{outOfStock ? t('stock.outOfStock') : lowStock ? t('stock.onlyLeft', { count: v.stock_quantity }) : t('stock.available', { count: v.stock_quantity })}</strong>
            <span>{t('product.selectedSku')} {v.sku || p.sku}</span>
          </section>

          <div className="pd-quantity-row">
            <strong>{t('common.quantity')}</strong>
            <div className="stepper" role="group" aria-label={t('common.quantity')}>
              <button onClick={() => changeQty(qty - 1)} disabled={qty <= 1} aria-label={t('product.decreaseQuantity')}>
                −
              </button>
              <span className="stepper-qty" aria-live="polite">{qty}</span>
              <button onClick={() => changeQty(qty + 1)} disabled={qty >= maxQty} aria-label={t('product.increaseQuantity')}>
                +
              </button>
            </div>
          </div>

          <section className="pd-delivery">
            <strong>{t('product.delivery')}</strong>
            <span>{p.free_delivery ? t('product.freeDelivery') : t('product.deliveryNote')}</span>
            {Boolean(p.delivery_discount_percent) && <small>{t('product.deliveryDiscount', { percent: p.delivery_discount_percent as number })}</small>}
          </section>

          <div className="pd-subtotal"><span>{t('product.subtotalWithQty', { qty, unit: qty === 1 ? p.unit : `${p.unit}s` })}</span><strong aria-live="polite">{formatMoney(displayPrice * qty)}</strong></div>

          {added && <SuccessBox message={t('product.addedToCart')} />}

          <div className="pd-actions">
            <Button variant="outline" size="lg" block disabled={outOfStock} onClick={addToCart}>{t('product.addToCart')}</Button>
            <Button variant="accent" size="lg" block disabled={outOfStock} onClick={buyNow}>{outOfStock ? t('product.unavailable') : t('product.buyNow')}</Button>
          </div>
          <div className="pd-favorite">
            <Button variant="outline" block onClick={toggleFavorite} aria-pressed={isFav}>
              {isFav ? t('product.inFavorites') : t('product.addToFavorites')}
            </Button>
          </div>

          {!user && (
            <p className="small muted">
              <Link to={loginWithReturnTo(`/products/${p.id}`)} className="section-link">
                {t('common.signIn')}
              </Link>{' '}
              {t('product.signInForPrice')}
            </p>
          )}
        </div>
      </div>

      <div className="pd-mobile-purchase" aria-label={t('product.purchaseActions')}>
        <div><small>{outOfStock ? t('product.unavailable') : `${qty} × ${formatMoney(displayPrice)}`}</small><strong>{formatMoney(displayPrice * qty)}</strong></div>
        <Button variant="outline" disabled={outOfStock} onClick={addToCart}>{t('product.addToCart')}</Button>
        <Button variant="accent" disabled={outOfStock} onClick={buyNow}>{t('product.buyNow')}</Button>
      </div>

      <div className="pd-information">
        <section className="pd-info-section" aria-labelledby="product-description">
          <h2 id="product-description">{t('product.description')}</h2>
          <ul className="pd-highlights">
            {(highlights.length > 0 ? highlights : [shortDescription]).map((highlight, index) => (
              <li key={`${highlight}-${index}`}>{highlight}</li>
            ))}
            <li>{v.stock_quantity > 0 ? t('product.unitsAvailable', { count: v.stock_quantity }) : t('product.currentlyOutOfStock')}</li>
          </ul>
          {descriptionParts.length > highlights.length && (
            <div className="pd-description-copy">
              {descriptionParts.slice(highlights.length).map((paragraph, index) => (
                <p key={`${paragraph}-${index}`}>{paragraph}</p>
              ))}
            </div>
          )}
        </section>

        <section className="pd-info-section" aria-labelledby="product-specifications">
          <h2 id="product-specifications">{t('product.specifications')}</h2>
          <dl className="pd-specifications">
            <div><dt>{t('product.product')}</dt><dd>{p.name}</dd></div>
            <div><dt>{t('product.category')}</dt><dd>{p.category?.name ?? t('product.general')}</dd></div>
            {p.subcategory && <div><dt>{t('product.subcategory')}</dt><dd>{p.subcategory.name}</dd></div>}
            {specifications.map((spec) => (
              <div key={spec.key}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>
            ))}
            {(v.sku || p.sku) && <div><dt>SKU</dt><dd className="mono">{v.sku || p.sku}</dd></div>}
            <div><dt>{t('product.unit')}</dt><dd>{p.unit}</dd></div>
            <div><dt>{t('product.seller')}</dt><dd><Link to={`/shops/${p.shop_id}`}>{p.shop_name}</Link></dd></div>
            <div><dt>{t('product.sellerLevel')}</dt><dd>{p.seller_level}</dd></div>
            <div><dt>{t('product.listed')}</dt><dd>{formatDate(p.created_at)}</dd></div>
          </dl>
        </section>
      </div>

      <ProductReviews productId={p.id} signedIn={Boolean(user)} onRequireLogin={() => navigate(loginWithReturnTo(`/products/${p.id}`))} />

      {similar.length > 0 && (
        <>
          <div className="section-head">
            <h2>{t('product.similarProducts')}</h2>
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
  const { t } = useI18n()
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
      <div className="section-head"><h2 id="customer-reviews">{t('reviews.title')}</h2></div>
      <div className="review-layout">
        <aside className="review-summary card">
          <div className="review-score">{(summary?.average_rating ?? 0).toFixed(1)} <span>★</span></div>
          <div className="muted">{t('reviews.verifiedReviews', { count: summary?.total_reviews ?? 0 })}</div>
          {[5,4,3,2,1].map((n) => {
            const count = summary?.[`rating_${n}_count` as keyof typeof summary] as number ?? 0
            const pct = summary?.total_reviews ? count / summary.total_reviews * 100 : 0
            // Filtering to a rating nobody gave would only ever show an empty
            // list, so those rows stay inert rather than looking clickable.
            const selectable = count > 0
            return (
              <button
                className={`rating-row${selectable ? '' : ' is-empty'}`}
                key={n}
                disabled={!selectable}
                onClick={() => selectable && setRating(rating === n ? undefined : n)}
                aria-pressed={rating === n}
                title={selectable ? t('reviews.showOnlyStars', { stars: n }) : t('reviews.noStarReviews', { stars: n })}
              >
                <span>{n} ★</span><i><b style={{ width: `${pct}%` }} /></i><span>{count}</span>
              </button>
            )
          })}
          {rating !== undefined && (
            <button type="button" className="review-clear-filter" onClick={() => setRating(undefined)}>
              {t('reviews.clearStarsFilter', { stars: rating })}
            </button>
          )}
        </aside>
        <div className="review-feed">
          <div className="row-between"><strong>{t('reviews.ratings')}</strong><select className="input review-sort" value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">{t('reviews.sortNewest')}</option><option value="helpful">{t('reviews.sortHelpful')}</option><option value="highest_rating">{t('reviews.sortHighest')}</option><option value="lowest_rating">{t('reviews.sortLowest')}</option></select></div>
          {data?.reviews.length ? data.reviews.map((review) => (
            <article className="review-card" key={review.id}>
              <div className="review-meta"><span className="review-stars">{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</span><strong>{review.buyer_display_name || t('reviews.buyer')}</strong>{review.verified_purchase && <span className="verified-badge">✓ {t('reviews.verifiedPurchase')}</span>}<span className="muted">{formatDate(review.created_at)}</span></div>
              {review.comment && <p>{review.comment}</p>}
              <div className="review-actions"><button onClick={() => helpful(review.id, review.helpful_by_me)} aria-pressed={review.helpful_by_me}>{review.helpful_by_me ? `${t('reviews.helpfulActive')} ✓` : t('reviews.helpful')} ({review.helpful_count})</button><button onClick={() => signedIn ? setReplying(replying === review.id ? null : review.id) : onRequireLogin()}>{t('reviews.reply')}</button></div>
              {review.replies?.map((r) => <div className="review-reply" key={r.id}><strong>{r.author_display_name}</strong><span className="muted"> · {formatDate(r.created_at)}</span><p>{r.body}</p></div>)}
              {replying === review.id && <div className="review-reply-form"><textarea className="input" rows={2} maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t('reviews.replyPlaceholder')} /><Button size="sm" onClick={() => sendReply(review.id)}>{t('reviews.postReply')}</Button></div>}
            </article>
          )) : <div className="card muted">{t('reviews.noneYetLong')}</div>}
        </div>
      </div>
    </section>
  )
}
