import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { adminInvitationApi } from '@/api/admin'
import { useT } from '@/store/i18n'

export default function AdminActivatePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''
  const t = useT()

  const [verifying, setVerifying] = useState(true)
  const [invalid, setInvalid] = useState<string | null>(null)
  const [invitee, setInvitee] = useState<{ first_name: string; last_name: string; email: string; role: string } | null>(null)

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activated, setActivated] = useState(false)

  useEffect(() => {
    if (!token) {
      setInvalid(t('admin.activate.missingToken'))
      setVerifying(false)
      return
    }
    adminInvitationApi.verify(token)
      .then((data) => setInvitee(data))
      .catch((err: unknown) => setInvalid(err instanceof Error ? err.message : t('admin.activate.invalidOrExpired')))
      .finally(() => setVerifying(false))
  }, [token])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== passwordConfirm) {
      setError(t('admin.activate.passwordMismatch'))
      return
    }
    if (password.length < 8) {
      setError(t('admin.activate.passwordTooShort'))
      return
    }

    setSubmitting(true)
    try {
      await adminInvitationApi.activate({ token, password, password_confirmation: passwordConfirm })
      setActivated(true)
      setTimeout(() => navigate('/admin/login', { replace: true }), 1800)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('admin.activate.failedToActivate'))
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 8,
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#ffffff',
    fontSize: 14,
    boxSizing: 'border-box'
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#090d16', color: '#f8fafc', padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 440, width: '100%', backgroundColor: '#0f172a', borderRadius: 16, border: '1px solid #1e293b', padding: '36px', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(59, 130, 246, 0.35)' }}>
            🔐
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.02em', margin: '0 0 6px' }}>{t('admin.activate.title')}</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{t('admin.activate.subtitle')}</p>
        </div>

        {verifying ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>{t('admin.activate.verifying')}</div>
        ) : invalid ? (
          <div>
            <div style={{ backgroundColor: '#450a0a', border: '1px solid #991b1b', borderRadius: 8, padding: '12px 14px', marginBottom: 20, color: '#fca5a5', fontSize: 13 }}>
              {invalid}
            </div>
            <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>
              {t('admin.activate.askSuperAdmin')}{' '}
              <Link to="/admin/login" style={{ color: '#60a5fa' }}>{t('admin.activate.returnToSignIn')}</Link>.
            </p>
          </div>
        ) : activated ? (
          <div style={{ backgroundColor: '#064e3b', border: '1px solid #10b981', borderRadius: 8, padding: '16px', color: '#a7f3d0', fontSize: 13, textAlign: 'center' }}>
            {t('admin.activate.activatedSuccess')}
          </div>
        ) : (
          <>
            {invitee && (
              <div style={{ backgroundColor: '#1e1b4b', border: '1px solid #3730a3', borderRadius: 8, padding: '10px 14px', marginBottom: 24, fontSize: 12, color: '#c7d2fe' }}>
                <div><strong>{invitee.first_name} {invitee.last_name}</strong> ({invitee.email})</div>
                <div>{t('admin.activate.roleLabel', { role: invitee.role.replace('_', ' ') })}</div>
              </div>
            )}

            {error && (
              <div style={{ backgroundColor: '#450a0a', border: '1px solid #991b1b', borderRadius: 8, padding: '12px 14px', marginBottom: 20, color: '#fca5a5', fontSize: 13 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>{t('admin.activate.newPasswordLabel')}</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder={t('admin.activate.minCharsPlaceholder')} style={inputStyle} />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>{t('admin.activate.confirmPasswordLabel')}</label>
                <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required minLength={8} placeholder={t('admin.activate.repeatPasswordPlaceholder')} style={inputStyle} />
              </div>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 8, backgroundColor: '#2563eb', color: '#ffffff',
                  border: 'none', fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
                }}
              >
                {submitting ? t('admin.activate.activating') : t('admin.activate.submit')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
