import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { PublicProduct } from '@/api/types'
import { formatMoney } from '@/lib/format'
import { getCategoryVisual } from '@/lib/categoryVisuals'
import { useFavorites } from '@/store/favorites'
import { StockChip } from './Badges'

function FavoriteButton({ product }: { product: PublicProduct }) {
  const { has, toggle } = useFavorites()
  const active = has(product.id)
  const first = product.variants?.[0]
  return (
    <button
      type="button"
      className="btn btn-sm"
      style={{
        background: 'rgba(0,0,0,0.35)',
        color: active ? '#ffd166' : '#fff',
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
      aria-label={active ? 'Remove from favorites' : 'Add to favorites'}
    >
      {active ? '♥' : '♡'}
    </button>
  )
}

export function ProductCard({ product }: { product: PublicProduct }) {
  const [imageFailed, setImageFailed] = useState(false)
  const first = product.variants?.[0]
  
  const originalPrice = first?.base_price ?? product.base_price
  const salePrice = first?.unit_price ?? product.seller_sale_price ?? product.base_price
  const hasDiscount = Boolean(product.discount_active && salePrice < originalPrice)
  const discountPercent = hasDiscount 
    ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
    : 0

  const link = `/products/${product.id}`
  const cover = product.images?.find((img) => img.is_primary) ?? product.images?.[0]
  const fallback = getCategoryVisual(product.category_slug ?? '')
  const availability = product.availability ?? first?.stock ?? 'AVAILABLE'

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
            {discountPercent}% OFF
          </span>
        )}
      </div>
      <div className="product-body">
        {product.category_name && (
          <span className="product-category-chip">{product.category_name}</span>
        )}
        <span className="product-name">{product.name}</span>
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
      </div>
    </Link>
  )
}
