import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API_BASE } from '@/api/client'
import { localizeApiError } from '@/api/errorMessages'
import { useT } from '@/store/i18n'
import { StructuredAddressFields, emptyStructuredAddress, isStructuredAddressComplete, type StructuredAddressValue } from '@/components/address/StructuredAddressFields'
// The TBK charter the rest of the courier space uses. Every rule in it is
// scoped to a courier class, so importing it affects no other screen.
import './courier.css'

export default function CourierActivationPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [address, setAddress] = useState<StructuredAddressValue>(emptyStructuredAddress)
  const submittingRef = useRef(false)
  const t = useT()

  useEffect(() => {
    if (!token) {
      setError(t('courierActivation.invalidLinkCheckEmail'))
      setLoading(false)
      return
    }

    let cancelled = false
    fetch(`${API_BASE}/courier/verify/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error ? localizeApiError(response.status, payload.error.code || 'REQUEST_FAILED', payload.error.message) : t('courierActivation.invalidInvitation'))
        if (cancelled) return
        setFirstName(payload.data?.first_name ?? '')
        setLastName(payload.data?.last_name ?? '')
        setEmail(payload.data?.email ?? '')
      })
      .catch((err) => {
        // fetch rejects with a TypeError ("Failed to fetch") when the API is unreachable.
        if (!cancelled) setError(err instanceof TypeError ? t('apiError.NETWORK_ERROR') : err instanceof Error ? err.message : t('courierActivation.invalidInvitation'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current) return
    
    if (password !== confirmPassword) {
      setError(t('courierActivation.passwordsMismatch'))
      return
    }
    
    if (password.length < 8) {
      setError(t('courierActivation.passwordTooShort'))
      return
    }

    if (password.length > 64) {
      setError(t('courierActivation.passwordTooLong'))
      return
    }

    if (!isStructuredAddressComplete(address)) {
      setError(t('courierActivation.addressIncomplete'))
      return
    }

    submittingRef.current = true
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch(`${API_BASE}/courier/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          password_confirmation: confirmPassword,
          province: address.province,
          city: address.city,
          commune: address.commune,
          street: address.street,
          building_number: address.building_number,
          landmark: address.landmark,
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error ? localizeApiError(response.status, data.error.code || 'REQUEST_FAILED', data.error.message) : t('courierActivation.failed'))
      }
      
      setSuccess(t('courierActivation.successTitle'))
    } catch (err: any) {
      setError(err instanceof TypeError ? t('apiError.NETWORK_ERROR') : err.message || t('courierActivation.failed'))
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="courier-auth" style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--background)',
        padding: 24
      }}>
        <div className="card" style={{
          padding: 40,
          maxWidth: 400,
          width: '100%',
          textAlign: 'center'
        }}>
          <div className="courier-auth-mark" aria-hidden="true">❌</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
            {t('courierActivation.invalidLinkTitle')}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {t('courierActivation.invalidLinkBody')}
          </p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="auth-wrap courier-auth">
        <div className="card auth-card" style={{ textAlign: 'center' }}>
          <div className="courier-auth-mark" aria-hidden="true">✅</div>
          <h1>{t('courierActivation.successTitle')}</h1>
          <p className="muted">{t('courierActivation.successBody')}</p>
          {/* A plain anchor, not a Link: this screen is served by web-app but
              the rest of the site is the Expo app, and courier sign-in lives
              there at /auth/login (which sends a COURIER account on to
              /courier). A client-side Link to web-app's own /livreur/login
              rendered fine on click but 404'd the moment the courier
              refreshed or reopened that URL, because the server hands
              /livreur/* to Expo, which has no such route. */}
          <a href="/auth/login" className="btn btn-primary btn-block">{t('courierActivation.goToSpace')}</a>
        </div>
      </div>
    )
  }

  return (
    <div className="courier-auth" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--background)',
      padding: 24
    }}>
      <div className="card" style={{
        padding: 40,
        maxWidth: 500,
        width: '100%'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="courier-auth-mark" aria-hidden="true">🛵</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>
            {t('courierActivation.title')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {t('courierActivation.subtitle')}
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'var(--error-bg)',
            color: 'var(--error)',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 24,
            fontSize: 14
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
                {t('auth.firstName')} *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                readOnly
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--background)',
                  color: 'var(--text)',
                  fontSize: 14
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
                {t('auth.lastName')} *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                readOnly
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--background)',
                  color: 'var(--text)',
                  fontSize: 14
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
              {t('common.email')} *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              readOnly
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                backgroundColor: 'var(--background)',
                color: 'var(--text)',
                fontSize: 14
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
              {t('auth.password')} *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={64}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                backgroundColor: 'var(--background)',
                color: 'var(--text)',
                fontSize: 14
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
              {t('courierActivation.confirmPassword')} *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              maxLength={64}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                backgroundColor: 'var(--background)',
                color: 'var(--text)',
                fontSize: 14
              }}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
              {t('courierActivation.addressTitle')}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
              {t('courierActivation.addressHint')}
            </p>
            <StructuredAddressFields value={address} onChange={setAddress} />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 24px',
              borderRadius: 14,
              backgroundColor: 'var(--primary)',
              // Dark mode's primary is a light blue, so white text on it would
              // fall under AA; the charter carries the readable ink for each.
              color: 'var(--c-on-primary, #ffffff)',
              border: 'none',
              fontSize: 16,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? t('courierActivation.activating') : t('courierActivation.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
