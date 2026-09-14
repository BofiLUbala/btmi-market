import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { ApiError, type DeliveryOptionsResponse } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { formatMoney, asArray } from '@/lib/format'
import { useAuth } from '@/store/auth'
import { useT } from '@/store/i18n'
import { RequireAuth } from '@/components/auth/Guards'
import { CheckoutProgress } from '@/components/checkout/CheckoutProgress'
import { StructuredAddressFields, StructuredAddressSummary, emptyStructuredAddress, isStructuredAddressComplete, type StructuredAddressValue } from '@/components/address/StructuredAddressFields'

function DeliveryInner() {
  const navigate = useNavigate()
  const { user, buyerProfile } = useAuth()
  const t = useT()
  const location = useLocation()
  const orderId = (location.state as { orderId?: string } | null)?.orderId

  const [data, setData] = useState<DeliveryOptionsResponse | null>(null)
  const [usePointsForDelivery, setUsePointsForDelivery] = useState(false)
  // The postal address itself lives in `address` below: this is only who the
  // courier calls on arrival.
  const [contact, setContact] = useState(() => ({
    contact_name: [buyerProfile?.first_name || user?.first_name, buyerProfile?.last_name || user?.last_name].filter(Boolean).join(' '),
    phone: buyerProfile?.phone || user?.phone || '',
    notes: ''
  }))
  // Pre-fill from the address the buyer already saved on their profile; they
  // can still change any level, and the server re-resolves it either way.
  const [address, setAddress] = useState<StructuredAddressValue>(() => ({
    ...emptyStructuredAddress(),
    province: buyerProfile?.province ?? '',
    city: buyerProfile?.city ?? '',
    commune: buyerProfile?.commune ?? '',
    province_id: buyerProfile?.province_id ?? '',
    city_id: buyerProfile?.city_id ?? '',
    commune_id: buyerProfile?.commune_id ?? '',
    street: buyerProfile?.street || buyerProfile?.address || '',
    building_number: buyerProfile?.building_number ?? '',
    landmark: buyerProfile?.landmark ?? ''
  }))
  const [previewFee, setPreviewFee] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!buyerProfile && !user) return
    const name = [buyerProfile?.first_name || user?.first_name, buyerProfile?.last_name || user?.last_name].filter(Boolean).join(' ')
    const phone = buyerProfile?.phone || user?.phone || ''
    setContact((prev) => ({
      contact_name: prev.contact_name || name,
      phone: prev.phone || phone,
      notes: prev.notes
    }))
  }, [buyerProfile, user])

  const isAddressIncomplete = useMemo(() => !isStructuredAddressComplete(address), [address])

  const isFormInvalid = useMemo(() => {
    return !contact.contact_name.trim() || !contact.phone.trim() || isAddressIncomplete
  }, [contact.contact_name, contact.phone, isAddressIncomplete])

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
          setLoading(false)
        },
        (e: unknown) => {
          if (!mounted) return
          setError(e instanceof ApiError ? e.message : t('delivery.couldNotLoad'))
          setLoading(false)
        }
      )
    return () => {
      mounted = false
    }
  }, [orderId, navigate, t])

  const option = data?.options?.[0]
  const baseFee = option?.fee ?? 0
  const displayedFee = previewFee !== null ? previewFee : baseFee

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
    if (!orderId) return
    if (isFormInvalid) {
      setError(t('delivery.fillAllFields'))
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await buyerApi.selectDelivery(orderId, {
        method: 'TBK_STANDARD',
        use_points_for_delivery: usePointsForDelivery,
        contact_name: contact.contact_name.trim(),
        phone: contact.phone.trim(),
        address: [address.street.trim(), address.building_number.trim(), address.commune, address.city, address.province].filter(Boolean).join(', '),
        province_id: address.province_id, city_id: address.city_id, commune_id: address.commune_id,
        province: address.province, city: address.city, commune: address.commune,
        street: address.street.trim(), building_number: address.building_number.trim(), landmark: address.landmark.trim(),
        notes: contact.notes.trim()
      })
      navigate('/checkout/payment', {
        state: { orderId, summary: res },
        replace: true
      })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('delivery.couldNotSelect'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingBlock label={t('delivery.loadingOptions')} />

  return (
    <div className="checkout-page fade-in">
      <CheckoutProgress current="Delivery" />
      <header className="checkout-heading">
        <div>
          <h1>{t('delivery.title')}</h1>
          <p>{t('delivery.subtitle')}</p>
        </div>
      </header>
      {error && <ErrorBox error={error} />}

      {data && (
        <div className="checkout-layout">
          <div className="checkout-content stack">
            <section className="checkout-card delivery-options-card">
              <div className="checkout-card-head">
                <h2>{t('delivery.tbkTitle')}</h2>
              </div>
              <div className="delivery-option selected" style={{ cursor: 'default' }}>
                <span className="delivery-radio checked" aria-hidden />
                <div className="row-between">
                  <h3>{t('delivery.tbkTitle')}</h3>
                  <div className="bold">{formatMoney(displayedFee)}</div>
                </div>
                <div className="small muted" style={{ marginTop: 4 }}>
                  {t('delivery.tbkSubtitle')}
                </div>
                <div className="small muted" style={{ marginTop: 4 }}>
                  {t('delivery.tbkNotice')}
                </div>
              </div>
            </section>

            {baseFee > 0 && (
              <section className={`checkout-card rewards-card ${usePointsForDelivery ? 'active' : ''}`}>
                <div>
                  <span className="eyebrow">{t('delivery.rewards')}</span>
                  <h2>{t('delivery.usePointsForDelivery')}</h2>
                  <p>{t('delivery.reduceFee')}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-label={t('delivery.usePointsForDelivery')}
                  aria-checked={usePointsForDelivery}
                  className={`toggle-switch ${usePointsForDelivery ? 'on' : ''}`}
                  onClick={() => togglePoints(!usePointsForDelivery)}
                >
                  <span />
                </button>
                {usePointsForDelivery && previewFee !== null && (
                  <div className="rewards-result">
                    <strong>{t('points.applied')}</strong>
                    <span>
                      {t('delivery.fee')}{' '}
                      <s className="muted">{formatMoney(baseFee)}</s>{' '}
                      <span className="pd-discount">{formatMoney(previewFee)}</span>
                    </span>
                    <button onClick={() => togglePoints(false)}>{t('points.remove')}</button>
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="checkout-card checkout-summary stack">
            <span className="eyebrow">{t('delivery.details')}</span>
            <h2>{t('delivery.contactName')}</h2>
            <Field
              label={t('delivery.contactName')}
              name="contact_name"
              required
              value={contact.contact_name}
              onChange={(e) => setContact({ ...contact, contact_name: e.target.value })}
            />
            <Field
              label={t('common.phone')}
              name="phone"
              required
              value={contact.phone}
              onChange={(e) => setContact({ ...contact, phone: e.target.value })}
            />
            <StructuredAddressFields value={address} onChange={setAddress} />
            {isAddressIncomplete ? (
              <p className="small" style={{ color: 'var(--color-muted)', marginTop: -8, marginBottom: 12 }}>
                {t('delivery.addressIncomplete')}
              </p>
            ) : (
              <StructuredAddressSummary value={address} />
            )}
            <Field
              label={t('delivery.notes')}
              name="notes"
              value={contact.notes}
              onChange={(e) => setContact({ ...contact, notes: e.target.value })}
            />
            <Button
              size="lg"
              block
              loading={submitting}
              disabled={isFormInvalid}
              onClick={continueToPayment}
            >
              {t('delivery.continueToReview')}
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
