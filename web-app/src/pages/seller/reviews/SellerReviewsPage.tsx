import { useAuth } from '@/store/auth'
import { reviewApi } from '@/api/seller'
import { Card } from '@/components/ui/Card'
import { useEffect, useState } from 'react'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'

interface SellerReviewsResponse {
  summary: {
    shop_id: string
    average_rating: number
    total_reviews: number
    rating_1_count: number
    rating_2_count: number
    rating_3_count: number
    rating_4_count: number
    rating_5_count: number
    last_review_at?: string | null
    updated_at: string
  }
  reviews: Array<{
    id: string
    order_id: string
    shop_id: string
    business_id: string
    buyer_profile_id: string
    buyer_display_name: string
    rating: number
    comment: string
    verified_purchase: boolean
    status: string
    created_at: string
    updated_at: string
  }>
  pagination: {
    page: number
    limit: number
    total: number
    has_more: boolean
  }
}

export default function SellerReviewsPage() {
  const { activeBusiness, activeShop } = useAuth()
  const [reviewsData, setReviewsData] = useState<SellerReviewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (activeShop) {
      loadReviews()
    }
  }, [activeShop])

  async function loadReviews() {
    if (!activeShop) return
    setLoading(true)
    try {
      const data = await reviewApi.getShopReviews(activeShop)
      setReviewsData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <div className="empty-icon" style={{ fontSize: 64 }}>⭐</div>
        <h2>No Business Selected</h2>
        <p className="muted">Select a business to view reviews.</p>
      </div>
    )
  }

  if (!activeShop) {
    return (
      <Card>
        <h2>Select a Shop</h2>
        <p className="muted">Select a shop from the header dropdown to view its reviews.</p>
      </Card>
    )
  }

  if (loading) return <LoadingBlock label="Loading reviews…" />
  if (error) return <ErrorBox error={error} />
  if (!reviewsData) return <ErrorBox error="No reviews data available" />

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
      <div className="page-header">
        <h1>Customer Reviews</h1>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <h2>Shop Review Summary</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="stat-value" style={{ fontSize: 48 }}>{summary.average_rating.toFixed(1)}</div>
            <div className="muted">Average Rating</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="stat-value" style={{ fontSize: 48 }}>{summary.total_reviews}</div>
            <div className="muted">Total Reviews</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="stat-value" style={{ fontSize: 48 }}>{summary.rating_5_count}</div>
            <div className="muted">5-Star Reviews</div>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <h3>Rating Breakdown</h3>
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = (summary as any)[`rating_${rating}_count`] || 0
            const percent = summary.total_reviews > 0 ? (count / summary.total_reviews) * 100 : 0
            return (
              <div key={rating} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span className="small" style={{ width: 40 }}>{rating} ★</span>
                <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${percent}%`, background: 'var(--warning)', borderRadius: 4 }} />
                </div>
                <span className="small muted" style={{ width: 40, textAlign: 'right' }}>{count}</span>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <h2>Recent Reviews</h2>
        {reviewList.length === 0 ? (
          <p className="muted small" style={{ padding: 16, textAlign: 'center' }}>No reviews yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {reviewList.map((review) => (
              <div key={review.id} className="review-card" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <strong>{review.buyer_display_name}</strong>
                    <span className="muted small" style={{ marginLeft: 8 }}>Verified Purchase</span>
                  </div>
                  <div>
                    <span className="badge badge-warning">{review.rating} ★</span>
                    <span className="muted small" style={{ marginLeft: 8 }}>{new Date(review.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <p className="muted">{review.comment}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}