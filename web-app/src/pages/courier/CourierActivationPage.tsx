import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { API_BASE } from '@/api/client'

export default function CourierActivationPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (!token) {
      setError('Invalid activation link. Please check your email for the correct link.')
      setLoading(false)
      return
    }

    let cancelled = false
    fetch(`${API_BASE}/courier/verify/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error?.message || 'Invalid or expired invitation')
        if (cancelled) return
        setFirstName(payload.data?.first_name ?? '')
        setLastName(payload.data?.last_name ?? '')
        setEmail(payload.data?.email ?? '')
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Invalid or expired invitation')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

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
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Activation failed')
      }
      
      setSuccess('Account activated successfully! Redirecting to login...')
      setTimeout(() => navigate('/login?returnTo=/courier/dashboard'), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to activate account')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--background)',
        padding: 24
      }}>
        <div style={{
          backgroundColor: 'var(--surface)',
          borderRadius: 12,
          padding: 40,
          maxWidth: 400,
          width: '100%',
          textAlign: 'center',
          border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
            Invalid Link
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            This activation link is invalid or has expired. Please contact your administrator for a new invitation.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--background)',
      padding: 24
    }}>
      <div style={{
        backgroundColor: 'var(--surface)',
        borderRadius: 12,
        padding: 40,
        maxWidth: 500,
        width: '100%',
        border: '1px solid var(--border)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🛵</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>
            Activate Your Courier Account
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Complete your profile to start accepting deliveries
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

        {success && (
          <div style={{
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 24,
            fontSize: 14
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
                First Name *
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
                Last Name *
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
              Email *
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
              Password *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
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
              Confirm Password *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
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

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 24px',
              borderRadius: 8,
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              fontSize: 16,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Activating...' : 'Activate Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
