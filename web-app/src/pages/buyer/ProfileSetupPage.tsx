import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { buyerApi } from '@/api/buyer'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { useAuth } from '@/store/auth'
import { RequireAuth } from '@/components/auth/Guards'

function SetupInner() {
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
      setError(err instanceof ApiError ? err.message : 'Could not create profile')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>Complete your buyer profile</h1>
        <p className="muted small">
          Your profile links your purchases to points and lets shops reach you.
        </p>
        {error && <ErrorBox error={error} />}
        <Field label="First name" name="first_name" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
        <Field label="Last name" name="last_name" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
        <Field label="Phone" name="phone" required value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        <Field label="Email" name="email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
        <Button type="submit" block size="lg" loading={busy}>
          Save profile
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