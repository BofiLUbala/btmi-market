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
import { CheckoutProgress } from '@/components/checkout/CheckoutProgress'

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

  const defaultAddress = useMemo(() => (user?.city ? `City: ${user.city}` : ''), [user?.city])

  const isAddressIncomplete = useMemo(() => {
    if (method === 'PICKUP') return false
    const addr = contact.address.trim()
    return !addr || (!!defaultAddress && addr.toLowerCase() === defaultAddress.toLowerCase())
  }, [method, contact.address, defaultAddress])

  const isFormInvalid = useMemo(() => {
    if (method === 'PICKUP') return false
    return !contact.contact_name.trim() || !contact.phone.trim() || isAddressIncomplete
  }, [method, contact.contact_name, contact.phone, isAddressIncomplete])

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
    if (isFormInvalid) {
      setError('Please fill in all delivery details completely.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await buyerApi.selectDelivery(orderId, {
        method,
        use_points_for_delivery: usePointsForDelivery,
        contact_name: contact.contact_name.trim(),
        phone: contact.phone.trim(),
        address: contact.address.trim(),
        notes: contact.notes.trim()
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
    <div className="checkout-page fade-in">
      <CheckoutProgress current="Delivery" />
      <header className="checkout-heading"><div><h1>Choose delivery</h1><p>Select how you want to receive this order.</p></div></header>
      {error && <ErrorBox error={error} />}

      {data && (
        <div className="checkout-layout">
          <div className="checkout-content stack">
            <section className="checkout-card delivery-options-card"><div className="checkout-card-head"><h2>Delivery method</h2><span>{data.options.length} options</span></div>
            {data.options.map((o) => (
              <button type="button"
                key={o.method}
                className={`delivery-option ${method === o.method ? 'selected' : ''} ${o.available ? '' : 'unavailable'}`}
                onClick={() => o.available && setMethod(o.method as DeliveryMethod)}
                disabled={!o.available}
                aria-pressed={method === o.method}
              >
                <span className="delivery-radio" aria-hidden />
                <div className="row-between">
                  <h3>{METHOD_LABEL[o.method] ?? o.label}</h3>
                  <div className="bold">{o.available ? formatMoney(o.fee) : 'Unavailable'}</div>
                </div>
                {o.provider && <div className="small muted">Provided by {o.provider}</div>}
                <div className="small muted">{o.method === 'PICKUP' ? 'Collect your order directly from the shop.' : 'Receive your order at the address provided.'}</div>
              </button>
            ))}
            </section>

            <section className={`checkout-card rewards-card ${usePointsForDelivery ? 'active' : ''}`}>
              <div><span className="eyebrow">DELIVERY REWARDS</span><h2>Use points for delivery</h2><p>Apply available points to reduce the delivery fee.</p></div>
              <button type="button" role="switch" aria-label="Use points for delivery" aria-checked={usePointsForDelivery} className={`toggle-switch ${usePointsForDelivery ? 'on' : ''}`} onClick={() => togglePoints(!usePointsForDelivery)}><span /></button>
              {usePointsForDelivery && previewFee !== null && selected && (
                <div className="rewards-result"><strong>✓ Points applied</strong><span>Delivery fee:{' '}
                    <s className="muted">{formatMoney(selected.fee)}</s>{' '}
                    <span className="pd-discount">{formatMoney(previewFee)}</span>
                  </span><button onClick={() => togglePoints(false)}>Remove points</button>
                </div>
              )}
            </section>
          </div>

          <aside className="checkout-card checkout-summary stack">
            <span className="eyebrow">DELIVERY DETAILS</span>
            <h2>{selected ? METHOD_LABEL[selected.method] : 'Choose a method'}</h2>
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
                {isAddressIncomplete && contact.address.trim().length > 0 && (
                  <p className="small" style={{ color: 'var(--color-danger, #ef4444)', marginTop: -8, marginBottom: 12 }}>
                    Please add specific details (commune, avenue, house number, etc.).
                  </p>
                )}
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
              disabled={isFormInvalid}
              onClick={continueToPayment}
            >
              Continue to review
            </Button>
          </aside>
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
