import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { ApiError, type DeliveryMethod, type DeliveryOptionsResponse } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { formatMoney, asArray } from '@/lib/format'
import { useAuth } from '@/store/auth'
import { RequireAuth } from '@/components/auth/Guards'

const METHOD_LABEL: Record<string, string> = {
  PICKUP: 'Pick up at the shop',
  SHOP_DELIVERY: 'Shop delivery',
  PARTNER: 'Delivery partner'
}

function DeliveryInner() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const location = useLocation()
  const orderId = (location.state as { orderId?: string } | null)?.orderId

  const [data, setData] = useState<DeliveryOptionsResponse | null>(null)
  const [method, setMethod] = useState<DeliveryMethod>('PICKUP')
  const [usePointsForDelivery, setUsePointsForDelivery] = useState(false)
  const [contact, setContact] = useState({
    contact_name: user ? `${user.first_name} ${user.last_name}` : '',
    phone: user?.phone ?? '',
    address: user?.city ? `City: ${user.city}` : '',
    notes: ''
  })
  const [previewFee, setPreviewFee] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const selected = useMemo(
    () => data?.options.find((o) => o.method === method) ?? null,
    [data, method]
  )

  useEffect(() => {
    if (!orderId) {
      navigate('/cart', { replace: true })
      return
    }
    let mounted = true
    buyerApi
      .deliveryOptions(orderId)
      .then(
        (d) => {
          if (!mounted) return
          setData(
            d ? { ...d, options: asArray(d.options) } : d
          )
          const current = d.options.find((o) => o.method === d.current_method)
          if (current) setMethod(current.method)
          setLoading(false)
        },
        (e: unknown) => {
          if (!mounted) return
          setError(e instanceof ApiError ? e.message : 'Could not load delivery options')
          setLoading(false)
        }
      )
    return () => {
      mounted = false
    }
  }, [orderId, navigate])

  async function togglePoints(v: boolean) {
    setUsePointsForDelivery(v)
    if (!orderId) return
    setError('')
    try {
      const res = await buyerApi.deliveryPointsPreview(orderId, v)
      setPreviewFee(res.fee_final)
    } catch {
      setPreviewFee(null)
    }
  }

  async function continueToPayment() {
    if (!orderId || !selected) return
    setSubmitting(true)
    setError('')
    try {
      const res = await buyerApi.selectDelivery(orderId, {
        method,
        use_points_for_delivery: usePointsForDelivery,
        contact_name: contact.contact_name,
        phone: contact.phone,
        address: contact.address,
        notes: contact.notes
      })
      navigate('/checkout/payment', {
        state: { orderId, summary: res },
        replace: true
      })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not select delivery')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingBlock label="Loading delivery options…" />

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 12 }}>Delivery</h1>
      {error && <ErrorBox error={error} />}

      {data && (
        <div className="order-summary-grid">
          <div className="stack">
            {data.options.map((o) => (
              <div
                key={o.method}
                className={`delivery-option ${method === o.method ? 'selected' : ''} ${o.available ? '' : 'unavailable'}`}
                onClick={() => o.available && setMethod(o.method as DeliveryMethod)}
              >
                <div className="row-between">
                  <h3>{METHOD_LABEL[o.method] ?? o.label}</h3>
                  <div className="bold">{o.available ? formatMoney(o.fee) : 'Unavailable'}</div>
                </div>
                {o.provider && <div className="small muted">{o.provider}</div>}
              </div>
            ))}

            <div className="card">
              <div className="row-between" style={{ marginBottom: 8 }}>
                <label className="small bold" htmlFor="use-points-delivery">
                  Pay delivery with points
                </label>
                <input
                  id="use-points-delivery"
                  type="checkbox"
                  checked={usePointsForDelivery}
                  onChange={(e) => togglePoints(e.target.checked)}
                />
              </div>
              {usePointsForDelivery && previewFee !== null && selected && (
                <div className="total-row">
                  <span>Delivery fee</span>
                  <span>
                    <s className="muted">{formatMoney(selected.fee)}</s>{' '}
                    <span className="pd-discount">{formatMoney(previewFee)}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="card stack">
            <h2 style={{ fontSize: '1.15rem' }}>Delivery details</h2>
            {method === 'PICKUP' ? (
              <p className="small muted">
                You will pick up this order at the shop. No address needed.
              </p>
            ) : (
              <>
                <Field
                  label="Contact name"
                  name="contact_name"
                  required
                  value={contact.contact_name}
                  onChange={(e) => setContact({ ...contact, contact_name: e.target.value })}
                />
                <Field
                  label="Phone"
                  name="phone"
                  required
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                />
                <Field
                  label="Delivery address"
                  name="address"
                  required
                  value={contact.address}
                  onChange={(e) => setContact({ ...contact, address: e.target.value })}
                  placeholder="City, commune, avenue, number…"
                />
                <Field
                  label="Notes"
                  name="notes"
                  value={contact.notes}
                  onChange={(e) => setContact({ ...contact, notes: e.target.value })}
                />
              </>
            )}
            <Button
              size="lg"
              block
              loading={submitting}
              disabled={method !== 'PICKUP' && (!contact.contact_name || !contact.phone || !contact.address)}
              onClick={continueToPayment}
            >
              Continue to payment
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DeliveryPage() {
  return (
    <RequireAuth>
      <DeliveryInner />
    </RequireAuth>
  )
}