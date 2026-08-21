import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { employeeAuthApi } from '@/api/seller'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'

export default function EmployeeInvitationAcceptPage() {
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
      setMessage('Invalid invitation link')
      return
    }
    // Token is present, show form
    setState('form')
  }, [token])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.password_confirmation) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setBusy(true)
    try {
      await employeeAuthApi.acceptInvitation({ token, password: form.password, password_confirmation: form.password_confirmation })
      setState('ok')
      setMessage('Your employee account has been activated. You can now sign in.')
      setTimeout(() => navigate('/employee/login'), 3000)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to accept invitation')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') return <LoadingBlock label="Verifying invitation…" />

  if (state === 'error') {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <h1>Invalid Invitation</h1>
          <p className="muted">{message}</p>
          <Link to="/employee/login">
            <Button block>Go to sign in</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (state === 'ok') {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <h1>🎉 Account Activated</h1>
          <p className="muted">{message}</p>
          <Link to="/employee/login">
            <Button block>Go to sign in</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>Accept Invitation</h1>
        <p className="muted small">Create your password to activate your employee account.</p>
        {error && <ErrorBox error={error} />}
        <Field label="Password" name="password" type="password" required minLength={8} value={form.password} onChange={(e) => updateField('password', e.target.value)} hint="At least 8 characters (uppercase, lowercase, number, special char)" showPasswordToggle />
        <Field label="Confirm Password" name="password_confirmation" type="password" required value={form.password_confirmation} onChange={(e) => updateField('password_confirmation', e.target.value)} showPasswordToggle />
        <Button type="submit" block size="lg" loading={busy}>
          Activate Account
        </Button>
      </form>
    </div>
  )
}