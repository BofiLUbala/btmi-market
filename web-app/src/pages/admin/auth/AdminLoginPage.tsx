import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '@/store/adminAuth'
import { useT } from '@/store/i18n'
import { defaultRouteForRole } from '@/components/admin/adminNav'

export default function AdminLoginPage() {
  const { login } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const t = useT()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const admin = await login(email, password)
      // Redirect based on role or original destination
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname
      if (from && from !== '/admin/login') {
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#090d16', color: '#f8fafc', padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 420, width: '100%', backgroundColor: '#0f172a', borderRadius: 16, border: '1px solid #1e293b', padding: '36px', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src="/tbk-admin-logo.png"
            alt="TBK"
            style={{ width: 56, height: 56, objectFit: 'contain', display: 'block', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(59, 130, 246, 0.35)', borderRadius: 13 }}
          />
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.02em', margin: '0 0 6px' }}>{t('admin.login.title')}</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{t('admin.login.subtitle')}</p>
        </div>

        <div style={{ backgroundColor: '#1e1b4b', border: '1px solid #3730a3', borderRadius: 8, padding: '10px 14px', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 14 }}>🛡️</span>
          <span style={{ fontSize: 12, color: '#c7d2fe', lineHeight: 1.5 }}>
            {t('admin.login.restrictedNotice')}
          </span>
        </div>

        {error && (
          <div
            id="admin-login-error"
            role="alert"
            style={{ backgroundColor: '#450a0a', border: '1px solid #991b1b', borderRadius: 8, padding: '12px 14px', marginBottom: 20, color: '#fca5a5', fontSize: 13 }}
          >
            <strong>{t('admin.login.authErrorLabel')}</strong> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate={false}>
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="admin-email" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              {t('admin.login.emailLabel')}
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@tbk.cd"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 8,
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#ffffff',
                fontSize: 14,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label htmlFor="admin-password" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              {t('admin.login.passwordLabel')}
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••••••"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 8,
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#ffffff',
                fontSize: 14,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            id="admin-submit-btn"
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 8,
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
              transition: 'background-color 0.15s ease',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
            }}
          >
            {isSubmitting ? t('admin.login.authenticating') : t('admin.login.submit')}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <a href="/" style={{ color: '#64748b', fontSize: 12, textDecoration: 'none' }}>
            ← {t('admin.login.returnToMarketplace')}
          </a>
        </div>
      </div>
    </div>
  )
}
