import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import type { ReviewResponse } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { Rating } from '@/components/ui/Rating'
import { formatDate, asArray } from '@/lib/format'
import { RequireAuth } from '@/components/auth/Guards'

function MyReviewsInner() {
  const [reviews, setReviews] = useState<ReviewResponse[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [withdrawing, setWithdrawing] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    buyerApi.myReviews().then(
      (r) => {
        setReviews(asArray(r.reviews))
        setLoading(false)
      },
      (e: unknown) => {
        setError(e instanceof Error ? e.message : 'Could not load reviews')
        setLoading(false)
      }
    )
  }

  useEffect(load, [])

  async function withdraw(id: string) {
    if (!confirm('Withdraw this review?')) return
    setWithdrawing(id)
    try {
      await buyerApi.withdrawReview(id)
      load()
    } finally {
      setWithdrawing(null)
    }
  }

  if (loading) return <LoadingBlock label="Loading your reviews…" />
  if (error) return <ErrorBox error={error} onRetry={load} />

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon="⭐"
        title="No reviews yet"
        description="After an order is completed you can review the shop."
        action={
          <Link to="/orders" className="btn btn-primary">
            My orders
          </Link>
        }
      />
    )
  }

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 12 }}>My reviews</h1>
      <div className="card">
        {reviews.map((r) => (
          <div key={r.id} className="review-item">
            <div className="review-head">
              <div>
                <Rating value={r.rating} />
                <span className="badge" style={{ marginLeft: 8 }}>
                  {r.verified_purchase ? 'Verified purchase' : 'Pending'}
                </span>
              </div>
              <span className="small muted">{formatDate(r.created_at)}</span>
            </div>
            {r.comment && <p className="small mt-0" style={{ marginTop: 6 }}>{r.comment}</p>}
            <div className="row-between" style={{ marginTop: 8 }}>
              <Link to={`/shops/${r.shop_id}`} className="small section-link">
                Shop page →
              </Link>
              <Button
                variant="ghost"
                size="sm"
                loading={withdrawing === r.id}
                onClick={() => withdraw(r.id)}
              >
                Withdraw
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MyReviewsPage() {
  return (
    <RequireAuth>
      <MyReviewsInner />
    </RequireAuth>
  )
}