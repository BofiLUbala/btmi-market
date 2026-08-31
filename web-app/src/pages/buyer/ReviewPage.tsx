import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { RequireAuth } from '@/components/auth/Guards'
import { marketplaceApi } from '@/api/marketplace'
import type { OrderLine, PublicProductDetail } from '@/api/types'
import { useI18n } from '@/store/i18n'

function ReviewFormInner() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const serviceMode = searchParams.get('type') === 'service'
  const orderLineId = searchParams.get('line') ?? ''
  const [eligibility, setEligibility] = useState<{
    eligible: boolean
    reason?: string
    existing_review_id?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(5)
  const [deliveryRating, setDeliveryRating] = useState(5)
  const [serviceRating, setServiceRating] = useState(5)
  const [experienceRating, setExperienceRating] = useState(5)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [product, setProduct] = useState<PublicProductDetail | null>(null)
  const [line, setLine] = useState<OrderLine | null>(null)
  const [shopName, setShopName] = useState('')

  useEffect(() => {
    buyerApi.reviewEligibility(orderId, serviceMode ? undefined : orderLineId).then(
      (r) => {
        setEligibility(r)
        setLoading(false)
      },
      () => {
        setEligibility(null)
        setLoading(false)
      }
    )
  }, [orderId, orderLineId, serviceMode])

  useEffect(() => {
    buyerApi.orderDetail(orderId).then(order => {
      const purchasedLine = serviceMode ? null : order.lines.find(item => item.id === orderLineId) ?? null
      setLine(purchasedLine)
      if (purchasedLine) marketplaceApi.productDetail(purchasedLine.product_id).then(setProduct).catch(() => setProduct(null))
      marketplaceApi.shopDetail(order.order.shop_id).then(shop => setShopName(shop.name)).catch(() => setShopName(t('reviews.purchaseShop')))
    }).catch(() => undefined)
  }, [orderId, orderLineId, serviceMode, t])

  async function submit() {
    setError('')
    setBusy(true)
    try {
      if (serviceMode) {
        await buyerApi.createServiceReview(orderId, deliveryRating, serviceRating, experienceRating, comment)
      } else if (eligibility?.existing_review_id) {
        await buyerApi.updateReview(eligibility.existing_review_id, rating, comment)
      } else {
        await buyerApi.createReview(orderId, orderLineId, rating, comment)
      }
      navigate(`/orders/${orderId}`, { replace: true })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('reviews.submitFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingBlock label={t('reviews.checkingEligibility')} />
  if (!eligibility?.eligible && !eligibility?.existing_review_id) {
    return (
      <div className="card stack" style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.4rem' }}>{t('reviews.notEligible')}</h1>
        <p className="muted">
          {eligibility?.reason ?? t('reviews.notEligibleReason')}
        </p>
        <Link to={`/orders/${orderId}`}>
          <Button variant="outline">{t('reviews.backToOrder')}</Button>
        </Link>
      </div>
    )
  }

  if (serviceMode && eligibility.existing_review_id) {
    return <div className="card stack" style={{ maxWidth: 520, margin: '0 auto' }}><h1>{t('reviews.alreadyReviewedTitle')}</h1><p className="muted">{t('reviews.alreadyReviewedDesc')}</p><Link to={`/orders/${orderId}`}><Button>{t('reviews.backToOrder')}</Button></Link></div>
  }

  return (
    <div className="card stack" style={{ maxWidth: 520, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.4rem' }}>{serviceMode ? t('reviews.reviewDeliveryService') : eligibility.existing_review_id ? t('reviews.editReview') : t('reviews.reviewProduct')}</h1>
      <div className="card" style={{ background: 'var(--color-surface-2)', border: 0, display: 'flex', gap: 12, alignItems: 'center' }}>
        {!serviceMode && (line?.image_url || product?.images?.[0]?.url) && (
          <img 
            src={line?.image_url || product?.images?.[0]?.url} 
            alt="" 
            style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--radius)' }} 
          />
        )}
        <div className="stack" style={{ gap: 2 }}>
          <strong>{serviceMode ? shopName || t('reviews.purchaseShop') : product?.name ?? t('orders.productWithId', { id: line?.product_id.slice(0, 8) ?? '' })}</strong>
          {!serviceMode && <div className="small muted">{t('orders.variantWithLabel', { variant: product?.variants?.find(v => v.id === line?.variant_id)?.name || line?.variant_id.slice(0, 8) || '—' })}</div>}
          <div className="small muted">{t('reviews.shopWithName', { shop: shopName || t('reviews.purchaseShop') })}</div>
        </div>
      </div>
      {error && <ErrorBox error={error} />}
      {serviceMode ? <>
        <ReviewStars label={t('reviews.deliveryLabel')} value={deliveryRating} onChange={setDeliveryRating} />
        <ReviewStars label={t('reviews.shopServiceLabel')} value={serviceRating} onChange={setServiceRating} />
        <ReviewStars label={t('reviews.overallExperienceLabel')} value={experienceRating} onChange={setExperienceRating} />
      </> : <div className="review-field"><strong>{t('reviews.productQuality')}</strong><div className="review-stars-input" aria-label={t('reviews.productQualityRating')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)} aria-label={t('reviews.starsLabel', { count: n })}>
            ★
          </button>
        ))}
      </div></div>}
      <textarea
        className="input"
        rows={4}
        placeholder={serviceMode ? t('reviews.serviceCommentPlaceholder') : t('reviews.commentPlaceholder')}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="row-between">
        <Button variant="outline" onClick={() => navigate(`/orders/${orderId}`)}>
          {t('common.cancel')}
        </Button>
        <Button loading={busy} onClick={submit}>
          {serviceMode ? t('reviews.submitExperienceReview') : eligibility.existing_review_id ? t('reviews.updateReview') : t('reviews.submitProductReview')}
        </Button>
      </div>
    </div>
  )
}

function ReviewStars({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const { t } = useI18n()
  return <div className="review-field"><strong>{label}</strong><div className="review-stars-input" aria-label={t('reviews.labelRating', { label })}>{[1,2,3,4,5].map(n => <button key={n} className={n <= value ? 'on' : ''} onClick={() => onChange(n)} aria-label={t('reviews.starsForLabel', { count: n, label })}>★</button>)}</div></div>
}

export default function ReviewPage() {
  return (
    <RequireAuth>
      <ReviewFormInner />
    </RequireAuth>
  )
}
