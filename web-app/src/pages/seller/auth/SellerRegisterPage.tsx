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
  const requiredComplete = Boolean(form.first_name && form.last_name && form.phone && form.email)
  const canSubmit = requiredComplete && passwordValid && passwordsMatch && !busy

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!passwordValid) {
      setError('Password must meet every requirement below.')
      return
    }
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
    <div className="seller-register-layout">
      <aside className="seller-register-benefits">
        <span className="seller-eyebrow">BTMI Seller</span>
        <h1>Transformez votre activité en commerce organisé.</h1>
        <p>Créez votre compte vendeur, puis gérez vos boutiques, produits, stocks et commandes depuis un seul espace.</p>
        <ul>
          <li><strong>Une vue claire</strong><span>Suivez votre activité au quotidien.</span></li>
          <li><strong>Plus de contrôle</strong><span>Centralisez stock, commandes et équipe.</span></li>
          <li><strong>Une inscription simple</strong><span>Votre compte est protégé par activation email.</span></li>
        </ul>
      </aside>
      <form className="card seller-register-card" onSubmit={onSubmit}>
        <span className="seller-eyebrow">Créer un compte</span>
        <h2>Commencez à vendre sur BTMI</h2>
        <p className="muted">Renseignez vos informations de responsable vendeur.</p>
        {done && <SuccessBox message={done} />}
        {error && <ErrorBox error={error} />}
        <div className="seller-form-row">
          <Field label="First name" name="first_name" autoComplete="given-name" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
          <Field label="Last name" name="last_name" autoComplete="family-name" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
        </div>
        <Field label="Middle name / Post-name (optional)" name="middle_name" autoComplete="additional-name" value={form.middle_name} onChange={(e) => set('middle_name', e.target.value)} />
        <Field label="Phone" name="phone" type="tel" autoComplete="tel" required value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+243 …" />
        <Field label="Email" name="email" type="email" autoComplete="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
        <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={64} value={form.password} onChange={(e) => set('password', e.target.value)} showPasswordToggle />
        <div className="password-requirements" aria-live="polite">
          <strong>Password requirements</strong>
          <ul>
            <Rule met={passwordRules.minLength}>At least 8 characters</Rule>
            <Rule met={passwordRules.maxLength}>No more than 64 characters</Rule>
            <Rule met={passwordRules.uppercase}>One uppercase letter</Rule>
            <Rule met={passwordRules.lowercase}>One lowercase letter</Rule>
            <Rule met={passwordRules.number}>One number</Rule>
            <Rule met={passwordRules.special}>One special character</Rule>
          </ul>
        </div>
        <Field label="Confirm password" name="password_confirmation" type="password" autoComplete="new-password" required maxLength={64} value={form.password_confirmation} onChange={(e) => set('password_confirmation', e.target.value)} showPasswordToggle />
        {confirmStarted && <p className={`password-match ${passwordsMatch ? 'valid' : 'invalid'}`} role="status">{passwordsMatch ? 'Passwords match.' : 'Passwords do not match.'}</p>}
        <Button type="submit" block size="lg" loading={busy} disabled={!canSubmit}>
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

function Rule({ met, children }: { met: boolean; children: string }) {
  return <li className={met ? 'met' : ''}><span aria-hidden="true">{met ? '✓' : '○'}</span>{children}</li>
}
