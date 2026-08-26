import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, SuccessBox } from '@/components/ui/Feedback'

export default function ResetPasswordPage() {
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
  const passwordRules = {
    minLength: form.password.length >= 8,
    maxLength: form.password.length <= 64,
    uppercase: /[A-Z]/.test(form.password),
    lowercase: /[a-z]/.test(form.password),
    number: /[0-9]/.test(form.password),
    special: /[^A-Za-z0-9]/.test(form.password),
  }
  const passwordValid = Object.values(passwordRules).every(Boolean)
  const confirmStarted = form.password_confirmation.length > 0
  const passwordsMatch = confirmStarted && form.password === form.password_confirmation
  const canSubmit = Boolean(token) && passwordValid && passwordsMatch && validToken && !busy && !done

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!passwordsMatch) {
      setError('Passwords do not match')
      return
    }
    if (!passwordValid) {
      setError('Password must meet every security requirement below.')
      return
    }
    setBusy(true)
    try {
      await authApi.resetPassword({ token, password: form.password, password_confirmation: form.password_confirmation })
      setDone('Password has been reset successfully. You can now sign in with your new password.')
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
          maxLength={64}
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          showPasswordToggle
        />
        <div className="password-requirements" aria-live="polite">
          <strong>Password requirements</strong>
          <ul>
            <PasswordRule met={passwordRules.minLength}>At least 8 characters</PasswordRule>
            <PasswordRule met={passwordRules.maxLength}>No more than 64 characters</PasswordRule>
            <PasswordRule met={passwordRules.uppercase}>One uppercase letter</PasswordRule>
            <PasswordRule met={passwordRules.lowercase}>One lowercase letter</PasswordRule>
            <PasswordRule met={passwordRules.number}>One number</PasswordRule>
            <PasswordRule met={passwordRules.special}>One special character</PasswordRule>
          </ul>
        </div>
        <Field
          label="Confirm new password"
          name="password_confirmation"
          type="password"
          required
          maxLength={64}
          value={form.password_confirmation}
          onChange={(e) => set('password_confirmation', e.target.value)}
          showPasswordToggle
        />
        {confirmStarted && <p className={`password-match ${passwordsMatch ? 'valid' : 'invalid'}`} role="status">{passwordsMatch ? 'Passwords match.' : 'Passwords do not match.'}</p>}
        <Button type="submit" block size="lg" loading={busy} disabled={!canSubmit}>
          Reset password
        </Button>
        {done ? (
          <div className="reset-login-options">
            <Link to="/seller/login"><Button block>Sign in as Seller</Button></Link>
            <Link to="/login"><Button variant="outline" block>Sign in as Buyer</Button></Link>
          </div>
        ) : (
          <p className="small muted">
            <Link to="/seller/login" className="section-link">Seller sign in</Link>
            {' · '}
            <Link to="/login" className="section-link">Buyer sign in</Link>
          </p>
        )}
      </form>
    </div>
  )
}

function PasswordRule({ met, children }: { met: boolean; children: string }) {
  return <li className={met ? 'met' : ''}><span aria-hidden="true">{met ? '✓' : '○'}</span>{children}</li>
}
