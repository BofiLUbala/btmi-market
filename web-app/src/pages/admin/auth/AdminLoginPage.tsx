import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '@/store/adminAuth'

export default function AdminLoginPage() {
  const { login } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const admin = await login(email, password)
      // Redirect based on role or original destination
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname
      if (from && from !== '/admin/login') {
        navigate(from, { replace: true })
      } else {
        // Direct to appropriate dashboard
        switch (admin.role) {
          case 'COMMERCE_ADMIN':
            navigate('/admin/commerce', { replace: true })
            break
          case 'FINANCE_SUPPORT_ADMIN':
            navigate('/admin/finance', { replace: true })
            break
          case 'TECHNICAL_ADMIN':
            navigate('/admin/technical', { replace: true })
            break
          default:
            navigate('/admin/direction', { replace: true })
            break
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid administrator credentials'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#090d16', color: '#f8fafc', padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 420, width: '100%', backgroundColor: '#0f172a', borderRadius: 16, border: '1px solid #1e293b', padding: '36px', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(59, 130, 246, 0.35)' }}>
            🏛️
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.02em', margin: '0 0 6px' }}>TBK Control Center</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Omni-Channel Administrative Authentication</p>
        </div>

        <div style={{ backgroundColor: '#1e1b4b', border: '1px solid #3730a3', borderRadius: 8, padding: '10px 14px', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 14 }}>🛡️</span>
          <span style={{ fontSize: 12, color: '#c7d2fe', lineHeight: 1.5 }}>
            Restricted area. All administrative access events and API interactions are permanently logged to the audit ledger.
          </span>
        </div>

        {error && (
          <div style={{ backgroundColor: '#450a0a', border: '1px solid #991b1b', borderRadius: 8, padding: '12px 14px', marginBottom: 20, color: '#fca5a5', fontSize: 13 }}>
            <strong>Authentication Error:</strong> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Administrator Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@tbkmarket.com"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 8,
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#ffffff',
                fontSize: 14,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••••••"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 8,
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#ffffff',
                fontSize: 14,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 8,
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
              transition: 'background-color 0.15s ease',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
            }}
          >
            {isSubmitting ? 'Authenticating...' : 'Enter Control Center'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <a href="/" style={{ color: '#64748b', fontSize: 12, textDecoration: 'none' }}>
            ← Return to Consumer Marketplace
          </a>
        </div>
      </div>
    </div>
  )
}
