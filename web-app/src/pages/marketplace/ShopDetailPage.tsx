import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { marketplaceApi } from '@/api/marketplace'
import type { PublicProduct, PublicShopDetail, PublicReview } from '@/api/types'
import { ProductCard } from '@/components/ui/ProductCard'
import { Rating } from '@/components/ui/Rating'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { initials, formatDate, asArray } from '@/lib/format'

export default function ShopDetailPage() {
  const { id = '' } = useParams()
  const [shop, setShop] = useState<PublicShopDetail | null>(null)
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [tab, setTab] = useState<'products' | 'reviews'>('products')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.allSettled([
      marketplaceApi.shopDetail(id),
      marketplaceApi.shopProducts(id, { page: 1, limit: 24 })
    ]).then(([s, p]) => {
      if (!mounted) return
      if (s.status === 'fulfilled') setShop(s.value)
      if (p.status === 'fulfilled') setProducts(asArray(p.value.products))
      if (s.status === 'rejected' && p.status === 'rejected') {
        setError('Could not load this shop.')
      }
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [id])

  useEffect(() => {
    if (tab !== 'reviews') return
    marketplaceApi.shopReviews(id, { page: 1, per_page: 10 }).then(
      (r) => setReviews(asArray(r.reviews)),
      () => setReviews([])
    )
  }, [id, tab])

  const initial = useMemo(() => (shop ? initials(shop.name) : '—'), [shop])

  if (loading) return <LoadingBlock label="Loading shop…" />
  if (error || !shop) return <ErrorBox error={error || 'Shop not found'} onRetry={() => window.location.reload()} />

  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div className="stack" style={{ gap: 4 }}>
            <div className="shop-logo" style={{ width: 64, height: 64, fontSize: 22 }}>
              {initial}
            </div>
            <h1 style={{ fontSize: '1.6rem' }}>{shop.name}</h1>
            <div className="muted small">
              {shop.type} · {shop.city}
              {shop.address ? ` · ${shop.address}` : ''}
              {shop.phone ? ` · ${shop.phone}` : ''}
            </div>
            <div className="small">
              {shop.total_reviews !== undefined ? (
                <Rating value={shop.average_rating ?? 0} count={shop.total_reviews} />
              ) : (
                <span className="muted">No reviews yet</span>
              )}
            </div>
          </div>
          <div className="stack small" style={{ gap: 4, textAlign: 'right' }}>
            <span className="badge">{shop.seller_level}</span>
            <span className="badge">{shop.seller_trust}</span>
            <span className="muted">{shop.product_count} products</span>
            <span className="muted">Member since {formatDate(shop.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>
          Products ({shop.product_count})
        </button>
        <button className={`tab ${tab === 'reviews' ? 'active' : ''}`} onClick={() => setTab('reviews')}>
          Reviews ({shop.total_reviews ?? 0})
        </button>
      </div>

      {tab === 'products' ? (
        products.length === 0 ? (
          <p className="muted">No products listed yet.</p>
        ) : (
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )
      ) : (
        <div>
          {reviews.length === 0 ? (
            <p className="muted">No reviews yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="review-item">
                <div className="review-head">
                  <div className="small bold">
                    {r.buyer_display_name}
                    {r.verified_purchase && (
                      <span className="badge" style={{ marginLeft: 8 }}>Verified</span>
                    )}
                  </div>
                  <span className="small muted">{formatDate(r.created_at)}</span>
                </div>
                <Rating value={r.rating} />
                {r.delivery_rating && <div className="small muted">Delivery {r.delivery_rating}★ · Shop service {r.service_rating}★ · Order experience {r.order_experience_rating}★</div>}
                <p className="small" style={{ margin: '6px 0 0' }}>{r.comment}</p>
              </div>
            ))
          )}
        </div>
      )}

      <Link to="/shops" className="section-link small">
        ← All shops
      </Link>
    </div>
  )
}
