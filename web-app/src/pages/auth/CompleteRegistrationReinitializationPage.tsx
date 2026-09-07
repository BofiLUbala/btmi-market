import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { tokenStore } from '@/api/client'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'

export default function CompleteRegistrationReinitializationPage() {
  const t = useT()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirmation) { setError(t('auth.passwordsMismatch')); return }
    setBusy(true); setError('')
    try {
      const session = await authApi.completeRegistrationReinitialization({
        token, email: email.trim().toLowerCase(), password, password_confirmation: confirmation,
      })
      tokenStore.set(session.access_token, session.refresh_token)
      window.location.replace('/')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t('auth.reinitialize.failed'))
    } finally { setBusy(false) }
  }

  return <div className="auth-wrap"><form className="card auth-card" onSubmit={submit}>
    <h1>{t('auth.reinitialize.confirmTitle')}</h1>
    <p className="muted small">{t('auth.reinitialize.confirmExplanation')}</p>
    {error && <ErrorBox error={error} />}
    {!token ? <ErrorBox error={t('auth.reinitialize.invalidLink')} /> : <>
      <Field label={t('common.email')} name="email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} />
      <Field label={t('auth.reinitialize.newPassword')} name="password" type="password" required autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} showPasswordToggle />
      <Field label={t('auth.confirmPassword')} name="password_confirmation" type="password" required autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} showPasswordToggle />
      <Button type="submit" block loading={busy}>{t('auth.reinitialize.confirmSubmit')}</Button>
    </>}
    <p className="small muted"><Link to="/login" className="section-link">{t('auth.resend.backToSignIn')}</Link></p>
  </form></div>
}
