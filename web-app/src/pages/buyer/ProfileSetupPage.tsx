import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { useAuth } from '@/store/auth'
import { useI18n } from '@/store/i18n'
import { RequireAuth } from '@/components/auth/Guards'

function SetupInner() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const [form, setForm] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    phone: user?.phone ?? '',
    email: user?.email ?? ''
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await buyerApi.createProfile(form)
      await refreshUser()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('account.createProfileFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>{t('account.completeProfileTitle')}</h1>
        <p className="muted small">
          {t('account.completeProfileDesc')}
        </p>
        {error && <ErrorBox error={error} />}
        <Field label={t('auth.firstName')} name="first_name" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
        <Field label={t('auth.lastName')} name="last_name" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
        <Field label={t('common.phone')} name="phone" required value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        <Field label={t('common.email')} name="email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
        <Button type="submit" block size="lg" loading={busy}>
          {t('account.saveProfile')}
        </Button>
      </form>
    </div>
  )
}

export default function ProfileSetupPage() {
  return (
    <RequireAuth>
      <SetupInner />
    </RequireAuth>
  )
}