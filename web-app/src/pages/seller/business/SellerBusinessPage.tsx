import { useAuth } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Link } from 'react-router-dom'

export default function SellerBusinessPage() {
  const { activeBusiness, sellerBusinesses, setActiveBusiness } = useAuth()

  return (
    <div className="seller-business">
      <div className="page-header">
        <h1>Business Management</h1>
        <p className="muted">Manage your business information</p>
      </div>

      {activeBusiness ? (
        <>
          <Card>
            <h2>Current Business: {activeBusiness.name}</h2>
            <p className="muted">Type: {activeBusiness.business_type} · Category: {activeBusiness.category}</p>
            <p className="muted">Location: {[activeBusiness.city, activeBusiness.country].filter(Boolean).join(', ') || '—'}</p>
            <p className="muted">Currency: {activeBusiness.default_currency || '—'} · Status: {activeBusiness.status}</p>
            <div style={{ marginTop: 16 }}>
              <Link to="/seller/onboarding">
                <Button variant="outline">Open Onboarding</Button>
              </Link>
              <Link to="/seller/shops">
                <Button variant="outline" style={{ marginLeft: 8 }}>Manage Shops</Button>
              </Link>
            </div>
          </Card>

          {sellerBusinesses.length > 1 && (
            <Card style={{ marginTop: 16 }}>
              <h3>Your Businesses</h3>
              <div className="shop-list" style={{ padding: 0 }}>
                {sellerBusinesses.map((b) => (
                  <button
                    key={b.id}
                    className={`shop-item ${b.id === activeBusiness.id ? 'active' : ''}`}
                    onClick={() => setActiveBusiness(b)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      background: b.id === activeBusiness.id ? 'var(--primary-bg)' : 'transparent',
                      color: b.id === activeBusiness.id ? 'var(--primary)' : 'var(--text)',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 16,
                      textAlign: 'left',
                      marginBottom: 8,
                    }}
                  >
                    <span>🏢 {b.name}</span>
                    {b.id === activeBusiness.id && <span className="badge badge-primary">Active</span>}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <h2>No Active Business</h2>
          <p className="muted">Complete onboarding to create your first business.</p>
          <Link to="/seller/onboarding">
            <Button size="lg" style={{ marginTop: 16 }}>Complete Onboarding</Button>
          </Link>
        </Card>
      )}
    </div>
  )
}
