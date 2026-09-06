import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'
import { safeInternalPath } from '@/lib/returnTo'

export default function LoginPage() {
  const t = useT()
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  // Intended destination: ?returnTo=… wins, then router state (guard redirects).
  const returnTo = safeInternalPath(
    params.get('returnTo') ?? (location.state as { from?: string } | null)?.from,
    '/'
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setErrorCode('')
    setBusy(true)
    try {
      const session = await login(email.trim(), password)
      if (session.accountType === 'SELLER') {
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
        if (returnTo && !returnTo.startsWith('/seller') && !returnTo.startsWith('/employee')) {
          navigate(returnTo, { replace: true })
        } else {
          navigate('/', { replace: true })
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorCode(err.code ?? '')
        if (err.code === 'ACCOUNT_NOT_ACTIVATED') {
          setError(t('auth.login.notActivatedMessage'))
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

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>{t('auth.login.title')}</h1>
        <p className="muted small">{t('auth.login.subtitle')}</p>
        {error && <ErrorBox error={error} />}
          {errorCode === 'ACCOUNT_NOT_ACTIVATED' && (
          <div className="small" style={{ marginTop: -4, marginBottom: 12 }}>
            <p>{t('auth.reinitialize.didNotReceive')} <Link to="/resend-activation" className="section-link">{t('auth.reinitialize.resend')}</Link></p>
            <p>{t('auth.reinitialize.stillBlocked')} <Link to="/reinitialize-registration" className="section-link">{t('auth.reinitialize.title')}</Link></p>
          </div>
        )}
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
        <Button type="submit" block size="lg" loading={busy}>
          {t('auth.login.submit')}
        </Button>
        <p className="small muted">
          {t('auth.login.noAccount')} <Link to="/register" className="section-link">{t('auth.login.createOne')}</Link>
          <br />
          {t('auth.login.notActivated')} <Link to="/resend-activation" className="section-link">{t('auth.login.resendEmail')}</Link>
          <br />
          {t('auth.reinitialize.stillBlocked')} <Link to="/reinitialize-registration" className="section-link">{t('auth.reinitialize.title')}</Link>
          <br />
          {t('auth.login.forgotPassword')} <Link to="/forgot-password" className="section-link">{t('auth.login.resetIt')}</Link>
        </p>
      </form>
    </div>
  )
}
