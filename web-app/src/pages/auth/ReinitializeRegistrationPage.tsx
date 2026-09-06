import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, SuccessBox } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'

export default function ReinitializeRegistrationPage() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await authApi.reinitializeRegistration(email.trim().toLowerCase(), password)
      setDone(true); setPassword('')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t('auth.reinitialize.failed'))
    } finally { setBusy(false) }
  }

  return <div className="auth-wrap"><form className="card auth-card" onSubmit={submit}>
    <h1>{t('auth.reinitialize.title')}</h1>
    <p className="muted small">{t('auth.reinitialize.explanation')}</p>
    {done && <SuccessBox message={t('auth.reinitialize.success')} />}
    {error && <ErrorBox error={error} />}
    {!done && <>
      <Field label={t('common.email')} name="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
      <Field label={t('auth.password')} name="password" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} showPasswordToggle />
      <Button type="submit" block loading={busy}>{t('auth.reinitialize.submit')}</Button>
    </>}
    <p className="small muted"><Link to="/resend-activation" className="section-link">{t('auth.reinitialize.resend')}</Link><br /><Link to="/login" className="section-link">{t('auth.resend.backToSignIn')}</Link></p>
  </form></div>
}
