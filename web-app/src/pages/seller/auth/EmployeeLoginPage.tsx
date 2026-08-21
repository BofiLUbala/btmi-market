import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'

export default function EmployeeLoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/employee/dashboard'
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
      if (result.accountType === 'EMPLOYEE') {
        navigate(from, { replace: true })
      } else if (result.accountType === 'SELLER') {
        navigate('/seller/dashboard', { replace: true })
      } else {
        setError('This account is not registered as an Employee.')
        navigate('/employee/login', { replace: true })
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
        <h1>Employee Sign In</h1>
        <p className="muted small">Access your assigned shop workspace.</p>
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
          Seller? <Link to="/seller/login" className="section-link">Sign in as Seller</Link>
        </p>
      </form>
    </div>
  )
}