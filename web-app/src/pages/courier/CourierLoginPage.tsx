import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { useAuth } from '@/store/auth'
import { useT } from '@/store/i18n'
import { CapsLockHint, RememberMe, forgotPasswordLink, useCapsLock, useRememberedEmail } from '@/components/auth/AuthFormParts'

export default function CourierLoginPage() {
  const { login, logout } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const { email, setEmail, remember, setRemember, prefilled, persist } = useRememberedEmail('courier')
  const caps = useCapsLock()
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
      persist(email)
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
        <Field
          label={t('common.email')}
          name="email"
          type="email"
          required
          autoComplete="username"
          inputMode="email"
          autoFocus={!prefilled}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.emailPlaceholder')}
        />
        <div className="auth-password-row">
          <Field
            label={t('auth.password')}
            name="password"
            type="password"
            required
            autoComplete="current-password"
            autoFocus={prefilled}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={caps.onKeyUp}
            onKeyDown={caps.onKeyDown}
            placeholder="••••••••"
            showPasswordToggle
          />
          <CapsLockHint on={caps.capsLock} />
          <Link {...forgotPasswordLink('courier', email)} className="section-link auth-forgot-link" data-testid="courier-forgot-password-link">
            {t('auth.login.forgotPassword')}
          </Link>
        </div>
        <RememberMe checked={remember} onChange={setRemember} />
        <Button type="submit" block size="lg" loading={busy}>Se connecter</Button>
        <p className="small muted" style={{ textAlign: 'center', margin: 0 }}><Link to="/login" className="section-link">Retour aux espaces TBK</Link></p>
      </form>
    </div>
  )
}
