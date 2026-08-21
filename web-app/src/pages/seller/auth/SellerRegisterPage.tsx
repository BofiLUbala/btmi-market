import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { sellerAuthApi } from '@/api/seller'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, SuccessBox } from '@/components/ui/Feedback'

export default function SellerRegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    phone: '',
    email: '',
    password: '',
    password_confirmation: '',
  })
  const [error, setError] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
    setBusy(true)
    try {
      await sellerAuthApi.registerSeller(form)
      setDone('Seller account created! Check your email to activate before signing in.')
      setTimeout(() => navigate('/seller/login'), 3500)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>Create your Seller Account</h1>
        <p className="muted small">Start selling on BTMI Market. Manage your business, shops, and employees.</p>
        {done && <SuccessBox message={done} />}
        {error && <ErrorBox error={error} />}
        <Field label="First name" name="first_name" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
        <Field label="Middle name / Post-name (optional)" name="middle_name" value={form.middle_name} onChange={(e) => set('middle_name', e.target.value)} />
        <Field label="Last name" name="last_name" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
        <Field label="Phone" name="phone" required value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+243 …" />
        <Field label="Email" name="email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
        <Field label="Password" name="password" type="password" required minLength={8} value={form.password} onChange={(e) => set('password', e.target.value)} hint="At least 8 characters (uppercase, lowercase, number, special char)" showPasswordToggle />
        <Field label="Confirm password" name="password_confirmation" type="password" required value={form.password_confirmation} onChange={(e) => set('password_confirmation', e.target.value)} showPasswordToggle />
        <Button type="submit" block size="lg" loading={busy}>
          Create Seller Account
        </Button>
        <p className="small muted">
          Already have a seller account?
          <Link to="/seller/login" className="section-link"> Sign In</Link>
        </p>
        <p className="small muted" style={{ marginTop: 8 }}>
          Want to buy instead?
          <Link to="/register" className="section-link"> Create a Buyer Account</Link>
        </p>
      </form>
    </div>
  )
}