import { useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { ResendEmailButton } from '@/components/auth/AuthFormParts'
import { getRememberedEmail, type LoginSpace } from '@/lib/rememberedLogin'
import { useT } from '@/store/i18n'
// Supplies the `.courier-auth` charter used when a courier reaches this screen.
// Every rule in it is scoped to a courier class, so no other space is affected.
import '@/pages/courier/courier.css'

const LOGIN_PATHS: Record<string, { path: string; space: LoginSpace }> = {
  seller: { path: '/seller/login', space: 'seller' },
  employee: { path: '/employee/login', space: 'employee' },
  courier: { path: '/livreur/login', space: 'courier' },
}

/** Same response time whether or not the account exists (no enumeration by timing). */
async function requestReset(identifier: string) {
  const startedAt = Date.now()
  const pad = async () => {
    const remaining = 1200 - (Date.now() - startedAt)
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
  }
  try {
    await authApi.forgotPassword(identifier)
  } finally {
    await pad()
  }
}

export default function ForgotPasswordPage() {
  const t = useT()
  const location = useLocation()
  const [params] = useSearchParams()
  const account = LOGIN_PATHS[params.get('account') ?? ''] ?? { path: '/login', space: 'buyer' as LoginSpace }
  // Pre-filled with what was typed on the sign-in form, else the remembered e-mail.
  const [identifier, setIdentifier] = useState(
    () => (location.state as { identifier?: string } | null)?.identifier || getRememberedEmail(account.space)
  )
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await requestReset(identifier.trim())
      setSentTo(identifier.trim())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.forgot.requestFailed'))
    } finally {
      setBusy(false)
    }
  }

  // A courier arriving from their own sign-in or profile keeps the courier
  // charter here, instead of dropping into the older warm theme mid-flow.
  // `.courier-auth` only carries style, and only when that class is present.
  const spaceClass = account.space === 'courier' ? ' courier-auth' : ''

  if (sentTo) {
    return (
      <div className={`auth-wrap${spaceClass}`}>
        <div className="card auth-card" data-testid="forgot-password-sent">
          <div className="auth-sent-icon" aria-hidden="true">✉️</div>
          <h1 style={{ textAlign: 'center' }}>{t('auth.forgot.sentTitle')}</h1>
          <p className="muted small" style={{ textAlign: 'center' }}>{t('auth.forgot.sentTo', { identifier: sentTo })}</p>
          <ResendEmailButton label={t('auth.forgot.resendLink')} onResend={() => requestReset(sentTo)} />
          <Link to={account.path} className="btn btn-primary btn-block" style={{ marginTop: 16 }}>
            {t('auth.resend.backToSignIn')}
          </Link>
          <p className="small" style={{ textAlign: 'center', margin: '12px 0 0' }}>
            <button type="button" className="link-button section-link" onClick={() => setSentTo(null)}>
              {t('auth.forgot.useAnother')}
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`auth-wrap${spaceClass}`}>
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>{t('auth.login.forgotPassword')}</h1>
        <p className="muted small">{t('auth.forgot.hint')}</p>
        {error && <ErrorBox error={error} />}
        <Field
          label={t('auth.forgot.identifier')}
          name="identifier"
          type="text"
          required
          autoFocus
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={t('auth.forgot.identifierPlaceholder')}
        />
        <Button type="submit" block size="lg" loading={busy}>
          {t('auth.forgot.submit')}
        </Button>
        <p className="small muted" style={{ textAlign: 'center', margin: '12px 0 0' }}>
          {t('auth.forgot.remember')} <Link to={account.path} className="section-link">{t('common.signIn')}</Link>
        </p>
      </form>
    </div>
  )
}
