import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { PublicProduct } from '@/api/types'
import { dateLocale as dateLocaleFor, formatDate, formatMoney } from '@/lib/format'
import { resolvePromotion } from '@/lib/promotion'
import { getCategoryVisual } from '@/lib/categoryVisuals'
import { categoryLabel } from '@/lib/categoryLabels'
import { useFavorites } from '@/store/favorites'
import { useI18n } from '@/store/i18n'
import { StockChip } from './Badges'
import { Rating } from './Rating'

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  )
}

function FavoriteButton({ product }: { product: PublicProduct }) {
  const { t } = useI18n()
  const { has, toggle } = useFavorites()
  const active = has(product.id)
  const first = product.variants?.[0]
  return (
    <button
      type="button"
      className={`card-fav ${active ? 'is-active' : ''}`}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle({
          productId: product.id,
          name: product.name,
          shopId: product.shop_id,
          shopName: product.shop_name,
          price: first?.unit_price ?? product.base_price,
          currency: product.currency ?? 'USD',
          unit: product.unit,
          addedAt: new Date().toISOString()
        })
      }}
      aria-label={active ? t('product.removeFromFavorites') : t('product.addToFavorites')}
    >
      <HeartIcon filled={active} />
    </button>
  )
}

export function ProductCard({ product }: { product: PublicProduct }) {
  const { t, lang } = useI18n()
  const dateLocale = dateLocaleFor(lang)
  const [imageFailed, setImageFailed] = useState(false)
  const first = product.variants?.[0]
  
  // Same resolver as the product page and the cart, so a buyer never sees one
  // price on the listing and another after clicking through.
  const promotion = resolvePromotion(
    product,
    first?.base_price || product.base_price || 0
  )
  const { originalPrice, effectivePrice: salePrice, discountPercent } = promotion
  const hasDiscount = promotion.phase === 'active' && discountPercent > 0
  const promotionUpcoming = promotion.phase === 'upcoming'

  const link = `/products/${product.id}`
  const cover = product.images?.find((img) => img.is_primary) ?? product.images?.[0]
  const fallback = getCategoryVisual(product.category_slug ?? '')
  const availability = product.availability ?? first?.stock ?? 'AVAILABLE'

  const reviewCount = product.total_reviews ?? 0
  const rating = reviewCount > 0 ? (product.average_rating ?? 0) : (product.self_rating ?? 0)

  const outOfStock = availability === 'OUT_OF_STOCK'

  return (
    <Link to={link} className={`product-card ${outOfStock ? 'is-out' : ''}`}>
      <div
        className="product-thumb"
        style={{ background: fallback.background }}
      >
        {cover && !imageFailed ? (
          <img
            src={cover.url}
            alt={product.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <img
            className="product-fallback-image"
            src={fallback.image}
            alt=""
            aria-hidden="true"
          />
        )}
        <span className="thumb-chip">
          <FavoriteButton product={product} />
        </span>
        <span className="card-badges">
          {outOfStock && <span className="card-badge card-badge--out">{t('stock.outOfStock')}</span>}
          {!outOfStock && hasDiscount && (
            <span className="card-badge card-badge--sale">-{discountPercent}%</span>
          )}
          {!outOfStock && promotionUpcoming && product.discount_start && (
            <span className="card-badge card-badge--soon">
              {t('product.saleStarts', { date: formatDate(product.discount_start, dateLocale) })}
            </span>
          )}
        </span>
      </div>
      <div className="product-body">
        {product.category_name && (
          <span className="product-category-chip">{categoryLabel(t, product.category_slug, product.category_name)}</span>
        )}
        <span className="product-name">{product.name}</span>
        <span className="product-meta">
          {product.shop_name && <span className="product-shop">{product.shop_name}</span>}
        </span>
        <Rating value={rating} count={reviewCount > 0 ? reviewCount : undefined} size="sm" />
        {!outOfStock && <StockChip stock={availability} />}
        <div className="product-price-row">
          {hasDiscount ? (
            <>
              <span className="product-price is-sale">{formatMoney(salePrice)}</span>
              <del className="product-price-was">{formatMoney(originalPrice)}</del>
            </>
          ) : (
            <span className="product-price">{formatMoney(salePrice)}</span>
          )}
        </div>
        {hasDiscount && (product.discount_start || product.discount_end) && (
          <span className="small muted">
            {product.discount_start
              ? t('product.promoFrom', { date: formatDate(product.discount_start, dateLocale) })
              : t('product.promoActiveNow')}
            {product.discount_end ? t('product.promoTo', { date: formatDate(product.discount_end, dateLocale) }) : ''}
          </span>
        )}
      </div>
    </Link>
  )
}
