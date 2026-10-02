import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'
import { CapsLockHint, RememberMe, forgotPasswordLink, useCapsLock, useRememberedEmail } from '@/components/auth/AuthFormParts'
import { ChannelSwitch, WhatsAppCodeForm, challengeFromError, useWhatsAppEnabled, whatsappErrorMessage } from '@/components/auth/WhatsAppAuth'
import { authApi } from '@/api/auth'
import type { AccountType, User, VerificationChannel, WhatsAppChallenge } from '@/api/types'

export default function SellerLoginPage() {
  const t = useT()
  const { login, logout, verifyWhatsApp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/seller/dashboard'
  const { email, setEmail, password, setPassword, remember, setRemember, prefilled, persist } = useRememberedEmail('seller')
  const caps = useCapsLock()
  const [error, setError] = useState('')
  const [notActivated, setNotActivated] = useState(false)
  const [busy, setBusy] = useState(false)
  const whatsappEnabled = useWhatsAppEnabled()
  const [channel, setChannel] = useState<VerificationChannel>('email')
  const [phone, setPhone] = useState('')
  const [challenge, setChallenge] = useState<WhatsAppChallenge | null>(null)
  const [challengeError, setChallengeError] = useState('')
  const useWhatsApp = whatsappEnabled && channel === 'whatsapp'

  async function goAfterLogin(result: { accountType: AccountType; user: User }) {
    if (result.accountType === 'COURIER' || result.user?.capabilities?.courier) {
      navigate('/courier/dashboard', { replace: true })
    } else if (result.accountType === 'SELLER') {
      navigate(from, { replace: true })
    } else if (result.accountType === 'EMPLOYEE') {
      navigate('/employee/dashboard', { replace: true })
    } else {
      await logout()
      setChallenge(null)
      setError(t('seller.auth.login.notSeller'))
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotActivated(false)
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
      const result = await login(email.trim(), password, 'seller')
      persist(email, password)
      await goAfterLogin(result)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'ACCOUNT_NOT_ACTIVATED') {
          setNotActivated(true)
          setError(t('auth.login.notActivatedMessage'))
        } else if (useWhatsApp) {
          setError(whatsappErrorMessage(err, t))
        } else if (err.code === 'INVALID_CREDENTIALS') {
          setError(t('auth.login.invalidCredentials'))
        } else {
          setError(err.message)
        }
      } else {
        setError(err instanceof Error ? err.message : t('auth.login.failed'))
      }
    } finally {
      setBusy(false)
    }
  }

  if (challenge) {
    return (
      <div className="seller-login-wrap">
        <div className="card seller-login-card">
          <span className="seller-eyebrow">TBK Seller</span>
          <h1>{t('seller.auth.login.title')}</h1>
          <WhatsAppCodeForm
            challenge={challenge}
            initialError={challengeError}
            onVerify={async (id, code) => goAfterLogin(await verifyWhatsApp(id, code, 'seller'))}
            onBack={() => setChallenge(null)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="seller-login-wrap">
      <form className="card seller-login-card" onSubmit={onSubmit}>
        <span className="seller-eyebrow">TBK Seller</span>
        <h1>{t('seller.auth.login.title')}</h1>
        <p className="muted">{t('seller.auth.login.subtitle')}</p>
        {whatsappEnabled && <ChannelSwitch value={channel} onChange={(c) => { setChannel(c); setError('') }} label={t('auth.whatsapp.loginWith')} />}
        {error && <ErrorBox error={error} />}
        {notActivated && (
          <p className="small" style={{ marginTop: -4, marginBottom: 12 }}>
            {t('auth.reinitialize.didNotReceive')} <Link to="/seller/resend-activation" className="section-link">{t('auth.reinitialize.resend')}</Link>
          </p>
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
          <Link {...forgotPasswordLink('seller', useWhatsApp ? phone : email)} className="section-link auth-forgot-link" data-testid="seller-forgot-password-link">
            {t('auth.login.forgotPassword')}
          </Link>
        </div>
        {!useWhatsApp && <RememberMe checked={remember} onChange={setRemember} />}
        <Button type="submit" block size="lg" loading={busy}>
          {useWhatsApp ? t('auth.whatsapp.sendCode') : t('auth.login.submit')}
        </Button>
        <div className="auth-alt-links small muted">
          <span>{t('seller.auth.login.noAccount')} <Link to="/seller/register" className="section-link">{t('auth.login.createOne')}</Link></span>
          <span>{t('seller.auth.login.employee')} <Link to="/employee/login" className="section-link">{t('auth.signInAsEmployee')}</Link></span>
        </div>
        <Link to="/" className="seller-auth-back">{t('seller.entry.backToMarketplace')}</Link>
      </form>
    </div>
  )
}