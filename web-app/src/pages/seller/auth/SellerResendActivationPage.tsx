import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, SuccessBox } from '@/components/ui/Feedback'

export default function SellerResendActivationPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await authApi.resendActivation(email.trim())
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>Resend seller activation email</h1>
        {done && (
          <SuccessBox message="If this email is registered as a seller, a new activation link has been sent." />
        )}
        {error && <ErrorBox error={error} />}
        <Field
          label="Email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <Button type="submit" block loading={busy}>
          Resend link
        </Button>
        <p className="small muted">
          <Link to="/seller/login" className="section-link">Back to sign in</Link>
        </p>
      </form>
    </div>
  )
}