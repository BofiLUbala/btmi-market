import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { safeInternalPath } from '@/lib/returnTo'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  // Intended destination: ?returnTo=… wins, then router state (guard redirects).
  const returnTo = safeInternalPath(
    params.get('returnTo') ?? (location.state as { from?: string } | null)?.from,
    '/'
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const session = await login(email.trim(), password)
      // Intended destination first; sellers with no specific target get
      // their workspace instead of the marketplace home.
      if (returnTo !== '/') {
        navigate(returnTo, { replace: true })
      } else if (session.accountType === 'SELLER') {
        navigate('/seller/dashboard', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>Sign in</h1>
        <p className="muted small">Buy from trusted shops, earn points on every purchase.</p>
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
        <Field
          label="Password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          showPasswordToggle
        />
        <Button type="submit" block size="lg" loading={busy}>
          Sign in
        </Button>
        <p className="small muted">
          No account? <Link to="/register" className="section-link">Create one</Link>
          <br />
          Not activated? <Link to="/resend-activation" className="section-link">Resend email</Link>
        </p>
      </form>
    </div>
  )
}