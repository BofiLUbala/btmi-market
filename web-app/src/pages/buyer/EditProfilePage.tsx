import { useEffect, useState, type FormEvent } from 'react'
import { buyerApi } from '@/api/buyer'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, LoadingBlock, SuccessBox } from '@/components/ui/Feedback'
import { AvatarUpload } from '@/components/ui/AvatarUpload'
import { useAuth } from '@/store/auth'
import { RequireAuth } from '@/components/auth/Guards'
import { drcCityOptions, isKinshasa, kinshasaCommuneOptions } from '@/lib/drcLocations'

const canonicalPhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return digits.length === 10 && digits.startsWith('0') ? `243${digits.slice(1)}` : digits
}

function EditInner() {
  const { user, buyerProfile, refreshUser } = useAuth()
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', backup_phone: '', address: '', city: '', commune: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!buyerProfile) return
    setForm({ first_name: buyerProfile.first_name ?? '', last_name: buyerProfile.last_name ?? '', phone: buyerProfile.phone ?? '', backup_phone: buyerProfile.backup_phone ?? '', address: buyerProfile.address ?? '', city: buyerProfile.city ?? '', commune: buyerProfile.commune ?? '' })
  }, [buyerProfile])

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
    setError(''); setSuccess('')
  }

  function setCity(city: string) {
    setForm((current) => ({ ...current, city, commune: isKinshasa(city) ? current.commune : '' }))
    setError(''); setSuccess('')
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault(); setError(''); setSuccess('')
    if (form.backup_phone.trim() && canonicalPhone(form.phone) === canonicalPhone(form.backup_phone)) {
      setError('Backup number must be different from your primary number.'); return
    }
    setBusy(true)
    try {
      await buyerApi.updateProfile(form)
      await refreshUser()
      setSuccess('Profile updated successfully.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update profile')
    } finally { setBusy(false) }
  }

  if (!buyerProfile) return <LoadingBlock label="Loading your profile…" />

  return (
    <div className="account-settings-page fade-in">
      <div className="account-settings-heading"><div className="eyebrow">ACCOUNT SETTINGS</div><h1>Edit profile</h1><p>Keep your private contact and delivery details up to date.</p></div>
      <form className="card account-settings-card" onSubmit={onSubmit}>
        {error && <ErrorBox error={error} />}{success && <SuccessBox message={success} />}
        <section className="profile-form-section" aria-labelledby="photo-title">
          <div><div className="eyebrow">PROFILE PICTURE</div><h2 id="photo-title">Your photo</h2></div>
          <AvatarUpload
            url={user?.avatar_url}
            name={`${buyerProfile.first_name ?? ''} ${buyerProfile.last_name ?? ''}`}
            size={88}
            onUploaded={refreshUser}
          />
        </section>
        <section className="profile-form-section" aria-labelledby="personal-title">
          <div><div className="eyebrow">PERSONAL INFORMATION</div><h2 id="personal-title">About you</h2></div>
          <div className="profile-form-grid">
            <Field label="First name" name="first_name" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
            <Field label="Last name" name="last_name" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
            <div className="profile-field-full"><Field label="Email" name="email" type="email" value={buyerProfile.email} readOnly hint="Email changes require a verified security flow and are not available here." /></div>
          </div>
        </section>
        <section className="profile-form-section" aria-labelledby="contact-title">
          <div><div className="eyebrow">CONTACT INFORMATION</div><h2 id="contact-title">Phone numbers</h2></div>
          <div className="profile-form-grid">
            <Field label="Primary phone / WhatsApp" name="phone" type="tel" required placeholder="+243 812 345 678" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            <Field label="Backup / Emergency phone" name="backup_phone" type="tel" placeholder="+243 999 456 789" value={form.backup_phone} onChange={(e) => set('backup_phone', e.target.value)} hint="Optional, but it must differ from your primary number." />
          </div>
        </section>
        <section className="profile-form-section" aria-labelledby="location-title">
          <div><div className="eyebrow">LOCATION</div><h2 id="location-title">Your address</h2></div>
          <div className="profile-form-grid">
            <div className="profile-field-full"><Field label="Address" name="address" maxLength={500} placeholder="12 Avenue Kasa-Vubu" value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
            <Field label="City" name="city" as="select" value={form.city} options={drcCityOptions(form.city)} onChange={(e) => setCity(e.target.value)} />
            {isKinshasa(form.city) && <Field label="Commune" name="commune" as="select" value={form.commune} options={kinshasaCommuneOptions(form.commune)} onChange={(e) => set('commune', e.target.value)} />}
          </div>
        </section>
        <div className="profile-form-actions"><Button type="submit" loading={busy}>Save changes</Button></div>
      </form>
    </div>
  )
}

export default function EditProfilePage() { return <RequireAuth><EditInner /></RequireAuth> }
