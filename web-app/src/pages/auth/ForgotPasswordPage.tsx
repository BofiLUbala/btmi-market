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
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setDone(null)
    setBusy(true)
    try {
      await authApi.forgotPassword(email.trim())
      setDone('If an account with that email exists, a password reset link has been sent.')
      setTimeout(() => navigate(loginPath), 4000)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>Forgot password?</h1>
        <p className="muted small">Enter your email and we'll send you a link to reset your password.</p>
        {done && <SuccessBox message={done} />}
        {error && <ErrorBox error={error} />}
        <Field
          label="Email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
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
