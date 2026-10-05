import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'
import { safeInternalPath } from '@/lib/returnTo'
import { CapsLockHint, RememberMe, forgotPasswordLink, useCapsLock, useRememberedEmail } from '@/components/auth/AuthFormParts'
import { ChannelSwitch, WhatsAppCodeForm, challengeFromError, useWhatsAppEnabled, whatsappErrorMessage } from '@/components/auth/WhatsAppAuth'
import { authApi } from '@/api/auth'
import type { VerificationChannel, WhatsAppChallenge } from '@/api/types'

export default function LoginPage() {
  const t = useT()
  const { login, verifyWhatsApp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  // Intended destination: ?returnTo=… wins, then router state (guard redirects).
  const returnTo = safeInternalPath(
    params.get('returnTo') ?? (location.state as { from?: string } | null)?.from,
    '/'
  )
  const { email, setEmail, password, setPassword, remember, setRemember, prefilled, persist } = useRememberedEmail('buyer')
  const caps = useCapsLock()
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [busy, setBusy] = useState(false)
  const whatsappEnabled = useWhatsAppEnabled()
  const [channel, setChannel] = useState<VerificationChannel>('email')
  const [phone, setPhone] = useState('')
  const [challenge, setChallenge] = useState<WhatsAppChallenge | null>(null)
  const [challengeError, setChallengeError] = useState('')
  const useWhatsApp = whatsappEnabled && channel === 'whatsapp'

  function goAfterLogin(session: { accountType: string; user?: { capabilities?: { courier?: boolean } } }) {
    if (session.accountType === 'COURIER' || session.user?.capabilities?.courier) {
      if (returnTo && (returnTo.startsWith('/courier') || returnTo.startsWith('/notif/'))) {
        navigate(returnTo, { replace: true })
      } else {
        navigate('/courier/dashboard', { replace: true })
      }
    } else if (session.accountType === 'SELLER') {
      if (returnTo && returnTo !== '/' && !returnTo.startsWith('/account') && !returnTo.startsWith('/orders') && !returnTo.startsWith('/points')) {
        navigate(returnTo, { replace: true })
      } else {
        navigate('/seller/dashboard', { replace: true })
      }
    } else if (session.accountType === 'EMPLOYEE') {
      if (returnTo && returnTo !== '/' && !returnTo.startsWith('/account') && !returnTo.startsWith('/orders') && !returnTo.startsWith('/points')) {
        navigate(returnTo, { replace: true })
      } else {
        navigate('/employee/dashboard', { replace: true })
      }
    } else {
      if (returnTo && !returnTo.startsWith('/seller') && !returnTo.startsWith('/employee') && !returnTo.startsWith('/courier')) {
        navigate(returnTo, { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setErrorCode('')
    setBusy(true)
    try {
      if (useWhatsApp) {
        try {
          setChallenge(await authApi.whatsappLogin(phone.trim(), password))
          setChallengeError('')
        } catch (err) {
          const pending = challengeFromError(err)
          if (!pending) throw err
          setChallenge(pending)
          setChallengeError(whatsappErrorMessage(err, t))
        }
        return
      }
      const session = await login(email.trim(), password, 'buyer')
      persist(email, password)
      goAfterLogin(session)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorCode(err.code ?? '')
        if (err.code === 'ACCOUNT_NOT_ACTIVATED') {
          setError(t('auth.login.notActivatedMessage'))
        } else if (useWhatsApp) {
          setError(whatsappErrorMessage(err, t))
        } else if (err.code === 'INVALID_CREDENTIALS') {
          setError(t('auth.login.invalidCredentials'))
        } else {
          setError(err.message)
        }
      } else {
        setError(t('auth.login.failed'))
      }
    } finally {
      setBusy(false)
    }
  }

  if (challenge) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <h1>{t('auth.login.title')}</h1>
          <WhatsAppCodeForm
            challenge={challenge}
            initialError={challengeError}
            onVerify={async (id, code) => goAfterLogin(await verifyWhatsApp(id, code, 'buyer'))}
            onBack={() => setChallenge(null)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>{t('auth.login.title')}</h1>
        <p className="muted small">{t('auth.login.subtitle')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 16 }}>
          <span className="btn btn-primary">{t('authLoginPage.roleBuyer')}</span>
          <Link className="btn btn-outline" to="/seller/login">{t('authLoginPage.roleSeller')}</Link>
          <Link className="btn btn-outline" to="/livreur/login">{t('authLoginPage.roleCourier')}</Link>
          <Link className="btn btn-outline" to="/admin/login">{t('authLoginPage.roleAdmin')}</Link>
        </div>
        {whatsappEnabled && <ChannelSwitch value={channel} onChange={(c) => { setChannel(c); setError('') }} label={t('auth.whatsapp.loginWith')} />}
        {error && <ErrorBox error={error} />}
        {errorCode === 'ACCOUNT_NOT_ACTIVATED' && (
          <div className="small" style={{ marginTop: -4, marginBottom: 12 }}>
            <p>{t('auth.reinitialize.didNotReceive')} <Link to="/resend-activation" className="section-link">{t('auth.reinitialize.resend')}</Link></p>
            <p>{t('auth.reinitialize.stillBlocked')} <Link to="/reinitialize-registration" className="section-link">{t('auth.reinitialize.title')}</Link></p>
          </div>
        )}
        {useWhatsApp ? (
          <Field
            label={t('auth.whatsapp.phoneLabel')}
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('auth.whatsapp.phonePlaceholder')}
          />
        ) : (
          <Field
            label={t('common.email')}
            name="email"
            type="email"
            required
            autoComplete="username"
            inputMode="email"
            autoFocus={!prefilled}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.emailPlaceholder')}
          />
        )}
        <div className="auth-password-row">
          <Field
            label={t('auth.password')}
            name="password"
            type="password"
            required
            autoComplete="current-password"
            autoFocus={prefilled}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={caps.onKeyUp}
            onKeyDown={caps.onKeyDown}
            placeholder="••••••••"
            showPasswordToggle
          />
          <CapsLockHint on={caps.capsLock} />
          <Link {...forgotPasswordLink(undefined, useWhatsApp ? phone : email)} className="section-link auth-forgot-link" data-testid="forgot-password-link">
            {t('auth.login.forgotPassword')}
          </Link>
        </div>
        {!useWhatsApp && <RememberMe checked={remember} onChange={setRemember} />}
        <Button type="submit" block size="lg" loading={busy}>
          {useWhatsApp ? t('auth.whatsapp.sendCode') : t('auth.login.submit')}
        </Button>
        <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>
          {t('auth.login.noAccount')} <Link to="/register" className="section-link">{t('auth.login.createOne')}</Link>
        </p>
      </form>
    </div>
  )
}
