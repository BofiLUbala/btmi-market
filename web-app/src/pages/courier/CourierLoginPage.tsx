import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { useAuth } from '@/store/auth'

export default function CourierLoginPage() {
  const { login, logout } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email.trim(), password)
      // Courier is a profile/capability on the shared user account, not a legacy
      // account_type. The protected profile endpoint is the authoritative check.
      await api('/courier/profile')
      navigate('/courier/dashboard', { replace: true })
    } catch (err) {
      const code = err instanceof ApiError ? err.code : ''
      if (code === 'ACCOUNT_NOT_ACTIVATED') {
        setError("Votre invitation Livreur n'est pas encore activée. Consultez votre email d'invitation.")
      } else if (code === 'COURIER_ACCESS_DENIED' || code === 'COURIER_NOT_FOUND') {
        await logout()
        setError("Ce compte n'est pas un compte Livreur actif. Les comptes Livreurs sont créés uniquement sur invitation de TBK.")
      } else {
        setError("Email ou mot de passe incorrect. Si vous venez d’être invité, votre invitation Livreur n’est peut-être pas encore activée : consultez votre email d’invitation.")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <div style={{ textAlign: 'center', fontSize: 44 }} aria-hidden="true">🛵</div>
        <h1>Connexion Livreur</h1>
        <p className="muted small">Votre compte Livreur est créé uniquement sur invitation de TBK.</p>
        {error && <ErrorBox error={error} />}
        <Field label="Email" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Mot de passe" name="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} showPasswordToggle />
        <Link to="/forgot-password?account=courier" className="section-link small">Mot de passe oublié</Link>
        <Button type="submit" block size="lg" loading={busy}>Se connecter</Button>
        <p className="small muted" style={{ textAlign: 'center' }}><Link to="/login" className="section-link">Retour aux espaces TBK</Link></p>
      </form>
    </div>
  )
}
