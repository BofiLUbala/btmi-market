import { useEffect, useState, type FormEvent } from 'react'
import { buyerApi } from '@/api/buyer'
import { ApiError, type BuyerProfile, type User } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'

interface Props {
  open: boolean
  profile: BuyerProfile | null
  user: User
  onClose: () => void
  onSaved: () => Promise<void>
}

export function BuyerProfileModal({ open, profile, user, onClose, onSaved }: Props) {
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({
      first_name: profile?.first_name || user.first_name || '',
      last_name: profile?.last_name || user.last_name || '',
      phone: profile?.phone || user.phone || '',
      email: profile?.email || user.email || '',
    })
    setError('')
  }, [open, profile, user])

  if (!open) return null

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (profile) {
        await buyerApi.updateProfile({ first_name: form.first_name.trim(), last_name: form.last_name.trim(), phone: form.phone.trim() })
      } else {
        await buyerApi.createProfile({ first_name: form.first_name.trim(), last_name: form.last_name.trim(), phone: form.phone.trim(), email: form.email.trim().toLowerCase() })
      }
      await onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your buyer profile. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="profile-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="buyer-profile-modal-title">
        <div className="profile-modal-head">
          <div><h2 id="buyer-profile-modal-title">Complete your buyer profile</h2><p>Sellers need these details to identify you and contact you about your order. Your cart will stay exactly as it is.</p></div>
          <button type="button" className="profile-modal-close" aria-label="Close" disabled={busy} onClick={onClose}>×</button>
        </div>
        <form className="profile-modal-form" onSubmit={submit}>
          {error && <div className="checkout-inline-error" role="alert"><strong>We could not save your profile</strong><span>{error}</span></div>}
          <div className="profile-modal-grid">
            <Field label="First name" value={form.first_name} onChange={(event) => setForm((value) => ({ ...value, first_name: event.target.value }))} required />
            <Field label="Last name" value={form.last_name} onChange={(event) => setForm((value) => ({ ...value, last_name: event.target.value }))} required />
          </div>
          <Field label="Phone number" value={form.phone} onChange={(event) => setForm((value) => ({ ...value, phone: event.target.value }))} required autoFocus />
          {!profile && <Field label="Email" type="email" value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} required />}
          <div className="profile-modal-actions"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Not now</Button><Button type="submit" variant="accent" loading={busy}>Save and continue</Button></div>
        </form>
      </section>
    </div>
  )
}
