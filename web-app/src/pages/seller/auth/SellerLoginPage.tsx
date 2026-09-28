import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'
import { CapsLockHint, RememberMe, forgotPasswordLink, useCapsLock, useRememberedEmail } from '@/components/auth/AuthFormParts'

export default function SellerLoginPage() {
  const t = useT()
  const { login, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/seller/dashboard'
  const { email, setEmail, remember, setRemember, prefilled, persist } = useRememberedEmail('seller')
  const caps = useCapsLock()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notActivated, setNotActivated] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotActivated(false)
    setBusy(true)
    try {
      const result = await login(email.trim(), password, 'seller')
      persist(email)
      if (result.accountType === 'COURIER' || result.user?.capabilities?.courier) {
        navigate('/courier/dashboard', { replace: true })
      } else if (result.accountType === 'SELLER') {
        navigate(from, { replace: true })
      } else if (result.accountType === 'EMPLOYEE') {
        navigate('/employee/dashboard', { replace: true })
      } else {
        await logout()
        setError(t('seller.auth.login.notSeller'))
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'ACCOUNT_NOT_ACTIVATED') {
          setNotActivated(true)
          setError(t('auth.login.notActivatedMessage'))
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

  return (
    <div className="seller-login-wrap">
      <form className="card seller-login-card" onSubmit={onSubmit}>
        <span className="seller-eyebrow">TBK Seller</span>
        <h1>{t('seller.auth.login.title')}</h1>
        <p className="muted">{t('seller.auth.login.subtitle')}</p>
        {error && <ErrorBox error={error} />}
        {notActivated && (
          <p className="small" style={{ marginTop: -4, marginBottom: 12 }}>
            {t('auth.reinitialize.didNotReceive')} <Link to="/seller/resend-activation" className="section-link">{t('auth.reinitialize.resend')}</Link>
          </p>
        )}
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
          <Link {...forgotPasswordLink('seller', email)} className="section-link auth-forgot-link" data-testid="seller-forgot-password-link">
            {t('auth.login.forgotPassword')}
          </Link>
        </div>
        <RememberMe checked={remember} onChange={setRemember} />
        <Button type="submit" block size="lg" loading={busy}>
          {t('auth.login.submit')}
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