import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'

type RegPhase = 'form' | 'creating' | 'sending' | 'success' | 'email-failed'

const MIN_LOADING_MS = 1500

export default function RegisterPage() {
  const t = useT()
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    password: '',
    password_confirmation: ''
  })
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<RegPhase>('form')
  const [busy, setBusy] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.password_confirmation) {
      setError(t('auth.register.passwordsMismatch'))
      return
    }
    setBusy(true)
    setPhase('creating')
    const start = Date.now()
    try {
      // Simulate visual progress: show "creating" then "sending"
      const sendingTimer = setTimeout(() => setPhase('sending'), 600)
      await authApi.register(form)
      clearTimeout(sendingTimer)
      // Enforce minimum visual duration
      const elapsed = Date.now() - start
      if (elapsed < MIN_LOADING_MS) {
        setPhase('sending')
        await new Promise((r) => setTimeout(r, MIN_LOADING_MS - elapsed))
      }
      setPhase('success')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('auth.register.failed')
      // If account was created but email failed, backend returns error
      if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('activation')) {
        setPhase('email-failed')
        setError(msg)
      } else {
        setPhase('form')
        setError(msg)
      }
    } finally {
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

  // ── Loading overlay inside card ──
  const isLoading = phase === 'creating' || phase === 'sending'

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>{t('auth.register.title')}</h1>
        <p className="muted small">{t('auth.register.subtitle')}</p>
        {error && <ErrorBox error={error} />}

        {isLoading && (
          <div className="registration-steps" aria-busy="true" aria-live="polite">
            <Step label={t('auth.register.creating')} done={phase === 'sending'} active={phase === 'creating'} />
            <Step label={t('auth.register.sendingEmail')} done={false} active={phase === 'sending'} />
          </div>
        )}

        {!isLoading && (
          <>
            <Field label={t('auth.firstName')} name="first_name" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
            <Field label={t('auth.lastName')} name="last_name" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
            <Field label={t('common.phone')} name="phone" required value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder={t('auth.phonePlaceholder')} />
            <Field label={t('common.email')} name="email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
            <Field label={t('auth.password')} name="password" type="password" required minLength={8} value={form.password} onChange={(e) => set('password', e.target.value)} hint={t('auth.register.passwordHint')} showPasswordToggle />
            <Field label={t('auth.passwordConfirm')} name="password_confirmation" type="password" required value={form.password_confirmation} onChange={(e) => set('password_confirmation', e.target.value)} showPasswordToggle />
            <Button type="submit" block size="lg" loading={busy} disabled={busy}>
              {t('auth.register.submit')}
            </Button>
            <p className="small muted">
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