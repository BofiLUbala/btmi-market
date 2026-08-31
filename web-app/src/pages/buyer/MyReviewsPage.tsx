import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import type { ReviewResponse } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { Rating } from '@/components/ui/Rating'
import { formatDate, asArray } from '@/lib/format'
import { RequireAuth } from '@/components/auth/Guards'
import { useI18n } from '@/store/i18n'

function MyReviewsInner() {
  const { t } = useI18n()
  const [reviews, setReviews] = useState<ReviewResponse[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [withdrawing, setWithdrawing] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'product' | 'shop'>('product')

  const load = () => {
    setLoading(true)
    buyerApi.myReviews().then(
      (r) => {
        setReviews(asArray(r.reviews))
        setLoading(false)
      },
      (e: unknown) => {
        setError(e instanceof Error ? e.message : t('reviews.loadFailed'))
        setLoading(false)
      }
    )
  }

  useEffect(load, [])

  async function withdraw(id: string) {
    if (!confirm(t('reviews.withdrawConfirm'))) return
    setWithdrawing(id)
    try {
      await buyerApi.withdrawReview(id)
      load()
    } finally {
      setWithdrawing(null)
    }
  }

  if (loading) return <LoadingBlock label={t('reviews.loading')} />
  if (error) return <ErrorBox error={error} onRetry={load} />

  const productReviews = reviews.filter(r => r.product_id)
  const shopReviews = reviews.filter(r => !r.product_id)
  const activeReviews = activeTab === 'product' ? productReviews : shopReviews

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="eyebrow">{t('account.eyebrow')}</div>
          <h1>{t('account.myReviews')}</h1>
          <p className="muted">{t('reviews.manageSubtitle')}</p>
        </div>
      </div>

      <div className="tabs" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`tab ${activeTab === 'product' ? 'active' : ''}`}
          onClick={() => setActiveTab('product')}
        >
          {t('reviews.productReviews', { count: productReviews.length })}
        </button>
        <button
          className={`tab ${activeTab === 'shop' ? 'active' : ''}`}
          onClick={() => setActiveTab('shop')}
        >
          {t('reviews.shopReviews', { count: shopReviews.length })}
        </button>
      </div>

      {activeReviews.length === 0 ? (
        <EmptyState
          icon="⭐"
          title={activeTab === 'product' ? t('reviews.noProductReviews') : t('reviews.noShopReviews')}
          description={
            activeTab === 'product'
              ? t('reviews.noProductReviewsDesc')
              : t('reviews.noShopReviewsDesc')
          }
          action={
            <Link to="/orders" className="btn btn-primary">
              {t('account.myOrders')}
            </Link>
          }
        />
      ) : (
        <div className="card stack" style={{ gap: 16 }}>
          {activeReviews.map((r) => (
            <div key={r.id} className="review-item" style={{ paddingBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
              <div className="review-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong className="small" style={{ display: 'block', marginBottom: 4 }}>
                    {r.product_id ? t('reviews.productReviewLabel') : t('reviews.shopServiceEvaluation')}
                  </strong>
                  <Rating value={r.rating} />
                  <span className="badge" style={{ marginLeft: 8 }}>
                    {r.verified_purchase ? t('reviews.verifiedPurchase') : t('reviews.pending')}
                  </span>
                </div>
                <span className="small muted">{formatDate(r.created_at)}</span>
              </div>
              {!r.product_id && r.delivery_rating && (
                <div className="small muted" style={{ marginTop: 6 }}>
                  {t('reviews.serviceBreakdown', { delivery: r.delivery_rating ?? 0, service: r.service_rating ?? 0, overall: r.order_experience_rating ?? 0 })}
                </div>
              )}
              {r.comment && (
                <p className="small" style={{ marginTop: 8, marginBottom: 8, whiteSpace: 'pre-wrap' }}>
                  {r.comment}
                </p>
              )}
              <div className="row-between" style={{ marginTop: 8 }}>
                <Link to={r.product_id ? `/products/${r.product_id}` : `/shops/${r.shop_id}`} className="small section-link">
                  {r.product_id ? t('reviews.viewProductPage') : t('reviews.viewShopPage')}
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={withdrawing === r.id}
                  onClick={() => withdraw(r.id)}
                >
                  {t('reviews.withdraw')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
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
