import { useAuth } from '@/store/auth'
import { reviewApi } from '@/api/seller'
import type { ShopReviewsResponse } from '@/api/types'
import { Card } from '@/components/ui/Card'
import { useEffect, useState } from 'react'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'

export default function SellerReviewsPage() {
  const t = useT()
  const { activeBusiness, activeShop } = useAuth()
  const [reviewsData, setReviewsData] = useState<ShopReviewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'shop' | 'product'>('shop')

  useEffect(() => {
    if (activeShop) {
      loadReviews()
    }
  }, [activeShop, activeTab])

  async function loadReviews() {
    if (!activeShop) return
    setLoading(true)
    try {
      const data = await reviewApi.getShopReviews(activeShop, { type: activeTab })
      setReviewsData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reviews.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <div className="empty-icon" style={{ fontSize: 64 }}>⭐</div>
        <h2>{t('seller.noBusinessSelected')}</h2>
        <p className="muted">{t('seller.reviews.noBusinessSubtitle')}</p>
      </div>
    )
  }

  if (!activeShop) {
    return (
      <Card>
        <h2>{t('seller.reviews.selectShopTitle')}</h2>
        <p className="muted">{t('seller.reviews.selectShopDesc')}</p>
      </Card>
    )
  }

  if (loading) return <LoadingBlock label={t('seller.reviews.loading')} />
  if (error) return <ErrorBox error={error} onRetry={loadReviews} />
  if (!reviewsData) return <ErrorBox error={t('seller.reviews.noData')} onRetry={loadReviews} />

  const summary = reviewsData.summary || {
    shop_id: activeShop,
    average_rating: 0,
    total_reviews: 0,
    rating_1_count: 0,
    rating_2_count: 0,
    rating_3_count: 0,
    rating_4_count: 0,
    rating_5_count: 0,
    updated_at: new Date().toISOString(),
  }
  const reviewList = Array.isArray(reviewsData.reviews) ? reviewsData.reviews : []

  return (
    <div className="seller-reviews">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h1>{t('seller.reviews')}</h1>
      </div>

      <div className="tabs" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`tab ${activeTab === 'shop' ? 'active' : ''}`}
          onClick={() => setActiveTab('shop')}
        >
          {t('seller.reviews.tabShopService')}
        </button>
        <button
          className={`tab ${activeTab === 'product' ? 'active' : ''}`}
          onClick={() => setActiveTab('product')}
        >
          {t('seller.reviews.tabProduct')}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'start' }}>
        <Card>
          <h2>{activeTab === 'shop' ? t('seller.reviews.shopSummary') : t('seller.reviews.productSummary')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 16, marginBottom: 16 }}>
            <div className="stat-value" style={{ fontSize: 48, lineHeight: 1 }}>{summary.average_rating.toFixed(1)}</div>
            <div className="muted" style={{ marginTop: 4 }}>{t('seller.reviews.averageRating')}</div>
            <div className="small muted">{t('seller.reviews.totalReviews', { count: summary.total_reviews })}</div>
          </div>

          <div style={{ marginTop: 16 }}>
            <h3>{t('seller.reviews.breakdown')}</h3>
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = summary[`rating_${rating}_count` as keyof typeof summary] as number
              const percent = summary.total_reviews > 0 ? (count / summary.total_reviews) * 100 : 0
              return (
                <div key={rating} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span className="small" style={{ width: 40 }}>{rating} ★</span>
                  <div style={{ flex: 1, height: 8, background: 'var(--color-surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${percent}%`, background: 'var(--color-star)', borderRadius: 4 }} />
                  </div>
                  <span className="small muted" style={{ width: 40, textAlign: 'right' }}>{count}</span>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <h2>{activeTab === 'shop' ? t('seller.reviews.recentShop') : t('seller.reviews.recentProduct')}</h2>
          {reviewList.length === 0 ? (
            <p className="muted small" style={{ padding: 16, textAlign: 'center' }}>{t('shop.noReviewsYet')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
              {reviewList.map((review) => (
                <div key={review.id} className="review-card" style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 16 }}>
                  {review.product_name && (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, background: 'var(--color-surface-2)', padding: '8px 12px', borderRadius: 6 }}>
                      {review.image_url && <img src={review.image_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />}
                      <div>
                        <span className="small bold" style={{ display: 'block' }}>{review.product_name}</span>
                        {review.variant_name && <span className="small muted" style={{ fontSize: '0.8rem' }}>{t('orders.variantWithLabel', { variant: review.variant_name })}</span>}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                    <div>
                      <strong>{review.buyer_display_name}</strong>
                      {review.verified_purchase && <span className="badge" style={{ marginLeft: 8 }}>{t('reviews.verifiedPurchase')}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--color-star)', fontWeight: 'bold' }}>{review.rating} ★</span>
                      <span className="muted small">{new Date(review.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {review.comment && <p className="muted small" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{review.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}