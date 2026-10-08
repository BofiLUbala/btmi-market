import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { safeInternalPath } from '@/lib/returnTo'
import { api } from '@/api/client'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { useAuth } from '@/store/auth'
import { useT } from '@/store/i18n'
import { CapsLockHint, RememberMe, forgotPasswordLink, useCapsLock, useRememberedEmail } from '@/components/auth/AuthFormParts'
import './courier.css'

export default function CourierLoginPage() {
  const { login, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Where a courier was going (a mission link, a notification) before signing in.
  const from = safeInternalPath((location.state as { from?: string } | null)?.from, '')
  const t = useT()
  const { email, setEmail, password, setPassword, remember, setRemember, prefilled, persist } = useRememberedEmail('courier')
  const caps = useCapsLock()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email.trim(), password)
      // Courier is a profile/capability on the shared user account, not a legacy
      // account_type. The protected profile endpoint is the authoritative check.
      await api('/courier/profile')
      persist(email, password)
      navigate(from.startsWith('/courier') || from.startsWith('/notif/') ? from : '/courier/dashboard', { replace: true })
    } catch (err) {
      const code = err instanceof ApiError ? err.code : ''
      if (code === 'ACCOUNT_NOT_ACTIVATED') {
        setError(t('courierCourierLoginPage.errNotActivated'))
      } else if (code === 'COURIER_ACCESS_DENIED' || code === 'COURIER_NOT_FOUND') {
        await logout()
        setError(t('courierCourierLoginPage.errNotCourier'))
      } else {
        setError(t('courierCourierLoginPage.errBadCredentials'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    // `courier-auth` scopes the TBK courier charter to this page: .auth-wrap and
    // .card are shared with eleven other auth screens, so the palette is applied
    // under this class rather than on them.
    <div className="auth-wrap courier-auth">
      <form className="card auth-card" onSubmit={onSubmit}>
        <div className="courier-auth-mark" aria-hidden="true">🛵</div>
        <h1>{t('courierCourierLoginPage.title')}</h1>
        <p className="muted small">{t('courierCourierLoginPage.subtitle')}</p>
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
          <Link {...forgotPasswordLink('courier', email)} className="section-link auth-forgot-link" data-testid="courier-forgot-password-link">
            {t('auth.login.forgotPassword')}
          </Link>
        </div>
        <RememberMe checked={remember} onChange={setRemember} />
        <Button type="submit" block size="lg" loading={busy}>{t('common.signIn')}</Button>
        <p className="small muted" style={{ textAlign: 'center', margin: 0 }}><Link to="/login" className="section-link">{t('courierCourierLoginPage.backToSpaces')}</Link></p>
      </form>
    </div>
  )
}
