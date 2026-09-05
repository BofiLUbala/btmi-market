import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { ApiError, type DeliveryMethod, type DeliveryOptionsResponse } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { formatMoney, asArray } from '@/lib/format'
import { useAuth } from '@/store/auth'
import { useT } from '@/store/i18n'
import { RequireAuth } from '@/components/auth/Guards'
import { CheckoutProgress } from '@/components/checkout/CheckoutProgress'
import type { TranslationKey } from '@/locales/fr'

const METHOD_LABEL: Record<string, TranslationKey> = {
  PICKUP: 'delivery.pickup',
  SHOP_DELIVERY: 'delivery.shopDelivery',
  PARTNER: 'delivery.partner'
}

function DeliveryInner() {
  const navigate = useNavigate()
  const { user, buyerProfile } = useAuth()
  const t = useT()
  const location = useLocation()
  const orderId = (location.state as { orderId?: string } | null)?.orderId

  const [data, setData] = useState<DeliveryOptionsResponse | null>(null)
  const [method, setMethod] = useState<DeliveryMethod>('PICKUP')
  const [usePointsForDelivery, setUsePointsForDelivery] = useState(false)
  const [contact, setContact] = useState(() => {
    const name = [buyerProfile?.first_name || user?.first_name, buyerProfile?.last_name || user?.last_name].filter(Boolean).join(' ')
    const phone = buyerProfile?.phone || user?.phone || ''
    const fullAddress = [buyerProfile?.address, buyerProfile?.commune, buyerProfile?.city].filter(Boolean).join(', ')
    return {
      contact_name: name,
      phone,
      address: fullAddress || (user?.city ? `${t('delivery.cityPrefix')}${user.city}` : ''),
      notes: ''
    }
  })
  const [previewFee, setPreviewFee] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!buyerProfile && !user) return
    const name = [buyerProfile?.first_name || user?.first_name, buyerProfile?.last_name || user?.last_name].filter(Boolean).join(' ')
    const phone = buyerProfile?.phone || user?.phone || ''
    const fullAddress = [buyerProfile?.address, buyerProfile?.commune, buyerProfile?.city].filter(Boolean).join(', ')
    setContact((prev) => ({
      contact_name: prev.contact_name || name,
      phone: prev.phone || phone,
      address: prev.address || fullAddress || (user?.city ? `${t('delivery.cityPrefix')}${user.city}` : ''),
      notes: prev.notes
    }))
  }, [buyerProfile, user, t])

  const selected = useMemo(
    () => data?.options.find((o) => o.method === method) ?? null,
    [data, method]
  )

  const defaultAddress = useMemo(() => (user?.city ? `${t('delivery.cityPrefix')}${user.city}` : ''), [user?.city, t])

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
          setError(e instanceof ApiError ? e.message : t('delivery.couldNotLoad'))
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
      setError(t('delivery.fillAllFields'))
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
      setError(e instanceof ApiError ? e.message : t('delivery.couldNotSelect'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingBlock label={t('delivery.loadingOptions')} />

  return (
    <div className="checkout-page fade-in">
      <CheckoutProgress current="Delivery" />
      <header className="checkout-heading"><div><h1>{t('delivery.title')}</h1><p>{t('delivery.subtitle')}</p></div></header>
      {error && <ErrorBox error={error} />}

      {data && (
        <div className="checkout-layout">
          <div className="checkout-content stack">
            <section className="checkout-card delivery-options-card"><div className="checkout-card-head"><h2>{t('delivery.method')}</h2><span>{t('delivery.options', { count: data.options.length })}</span></div>
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
                  <h3>{METHOD_LABEL[o.method] ? t(METHOD_LABEL[o.method]) : o.label}</h3>
                  <div className="bold">{o.available ? formatMoney(o.fee) : t('delivery.unavailable')}</div>
                </div>
                {o.provider && <div className="small muted">{t('delivery.providedBy', { provider: o.provider })}</div>}
                <div className="small muted">{o.method === 'PICKUP' ? t('delivery.pickupNote') : t('delivery.deliveryNote')}</div>
              </button>
            ))}
            </section>

            <section className={`checkout-card rewards-card ${usePointsForDelivery ? 'active' : ''}`}>
              <div><span className="eyebrow">{t('delivery.rewards')}</span><h2>{t('delivery.usePointsForDelivery')}</h2><p>{t('delivery.reduceFee')}</p></div>
              <button type="button" role="switch" aria-label={t('delivery.usePointsForDelivery')} aria-checked={usePointsForDelivery} className={`toggle-switch ${usePointsForDelivery ? 'on' : ''}`} onClick={() => togglePoints(!usePointsForDelivery)}><span /></button>
              {usePointsForDelivery && previewFee !== null && selected && (
                <div className="rewards-result"><strong>{t('points.applied')}</strong><span>{t('delivery.fee')}{' '}
                    <s className="muted">{formatMoney(selected.fee)}</s>{' '}
                    <span className="pd-discount">{formatMoney(previewFee)}</span>
                  </span><button onClick={() => togglePoints(false)}>{t('points.remove')}</button>
                </div>
              )}
            </section>
          </div>

          <aside className="checkout-card checkout-summary stack">
            <span className="eyebrow">{t('delivery.details')}</span>
            <h2>{selected ? t(METHOD_LABEL[selected.method]) : t('delivery.chooseMethod')}</h2>
            {method === 'PICKUP' ? (
              <p className="small muted">
                {t('delivery.noAddressNeeded')}
              </p>
            ) : (
              <>
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
                  label={t('delivery.deliveryAddress')}
                  name="address"
                  required
                  value={contact.address}
                  onChange={(e) => setContact({ ...contact, address: e.target.value })}
                  placeholder={t('delivery.addressPlaceholder')}
                />
                {isAddressIncomplete && contact.address.trim().length > 0 && (
                  <p className="small" style={{ color: 'var(--color-danger)', marginTop: -8, marginBottom: 12 }}>
                    {t('delivery.addressIncomplete')}
                  </p>
                )}
                <Field
                  label={t('delivery.notes')}
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
