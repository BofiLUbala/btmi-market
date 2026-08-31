import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, SuccessBox } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'

export default function ResendActivationPage() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await authApi.resendActivation(email.trim())
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.resend.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>{t('auth.register.resendActivation')}</h1>
        {done && (
          <SuccessBox message={t('auth.resend.sent')} />
        )}
        {error && <ErrorBox error={error} />}
        <Field
          label={t('common.email')}
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.emailPlaceholder')}
        />
        <Button type="submit" block loading={busy}>
          {t('auth.resend.submit')}
        </Button>
        <p className="small muted">
          <Link to="/login" className="section-link">{t('auth.resend.backToSignIn')}</Link>
        </p>
      </form>
    </div>
  )
}