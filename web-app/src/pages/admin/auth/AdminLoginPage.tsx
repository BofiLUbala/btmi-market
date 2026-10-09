import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '@/store/adminAuth'
import { useT } from '@/store/i18n'
import { defaultRouteForRole } from '@/components/admin/adminNav'
import { EyeIcon, EyeOffIcon } from '@/components/ui/Icons'
import { useCapsLock, useRememberedEmail } from '@/components/auth/AuthFormParts'

export default function AdminLoginPage() {
  const { login } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const t = useT()

  const { email, setEmail, password, setPassword, remember, setRemember, prefilled, persist } = useRememberedEmail('admin')
  const caps = useCapsLock()
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotHelp, setShowForgotHelp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const admin = await login(email.trim(), password)
      persist(email, password)
      // Redirect based on role or original destination
      // Keep the query string too: a notification link carries its target in it.
      const fromLoc = (location.state as { from?: { pathname?: string; search?: string } })?.from
      const from = fromLoc?.pathname ? fromLoc.pathname + (fromLoc.search ?? '') : undefined
      if (from && fromLoc?.pathname !== '/admin/login') {
        navigate(from, { replace: true })
      } else {
        navigate(defaultRouteForRole(admin.role), { replace: true })
      }
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : ''
      let msg = t('admin.login.invalidCredentials')
      if (rawMsg === 'ADMIN_ACCOUNT_SUSPENDED') {
        msg = t('admin.login.accountSuspended')
      } else if (rawMsg && rawMsg !== 'INVALID_CREDENTIALS' && rawMsg !== 'UNAUTHORIZED') {
        msg = rawMsg
      }
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <div className="admin-login-heading">
          <img
            src="/tbk-admin-logo.png"
            alt="TBK"
            className="admin-login-logo"
          />
          <h1 id="admin-login-title">{t('admin.login.title')}</h1>
          <p>{t('admin.login.subtitle')}</p>
        </div>

        <div className="admin-login-notice">
          <span aria-hidden="true">🛡️</span>
          <span>
            {t('admin.login.restrictedNotice')}
          </span>
        </div>

        {error && (
          <div
            id="admin-login-error"
            role="alert"
            className="admin-login-error"
          >
            <strong>{t('admin.login.authErrorLabel')}</strong> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate={false}>
          <div className="admin-login-field">
            <label htmlFor="admin-email">
              {t('admin.login.emailLabel')}
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              inputMode="email"
              autoFocus={!prefilled}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@tbk.cd"
              className="admin-login-input"
            />
          </div>

          <div className="admin-login-field admin-login-password-field">
            <label htmlFor="admin-password">
              {t('admin.login.passwordLabel')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                autoFocus={prefilled}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyUp={caps.onKeyUp}
                onKeyDown={caps.onKeyDown}
                required
                placeholder="••••••••••••"
                className="admin-login-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={t(showPassword ? 'auth.hidePasswordFor' : 'auth.showPasswordFor', { field: t('admin.login.passwordLabel') })}
                aria-pressed={showPassword}
                className="admin-login-password-toggle"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {caps.capsLock && (
              <p className="admin-login-caps" role="status">⇪ {t('auth.login.capsLockOn')}</p>
            )}
            <div className="admin-login-forgot">
              <button
                type="button"
                id="admin-forgot-password"
                onClick={() => setShowForgotHelp((v) => !v)}
                aria-expanded={showForgotHelp}
                className="admin-login-link-button"
              >
                {t('auth.login.forgotPassword')}
              </button>
            </div>
            {showForgotHelp && (
              <p className="admin-login-help">
                {t('admin.login.forgotHelp')}
              </p>
            )}
          </div>

          <label className="admin-login-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="admin-login-checkbox"
            />
            <span>
              {t('auth.login.rememberMe')}
              <small>{t('auth.login.rememberMeHint')}</small>
            </span>
          </label>

          <button
            id="admin-submit-btn"
            type="submit"
            disabled={isSubmitting}
            className="admin-login-submit"
          >
            {isSubmitting ? t('admin.login.authenticating') : t('admin.login.submit')}
          </button>
        </form>

        <div className="admin-login-footer">
          <a href="/">
            ← {t('admin.login.returnToMarketplace')}
          </a>
        </div>
      </section>
    </main>
  )
}
