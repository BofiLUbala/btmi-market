import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, SuccessBox } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'

export default function ResetPasswordPage() {
  const t = useT()
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
      setError(t('auth.register.passwordsMismatch'))
      return
    }
    if (!passwordValid) {
      setError(t('auth.reset.invalidPassword'))
      return
    }
    setBusy(true)
    try {
      await authApi.resetPassword({ token, password: form.password, password_confirmation: form.password_confirmation })
      setDone(t('auth.reset.success'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.reset.failed'))
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
          <h1>{t('auth.reset.invalidLink')}</h1>
          <p className="muted small">{t('auth.reset.missingToken')}</p>
          <Link to="/forgot-password" className="section-link">{t('auth.reset.requestNew')}</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>{t('auth.reset.title')}</h1>
        <p className="muted small">{t('auth.reset.subtitle')}</p>
        {!validToken && <ErrorBox error={t('auth.reset.invalidUsed')} />}
        {done && <SuccessBox message={done} />}
        {error && <ErrorBox error={error} />}
        <Field
          label={t('auth.reset.newPassword')}
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
          <strong>{t('auth.reset.requirements')}</strong>
          <ul>
            <PasswordRule met={passwordRules.minLength}>{t('auth.passwordRules.minLength')}</PasswordRule>
            <PasswordRule met={passwordRules.maxLength}>{t('auth.passwordRules.maxLength')}</PasswordRule>
            <PasswordRule met={passwordRules.uppercase}>{t('auth.passwordRules.uppercase')}</PasswordRule>
            <PasswordRule met={passwordRules.lowercase}>{t('auth.passwordRules.lowercase')}</PasswordRule>
            <PasswordRule met={passwordRules.number}>{t('auth.passwordRules.number')}</PasswordRule>
            <PasswordRule met={passwordRules.special}>{t('auth.passwordRules.special')}</PasswordRule>
          </ul>
        </div>
        <Field
          label={t('auth.reset.confirmNewPassword')}
          name="password_confirmation"
          type="password"
          required
          maxLength={64}
          value={form.password_confirmation}
          onChange={(e) => set('password_confirmation', e.target.value)}
          showPasswordToggle
        />
        {confirmStarted && <p className={`password-match ${passwordsMatch ? 'valid' : 'invalid'}`} role="status">{passwordsMatch ? t('auth.passwordsMatch') : t('auth.passwordsMismatchFull')}</p>}
        <Button type="submit" block size="lg" loading={busy} disabled={!canSubmit}>
          {t('auth.reset.submit')}
        </Button>
        {done ? (
          <div className="reset-login-options">
            <Link to="/seller/login"><Button block>{t('auth.signInAsSeller')}</Button></Link>
            <Link to="/login"><Button variant="outline" block>{t('auth.signInAsBuyer')}</Button></Link>
          </div>
        ) : (
          <p className="small muted">
            <Link to="/seller/login" className="section-link">{t('auth.sellerSignIn')}</Link>
            {' · '}
            <Link to="/login" className="section-link">{t('auth.buyerSignIn')}</Link>
          </p>
        )}
      </form>
    </div>
  )
}

function PasswordRule({ met, children }: { met: boolean; children: string }) {
  return <li className={met ? 'met' : ''}><span aria-hidden="true">{met ? '✓' : '○'}</span>{children}</li>
}