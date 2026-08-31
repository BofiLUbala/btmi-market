import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { businessApi } from '@/api/seller'
import { shopApi } from '@/api/seller'
import { Button } from '@/components/ui/Button'
import { ErrorBox } from '@/components/ui/Feedback'
import { Field } from '@/components/ui/Field'
import type { SellerBusiness } from '@/api/types'
import { drcCityOptions } from '@/lib/drcLocations'
import { useT } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

interface OnboardingStep {
  id: 'business' | 'shop'
  labelKey: TranslationKey
  completed: boolean
  current: boolean
}

const steps: OnboardingStep[] = [
  { id: 'business', labelKey: 'seller.onboarding.stepCreateBusiness', completed: false, current: false },
  { id: 'shop', labelKey: 'seller.onboarding.stepCreateShop', completed: false, current: false },
]

export default function SellerOnboardingPage() {
  const t = useT()
  const { user, activeBusiness, setActiveBusiness, setSellerBusinesses, setActiveShop } = useAuth()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<'business' | 'shop'>('business')
  const [businessForm, setBusinessForm] = useState({
    name: '',
    description: '',
    registration_number: '',
    tax_id: '',
    business_type: 'RETAIL',
    category: 'general',
    phone: '',
    email: '',
    country: 'CD',
    city: '',
    default_currency: 'USD',
  })
  const [shopForm, setShopForm] = useState({
    name: '',
    type: 'PHYSICAL',
    city: '',
    address: '',
    phone: '',
    supports_shop_delivery: false,
    shop_delivery_fee: 0,
    supports_partner_delivery: false,
    partner_delivery_fee: 0,
    partner_delivery_provider: '',
    delivery_city: '',
    delivery_address: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [businessCreated, setBusinessCreated] = useState(false)

  useEffect(() => {
    if (user?.email || user?.phone) {
      setBusinessForm((f) => ({
        ...f,
        email: f.email || user.email || '',
        phone: f.phone || user.phone || '',
      }))
    }
  }, [user])

  useEffect(() => {
    if (activeBusiness) {
      setCurrentStep('shop')
      steps[0].completed = true
      steps[0].current = false
      steps[1].current = true
    } else if (user?.account_type === 'SELLER') {
      setCurrentStep('business')
      steps[0].current = true
    }
  }, [activeBusiness, user])

  async function createBusiness(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const created = await businessApi.create({
        name: businessForm.name,
        business_type: businessForm.business_type,
        category: businessForm.category,
        phone: businessForm.phone,
        whatsapp: businessForm.phone,
        email: businessForm.email,
        country: businessForm.country,
        city: businessForm.city,
        default_currency: businessForm.default_currency,
      })
      const sellerBiz: SellerBusiness = {
        ...created,
        status: created.status || 'ACTIVE',
      }
      setActiveBusiness(sellerBiz)
      setSellerBusinesses([sellerBiz])
      setBusinessCreated(true)
      setCurrentStep('shop')
      steps[0].completed = true
      steps[0].current = false
      steps[1].current = true
    } catch (err) {
      setError(err instanceof Error ? err.message : t('seller.onboarding.createBusinessFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function createShop(e: React.FormEvent) {
    e.preventDefault()
    if (!activeBusiness) {
      setError(t('seller.onboarding.noActiveBusiness'))
      return
    }
    setError('')
    setBusy(true)
    try {
      const newShop = await shopApi.create(activeBusiness.id, shopForm)
      setActiveShop(newShop.id)
      navigate('/seller/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('seller.onboarding.createShopFailed'))
    } finally {
      setBusy(false)
    }
  }

  const updateBusiness = <K extends keyof typeof businessForm>(key: K, value: string) => {
    setBusinessForm((f) => ({ ...f, [key]: value }))
  }

  const updateShop = <K extends keyof typeof shopForm>(key: K, value: string | number | boolean) => {
    setShopForm((f) => ({ ...f, [key]: value }))
  }

  if (!user || user.account_type !== 'SELLER') {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <h1>{t('seller.onboarding.accessDenied')}</h1>
          <p className="muted">{t('seller.onboarding.notSeller')}</p>
          <Link to="/seller/login">
            <Button block>{t('auth.signInAsSeller')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (activeBusiness && !businessCreated) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <h1>{t('seller.onboarding.welcomeBack')}</h1>
          <p className="muted">{t('seller.onboarding.yourBusiness')} <strong>{activeBusiness.name}</strong> {t('seller.onboarding.businessReadySuffix')}</p>
          <p className="small muted">{t('seller.onboarding.createFirstShopHint')}</p>
          <Button block onClick={() => setCurrentStep('shop')}>
            {t('seller.onboarding.createFirstShop')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card" style={{ maxWidth: '600px' }}>
        <ol className="onboarding-progress mb-5">
          {steps.map((step, i) => (
            <li
              key={step.id}
              className="onboarding-step"
              aria-current={step.current ? 'step' : undefined}
            >
              <span className={`step-circle ${step.completed ? 'completed' : step.current ? 'current' : ''}`}>
                {step.completed ? '✓' : i + 1}
              </span>
              <span className={step.current ? 'bold' : ''}>{t(step.labelKey)}</span>
            </li>
          ))}
        </ol>

        {currentStep === 'business' && (
          <form onSubmit={createBusiness}>
            <h1>{t('seller.onboarding.createBusinessTitle')}</h1>
            <p className="muted small">{t('seller.onboarding.businessSubtitle')}</p>
            {error && <ErrorBox error={error} />}
            <Field label={t('seller.onboarding.businessName')} name="name" required value={businessForm.name} onChange={(e) => updateBusiness('name', e.target.value)} />
            <Field label={t('seller.onboarding.businessType')} name="business_type" required value={businessForm.business_type} onChange={(e) => updateBusiness('business_type', e.target.value)} as="select" options={[
              { value: 'RETAIL', label: t('seller.businessType.RETAIL') },
              { value: 'WHOLESALE', label: t('seller.businessType.WHOLESALE') },
              { value: 'MANUFACTURING', label: t('seller.businessType.MANUFACTURING') },
              { value: 'SERVICES', label: t('seller.businessType.SERVICES') },
              { value: 'OTHER', label: t('seller.businessType.OTHER') },
            ]} />
            <Field label={t('seller.onboarding.category')} name="category" required value={businessForm.category} onChange={(e) => updateBusiness('category', e.target.value)} placeholder={t('seller.onboarding.categoryPlaceholder')} />
            <Field label={t('seller.onboarding.businessPhone')} name="phone" required value={businessForm.phone} onChange={(e) => updateBusiness('phone', e.target.value)} placeholder={t('auth.phonePlaceholder')} />
            <Field label={t('seller.onboarding.businessEmail')} name="email" type="email" required value={businessForm.email} onChange={(e) => updateBusiness('email', e.target.value)} />
            <Field label={t('seller.onboarding.country')} name="country" required value={businessForm.country} onChange={(e) => updateBusiness('country', e.target.value)} placeholder="CD" />
            <Field label={t('common.city')} name="city" as="select" required value={businessForm.city} options={drcCityOptions()} onChange={(e) => updateBusiness('city', e.target.value)} />
            <Field label={t('seller.onboarding.defaultCurrency')} name="default_currency" required value={businessForm.default_currency} onChange={(e) => updateBusiness('default_currency', e.target.value)} as="select" options={[
              { value: 'USD', label: 'USD' },
              { value: 'CDF', label: 'CDF' },
            ]} />
            <Field label={t('seller.onboarding.descriptionOptional')} name="description" value={businessForm.description} onChange={(e) => updateBusiness('description', e.target.value)} rows={3} />
            <Field label={t('seller.onboarding.registrationNumberOptional')} name="registration_number" value={businessForm.registration_number} onChange={(e) => updateBusiness('registration_number', e.target.value)} />
            <Field label={t('seller.onboarding.taxIdOptional')} name="tax_id" value={businessForm.tax_id} onChange={(e) => updateBusiness('tax_id', e.target.value)} />
            <Button type="submit" block size="lg" loading={busy}>
              {t('seller.onboarding.createBusiness')}
            </Button>
          </form>
        )}

        {currentStep === 'shop' && !activeBusiness && (
          <div>
            <h1>{t('seller.onboarding.createBusinessFirst')}</h1>
            <p className="muted">{t('seller.onboarding.createBusinessFirstHint')}</p>
            <Button block onClick={() => setCurrentStep('business')}>
              {t('seller.onboarding.backToBusiness')}
            </Button>
          </div>
        )}

        {currentStep === 'shop' && activeBusiness && (
          <form onSubmit={createShop}>
            <h1>{t('seller.onboarding.createShopTitle')}</h1>
            <p className="muted small">{t('seller.onboarding.businessLabel')} <strong>{activeBusiness.name}</strong></p>
            {error && <ErrorBox error={error} />}
            <Field label={t('seller.onboarding.shopName')} name="name" required value={shopForm.name} onChange={(e) => updateShop('name', e.target.value)} />
            <Field
              label={t('seller.onboarding.shopType')}
              name="type"
              required
              value={shopForm.type}
              onChange={(e) => updateShop('type', e.target.value)}
              as="select"
              options={[
                { value: 'PHYSICAL', label: t('seller.shopType.PHYSICAL') },
                { value: 'ONLINE', label: t('seller.shopType.ONLINE') },
              ]}
            />
            <Field label={t('common.city')} name="city" as="select" required value={shopForm.city} options={drcCityOptions()} onChange={(e) => updateShop('city', e.target.value)} />
            <Field label={t('common.address')} name="address" required value={shopForm.address} onChange={(e) => updateShop('address', e.target.value)} rows={2} />
            <Field label={t('common.phone')} name="phone" required value={shopForm.phone} onChange={(e) => updateShop('phone', e.target.value)} placeholder={t('auth.phonePlaceholder')} />

            <details style={{ marginTop: 16 }}>
              <summary className="small muted">{t('seller.onboarding.deliveryConfiguration')}</summary>
              <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={shopForm.supports_shop_delivery}
                    onChange={(e) => updateShop('supports_shop_delivery', e.target.checked)}
                  />
                  <span>{t('seller.onboarding.shopProvidesDelivery')}</span>
                </label>
                {shopForm.supports_shop_delivery && (
                  <Field
                    label={t('seller.onboarding.shopDeliveryFee')}
                    name="shop_delivery_fee"
                    type="number"
                    value={String(shopForm.shop_delivery_fee)}
                    onChange={(e) => updateShop('shop_delivery_fee', Number(e.target.value))}
                  />
                )}
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={shopForm.supports_partner_delivery}
                    onChange={(e) => updateShop('supports_partner_delivery', e.target.checked)}
                  />
                  <span>{t('seller.onboarding.partnerDeliveryAvailable')}</span>
                </label>
                {shopForm.supports_partner_delivery && (
                  <>
                    <Field
                      label={t('seller.onboarding.partnerDeliveryFee')}
                      name="partner_delivery_fee"
                      type="number"
                      value={String(shopForm.partner_delivery_fee)}
                      onChange={(e) => updateShop('partner_delivery_fee', Number(e.target.value))}
                    />
                    <Field
                      label={t('seller.onboarding.partnerProvider')}
                      name="partner_delivery_provider"
                      value={shopForm.partner_delivery_provider}
                      onChange={(e) => updateShop('partner_delivery_provider', e.target.value)}
                    />
                    <Field
                      label={t('seller.onboarding.deliveryCity')}
                      name="delivery_city"
                      as="select"
                      value={shopForm.delivery_city}
                      options={drcCityOptions()}
                      onChange={(e) => updateShop('delivery_city', e.target.value)}
                    />
                    <Field
                      label={t('seller.onboarding.deliveryAddress')}
                      name="delivery_address"
                      value={shopForm.delivery_address}
                      onChange={(e) => updateShop('delivery_address', e.target.value)}
                      rows={2}
                    />
                  </>
                )}
              </div>
            </details>

            <Button type="submit" block size="lg" loading={busy}>
              {t('seller.onboarding.createShopGo')}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}