import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'

export default function SellerLoginPage() {
  const { login, logout } = useAuth()
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
        await logout()
        setError('This account is not registered as a Seller. Please use a Seller account or register as a Seller.')
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'ACCOUNT_NOT_ACTIVATED') {
          setError('Your account has not been activated yet. Please check your email for the activation link.')
        } else if (err.code === 'INVALID_CREDENTIALS') {
          setError('Invalid email or password. Please try again.')
        } else {
          setError(err.message)
        }
      } else {
        setError(err instanceof Error ? err.message : 'Sign in failed')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="seller-login-wrap">
      <form className="card seller-login-card" onSubmit={onSubmit}>
        <span className="seller-eyebrow">TBK Seller</span>
        <h1>Bienvenue</h1>
        <p className="muted">Connectez-vous pour gérer votre commerce.</p>
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
        <div className="seller-forgot-password-link">
          <Link to="/forgot-password?account=seller" className="section-link">Forgot password?</Link>
        </div>
        <Button type="submit" block size="lg" loading={busy}>
          Se connecter
        </Button>
        <p className="small muted">
          No seller account? <Link to="/seller/register" className="section-link">Create one</Link>
          <br />
          Not activated? <Link to="/seller/resend-activation" className="section-link">Resend email</Link>
        </p>
        <p className="small muted" style={{ marginTop: 8 }}>
          Employee? <Link to="/employee/login" className="section-link">Sign in as Employee</Link>
        </p>
        <Link to="/" className="seller-auth-back">← Retour au Marketplace</Link>
      </form>
    </div>
  )
}
