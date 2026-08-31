import { Link } from 'react-router-dom'
import type { PublicShop } from '@/api/types'
import { initials } from '@/lib/format'
import { useI18n } from '@/store/i18n'
import { Rating } from './Rating'

export function ShopCard({ shop, rating }: { shop: PublicShop; rating?: number }) {
  const { t } = useI18n()
  return (
    <Link to={`/shops/${shop.id}`} className="shop-card">
      <div className="shop-logo">{initials(shop.name)}</div>
      <div className="stack" style={{ gap: 4, flex: 1 }}>
        <div className="bold">{shop.name}</div>
        <div className="shop-meta">
          {shop.city}
          {shop.address ? ` · ${shop.address}` : ''}
        </div>
        <div className="shop-meta">
          {t(shop.product_count === 1 ? 'shop.productsCount' : 'shop.productsCountPlural', {
            count: shop.product_count,
          })}{' · '}{shop.seller_level}
        </div>
        {rating !== undefined && <Rating value={rating} />}
      </div>
    </Link>
  )
}

export function SectionHead({
  title,
  subtitle,
  linkTo,
  linkLabel
}: {
  title: string
  subtitle?: string
  linkTo?: string
  linkLabel?: string
}) {
  return (
    <div className="section-head">
      <div className="section-head-copy">
        <h2>{title}</h2>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {linkTo && linkLabel && (
        <Link className="section-link" to={linkTo}>
          {linkLabel} →
        </Link>
      )}
    </div>
  )
}