import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { RequireAuth } from '@/components/auth/Guards'

function ReviewFormInner() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  const [eligibility, setEligibility] = useState<{
    eligible: boolean
    reason?: string
    existing_review_id?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    buyerApi.reviewEligibility(orderId).then(
      (r) => {
        setEligibility(r)
        setLoading(false)
      },
      () => {
        setEligibility(null)
        setLoading(false)
      }
    )
  }, [orderId])

  async function submit() {
    setError('')
    setBusy(true)
    try {
      if (eligibility?.existing_review_id) {
        await buyerApi.updateReview(eligibility.existing_review_id, rating, comment)
      } else {
        await buyerApi.createReview(orderId, rating, comment)
      }
      navigate(`/orders/${orderId}`, { replace: true })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not submit review')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingBlock label="Checking eligibility…" />
  if (!eligibility?.eligible) {
    return (
      <div className="card stack" style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.4rem' }}>Not eligible</h1>
        <p className="muted">
          {eligibility?.reason ?? 'You can only review an order once it has been completed and the payment verified.'}
        </p>
        <Link to={`/orders/${orderId}`}>
          <Button variant="outline">Back to order</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="card stack" style={{ maxWidth: 520, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.4rem' }}>{eligibility.existing_review_id ? 'Edit your review' : 'Leave a review'}</h1>
      {error && <ErrorBox error={error} />}
      <div className="review-stars-input" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)} aria-label={`${n} stars`}>
            ★
          </button>
        ))}
      </div>
      <textarea
        className="input"
        rows={4}
        placeholder="Tell others about this shop…"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="row-between">
        <Button variant="outline" onClick={() => navigate(`/orders/${orderId}`)}>
          Cancel
        </Button>
        <Button loading={busy} onClick={submit}>
          {eligibility.existing_review_id ? 'Update review' : 'Submit review'}
        </Button>
      </div>
    </div>
  )
}

export default function ReviewPage() {
  return (
    <RequireAuth>
      <ReviewFormInner />
    </RequireAuth>
  )
}