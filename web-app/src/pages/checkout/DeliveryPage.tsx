import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { ApiError, type DeliveryOptionsResponse, type BuyerProfile } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { formatMoney, asArray } from '@/lib/format'
import { useAuth } from '@/store/auth'
import { useT } from '@/store/i18n'
import { RequireAuth } from '@/components/auth/Guards'
import { CheckoutProgress } from '@/components/checkout/CheckoutProgress'
import { StructuredAddressFields, StructuredAddressSummary, emptyStructuredAddress, isStructuredAddressComplete, type StructuredAddressValue } from '@/components/address/StructuredAddressFields'

/** The buyer's primary delivery address stored on their profile, or null when
 * it was never set (or only has legacy free-text labels with no ids).
 * Null is treated as "first checkout": the full form is shown and the address
 * is offered to be saved as primary. */
function savedAddressOf(profile?: BuyerProfile | null): StructuredAddressValue | null {
  if (!profile) return null
  const value: StructuredAddressValue = {
    province: profile.province ?? '',
    city: profile.city ?? '',
    commune: profile.commune ?? '',
    province_id: profile.province_id ?? '',
    city_id: profile.city_id ?? '',
    commune_id: profile.commune_id ?? '',
    street: profile.street || profile.address || '',
    building_number: profile.building_number ?? '',
    landmark: profile.landmark ?? ''
  }
  return isStructuredAddressComplete(value) ? value : null
}

function DeliveryInner() {
  const navigate = useNavigate()
  const { user, buyerProfile } = useAuth()
  const t = useT()
  const location = useLocation()
  const checkoutState = location.state as
    | { orderId?: string; orderIds?: string[]; checkoutGroupId?: string }
    | null
  const orderId = checkoutState?.orderId
  // A cart spanning several shops produced several orders. The buyer chooses one
  // address once; it is applied to every order in the checkout, so the split
  // never becomes the buyer's problem.
  const orderIds = checkoutState?.orderIds?.length ? checkoutState.orderIds : orderId ? [orderId] : []

  const [data, setData] = useState<DeliveryOptionsResponse | null>(null)
  const [usePointsForDelivery, setUsePointsForDelivery] = useState(false)
  // The postal address itself lives in `address` below: this is only who the
  // courier calls on arrival.
  const [contact, setContact] = useState(() => ({
    contact_name: [buyerProfile?.first_name || user?.first_name, buyerProfile?.last_name || user?.last_name].filter(Boolean).join(' '),
    phone: buyerProfile?.phone || user?.phone || '',
    notes: ''
  }))

  const savedAddress = useMemo(() => savedAddressOf(buyerProfile), [buyerProfile])

  // The full form lives in `address`, always seeded from the profile address so
  // editing starts from what is already known. `mode` decides whether the saved
  // summary card or the editable form is shown.
  const [address, setAddress] = useState<StructuredAddressValue>(() => ({
    ...emptyStructuredAddress(),
    ...(savedAddressOf(buyerProfile) ?? {})
  }))
  const [mode, setMode] = useState<'saved' | 'custom'>(() => (savedAddressOf(buyerProfile) ? 'saved' : 'custom'))
  // First checkout: store the address as primary by default. Returning buyer
  // editing their address: opt-in, so a temporary address stays temporary.
  const [savePrimary, setSavePrimary] = useState(() => !savedAddressOf(buyerProfile))

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
    return !contact.contact_name.trim() || !contact.phone.trim() || (mode === 'custom' && isAddressIncomplete)
  }, [contact.contact_name, contact.phone, isAddressIncomplete, mode])

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
        notes: contact.notes.trim(),
        // In saved mode the address already is the profile address; when the
        // buyer enters a different one, it only replaces the primary address
        // on explicit opt-in.
        save_address: mode === 'saved' ? false : savePrimary
      })
      // The remaining orders of a multi-shop checkout get the same address. They
      // are applied after the first so its response is the one summarised.
      for (const siblingId of orderIds.filter((id) => id !== orderId)) {
        await buyerApi.selectDelivery(siblingId, {
          method: 'TBK_STANDARD',
          use_points_for_delivery: usePointsForDelivery,
          contact_name: contact.contact_name.trim(),
          phone: contact.phone.trim(),
          address: [address.street.trim(), address.building_number.trim(), address.commune, address.city, address.province].filter(Boolean).join(', '),
          province_id: address.province_id, city_id: address.city_id, commune_id: address.commune_id,
          province: address.province, city: address.city, commune: address.commune,
          street: address.street.trim(), building_number: address.building_number.trim(), landmark: address.landmark.trim(),
          notes: contact.notes.trim(),
          save_address: false
        })
      }

      navigate('/checkout/payment', {
        state: { orderId, orderIds, checkoutGroupId: checkoutState?.checkoutGroupId, summary: res },
        replace: true
      })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('delivery.couldNotSelect'))
    } finally {
      setSubmitting(false)
    }
  }

  function useAnotherAddress() {
    setError('')
    setAddress((current) => {
      // Seed the form with the saved address so "a different address" starts
      // from what the buyer knows is correct.
      const base = savedAddressOf(buyerProfile)
      return base ? { ...base } : current
    })
    setMode('custom')
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
            <Field
              label={t('delivery.notes')}
              name="notes"
              value={contact.notes}
              onChange={(e) => setContact({ ...contact, notes: e.target.value })}
            />

            <hr className="checkout-divider" />
            <span className="eyebrow">{t('delivery.savedAddressTitle')}</span>

            {mode === 'saved' && (
              <>
                <p className="small muted">{t('delivery.savedAddress')}</p>
                {savedAddress && <StructuredAddressSummary value={savedAddress} />}
                <Button size="lg" block loading={submitting} onClick={continueToPayment}>
                  {t('delivery.useSavedAddress')}
                </Button>
                <button
                  type="button"
                  className="delivery-custom-link"
                  onClick={useAnotherAddress}
                >
                  {t('delivery.useAnotherAddress')}
                </button>
              </>
            )}

            {mode === 'custom' && (
              <>
                <StructuredAddressFields value={address} onChange={setAddress} />
                {isAddressIncomplete ? (
                  <p className="small" style={{ color: 'var(--color-muted)', marginTop: -8, marginBottom: 12 }}>
                    {t('delivery.addressIncomplete')}
                  </p>
                ) : (
                  <StructuredAddressSummary value={address} />
                )}
                <label className="checkout-checkbox">
                  <input
                    type="checkbox"
                    checked={savePrimary}
                    onChange={(e) => setSavePrimary(e.target.checked)}
                  />
                  <span>
                    <strong>{t('delivery.saveAsPrimary')}</strong>
                    <span className="small muted">{t('delivery.saveAsPrimaryHint')}</span>
                  </span>
                </label>
                <p className="small" style={{ color: 'var(--color-muted)', marginTop: -4 }}>
                  {t('delivery.otherAddressNote')}
                </p>
                {savedAddress && (
                  <button
                    type="button"
                    className="delivery-custom-link"
                    onClick={() => {
                      setError('')
                      setMode('saved')
                    }}
                  >
                    {t('delivery.backToSavedAddress')}
                  </button>
                )}
                <Button
                  size="lg"
                  block
                  loading={submitting}
                  disabled={isFormInvalid}
                  onClick={continueToPayment}
                >
                  {t('delivery.continueToReview')}
                </Button>
              </>
            )}
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