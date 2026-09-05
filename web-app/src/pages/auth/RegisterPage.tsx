import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'
import { drcCityOptions, isKinshasa, kinshasaCommuneOptions } from '@/lib/drcLocations'

type RegPhase = 'form' | 'creating' | 'sending' | 'success' | 'email-failed'

const MIN_LOADING_MS = 1500

const canonicalPhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return digits.length === 10 && digits.startsWith('0') ? `243${digits.slice(1)}` : digits
}

export default function RegisterPage() {
  const t = useT()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [form, setForm] = useState({
    email: '',
    password: '',
    password_confirmation: '',
    first_name: '',
    last_name: '',
    phone: '',
    backup_phone: '',
    country: 'République Démocratique du Congo',
    city: 'Kinshasa',
    commune: 'Gombe',
    address: '',
    latitude: null as number | null,
    longitude: null as number | null
  })

  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsStatus, setGpsStatus] = useState<string>('')
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<RegPhase>('form')
  const [busy, setBusy] = useState(false)

  const passwordRules = {
    minLength: form.password.length >= 8,
    maxLength: form.password.length <= 64,
    uppercase: /[A-Z]/.test(form.password),
    lowercase: /[a-z]/.test(form.password),
    number: /[0-9]/.test(form.password),
    special: /[^A-Za-z0-9]/.test(form.password),
  }
  const passwordValid = Object.values(passwordRules).every(Boolean)
  const passwordsMatch = form.password.length > 0 && form.password === form.password_confirmation

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setError('')
  }

  function setCity(city: string) {
    setForm((f) => ({
      ...f,
      city,
      commune: isKinshasa(city) ? (f.commune || 'Gombe') : ''
    }))
    setError('')
  }

  function getGpsLocation() {
    if (!navigator.geolocation) {
      setGpsStatus(t('auth.register.gpsUnavailable'))
      return
    }
    setGpsLoading(true)
    setGpsStatus(t('auth.register.gpsAcquiring'))
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6))
        const lng = Number(pos.coords.longitude.toFixed(6))
        setForm((f) => ({ ...f, latitude: lat, longitude: lng }))
        setGpsLoading(false)
        setGpsStatus(t('auth.register.gpsSuccess', { lat, lng }))
      },
      () => {
        setGpsLoading(false)
        setGpsStatus(t('auth.register.gpsUnavailable'))
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function clearGps() {
    setForm((f) => ({ ...f, latitude: null, longitude: null }))
    setGpsStatus('')
  }

  function validateStep(currentStep: number): boolean {
    setError('')
    if (currentStep === 1) {
      if (!form.email.trim() || !form.email.includes('@')) {
        setError(t('auth.register.fillAllFields'))
        return false
      }
      if (!passwordValid) {
        setError(t('auth.register.passwordHint'))
        return false
      }
      if (!passwordsMatch) {
        setError(t('auth.register.passwordsMismatch'))
        return false
      }
      return true
    }

    if (currentStep === 2) {
      if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim()) {
        setError(t('auth.register.fillAllFields'))
        return false
      }
      if (form.backup_phone.trim() && canonicalPhone(form.phone) === canonicalPhone(form.backup_phone)) {
        setError(t('account.backupPhoneMustDiffer'))
        return false
      }
      return true
    }

    if (currentStep === 3) {
      if (!form.country.trim() || !form.city.trim() || !form.address.trim()) {
        setError(t('auth.register.fillAllFields'))
        return false
      }
      if (isKinshasa(form.city) && !form.commune.trim()) {
        setError(t('auth.register.fillAllFields'))
        return false
      }
      return true
    }

    return true
  }

  function nextStep() {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, 4) as 1 | 2 | 3 | 4)
    }
  }

  function prevStep() {
    setError('')
    setStep((s) => Math.max(s - 1, 1) as 1 | 2 | 3 | 4)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return
    }

    setBusy(true)
    setPhase('creating')
    const start = Date.now()
    let sendingTimer: ReturnType<typeof setTimeout> | undefined
    try {
      sendingTimer = setTimeout(() => setPhase('sending'), 600)
      await authApi.register({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        backup_phone: form.backup_phone.trim() || undefined,
        email: form.email.trim().toLowerCase(),
        password: form.password,
        password_confirmation: form.password_confirmation,
        country: form.country.trim() || undefined,
        city: form.city.trim() || undefined,
        commune: form.commune.trim() || undefined,
        address: form.address.trim() || undefined,
        latitude: form.latitude,
        longitude: form.longitude
      })
      clearTimeout(sendingTimer)
      sendingTimer = undefined

      const elapsed = Date.now() - start
      if (elapsed < MIN_LOADING_MS) {
        setPhase('sending')
        await new Promise((r) => setTimeout(r, MIN_LOADING_MS - elapsed))
      }
      setPhase('success')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('auth.register.failed')
      if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('activation')) {
        setPhase('email-failed')
        setError(msg)
      } else {
        setPhase('form')
        setError(msg)
      }
    } finally {
      if (sendingTimer) clearTimeout(sendingTimer)
      setBusy(false)
    }
  }

  // ── Success screen ──
  if (phase === 'success') {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <div className="registration-result">
            <span className="result-icon" aria-hidden>✓</span>
            <h1>{t('auth.register.created')}</h1>
            <p className="muted">{t('auth.register.checkEmail')}</p>
            <p>{t('auth.register.sentLinkToEmail', { email: form.email })}</p>
            <p className="small muted">{t('auth.register.linkValidity')}</p>
            <Link to="/resend-activation">
              <Button variant="outline" block>{t('auth.register.resendActivation')}</Button>
            </Link>
            <Link to="/login">
              <Button block>{t('auth.register.goToSignIn')}</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Email-failed screen ──
  if (phase === 'email-failed') {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <div className="registration-result">
            <span className="result-icon result-icon--warn" aria-hidden>!</span>
            <h1>{t('auth.register.created')}</h1>
            <p className="muted">{t('auth.register.emailFailed')}</p>
            {error && <ErrorBox error={error} />}
            <Link to="/resend-activation">
              <Button block>{t('auth.register.trySendingAgain')}</Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" block>{t('auth.register.goToSignIn')}</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const isLoading = phase === 'creating' || phase === 'sending'

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit} style={{ maxWidth: 580 }}>
        <h1>{t('auth.register.title')}</h1>
        <p className="muted small">{t('auth.register.subtitle')}</p>

        {/* Wizard progress tabs */}
        <div className="registration-steps" style={{ marginBottom: '1.25rem' }}>
          <div className={`reg-step${step > 1 ? ' reg-step--done' : ''}${step === 1 ? ' reg-step--active' : ''}`} onClick={() => step > 1 && setStep(1)} style={{ cursor: step > 1 ? 'pointer' : 'default' }}>
            <span className="reg-step-icon">{step > 1 ? '✓' : '1'}</span>
            <span>{t('auth.register.stepAccount')}</span>
          </div>
          <div className={`reg-step${step > 2 ? ' reg-step--done' : ''}${step === 2 ? ' reg-step--active' : ''}`} onClick={() => step > 2 && setStep(2)} style={{ cursor: step > 2 ? 'pointer' : 'default' }}>
            <span className="reg-step-icon">{step > 2 ? '✓' : '2'}</span>
            <span>{t('auth.register.stepPersonal')}</span>
          </div>
          <div className={`reg-step${step > 3 ? ' reg-step--done' : ''}${step === 3 ? ' reg-step--active' : ''}`} onClick={() => step > 3 && setStep(3)} style={{ cursor: step > 3 ? 'pointer' : 'default' }}>
            <span className="reg-step-icon">{step > 3 ? '✓' : '3'}</span>
            <span>{t('auth.register.stepAddress')}</span>
          </div>
          <div className={`reg-step${step === 4 ? ' reg-step--active' : ''}`}>
            <span className="reg-step-icon">4</span>
            <span>{t('auth.register.stepReview')}</span>
          </div>
        </div>

        {error && <ErrorBox error={error} />}

        {isLoading && (
          <div className="registration-steps" aria-busy="true" aria-live="polite">
            <Step label={t('auth.register.creating')} done={phase === 'sending'} active={phase === 'creating'} />
            <Step label={t('auth.register.sendingEmail')} done={false} active={phase === 'sending'} />
          </div>
        )}

        {!isLoading && (
          <>
            {/* Step 1: Account credentials */}
            {step === 1 && (
              <div className="stack" style={{ gap: '0.85rem' }}>
                <Field
                  label={t('common.email')}
                  name="email"
                  type="email"
                  required
                  placeholder={t('auth.emailPlaceholder')}
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                />
                <Field
                  label={t('auth.password')}
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  hint={t('auth.register.passwordHint')}
                  showPasswordToggle
                />
                <Field
                  label={t('auth.passwordConfirm')}
                  name="password_confirmation"
                  type="password"
                  required
                  value={form.password_confirmation}
                  onChange={(e) => set('password_confirmation', e.target.value)}
                  showPasswordToggle
                />
                {form.password_confirmation && (
                  <div className={`small ${passwordsMatch ? 'success-text' : 'danger-text'}`}>
                    {passwordsMatch ? '✓ ' + t('auth.passwordsMatch') : '✗ ' + t('auth.register.passwordsMismatch')}
                  </div>
                )}
                <div style={{ marginTop: '0.5rem' }}>
                  <Button type="button" block size="lg" onClick={nextStep}>
                    {t('auth.register.nextStep')} →
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Personal information */}
            {step === 2 && (
              <div className="stack" style={{ gap: '0.85rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <Field
                    label={t('auth.firstName')}
                    name="first_name"
                    required
                    value={form.first_name}
                    onChange={(e) => set('first_name', e.target.value)}
                  />
                  <Field
                    label={t('auth.lastName')}
                    name="last_name"
                    required
                    value={form.last_name}
                    onChange={(e) => set('last_name', e.target.value)}
                  />
                </div>
                <Field
                  label={t('account.primaryPhone')}
                  name="phone"
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder={t('auth.phonePlaceholder')}
                />
                <Field
                  label={t('auth.register.backupPhoneLabel')}
                  name="backup_phone"
                  type="tel"
                  value={form.backup_phone}
                  onChange={(e) => set('backup_phone', e.target.value)}
                  placeholder="+243 …"
                  hint={t('account.backupPhoneHint')}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <Button type="button" variant="outline" size="lg" onClick={prevStep}>
                    ← {t('auth.register.prevStep')}
                  </Button>
                  <Button type="button" size="lg" onClick={nextStep}>
                    {t('auth.register.nextStep')} →
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Address & Location */}
            {step === 3 && (
              <div className="stack" style={{ gap: '0.85rem' }}>
                <Field
                  label={t('auth.register.countryLabel')}
                  name="country"
                  value={form.country}
                  onChange={(e) => set('country', e.target.value)}
                  required
                />
                <div style={{ display: 'grid', gridTemplateColumns: isKinshasa(form.city) ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
                  <Field
                    label={t('common.city')}
                    name="city"
                    as="select"
                    value={form.city}
                    options={drcCityOptions(form.city)}
                    onChange={(e) => setCity(e.target.value)}
                  />
                  {isKinshasa(form.city) && (
                    <Field
                      label={t('common.commune')}
                      name="commune"
                      as="select"
                      value={form.commune}
                      options={kinshasaCommuneOptions(form.commune)}
                      onChange={(e) => set('commune', e.target.value)}
                    />
                  )}
                </div>
                {!isKinshasa(form.city) && (
                  <Field
                    label={t('common.commune')}
                    name="commune"
                    placeholder="Commune / Quartier"
                    value={form.commune}
                    onChange={(e) => set('commune', e.target.value)}
                  />
                )}
                <Field
                  label={t('common.address')}
                  name="address"
                  required
                  placeholder={t('auth.register.addressPlaceholder')}
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                />

                {/* Optional GPS Location */}
                <div className="profile-contact-block" style={{ padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <div className="eyebrow">{t('auth.register.gpsCoordinates')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    <Button type="button" variant="outline" size="sm" loading={gpsLoading} onClick={getGpsLocation}>
                      📍 {t('auth.register.gpsUse')}
                    </Button>
                    {form.latitude !== null && (
                      <Button type="button" variant="ghost" size="sm" onClick={clearGps}>
                        {t('auth.register.gpsClear')}
                      </Button>
                    )}
                  </div>
                  {gpsStatus && <p className="small muted" style={{ marginTop: '0.4rem' }}>{gpsStatus}</p>}
                  {form.latitude !== null && (
                    <p className="small" style={{ marginTop: '0.25rem', color: 'var(--success)' }}>
                      Lat: {form.latitude}, Lng: {form.longitude}
                    </p>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <Button type="button" variant="outline" size="lg" onClick={prevStep}>
                    ← {t('auth.register.prevStep')}
                  </Button>
                  <Button type="button" size="lg" onClick={nextStep}>
                    {t('auth.register.nextStep')} →
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Review / Confirmation */}
            {step === 4 && (
              <div className="stack" style={{ gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>{t('auth.register.reviewTitle')}</h2>
                  <p className="small muted">{t('auth.register.reviewDesc')}</p>
                </div>

                <div className="profile-contact-block" style={{ padding: '0.85rem', background: 'var(--surface-alt)', borderRadius: '8px' }}>
                  <div className="eyebrow">{t('auth.register.accountDetails')}</div>
                  <div className="info-row"><span className="k">{t('common.email')}</span><span className="v">{form.email}</span></div>
                </div>

                <div className="profile-contact-block" style={{ padding: '0.85rem', background: 'var(--surface-alt)', borderRadius: '8px' }}>
                  <div className="eyebrow">{t('auth.register.personalDetails')}</div>
                  <div className="info-row"><span className="k">{t('common.name')}</span><span className="v">{form.first_name} {form.last_name}</span></div>
                  <div className="info-row"><span className="k">{t('account.primary')}</span><span className="v">{form.phone}</span></div>
                  {form.backup_phone && <div className="info-row"><span className="k">{t('account.backup')}</span><span className="v">{form.backup_phone}</span></div>}
                </div>

                <div className="profile-contact-block" style={{ padding: '0.85rem', background: 'var(--surface-alt)', borderRadius: '8px' }}>
                  <div className="eyebrow">{t('auth.register.addressDetails')}</div>
                  <div className="info-row"><span className="k">{t('auth.register.countryLabel')}</span><span className="v">{form.country}</span></div>
                  <div className="info-row"><span className="k">{t('common.city')} / {t('common.commune')}</span><span className="v">{[form.commune, form.city].filter(Boolean).join(', ')}</span></div>
                  <div className="info-row"><span className="k">{t('common.address')}</span><span className="v">{form.address}</span></div>
                  {form.latitude !== null && (
                    <div className="info-row"><span className="k">GPS</span><span className="v">{form.latitude}, {form.longitude}</span></div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <Button type="button" variant="outline" size="lg" onClick={prevStep} disabled={busy}>
                    ← {t('auth.register.prevStep')}
                  </Button>
                  <Button type="submit" size="lg" loading={busy} disabled={busy}>
                    {t('auth.register.submit')}
                  </Button>
                </div>
              </div>
            )}

            <p className="small muted" style={{ textAlign: 'center', marginTop: '1rem' }}>
              {t('auth.register.alreadyRegistered')} <Link to="/login" className="section-link">{t('common.signIn')}</Link>
            </p>
          </>
        )}
      </form>
    </div>
  )
}

function Step({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div className={`reg-step${done ? ' reg-step--done' : ''}${active ? ' reg-step--active' : ''}`}>
      <span className="reg-step-icon" aria-hidden>
        {done ? '✓' : active ? '' : '○'}
        {active && !done && <span className="spinner" />}
      </span>
      <span>{label}</span>
    </div>
  )
}