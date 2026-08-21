import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'

export default function SellerLoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/seller/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = await login(email.trim(), password)
      if (result.accountType === 'SELLER') {
        navigate(from, { replace: true })
      } else if (result.accountType === 'EMPLOYEE') {
        navigate('/employee/dashboard', { replace: true })
      } else {
        setError('This account is not registered as a Seller. Please use a Seller account or register as a Seller.')
        navigate('/seller/login', { replace: true })
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
        <h1>Seller Sign In</h1>
        <p className="muted small">Access your seller dashboard to manage your business.</p>
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
        />
        <Button type="submit" block size="lg" loading={busy}>
          Sign in
        </Button>
        <p className="small muted">
          No seller account? <Link to="/seller/register" className="section-link">Create one</Link>
          <br />
          Not activated? <Link to="/seller/activation" className="section-link">Resend email</Link>
        </p>
        <p className="small muted" style={{ marginTop: 8 }}>
          Employee? <Link to="/employee/login" className="section-link">Sign in as Employee</Link>
        </p>
      </form>
    </div>
  )
}