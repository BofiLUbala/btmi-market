import { useEffect, useState, type FormEvent } from 'react'
import { buyerApi } from '@/api/buyer'
import { ApiError } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, LoadingBlock, SuccessBox } from '@/components/ui/Feedback'
import { AvatarUpload } from '@/components/ui/AvatarUpload'
import { useAuth } from '@/store/auth'
import { useI18n } from '@/store/i18n'
import { RequireAuth } from '@/components/auth/Guards'
import { drcCityOptions, isKinshasa, kinshasaCommuneOptions } from '@/lib/drcLocations'
import { safeInternalPath } from '@/lib/returnTo'
import { useNavigate, useSearchParams } from 'react-router-dom'

const canonicalPhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return digits.length === 10 && digits.startsWith('0') ? `243${digits.slice(1)}` : digits
}

function EditInner() {
  const { user, buyerProfile, refreshUser } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
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
      setError(t('account.backupPhoneMustDiffer')); return
    }
    setBusy(true)
    try {
      await buyerApi.updateProfile(form)
      await refreshUser()
      const returnTo = searchParams.get('returnTo')
      if (returnTo) navigate(safeInternalPath(returnTo, '/account'), { replace: true })
      else setSuccess(t('account.updated'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('account.updateFailed'))
    } finally { setBusy(false) }
  }

  if (!buyerProfile) return <LoadingBlock label={t('account.loadingProfile')} />

  return (
    <div className="account-settings-page fade-in">
      <div className="account-settings-heading"><div className="eyebrow">{t('account.settings')}</div><h1>{t('account.editProfile')}</h1><p>{t('account.editSubtitle')}</p></div>
      <form className="card account-settings-card" onSubmit={onSubmit}>
        {error && <ErrorBox error={error} />}{success && <SuccessBox message={success} />}
        <section className="profile-form-section" aria-labelledby="photo-title">
          <div><div className="eyebrow">{t('account.profilePicture')}</div><h2 id="photo-title">{t('account.yourPhoto')}</h2></div>
          <AvatarUpload
            url={user?.avatar_url}
            name={`${buyerProfile.first_name ?? ''} ${buyerProfile.last_name ?? ''}`}
            size={88}
            onUploaded={refreshUser}
          />
        </section>
        <section className="profile-form-section" aria-labelledby="personal-title">
          <div><div className="eyebrow">{t('account.personalInfo')}</div><h2 id="personal-title">{t('account.aboutYou')}</h2></div>
          <div className="profile-form-grid">
            <Field label={t('auth.firstName')} name="first_name" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
            <Field label={t('auth.lastName')} name="last_name" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
            <div className="profile-field-full"><Field label={t('common.email')} name="email" type="email" value={buyerProfile.email} readOnly hint={t('account.emailReadOnly')} /></div>
          </div>
        </section>
        <section className="profile-form-section" aria-labelledby="contact-title">
          <div><div className="eyebrow">{t('account.contactInfo')}</div><h2 id="contact-title">{t('account.phoneNumbers')}</h2></div>
          <div className="profile-form-grid">
            <Field label={t('account.primaryPhone')} name="phone" type="tel" required placeholder="+243 812 345 678" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            <Field label={t('account.backupPhone')} name="backup_phone" type="tel" placeholder="+243 999 456 789" value={form.backup_phone} onChange={(e) => set('backup_phone', e.target.value)} hint={t('account.backupPhoneHint')} />
          </div>
        </section>
        <section className="profile-form-section" aria-labelledby="location-title">
          <div><div className="eyebrow">{t('account.location')}</div><h2 id="location-title">{t('account.yourAddress')}</h2></div>
          <div className="profile-form-grid">
            <div className="profile-field-full"><Field label={t('common.address')} name="address" maxLength={500} placeholder="12 Avenue Kasa-Vubu" value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
            <Field label={t('common.city')} name="city" as="select" value={form.city} options={drcCityOptions(form.city)} onChange={(e) => setCity(e.target.value)} />
            {isKinshasa(form.city) && <Field label={t('common.commune')} name="commune" as="select" value={form.commune} options={kinshasaCommuneOptions(form.commune)} onChange={(e) => set('commune', e.target.value)} />}
          </div>
        </section>
        <div className="profile-form-actions"><Button type="submit" loading={busy}>{t('common.saveChanges')}</Button></div>
      </form>
    </div>
  )
}

export default function EditProfilePage() { return <RequireAuth><EditInner /></RequireAuth> }
