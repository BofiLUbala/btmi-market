import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { sellerAuthApi } from '@/api/seller'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'

type RegPhase = 'form' | 'creating' | 'sending' | 'success' | 'email-failed'

const MIN_LOADING_MS = 1500

export default function SellerRegisterPage() {
  const t = useT()
  const [form, setForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    phone: '',
    email: '',
    password: '',
    password_confirmation: '',
  })
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<RegPhase>('form')
  const [busy, setBusy] = useState(false)
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const passwordRules = {
    minLength: form.password.length >= 8,
    maxLength: form.password.length <= 64,
    uppercase: /[A-Z]/.test(form.password),
    lowercase: /[a-z]/.test(form.password),
    number: /[0-9]/.test(form.password),
    special: /[^A-Za-z0-9]/.test(form.password),
  }
  const passwordValid = Object.values(passwordRules).every(Boolean)
  const confirmStarted = form.password_confirmation.length > 0
  const passwordsMatch = confirmStarted && form.password === form.password_confirmation
  const requiredComplete = Boolean(form.first_name && form.last_name && form.phone && form.email)
  const canSubmit = requiredComplete && passwordValid && passwordsMatch && policyAccepted && !busy
  const existingAccountError = /already exists|already registered/i.test(error)

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!passwordValid) {
      setError(t('seller.auth.register.invalidPassword'))
      return
    }
    if (form.password !== form.password_confirmation) {
      setError(t('auth.register.passwordsMismatch'))
      return
    }
    setBusy(true)
    setPhase('creating')
    const start = Date.now()
    let sendingTimer: ReturnType<typeof setTimeout> | undefined
    try {
      sendingTimer = setTimeout(() => setPhase('sending'), 600)
      await sellerAuthApi.registerSeller(form)
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
      <div className="seller-register-layout">
        <aside className="seller-register-benefits">
          <span className="seller-eyebrow">TBK Seller</span>
          <h1>{t('seller.auth.register.benefitTitle')}</h1>
          <p>{t('seller.auth.register.benefitSubtitle')}</p>
        </aside>
        <div className="card seller-register-card">
          <div className="registration-result">
            <span className="result-icon" aria-hidden>✓</span>
            <h1>{t('seller.auth.register.sellerCreated')}</h1>
            <p className="muted">{t('auth.register.checkEmail')}</p>
            <p>{t('auth.register.sentLinkToEmail', { email: form.email })}</p>
            <p className="small muted">{t('auth.register.linkValidity')}</p>
            <Link to="/seller/resend-activation">
              <Button variant="outline" block>{t('auth.register.resendActivation')}</Button>
            </Link>
            <Link to="/seller/login">
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
      <div className="seller-register-layout">
        <aside className="seller-register-benefits">
          <span className="seller-eyebrow">TBK Seller</span>
          <h1>{t('seller.auth.register.benefitTitle')}</h1>
        </aside>
        <div className="card seller-register-card">
          <div className="registration-result">
            <span className="result-icon result-icon--warn" aria-hidden>!</span>
            <h1>{t('auth.register.created')}</h1>
            <p className="muted">{t('auth.register.emailFailed')}</p>
            {error && <ErrorBox error={error} />}
            <Link to="/seller/resend-activation">
              <Button block>{t('auth.register.trySendingAgain')}</Button>
            </Link>
            <Link to="/seller/login">
              <Button variant="outline" block>{t('auth.register.goToSignIn')}</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const isLoading = phase === 'creating' || phase === 'sending'

  return (
    <div className="seller-register-layout">
      <aside className="seller-register-benefits">
        <span className="seller-eyebrow">TBK Seller</span>
        <h1>{t('seller.auth.register.benefitTitle')}</h1>
        <p>{t('seller.auth.register.benefitSubtitle')}</p>
        <ul>
          <li><strong>{t('seller.auth.register.benefit1Title')}</strong><span>{t('seller.auth.register.benefit1Desc')}</span></li>
          <li><strong>{t('seller.auth.register.benefit2Title')}</strong><span>{t('seller.auth.register.benefit2Desc')}</span></li>
          <li><strong>{t('seller.auth.register.benefit3Title')}</strong><span>{t('seller.auth.register.benefit3Desc')}</span></li>
        </ul>
      </aside>
      <form className="card seller-register-card" onSubmit={onSubmit}>
        <span className="seller-eyebrow">{t('seller.auth.register.eyebrow')}</span>
        <h2>{t('seller.auth.register.title')}</h2>
        <p className="muted">{t('seller.auth.register.subtitle')}</p>
        {error && <ErrorBox error={error} />}
        {existingAccountError && phase === 'form' && (
          <div className="seller-registration-recovery">
            <p className="small muted">{t('seller.auth.register.alreadyRegistered')}</p>
            <div className="seller-registration-recovery-actions">
              <Link to="/seller/login"><Button variant="outline">{t('common.signIn')}</Button></Link>
              <Link to="/forgot-password?account=seller" className="section-link">{t('auth.login.forgotPassword')}</Link>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="registration-steps" aria-busy="true" aria-live="polite">
            <Step label={t('auth.register.creating')} done={phase === 'sending'} active={phase === 'creating'} />
            <Step label={t('auth.register.sendingEmail')} done={false} active={phase === 'sending'} />
          </div>
        )}

        {!isLoading && (
          <>
            <div className="seller-form-row">
              <Field label={t('auth.firstName')} name="first_name" autoComplete="given-name" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
              <Field label={t('auth.lastName')} name="last_name" autoComplete="family-name" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
            </div>
            <Field label={t('seller.auth.register.middleName')} name="middle_name" autoComplete="additional-name" value={form.middle_name} onChange={(e) => set('middle_name', e.target.value)} />
            <Field label={t('common.phone')} name="phone" type="tel" autoComplete="tel" required value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder={t('auth.phonePlaceholder')} />
            <Field label={t('common.email')} name="email" type="email" autoComplete="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
            <Field label={t('auth.password')} name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={64} value={form.password} onChange={(e) => set('password', e.target.value)} showPasswordToggle />
            <div className="password-requirements" aria-live="polite">
              <strong>{t('auth.reset.requirements')}</strong>
              <ul>
                <Rule met={passwordRules.minLength}>{t('auth.passwordRules.minLength')}</Rule>
                <Rule met={passwordRules.maxLength}>{t('auth.passwordRules.maxLength')}</Rule>
                <Rule met={passwordRules.uppercase}>{t('auth.passwordRules.uppercase')}</Rule>
                <Rule met={passwordRules.lowercase}>{t('auth.passwordRules.lowercase')}</Rule>
                <Rule met={passwordRules.number}>{t('auth.passwordRules.number')}</Rule>
                <Rule met={passwordRules.special}>{t('auth.passwordRules.special')}</Rule>
              </ul>
            </div>
            <Field label={t('auth.passwordConfirm')} name="password_confirmation" type="password" autoComplete="new-password" required maxLength={64} value={form.password_confirmation} onChange={(e) => set('password_confirmation', e.target.value)} showPasswordToggle />
            {confirmStarted && <p className={`password-match ${passwordsMatch ? 'valid' : 'invalid'}`} role="status">{passwordsMatch ? t('auth.passwordsMatch') : t('auth.passwordsMismatchFull')}</p>}
            <label className="seller-policy-consent">
              <input
                type="checkbox"
                checked={policyAccepted}
                onChange={(e) => setPolicyAccepted(e.target.checked)}
              />
              <span>
                {t('seller.policy.consentPrefix')}{' '}
                <Link to="/seller/politique" target="_blank" rel="noopener noreferrer" className="section-link">
                  {t('seller.policy.navLabel')}
                </Link>
              </span>
            </label>
            <Button type="submit" block size="lg" loading={busy} disabled={!canSubmit}>
              {t('seller.auth.register.submit')}
            </Button>
            <p className="small muted">
              {t('seller.auth.register.haveAccount')}
              <Link to="/seller/login" className="section-link"> {t('common.signIn')}</Link>
            </p>
            <p className="small muted" style={{ marginTop: 8 }}>
              {t('seller.auth.register.wantBuy')}
              <Link to="/register" className="section-link"> {t('seller.auth.register.createBuyerAccount')}</Link>
            </p>
          </>
        )}
      </form>
    </div>
  )
}

function Rule({ met, children }: { met: boolean; children: string }) {
  return <li className={met ? 'met' : ''}><span aria-hidden="true">{met ? '✓' : '○'}</span>{children}</li>
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