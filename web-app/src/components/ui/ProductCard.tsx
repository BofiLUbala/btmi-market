import { Link } from 'react-router-dom'
import type { PublicProduct } from '@/api/types'
import { initials, formatMoney } from '@/lib/format'
import { useFavorites } from '@/store/favorites'
import { StockChip } from './Badges'

function FavoriteButton({ product }: { product: PublicProduct }) {
  const { has, toggle } = useFavorites()
  const active = has(product.id)
  const first = product.variants?.[0]
  return (
    <button
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
  const first = product.variants?.[0]
  const price = first?.unit_price ?? product.base_price
  const link = `/products/${product.id}`
  const hue =
    product.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return (
    <Link to={link} className="product-card">
      <div
        className="product-thumb"
        style={{ background: `hsl(${hue}, 32%, 26%)` }}
        aria-hidden
      >
        {initials(product.name)}
        <span className="thumb-chip">
          <FavoriteButton product={product} />
        </span>
      </div>
      <div className="product-body">
        <span className="product-name">{product.name}</span>
        <span className="product-shop">{product.shop_name}</span>
        <StockChip stock={first?.stock ?? 'AVAILABLE'} />
        <div className="product-price">{formatMoney(price)}</div>
      </div>
    </Link>
  )
}