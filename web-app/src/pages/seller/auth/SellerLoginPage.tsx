import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'

export default function SellerLoginPage() {
  const t = useT()
  const { login, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/seller/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = await login(email.trim(), password)
      if (result.accountType === 'SELLER') {
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
        <Field
          label={t('common.email')}
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.emailPlaceholder')}
        />
        <Field
          label={t('auth.password')}
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          showPasswordToggle
        />
        <div className="seller-forgot-password-link">
          <Link to="/forgot-password?account=seller" className="section-link">{t('auth.login.forgotPassword')}</Link>
        </div>
        <Button type="submit" block size="lg" loading={busy}>
          {t('auth.login.submit')}
        </Button>
        <p className="small muted">
          {t('seller.auth.login.noAccount')} <Link to="/seller/register" className="section-link">{t('auth.login.createOne')}</Link>
          <br />
          {t('auth.login.notActivated')} <Link to="/seller/resend-activation" className="section-link">{t('auth.login.resendEmail')}</Link>
        </p>
        <p className="small muted" style={{ marginTop: 8 }}>
          {t('seller.auth.login.employee')} <Link to="/employee/login" className="section-link">{t('auth.signInAsEmployee')}</Link>
        </p>
        <Link to="/" className="seller-auth-back">{t('seller.entry.backToMarketplace')}</Link>
      </form>
    </div>
  )
}