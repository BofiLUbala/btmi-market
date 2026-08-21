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
  const [errorCode, setErrorCode] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setErrorCode('')
    setBusy(true)
    try {
      const session = await login(email.trim(), password)
      if (session.accountType === 'SELLER') {
        if (returnTo && returnTo !== '/' && !returnTo.startsWith('/account') && !returnTo.startsWith('/orders') && !returnTo.startsWith('/points')) {
          navigate(returnTo, { replace: true })
        } else {
          navigate('/seller/dashboard', { replace: true })
        }
      } else if (session.accountType === 'EMPLOYEE') {
        if (returnTo && returnTo !== '/' && !returnTo.startsWith('/account') && !returnTo.startsWith('/orders') && !returnTo.startsWith('/points')) {
          navigate(returnTo, { replace: true })
        } else {
          navigate('/employee/dashboard', { replace: true })
        }
      } else {
        if (returnTo && !returnTo.startsWith('/seller') && !returnTo.startsWith('/employee')) {
          navigate(returnTo, { replace: true })
        } else {
          navigate('/', { replace: true })
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorCode(err.code ?? '')
        if (err.code === 'ACCOUNT_NOT_ACTIVATED') {
          setError('Your account has not been activated yet. Please check your email for the activation link.')
        } else if (err.code === 'INVALID_CREDENTIALS') {
          setError('Invalid email or password. Please try again.')
        } else {
          setError(err.message)
        }
      } else {
        setError('Sign in failed')
      }
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
        {errorCode === 'ACCOUNT_NOT_ACTIVATED' && (
          <p className="small" style={{ marginTop: -4, marginBottom: 12 }}>
            <Link to="/resend-activation" className="section-link">Resend activation email</Link>
          </p>
        )}
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
          <br />
          Forgot password? <Link to="/forgot-password" className="section-link">Reset it</Link>
        </p>
      </form>
    </div>
  )
}