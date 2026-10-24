import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { adminAuthApi, type AdminRole } from '@/api/admin'
import { useT } from '@/store/i18n'

/**
 * The page the owner lands on from the activation e-mail. Confirming here is
 * what makes the pending account the one super admin; he then signs in with
 * the password he chose on the setup screen.
 */
export default function AdminSetupActivatePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''
  const t = useT()

  const [verifying, setVerifying] = useState(true)
  const [invalid, setInvalid] = useState<string | null>(null)
  const [owner, setOwner] = useState<{ first_name: string; last_name: string; email: string; role: AdminRole } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activated, setActivated] = useState(false)

  useEffect(() => {
    if (!token) {
      setInvalid(t('admin.setup.activate.missingToken'))
      setVerifying(false)
      return
    }
    adminAuthApi.setupVerify(token)
      .then((data) => setOwner(data))
      .catch((err: unknown) => setInvalid(err instanceof Error ? err.message : t('admin.setup.activate.invalid')))
      .finally(() => setVerifying(false))
  }, [token])

  const activate = async () => {
    setError(null)
    setSubmitting(true)
    try {
      await adminAuthApi.setupActivate(token)
      setActivated(true)
      setTimeout(() => navigate('/admin/login', { replace: true }), 2500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('admin.setup.activate.invalid'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card" aria-labelledby="admin-setup-activate-title">
        <div className="admin-login-heading">
          <img src="/tbk-admin-logo.png" alt="TBK" className="admin-login-logo" />
          <h1 id="admin-setup-activate-title">{t('admin.setup.activate.title')}</h1>
          <p>{t('admin.setup.activate.subtitle')}</p>
        </div>

        {verifying ? (
          <p className="admin-login-help" role="status">{t('admin.setup.activate.verifying')}</p>
        ) : invalid ? (
          <>
            <div className="admin-login-error" role="alert">{invalid}</div>
            <div className="admin-login-footer">
              <Link to="/admin/login">{t('admin.setup.back')}</Link>
            </div>
          </>
        ) : activated ? (
          <>
            <div className="admin-login-sent" role="status">
              <p>{t('admin.setup.activate.done')}</p>
              <p>{t('admin.setup.activate.doneHint')}</p>
            </div>
            <div className="admin-login-footer">
              <Link to="/admin/login">{t('admin.setup.activate.goToSignIn')}</Link>
            </div>
          </>
        ) : (
          <>
            {owner && (
              <div className="admin-login-notice">
                <span aria-hidden="true">👤</span>
                <span>
                  <strong>{owner.first_name} {owner.last_name}</strong> ({owner.email}) — {t('admin.setup.activate.role')}
                </span>
              </div>
            )}

            {error && <div className="admin-login-error" role="alert">{error}</div>}

            <p className="admin-login-help">{t('admin.setup.activate.warning')}</p>

            <button
              id="admin-setup-activate-btn"
              type="button"
              onClick={activate}
              disabled={submitting}
              className="admin-login-submit"
            >
              {submitting ? t('admin.setup.activate.working') : t('admin.setup.activate.submit')}
            </button>

            <div className="admin-login-footer">
              <Link to="/admin/login">{t('admin.setup.back')}</Link>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
