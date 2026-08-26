import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, SuccessBox } from '@/components/ui/Feedback'

export default function ForgotPasswordPage() {
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
      setDone('If a matching account exists, a password reset link has been sent to its registered email address.')
      setTimeout(() => navigate(loginPath), 4000)
    } catch (err) {
      const remaining = 1200 - (Date.now() - startedAt)
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
      setError(err instanceof ApiError ? err.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>Forgot password?</h1>
        <p className="muted small">Enter the email or phone number registered on your account. The reset link will be sent to the registered email address.</p>
        {done && <SuccessBox message={done} />}
        {error && <ErrorBox error={error} />}
        <Field
          label="Email or phone number"
          name="identifier"
          type="text"
          required
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="you@example.com or +243…"
        />
        <Button type="submit" block size="lg" loading={busy}>
          Send reset link
        </Button>
        <p className="small muted">
          Remember your password? <Link to={loginPath} className="section-link">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
