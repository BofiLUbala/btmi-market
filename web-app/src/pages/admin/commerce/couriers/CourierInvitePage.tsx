import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminCommerceApi } from '@/api/admin'
import { useT } from '@/store/i18n'

export default function CourierInvitePage() {
  const t = useT()
  const navigate = useNavigate()
  
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [transportType, setTransportType] = useState('MOTORBIKE')
  const [vehicleInfo, setVehicleInfo] = useState('')
  const [serviceZone, setServiceZone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [invitationUrl, setInvitationUrl] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const result = await adminCommerceApi.inviteCourier({
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || undefined,
        transport_type: transportType,
        vehicle_info: vehicleInfo || undefined,
        service_zone: serviceZone || undefined,
      })
      
      setSuccess('Invitation sent successfully!')
      setInvitationUrl(result.invitation_url)
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>✉</span> {t('admin.commerce.inviteNewCourier') || 'Invite New Courier'}
        </h2>
        <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, margin: 0 }}>
          {t('admin.commerce.inviteCourierDescription') || 'Send an invitation to a new courier to join the platform.'}
        </p>
      </div>

      {error && (
        <div style={{
          backgroundColor: 'var(--admin-danger-soft)',
          color: 'var(--admin-danger)',
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
          backgroundColor: 'var(--admin-success-soft)',
          color: 'var(--admin-success)',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 24,
          fontSize: 14
        }}>
          <div style={{ marginBottom: 8 }}>{success}</div>
          {invitationUrl && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Invitation URL:</div>
              <div style={{
                backgroundColor: 'var(--admin-surface)',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--admin-border)',
                wordBreak: 'break-all',
                fontSize: 12,
                fontFamily: 'monospace'
              }}>
                {invitationUrl}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(invitationUrl)
                  alert('Copied to clipboard!')
                }}
                style={{
                  marginTop: 8,
                  padding: '6px 12px',
                  borderRadius: 6,
                  backgroundColor: 'var(--admin-primary)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Copy to Clipboard
              </button>
            </div>
          )}
          <button
            onClick={() => navigate('/admin/commerce/couriers')}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              borderRadius: 6,
              backgroundColor: 'var(--admin-surface)',
              color: 'var(--admin-text)',
              border: '1px solid var(--admin-border)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Back to Couriers
          </button>
        </div>
      )}

      {!success && (
        <form onSubmit={handleSubmit} style={{
          backgroundColor: 'var(--admin-surface)',
          borderRadius: 12,
          padding: 24,
          border: '1px solid var(--admin-border-soft)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--admin-text)' }}>
                {t('admin.commerce.firstName') || 'First Name'} *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--admin-border)',
                  backgroundColor: 'var(--admin-surface-2)',
                  color: 'var(--admin-text)',
                  fontSize: 14
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--admin-text)' }}>
                {t('admin.commerce.lastName') || 'Last Name'} *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--admin-border)',
                  backgroundColor: 'var(--admin-surface-2)',
                  color: 'var(--admin-text)',
                  fontSize: 14
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--admin-text)' }}>
              {t('admin.commerce.email') || 'Email'} *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--admin-border)',
                backgroundColor: 'var(--admin-surface-2)',
                color: 'var(--admin-text)',
                fontSize: 14
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--admin-text)' }}>
              {t('admin.commerce.phone') || 'Phone (Optional)'}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--admin-border)',
                backgroundColor: 'var(--admin-surface-2)',
                color: 'var(--admin-text)',
                fontSize: 14
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--admin-text)' }}>
              {t('admin.commerce.transportType') || 'Transport Type'} *
            </label>
            <select
              value={transportType}
              onChange={(e) => setTransportType(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--admin-border)',
                backgroundColor: 'var(--admin-surface-2)',
                color: 'var(--admin-text)',
                fontSize: 14
              }}
            >
              <option value="MOTORBIKE">Motorbike</option>
              <option value="BICYCLE">Bicycle</option>
              <option value="CAR">Car</option>
              <option value="VAN">Van</option>
              <option value="WALKING">Walking</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--admin-text)' }}>
              {t('admin.commerce.vehicleInfo') || 'Vehicle Info (Optional)'}
            </label>
            <input
              type="text"
              value={vehicleInfo}
              onChange={(e) => setVehicleInfo(e.target.value)}
              placeholder="e.g., Honda Dio 2023"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--admin-border)',
                backgroundColor: 'var(--admin-surface-2)',
                color: 'var(--admin-text)',
                fontSize: 14
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--admin-text)' }}>
              {t('admin.commerce.serviceZone') || 'Service Zone (Optional)'}
            </label>
            <input
              type="text"
              value={serviceZone}
              onChange={(e) => setServiceZone(e.target.value)}
              placeholder="e.g., Downtown, North District"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--admin-border)',
                backgroundColor: 'var(--admin-surface-2)',
                color: 'var(--admin-text)',
                fontSize: 14
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 24px',
                borderRadius: 8,
                backgroundColor: 'var(--admin-primary)',
                color: '#ffffff',
                border: 'none',
                fontSize: 14,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Sending...' : t('admin.commerce.sendInvitation') || 'Send Invitation'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/commerce/couriers')}
              style={{
                padding: '12px 24px',
                borderRadius: 8,
                backgroundColor: 'var(--admin-surface-2)',
                color: 'var(--admin-text)',
                border: '1px solid var(--admin-border)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {t('common.cancel') || 'Cancel'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
