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

interface OnboardingStep {
  id: 'business' | 'shop'
  label: string
  completed: boolean
  current: boolean
}

const steps: OnboardingStep[] = [
  { id: 'business', label: 'Create Business', completed: false, current: false },
  { id: 'shop', label: 'Create First Shop', completed: false, current: false },
]

export default function SellerOnboardingPage() {
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
      setError(err instanceof Error ? err.message : 'Failed to create business')
    } finally {
      setBusy(false)
    }
  }

  async function createShop(e: React.FormEvent) {
    e.preventDefault()
    if (!activeBusiness) {
      setError('No active business found')
      return
    }
    setError('')
    setBusy(true)
    try {
      const newShop = await shopApi.create(activeBusiness.id, shopForm)
      setActiveShop(newShop.id)
      navigate('/seller/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create shop')
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
          <h1>Access Denied</h1>
          <p className="muted">This account is not registered as a Seller.</p>
          <Link to="/seller/login">
            <Button block>Sign in as Seller</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (activeBusiness && !businessCreated) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <h1>Welcome back!</h1>
          <p className="muted">Your business <strong>{activeBusiness.name}</strong> is ready.</p>
          <p className="small muted">Now create your first shop to start selling.</p>
          <Button block onClick={() => setCurrentStep('shop')}>
            Create First Shop
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card" style={{ maxWidth: '600px' }}>
        <div className="onboarding-progress" style={{ marginBottom: 24 }}>
          {steps.map((step, i) => (
            <div key={step.id} className="step" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                className={`step-circle ${step.completed ? 'completed' : step.current ? 'current' : ''}`}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '2px solid',
                  borderColor: step.completed || step.current ? 'var(--primary)' : 'var(--border)',
                  backgroundColor: step.completed ? 'var(--primary)' : step.current ? 'var(--primary-bg)' : 'transparent',
                  color: step.completed ? 'white' : step.current ? 'var(--primary)' : 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {step.completed ? '✓' : i + 1}
              </div>
              <span className={step.current ? 'bold' : ''}>{step.label}</span>
            </div>
          ))}
        </div>

        {currentStep === 'business' && (
          <form onSubmit={createBusiness}>
            <h1>Create your Business</h1>
            <p className="muted small">This will be your legal business entity on BTMI Market.</p>
            {error && <ErrorBox error={error} />}
            <Field label="Business Name" name="name" required value={businessForm.name} onChange={(e) => updateBusiness('name', e.target.value)} />
            <Field label="Business Type" name="business_type" required value={businessForm.business_type} onChange={(e) => updateBusiness('business_type', e.target.value)} as="select" options={[
              { value: 'RETAIL', label: 'Retail' },
              { value: 'WHOLESALE', label: 'Wholesale' },
              { value: 'MANUFACTURING', label: 'Manufacturing' },
              { value: 'SERVICES', label: 'Services' },
              { value: 'OTHER', label: 'Other' },
            ]} />
            <Field label="Category" name="category" required value={businessForm.category} onChange={(e) => updateBusiness('category', e.target.value)} placeholder="e.g. general, electronics, food" />
            <Field label="Business Phone" name="phone" required value={businessForm.phone} onChange={(e) => updateBusiness('phone', e.target.value)} placeholder="+243 …" />
            <Field label="Business Email" name="email" type="email" required value={businessForm.email} onChange={(e) => updateBusiness('email', e.target.value)} />
            <Field label="Country" name="country" required value={businessForm.country} onChange={(e) => updateBusiness('country', e.target.value)} placeholder="CD" />
            <Field label="City" name="city" as="select" required value={businessForm.city} options={drcCityOptions()} onChange={(e) => updateBusiness('city', e.target.value)} />
            <Field label="Default Currency" name="default_currency" required value={businessForm.default_currency} onChange={(e) => updateBusiness('default_currency', e.target.value)} as="select" options={[
              { value: 'USD', label: 'USD' },
              { value: 'CDF', label: 'CDF' },
            ]} />
            <Field label="Description (optional)" name="description" value={businessForm.description} onChange={(e) => updateBusiness('description', e.target.value)} rows={3} />
            <Field label="Registration Number (optional)" name="registration_number" value={businessForm.registration_number} onChange={(e) => updateBusiness('registration_number', e.target.value)} />
            <Field label="Tax ID (optional)" name="tax_id" value={businessForm.tax_id} onChange={(e) => updateBusiness('tax_id', e.target.value)} />
            <Button type="submit" block size="lg" loading={busy}>
              Create Business
            </Button>
          </form>
        )}

        {currentStep === 'shop' && !activeBusiness && (
          <div>
            <h1>Create Business First</h1>
            <p className="muted">You need to create a business before creating a shop.</p>
            <Button block onClick={() => setCurrentStep('business')}>
              Back to Business
            </Button>
          </div>
        )}

        {currentStep === 'shop' && activeBusiness && (
          <form onSubmit={createShop}>
            <h1>Create your First Shop</h1>
            <p className="muted small">Business: <strong>{activeBusiness.name}</strong></p>
            {error && <ErrorBox error={error} />}
            <Field label="Shop Name" name="name" required value={shopForm.name} onChange={(e) => updateShop('name', e.target.value)} />
            <Field
              label="Type"
              name="type"
              required
              value={shopForm.type}
              onChange={(e) => updateShop('type', e.target.value)}
              as="select"
              options={[
                { value: 'PHYSICAL', label: 'Retail Store' },
                { value: 'ONLINE', label: 'Online Only' },
              ]}
            />
            <Field label="City" name="city" as="select" required value={shopForm.city} options={drcCityOptions()} onChange={(e) => updateShop('city', e.target.value)} />
            <Field label="Address" name="address" required value={shopForm.address} onChange={(e) => updateShop('address', e.target.value)} rows={2} />
            <Field label="Phone" name="phone" required value={shopForm.phone} onChange={(e) => updateShop('phone', e.target.value)} placeholder="+243 …" />
            
            <details style={{ marginTop: 16 }}>
              <summary className="small muted">Delivery Configuration (optional)</summary>
              <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={shopForm.supports_shop_delivery}
                    onChange={(e) => updateShop('supports_shop_delivery', e.target.checked)}
                  />
                  <span>Shop provides own delivery</span>
                </label>
                {shopForm.supports_shop_delivery && (
                  <Field
                    label="Shop Delivery Fee (FC)"
                    name="shop_delivery_fee"
                    type="number"
                    value={String(shopForm.shop_delivery_fee)}
                    onChange={(e) => updateShop('shop_delivery_fee', Number(e.target.value))}
                  />
                )}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={shopForm.supports_partner_delivery}
                    onChange={(e) => updateShop('supports_partner_delivery', e.target.checked)}
                  />
                  <span>Partner delivery available</span>
                </label>
                {shopForm.supports_partner_delivery && (
                  <>
                    <Field
                      label="Partner Delivery Fee (FC)"
                      name="partner_delivery_fee"
                      type="number"
                      value={String(shopForm.partner_delivery_fee)}
                      onChange={(e) => updateShop('partner_delivery_fee', Number(e.target.value))}
                    />
                    <Field
                      label="Partner Provider"
                      name="partner_delivery_provider"
                      value={shopForm.partner_delivery_provider}
                      onChange={(e) => updateShop('partner_delivery_provider', e.target.value)}
                    />
                    <Field
                      label="Delivery City"
                      name="delivery_city"
                      as="select"
                      value={shopForm.delivery_city}
                      options={drcCityOptions()}
                      onChange={(e) => updateShop('delivery_city', e.target.value)}
                    />
                    <Field
                      label="Delivery Address"
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
              Create Shop & Go to Dashboard
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
