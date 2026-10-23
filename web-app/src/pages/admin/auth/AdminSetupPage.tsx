import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { adminAuthApi } from '@/api/admin'
import { useAdminAuth } from '@/store/adminAuth'
import { useT } from '@/store/i18n'
import { defaultRouteForRole } from '@/components/admin/adminNav'
import { EyeIcon, EyeOffIcon } from '@/components/ui/Icons'

/**
 * First-time setup: the owner creates the single SUPER_ADMIN account himself
 * with the one-time code from the technical team, then lands signed in on the
 * dashboard. The backend only serves this while the code is unused, so an
 * unavailable code sends the visitor back to the sign-in screen.
 */
export default function AdminSetupPage() {
  const { setupSuperAdmin } = useAdminAuth()
  const navigate = useNavigate()
  const t = useT()

  const [available, setAvailable] = useState<boolean | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    adminAuthApi.setupStatus()
      .then((s) => setAvailable(!!s?.available))
      .catch(() => setAvailable(false))
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !name.trim() || !email.trim() || !password) {
      setError(t('admin.setup.missing'))
      return
    }
    if (password !== confirm) {
      setError(t('admin.setup.mismatch'))
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      const admin = await setupSuperAdmin({
        setup_code: code.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
      })
      navigate(defaultRouteForRole(admin.role), { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('admin.login.invalidCredentials'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card" aria-labelledby="admin-setup-title">
        <div className="admin-login-heading">
          <img src="/tbk-admin-logo.png" alt="TBK" className="admin-login-logo" />
          <h1 id="admin-setup-title">{t('admin.setup.title')}</h1>
          <p>{t('admin.setup.intro')}</p>
        </div>

        {available === false ? (
          <>
            <div className="admin-login-error" role="alert">
              {t('admin.setup.unavailable')}
            </div>
            <div className="admin-login-footer">
              <Link to="/admin/login">{t('admin.setup.back')}</Link>
            </div>
          </>
        ) : (
          <>
            {error && (
              <div className="admin-login-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="admin-login-field">
                <label htmlFor="admin-setup-code">{t('admin.setup.codeLabel')}</label>
                <input
                  id="admin-setup-code"
                  type="text"
                  autoComplete="one-time-code"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="admin-login-input"
                />
              </div>

              <div className="admin-login-field">
                <label htmlFor="admin-setup-name">{t('admin.setup.nameLabel')}</label>
                <input
                  id="admin-setup-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder={t('admin.setup.namePlaceholder')}
                  className="admin-login-input"
                />
              </div>

              <div className="admin-login-field">
                <label htmlFor="admin-setup-email">{t('admin.login.emailLabel')}</label>
                <input
                  id="admin-setup-email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@tbk.cd"
                  className="admin-login-input"
                />
              </div>

              <div className="admin-login-field admin-login-password-field">
                <label htmlFor="admin-setup-password">{t('admin.login.passwordLabel')}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="admin-setup-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                <p className="admin-login-help">{t('admin.setup.passwordHint')}</p>
              </div>

              <div className="admin-login-field">
                <label htmlFor="admin-setup-confirm">{t('admin.setup.confirmLabel')}</label>
                <input
                  id="admin-setup-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="admin-login-input"
                />
              </div>

              <button
                id="admin-setup-submit-btn"
                type="submit"
                disabled={submitting || available === null}
                className="admin-login-submit"
              >
                {submitting ? t('admin.login.authenticating') : t('admin.setup.submit')}
              </button>
            </form>

            <div className="admin-login-footer">
              <Link to="/admin/login">{t('admin.setup.back')}</Link>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
