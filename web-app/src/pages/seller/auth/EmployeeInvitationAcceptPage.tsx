import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { employeeAuthApi } from '@/api/seller'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'

export default function EmployeeInvitationAcceptPage() {
  const t = useT()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'form'>('loading')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ password: '', password_confirmation: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const updateField = <K extends keyof typeof form>(key: K, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  useEffect(() => {
    if (!token) {
      setState('error')
      setMessage(t('seller.auth.invite.invalidLink'))
      return
    }
    // Token is present, show form
    setState('form')
  }, [token, t])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.password_confirmation) {
      setError(t('auth.register.passwordsMismatch'))
      return
    }
    if (form.password.length < 8) {
      setError(t('seller.auth.invite.passwordTooShort'))
      return
    }
    setBusy(true)
    try {
      await employeeAuthApi.acceptInvitation({ token, password: form.password, password_confirmation: form.password_confirmation })
      setState('ok')
      setMessage(t('seller.auth.invite.activated'))
      setTimeout(() => navigate('/employee/login'), 3000)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('seller.auth.invite.failed'))
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') return <LoadingBlock label={t('seller.auth.invite.verifying')} />

  if (state === 'error') {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <h1>{t('seller.auth.invite.invalidTitle')}</h1>
          <p className="muted">{message}</p>
          <Link to="/employee/login">
            <Button block>{t('auth.register.goToSignIn')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (state === 'ok') {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <h1>{t('seller.auth.invite.activatedTitle')}</h1>
          <p className="muted">{message}</p>
          <Link to="/employee/login">
            <Button block>{t('auth.register.goToSignIn')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>{t('seller.auth.invite.title')}</h1>
        <p className="muted small">{t('seller.auth.invite.subtitle')}</p>
        {error && <ErrorBox error={error} />}
        <Field label={t('auth.password')} name="password" type="password" required minLength={8} value={form.password} onChange={(e) => updateField('password', e.target.value)} hint={t('auth.register.passwordHint')} showPasswordToggle />
        <Field label={t('auth.passwordConfirm')} name="password_confirmation" type="password" required value={form.password_confirmation} onChange={(e) => updateField('password_confirmation', e.target.value)} showPasswordToggle />
        <Button type="submit" block size="lg" loading={busy}>
          {t('seller.auth.invite.submit')}
        </Button>
      </form>
    </div>
  )
}