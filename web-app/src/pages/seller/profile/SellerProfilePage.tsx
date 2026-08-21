import { useAuth } from '@/store/auth'
import { Card, CardGrid } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function SellerProfilePage() {
  const { user, activeBusiness, logout } = useAuth()

  return (
    <div className="seller-profile">
      <div className="page-header">
        <h1>Profile & Settings</h1>
      </div>

      <CardGrid>
        <Card>
          <h3>Account Type</h3>
          <div className="stat-value">{user?.account_type || '—'}</div>
        </Card>
        <Card>
          <h3>Active Business</h3>
          <div className="stat-value">{activeBusiness?.name || 'None'}</div>
        </Card>
        <Card>
          <h3>Member Since</h3>
          <div className="stat-value">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</div>
        </Card>
      </CardGrid>

      <Card style={{ marginTop: 24 }}>
        <h2>Account Information</h2>
        <p className="muted small">Profile details are managed by your BTMI account and cannot be edited here yet.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 16 }}>
          <div>
            <div className="muted small">Name</div>
            <div>{[user?.first_name, user?.middle_name, user?.last_name].filter(Boolean).join(' ') || '—'}</div>
          </div>
          <div>
            <div className="muted small">Email</div>
            <div>{user?.email || '—'}</div>
          </div>
          <div>
            <div className="muted small">Phone</div>
            <div>{user?.phone || '—'}</div>
          </div>
          <div>
            <div className="muted small">Status</div>
            <div><span className={`badge badge-${user?.status === 'ACTIVE' ? 'success' : 'warning'}`}>{user?.status || '—'}</span></div>
          </div>
        </div>
      </Card>

      <Card style={{ marginTop: 24 }}>
        <div className="card-header">
          <h3>Session</h3>
        </div>
        <p className="muted small">Sign out of this device. Your session tokens will be revoked.</p>
        <Button variant="danger" onClick={logout} style={{ marginTop: 16 }}>
          Sign Out
        </Button>
      </Card>
    </div>
  )
}
