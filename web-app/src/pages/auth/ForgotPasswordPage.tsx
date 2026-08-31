import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, SuccessBox } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'

export default function ForgotPasswordPage() {
  const t = useT()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isSeller = params.get('account') === 'seller'
  const loginPath = isSeller ? '/seller/login' : '/login'
  const [identifier, setIdentifier] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setDone(null)
    setBusy(true)
    const startedAt = Date.now()
    try {
      await authApi.forgotPassword(identifier.trim())
      const remaining = 1200 - (Date.now() - startedAt)
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
      setDone(t('auth.forgot.sent'))
      setTimeout(() => navigate(loginPath), 4000)
    } catch (err) {
      const remaining = 1200 - (Date.now() - startedAt)
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
      setError(err instanceof ApiError ? err.message : t('auth.forgot.requestFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>{t('auth.login.forgotPassword')}</h1>
        <p className="muted small">{t('auth.forgot.hint')}</p>
        {done && <SuccessBox message={done} />}
        {error && <ErrorBox error={error} />}
        <Field
          label={t('auth.forgot.identifier')}
          name="identifier"
          type="text"
          required
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={t('auth.forgot.identifierPlaceholder')}
        />
        <Button type="submit" block size="lg" loading={busy}>
          {t('auth.forgot.submit')}
        </Button>
        <p className="small muted">
          {t('auth.forgot.remember')} <Link to={loginPath} className="section-link">{t('common.signIn')}</Link>
        </p>
      </form>
    </div>
  )
}