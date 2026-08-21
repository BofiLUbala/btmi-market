import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, SuccessBox } from '@/components/ui/Feedback'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [form, setForm] = useState({
    password: '',
    password_confirmation: ''
  })
  const [error, setError] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [validToken, setValidToken] = useState(true)

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

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
      await authApi.resetPassword({ token, password: form.password, password_confirmation: form.password_confirmation })
      setDone('Password has been reset successfully. You can now sign in with your new password.')
      setTimeout(() => navigate('/login'), 4000)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed')
      if (err instanceof ApiError && (err.code === 'RESET_LINK_INVALID' || err.code === 'RESET_LINK_EXPIRED' || err.code === 'RESET_LINK_ALREADY_USED')) {
        setValidToken(false)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <h1>Invalid reset link</h1>
          <p className="muted small">This password reset link is missing a token. Please request a new one.</p>
          <Link to="/forgot-password" className="section-link">Request new reset link</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>Reset your password</h1>
        <p className="muted small">Enter your new password below. The link expires in 1 hour.</p>
        {!validToken && <ErrorBox error="This reset link is invalid, expired, or has already been used." />}
        {done && <SuccessBox message={done} />}
        {error && <ErrorBox error={error} />}
        <Field
          label="New password"
          name="password"
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          hint="At least 8 characters (uppercase, lowercase, number, special char)"
          showPasswordToggle
        />
        <Field
          label="Confirm new password"
          name="password_confirmation"
          type="password"
          required
          value={form.password_confirmation}
          onChange={(e) => set('password_confirmation', e.target.value)}
          showPasswordToggle
        />
        <Button type="submit" block size="lg" loading={busy}>
          Reset password
        </Button>
        <p className="small muted">
          <Link to="/login" className="section-link">Back to sign in</Link>
        </p>
      </form>
    </div>
  )
}