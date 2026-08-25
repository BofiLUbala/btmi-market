import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { RequireAuth } from '@/components/auth/Guards'
import { marketplaceApi } from '@/api/marketplace'
import type { OrderLine, PublicProductDetail } from '@/api/types'

function ReviewFormInner() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
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
      marketplaceApi.shopDetail(order.order.shop_id).then(shop => setShopName(shop.name)).catch(() => setShopName('Purchase Shop'))
    }).catch(() => undefined)
  }, [orderId, orderLineId, serviceMode])

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
      setError(e instanceof ApiError ? e.message : 'Could not submit review')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingBlock label="Checking eligibility…" />
  if (!eligibility?.eligible && !eligibility?.existing_review_id) {
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

  if (serviceMode && eligibility.existing_review_id) {
    return <div className="card stack" style={{ maxWidth: 520, margin: '0 auto' }}><h1>Experience already reviewed</h1><p className="muted">You have already reviewed delivery and shop service for this order.</p><Link to={`/orders/${orderId}`}><Button>Back to order</Button></Link></div>
  }

  return (
    <div className="card stack" style={{ maxWidth: 520, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.4rem' }}>{serviceMode ? 'Review delivery & shop service' : eligibility.existing_review_id ? 'Edit your product review' : 'Review this product'}</h1>
      <div className="card" style={{ background: 'var(--color-surface-2)', border: 0 }}>
        <strong>{serviceMode ? shopName || 'Purchase shop' : product?.name ?? `Product ${line?.product_id.slice(0, 8) ?? ''}`}</strong>
        {!serviceMode && <div className="small muted">Variant: {product?.variants?.find(v => v.id === line?.variant_id)?.name || line?.variant_id.slice(0, 8) || '—'}</div>}
        <div className="small muted">Shop: {shopName || 'Purchase Shop'}</div>
      </div>
      {error && <ErrorBox error={error} />}
      {serviceMode ? <>
        <ReviewStars label="Delivery" value={deliveryRating} onChange={setDeliveryRating} />
        <ReviewStars label="Shop service" value={serviceRating} onChange={setServiceRating} />
        <ReviewStars label="Overall order experience" value={experienceRating} onChange={setExperienceRating} />
      </> : <div className="review-field"><strong>Product quality</strong><div className="review-stars-input" aria-label="Product quality rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)} aria-label={`${n} stars`}>
            ★
          </button>
        ))}
      </div></div>}
      <textarea
        className="input"
        rows={4}
        placeholder={serviceMode ? 'Tell us about delivery, the shop service and your order experience.' : 'What did you like or dislike about this product?'}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="row-between">
        <Button variant="outline" onClick={() => navigate(`/orders/${orderId}`)}>
          Cancel
        </Button>
        <Button loading={busy} onClick={submit}>
          {serviceMode ? 'Submit experience review' : eligibility.existing_review_id ? 'Update review' : 'Submit product review'}
        </Button>
      </div>
    </div>
  )
}

function ReviewStars({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div className="review-field"><strong>{label}</strong><div className="review-stars-input" aria-label={`${label} rating`}>{[1,2,3,4,5].map(n => <button key={n} className={n <= value ? 'on' : ''} onClick={() => onChange(n)} aria-label={`${n} stars for ${label}`}>★</button>)}</div></div>
}

export default function ReviewPage() {
  return (
    <RequireAuth>
      <ReviewFormInner />
    </RequireAuth>
  )
}
