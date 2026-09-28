import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { marketplaceApi } from '@/api/marketplace'
import { ApiError } from '@/api/types'
import type { ProductReviewsResponse, PublicProduct, PublicProductDetail, PublicVariantDetail } from '@/api/types'
import { ErrorBox, LoadingBlock, SuccessBox } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { ProductCard } from '@/components/ui/ProductCard'
import { Gallery } from '@/components/ui/Gallery'
import { formatMoney, formatDate } from '@/lib/format'
import {
  buildAttributeGroups,
  describeAttributes,
  extractSpecifications,
  hasRealVariants,
  bestVariantFor,
  optionValueState,
  resolveVariant,
  variantOptionLabel,
  type VariantSelection
} from '@/lib/variants'
import { resolvePromotion } from '@/lib/promotion'
import { categoryLabel, subcategoryLabel } from '@/lib/categoryLabels'
import { loginWithReturnTo } from '@/lib/returnTo'
import { useCart } from '@/store/cart'
import { reportSearchAddToCart } from '@/lib/searchTracking'
import { useAuth } from '@/store/auth'
import { useFavorites } from '@/store/favorites'
import { DescriptionParagraphs, descriptionAccordionItems } from '@/components/ui/DescriptionSections'
import { getCategoryVisual } from '@/lib/categoryVisuals'
import { colorSwatch, isColorAttribute } from '@/lib/colorSwatch'
import { useI18n } from '@/store/i18n'
import '@/styles/product-detail.css'

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
  const structured = descriptionAccordionItems(p.description)
  const descriptionParts = structured.intro
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((part) => part.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
  const shortDescription = descriptionParts[0] || t('product.discoverFrom', { name: p.name })

  function selectValue(key: string, value: string) {
    // Land on the variant that keeps most of the other choices: jumping to the
    // first in-stock match used to reset colour when the buyer changed size.
    const matching = bestVariantFor(variants, selection, key, value)
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
    reportSearchAddToCart(p.id)
    cart.add({
      productId: p.id,
      variantId: v.id,
      quantity: qty,
      name: p.name,
      variantName: describeAttributes(v),
      attributes: v.attributes,
      unit: p.unit,
      unitPrice: sellerSalePrice,
      currency: p.currency ?? 'USD',
      shopId: p.shop_id,
      shopName: p.shop_name,
      image: p.images?.find((img) => img.is_primary)?.url ?? p.images?.[0]?.url
    })
    setAdded(true)
  }

  function buyNow() {
    if (!v || outOfStock) return
    cart.buyNow({
      productId: p.id, variantId: v.id, quantity: qty, name: p.name,
      variantName: describeAttributes(v), attributes: v.attributes, unit: p.unit,
      unitPrice: sellerSalePrice, currency: p.currency ?? 'USD', shopId: p.shop_id,
      shopName: p.shop_name,
      image: p.images?.find((img) => img.is_primary)?.url ?? p.images?.[0]?.url
    })
    navigate('/checkout/buy-now')
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
      currency: p.currency ?? 'USD',
      unit: p.unit,
      addedAt: new Date().toISOString()
    })
  }

  const stockState = outOfStock ? 'out' : lowStock ? 'low' : 'in'
  const categoryName = p.category ? categoryLabel(t, p.category.slug, p.category.name) : ''
  const subcategoryName = p.subcategory?.name ? subcategoryLabel(t, p.subcategory.slug, p.subcategory.name) : ''
  const sku = v.sku || p.sku
  const trusted = p.seller_trust === 'HIGH'
  const currency = p.currency ?? 'USD'
  const specRows = [
    ...(categoryName ? [{ key: 'category', label: t('product.category'), value: categoryName }] : []),
    ...(subcategoryName ? [{ key: 'subcategory', label: t('product.subcategory'), value: subcategoryName }] : []),
    ...(p.unit ? [{ key: 'unit', label: t('product.unit'), value: p.unit }] : []),
    ...specifications.map((spec) => ({ key: spec.key, label: spec.label, value: spec.value })),
    { key: 'seller-level', label: t('product.sellerLevel'), value: p.seller_level },
    { key: 'listed', label: t('product.listed'), value: formatDate(p.created_at) },
  ]
  const stockLabel = outOfStock
    ? t('stock.outOfStock')
    : lowStock
    ? t('stock.onlyLeft', { count: v.stock_quantity })
    : t('stock.available', { count: v.stock_quantity })

  const actionButtons = (
    <>
      <button type="button" className="pdx-cart-btn" disabled={outOfStock} onClick={addToCart}>
        <BagIcon />
        <span>{t('product.cartShort')}</span>
      </button>
      <button type="button" className="pdx-order-btn" disabled={outOfStock} onClick={buyNow}>
        {outOfStock ? t('product.unavailable') : t('product.orderNow')}
      </button>
    </>
  )

  return (
    <div className="fade-in product-detail-page pdx">
      <nav className="pd-breadcrumb" aria-label={t('product.breadcrumb')}>
        <Link to="/">{t('nav.marketplace')}</Link><span>›</span>
        {p.category && <><Link to={`/categories/${p.category.slug}`}>{categoryName}</Link><span>›</span></>}
        <span aria-current="page">{p.name}</span>
      </nav>

      <div className="pd-grid pdx-grid">
        <Gallery
          name={p.name}
          fallback={getCategoryVisual(p.category?.slug ?? '')}
          badge={
            <span className={`pdx-stock-chip is-${stockState}`}>
              <i aria-hidden="true" />
              {outOfStock ? t('stock.outOfStock') : lowStock ? t('stock.lowStock') : t('stock.inStock')}
            </span>
          }
          topRight={
            <button
              type="button"
              className={`pdx-fav ${isFav ? 'is-active' : ''}`}
              onClick={toggleFavorite}
              aria-pressed={isFav}
              aria-label={isFav ? t('product.inFavorites') : t('product.addToFavorites')}
              title={isFav ? t('product.inFavorites') : t('product.addToFavorites')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" /></svg>
            </button>
          }
          caption={categoryName ? `${categoryName}${subcategoryName ? ` / ${subcategoryName}` : ''}` : undefined}
          images={(p.images ?? []).map((img) => ({
            url: img.url,
            alt: img.file_name || p.name,
            variantId: img.variant_id
          }))}
          focusUrl={(p.images ?? []).find((img) => img.variant_id === v.id)?.url}
        />

        <div className="pd-details pdx-details">
          <div className="pdx-seller-row">
            <div className="pdx-seller">
              <span className="pdx-meta">{t('product.soldBy')}</span>
              <Link to={`/shops/${p.shop_id}`} className="pdx-shop-chip">{p.shop_name}</Link>
              {trusted && (
                <svg className="pdx-trusted" width="16" height="16" viewBox="0 0 24 24" role="img" aria-label={t('product.trustedSeller')}>
                  <circle cx="12" cy="12" r="10" fill="currentColor" />
                  <path d="m7.5 12.5 3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            {sku && <span className="pdx-meta">{t('product.skuLabel', { sku })}</span>}
          </div>

          <h1 className="pdx-title">{p.name}</h1>

          <div className="pdx-rating">
            {reviewSummary && reviewSummary.total_reviews > 0 ? (
              <>
                <span className="pdx-stars" aria-hidden="true">{stars(reviewSummary.average_rating)}</span>
                <strong>{reviewSummary.average_rating.toFixed(1)}</strong>
                <span className="pdx-dot-sep">•</span>
                <a href="#customer-reviews">{reviewSummary.total_reviews} {reviewSummary.total_reviews === 1 ? t('reviews.rating') : t('reviews.ratingsPlural')}</a>
              </>
            ) : typeof p.self_rating === 'number' && p.self_rating > 0 ? (
              <span title={t('product.selfRatingHint')}>
                <span className="pdx-stars" aria-hidden="true">{stars(p.self_rating)}</span>{' '}
                <span className="pdx-muted">{t('product.selfRatingLabel')}</span>
              </span>
            ) : (
              <a href="#customer-reviews" className="pdx-muted">{t('reviews.noneYet')}</a>
            )}
          </div>

          <section className="pdx-card pdx-price-card" aria-label={t('common.price')} aria-live="polite">
            <div className="pdx-price-top">
              <div>
                <span className="pdx-meta">{t('product.unitPriceLabel')}</span>
                <div className="pdx-price-row">
                  <strong className={`pdx-price ${hasSellerDiscount ? 'is-sale' : ''}`}>{formatMoney(displayPrice, currency)}</strong>
                  {p.unit && <span className="pdx-meta">/ {p.unit}</span>}
                </div>
                {hasSellerDiscount && <del className="pdx-was">{formatMoney(regularPrice, currency)}</del>}
              </div>
              <div className="pdx-badges">
                {hasSellerDiscount && <span className="pdx-promo">-{promotion.discountPercent}%</span>}
                {hasBuyerDiscount && <span className="pdx-promo">{t('product.loyaltyDiscount', { percent: buyerDiscountPercent })}</span>}
              </div>
            </div>
            {hasSellerDiscount && hasBuyerDiscount && (
              <div className="pdx-muted pdx-small">
                {t('product.promo')}: <strong>{formatMoney(sellerSalePrice, currency)}</strong> · {t('product.levelDiscount')}: <strong>{formatMoney(sellerSalePrice - finalPrice, currency)} {t('product.saved')}</strong>
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
              <div className="pdx-muted pdx-small">
                {t('product.offerPeriod')}: {p.discount_start ? formatDate(p.discount_start) : t('product.activeNow')}
                {' → '}{p.discount_end ? formatDate(p.discount_end) : t('product.untilFurtherNotice')}
              </div>
            )}
            <hr />
            <div className="pdx-price-bottom">
              <span className={`pdx-stock is-${stockState}`}><i aria-hidden="true" />{stockLabel}</span>
              <span className="pdx-delivery">
                <span className="pdx-meta">{t('product.delivery')}</span>
                <strong>{p.free_delivery ? t('product.deliveryFree') : t('product.deliveryAtCheckout')}</strong>
              </span>
            </div>
          </section>

          {multiVariant &&
            groups.map((g) => {
              const colour = isColorAttribute(g.key, g.label)
              const shortValues = g.values.every((val) => val.length <= 4)
              return (
                <section className="pdx-option" key={g.key} aria-labelledby={`option-${g.key}`}>
                  <div className="pdx-option-head">
                    <span id={`option-${g.key}`} className="pdx-meta pdx-option-label">
                      {g.label} : <strong>{selection[g.key] ?? t('product.toChoose')}</strong>
                    </span>
                    {g.values.length > 1 && <span className="pdx-meta">{t('product.optionsCount', { count: g.values.length })}</span>}
                  </div>
                  <div className={colour ? 'pdx-colour-grid' : `pdx-tiles ${shortValues ? 'is-even' : ''}`} role="group" aria-label={g.label}>
                    {g.values.map((val) => {
                      const selectedVal = selection[g.key] === val
                      const { exists, compatible, units } = optionValueState(variants, selection, g.key, val)
                      const soldOut = !exists || units < 1
                      const title = !exists ? t('product.combinationUnavailable', { name: val }) : soldOut ? t('product.combinationOutOfStock', { name: val }) : val
                      const otherCombo = exists && !compatible
                      if (colour) {
                        return (
                          <button
                            key={val}
                            type="button"
                            aria-pressed={selectedVal}
                            disabled={!exists}
                            title={title}
                            className={`pdx-colour ${selectedVal ? 'is-selected' : ''} ${otherCombo ? 'is-other' : ''}`}
                            onClick={() => selectValue(g.key, val)}
                          >
                            <span className="pdx-colour-dot" style={{ background: colorSwatch(val) ?? 'var(--color-surface-muted)' }}>{selectedVal && <i />}</span>
                            <span className="pdx-colour-text">
                              <strong>{val}</strong>
                              <small className={soldOut ? 'is-out' : units <= 3 ? 'is-low' : 'is-in'}>
                                {soldOut ? t('product.valueSoldOut') : units <= 3 ? t('product.valueLowStock', { count: units }) : t('product.valueStock', { count: units })}
                              </small>
                            </span>
                          </button>
                        )
                      }
                      return (
                        <button
                          key={val}
                          type="button"
                          aria-pressed={selectedVal}
                          disabled={!exists}
                          title={title}
                          className={`pdx-tile ${selectedVal ? 'is-selected' : ''} ${soldOut ? 'is-out' : ''} ${otherCombo ? 'is-other' : ''}`}
                          onClick={() => selectValue(g.key, val)}
                        >
                          <span>{val}</span>
                          {soldOut && <small>{t('product.valueSoldOut')}</small>}
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}

          {!multiVariant && variants.length > 1 && (
            <section className="pdx-option" aria-labelledby="option-variant">
              <div className="pdx-option-head">
                <span id="option-variant" className="pdx-meta pdx-option-label">{t('product.variant')} : <strong>{variantOptionLabel(v, p.name)}</strong></span>
              </div>
              <div className="pdx-tiles" role="group" aria-label={t('product.variant')}>
                {variants.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={item.id === v.id}
                    disabled={item.stock === 'OUT_OF_STOCK'}
                    className={`pdx-tile ${item.id === v.id ? 'is-selected' : ''} ${item.stock === 'OUT_OF_STOCK' ? 'is-out' : ''}`}
                    onClick={() => selectVariantId(item.id)}
                  >
                    <span>{variantOptionLabel(item, p.name) || `${t('product.variant')} ${variants.indexOf(item) + 1}`}</span>
                    {item.stock === 'OUT_OF_STOCK' && <small>{t('product.valueSoldOut')}</small>}
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="pdx-card pdx-qty">
            <div>
              <strong className="pdx-meta pdx-qty-title">{t('common.quantity')}</strong>
              <span className="pdx-muted pdx-small" aria-live="polite">{t('product.subtotalValue', { amount: formatMoney(displayPrice * qty, currency) })}</span>
            </div>
            <div className="pdx-stepper" role="group" aria-label={t('common.quantity')}>
              <button type="button" onClick={() => changeQty(qty - 1)} disabled={qty <= 1} aria-label={t('product.decreaseQuantity')}>−</button>
              <span aria-live="polite">{qty}</span>
              <button type="button" onClick={() => changeQty(qty + 1)} disabled={qty >= maxQty} aria-label={t('product.increaseQuantity')}>+</button>
            </div>
          </div>

          {added && <SuccessBox message={t('product.addedToCart')} />}

          <div className="pdx-actions">{actionButtons}</div>

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

      <div className="pdx-info-grid">
        <section className="pdx-block">
          <SectionHeader title={t('product.specifications')} />
          <dl className="pdx-card pdx-specs">
            {specRows.map((row) => (
              <div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>
            ))}
          </dl>
        </section>
        <section className="pdx-block">
          <SectionHeader title={t('product.infoTitle')} />
          <InfoCards
            items={[
              {
                id: 'product-description',
                title: t('product.description'),
                icon: <DocIcon />,
                defaultOpen: true,
                content: <DescriptionParagraphs text={descriptionParts.length > 0 ? descriptionParts.join('\n') : shortDescription} />
              },
              ...structured.items.map((item) => ({ ...item, icon: <ListIcon /> })),
              {
                id: 'product-delivery',
                title: t('product.delivery'),
                icon: <BoxIcon />,
                content: (
                  <>
                    <p>{p.free_delivery ? t('product.freeDelivery') : t('product.deliveryNote')}</p>
                    {Boolean(p.delivery_discount_percent) && <p>{t('product.deliveryDiscount', { percent: p.delivery_discount_percent as number })}</p>}
                  </>
                )
              }
            ]}
          />
        </section>
      </div>

      <ProductReviews productId={p.id} signedIn={Boolean(user)} onRequireLogin={() => navigate(loginWithReturnTo(`/products/${p.id}`))} />

      {similar.length > 0 && (
        <section className="pdx-similar-section" aria-label={t('product.similarProducts')}>
          <SectionHeader title={t('product.similarProducts')} />
          <div className="pdx-similar">
            {similar.map((sp) => (
              <ProductCard key={sp.id} product={sp} />
            ))}
          </div>
        </section>
      )}

      <div className="pdx-bar" role="region" aria-label={t('product.addToCart')}>
        <div className="pdx-bar-total">
          <span className="pdx-meta">{t('product.total')}</span>
          <strong>{formatMoney(displayPrice * qty, currency)}</strong>
          <small>{t('product.totalDetail', { qty, price: formatMoney(displayPrice, currency) })}</small>
        </div>
        {actionButtons}
      </div>
    </div>
  )
}

const stars = (rating: number) => {
  const full = Math.max(0, Math.min(5, Math.round(rating)))
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}

/** Accent square + uppercase label heading a page section. */
function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="pdx-section-header">
      <i aria-hidden="true" />
      {title}
    </h2>
  )
}

interface InfoCardItem {
  id: string
  title: string
  icon: ReactNode
  content: ReactNode
  defaultOpen?: boolean
}

/** Framed, individually collapsible cards for the long-form product text. */
function InfoCards({ items }: { items: InfoCardItem[] }) {
  return (
    <div className="pdx-info-cards">
      {items.map((item) => (
        <details key={item.id} className="pdx-card pdx-info-card" open={item.defaultOpen}>
          <summary>
            <span className="pdx-info-icon" aria-hidden="true">{item.icon}</span>
            <span className="pdx-info-title">{item.title}</span>
            <svg className="pdx-chevron" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </summary>
          <div className="pdx-info-body">{item.content}</div>
        </details>
      ))}
    </div>
  )
}

const iconProps = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
function BagIcon() {
  return <svg {...iconProps} aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
}
function DocIcon() {
  return <svg {...iconProps}><path d="M14 3H6v18h12V7l-4-4Z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>
}
function ListIcon() {
  return <svg {...iconProps}><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></svg>
}
function BoxIcon() {
  return <svg {...iconProps}><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></svg>
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
          <div className="row-between"><strong>{t('reviews.ratings')}</strong><select className="input review-sort" aria-label={t('reviews.sortBy')} value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">{t('reviews.sortNewest')}</option><option value="helpful">{t('reviews.sortHelpful')}</option><option value="highest_rating">{t('reviews.sortHighest')}</option><option value="lowest_rating">{t('reviews.sortLowest')}</option></select></div>
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
