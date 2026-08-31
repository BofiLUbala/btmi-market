import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { PublicProduct } from '@/api/types'
import { formatDate, formatMoney } from '@/lib/format'
import { resolvePromotion } from '@/lib/promotion'
import { getCategoryVisual } from '@/lib/categoryVisuals'
import { useFavorites } from '@/store/favorites'
import { useI18n } from '@/store/i18n'
import { StockChip } from './Badges'
import { Rating } from './Rating'

function FavoriteButton({ product }: { product: PublicProduct }) {
  const { t } = useI18n()
  const { has, toggle } = useFavorites()
  const active = has(product.id)
  const first = product.variants?.[0]
  return (
    <button
      type="button"
      className="btn btn-sm"
      style={{
        background: 'rgba(0,0,0,0.35)',
        color: active ? 'var(--color-star)' : '#fff',
        border: 'none',
        borderRadius: 999,
        minWidth: 30
      }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle({
          productId: product.id,
          name: product.name,
          shopId: product.shop_id,
          shopName: product.shop_name,
          price: first?.unit_price ?? product.base_price,
          currency: 'FC',
          unit: product.unit,
          addedAt: new Date().toISOString()
        })
      }}
      aria-label={active ? t('product.removeFromFavorites') : t('product.addToFavorites')}
    >
      {active ? '♥' : '♡'}
    </button>
  )
}

export function ProductCard({ product }: { product: PublicProduct }) {
  const { t, lang } = useI18n()
  const dateLocale = lang === 'fr' ? 'fr-FR' : 'en-GB'
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
  const rating = product.average_rating ?? 0
  // A product nobody has reviewed shows nothing rather than an empty 0-star row,
  // which would read as a bad score instead of "not rated yet".
  const hasRating = reviewCount > 0

  return (
    <Link to={link} className="product-card">
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
        {hasDiscount && (
          <span className="badge badge-success" style={{ position: 'absolute', top: 12, left: 12, zIndex: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', fontWeight: 'bold' }}>
            {t('product.discountOff', { percent: discountPercent })}
          </span>
        )}
        {promotionUpcoming && product.discount_start && (
          <span className="badge badge-warning" style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}>
            {t('product.saleStarts', { date: formatDate(product.discount_start, dateLocale) })}
          </span>
        )}
      </div>
      <div className="product-body">
        {product.category_name && (
          <span className="product-category-chip">{product.category_name}</span>
        )}
        <span className="product-name">{product.name}</span>
        {product.shop_name && <span className="product-shop">{product.shop_name}</span>}
        {hasRating && (
          <Rating value={rating} count={reviewCount} size="sm" />
        )}
        <StockChip stock={availability} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          {hasDiscount ? (
            <>
              <span className="product-price" style={{ color: 'var(--color-primary)' }}>
                {formatMoney(salePrice)}
              </span>
              <span style={{ textDecoration: 'line-through', color: 'var(--color-text-muted)', fontSize: '0.85em' }}>
                {formatMoney(originalPrice)}
              </span>
            </>
          ) : (
            <div className="product-price">{formatMoney(salePrice)}</div>
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
