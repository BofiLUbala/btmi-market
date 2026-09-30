import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'
import { CapsLockHint, RememberMe, forgotPasswordLink, useCapsLock, useRememberedEmail } from '@/components/auth/AuthFormParts'

export default function EmployeeLoginPage() {
  const t = useT()
  const { login, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/employee/dashboard'
  const { email, setEmail, password, setPassword, remember, setRemember, prefilled, persist } = useRememberedEmail('employee')
  const caps = useCapsLock()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = await login(email.trim(), password)
      persist(email, password)
      if (result.accountType === 'COURIER' || result.user?.capabilities?.courier) {
        navigate('/courier/dashboard', { replace: true })
      } else if (result.accountType === 'EMPLOYEE') {
        navigate(from, { replace: true })
      } else if (result.accountType === 'SELLER') {
        navigate('/seller/dashboard', { replace: true })
      } else {
        await logout()
        setError(t('seller.auth.employeeLogin.notEmployee'))
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'ACCOUNT_NOT_ACTIVATED') {
          setError(t('seller.auth.employeeLogin.notActivated'))
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
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>{t('seller.auth.employeeLogin.title')}</h1>
        <p className="muted small">{t('seller.auth.employeeLogin.subtitle')}</p>
        {error && <ErrorBox error={error} />}
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
          <Link {...forgotPasswordLink('employee', email)} className="section-link auth-forgot-link" data-testid="employee-forgot-password-link">
            {t('auth.login.forgotPassword')}
          </Link>
        </div>
        <RememberMe checked={remember} onChange={setRemember} />
        <Button type="submit" block size="lg" loading={busy}>
          {t('auth.login.submit')}
        </Button>
        <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>
          {t('seller.auth.employeeLogin.seller')} <Link to="/seller/login" className="section-link">{t('auth.signInAsSeller')}</Link>
        </p>
      </form>
    </div>
  )
}