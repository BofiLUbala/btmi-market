import { useCallback, useEffect, useState } from 'react'
import { buyerApi } from '@/api/buyer'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { useI18n } from '@/store/i18n'

/**
 * The buyer's rating of a delivered order: five stars and a written feedback,
 * right where the delivery ends. It is stored as the order's shop/service
 * review, so the same row stays editable afterwards - the card reopens with
 * what the buyer wrote and saves the change in place.
 */
export function OrderRatingCard({ orderId }: { orderId: string }) {
  const { t } = useI18n()
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [eligible, setEligible] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [editing, setEditing] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    try {
      const e = await buyerApi.reviewEligibility(orderId)
      setEligible(e.eligible)
      if (e.existing_review_id && e.reason !== 'REVIEW_WITHDRAWN') {
        setReviewId(e.existing_review_id)
        const mine = await buyerApi.myReviews()
        const existing = (mine.reviews ?? []).find((r) => r.id === e.existing_review_id)
        if (existing) {
          setRating(existing.rating)
          setComment(existing.comment ?? '')
        }
        setEditing(false)
      }
    } catch {
      setEligible(false)
    }
  }, [orderId])

  useEffect(() => { void load() }, [load])

  if (!eligible && !reviewId) return null

  async function submit() {
    if (rating < 1) { setError(t('orderRating.pickStars')); return }
    setBusy(true); setError(''); setSaved(false)
    try {
      if (reviewId) {
        await buyerApi.updateReview(reviewId, rating, comment.trim())
      } else {
        const created = await buyerApi.createServiceReview(orderId, rating, rating, rating, comment.trim())
        setReviewId(created.id)
        setEligible(false)
      }
      setSaved(true)
      setEditing(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('orderRating.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card stack">
      <div>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 4 }}>{t('orderRating.title')}</h2>
        <p className="small muted" style={{ margin: 0 }}>{reviewId ? t('orderRating.editableHint') : t('orderRating.subtitle')}</p>
      </div>
      <div className="review-stars-input" role="radiogroup" aria-label={t('orderRating.title')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === rating}
            className={n <= rating ? 'on' : ''}
            disabled={!editing || busy}
            onClick={() => setRating(n)}
            aria-label={t('reviews.starsLabel', { count: n })}
          >★</button>
        ))}
      </div>
      {editing ? (
        <textarea
          className="input"
          rows={4}
          maxLength={1000}
          placeholder={t('orderRating.placeholder')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      ) : (
        comment && <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{comment}</p>
      )}
      {error && <p className="small" role="alert" style={{ margin: 0, color: 'var(--color-danger)' }}>{error}</p>}
      {saved && !editing && <p className="small" style={{ margin: 0 }}>✓ {t('orderRating.saved')}</p>}
      {editing ? (
        <Button variant="accent" block loading={busy} onClick={submit}>
          {reviewId ? t('orderRating.update') : t('orderRating.submit')}
        </Button>
      ) : (
        <Button variant="outline" block onClick={() => { setEditing(true); setSaved(false) }}>
          {t('orderRating.edit')}
        </Button>
      )}
    </div>
  )
}
