import { useAuth } from '@/store/auth'
import { Card, CardGrid } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AvatarUpload } from '@/components/ui/AvatarUpload'
import { useT } from '@/store/i18n'

export default function SellerProfilePage() {
  const t = useT()
  const { user, activeBusiness, logout, refreshUser } = useAuth()

  return (
    <div className="seller-profile">
      <div className="page-header">
        <h1>{t('seller.profile.title')}</h1>
      </div>

      <CardGrid>
        <Card>
          <h3>{t('seller.accountType')}</h3>
          <div className="stat-value">{user?.account_type || '—'}</div>
        </Card>
        <Card>
          <h3>{t('seller.activeBusiness')}</h3>
          <div className="stat-value">{activeBusiness?.name || t('common.none')}</div>
        </Card>
        <Card>
          <h3>{t('common.memberSince')}</h3>
          <div className="stat-value">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</div>
        </Card>
      </CardGrid>

      <Card style={{ marginTop: 24 }}>
        <h2>{t('seller.accountInfo')}</h2>
        <p className="muted small">{t('seller.accountInfoNote')}</p>
        <div style={{ marginTop: 16 }}>
          <AvatarUpload
            url={user?.avatar_url}
            name={user ? `${user.first_name} ${user.last_name}` : ''}
            size={72}
            onUploaded={refreshUser}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 16 }}>
          <div>
            <div className="muted small">{t('common.name')}</div>
            <div>{[user?.first_name, user?.middle_name, user?.last_name].filter(Boolean).join(' ') || '—'}</div>
          </div>
          <div>
            <div className="muted small">{t('common.email')}</div>
            <div>{user?.email || '—'}</div>
          </div>
          <div>
            <div className="muted small">{t('common.phone')}</div>
            <div>{user?.phone || '—'}</div>
          </div>
          <div>
            <div className="muted small">{t('common.city')}</div>
            <div>{user?.city || activeBusiness?.city || '—'}</div>
          </div>
          {user?.commune && (
            <div>
              <div className="muted small">{t('common.commune')}</div>
              <div>{user.commune}</div>
            </div>
          )}
          <div>
            <div className="muted small">{t('common.status')}</div>
            <div><span className={`badge badge-${user?.status === 'ACTIVE' ? 'success' : 'warning'}`}>{user?.status || '—'}</span></div>
          </div>
        </div>
      </Card>

      <Card style={{ marginTop: 24 }}>
        <div className="card-header">
          <h3>{t('seller.session')}</h3>
        </div>
        <p className="muted small">{t('seller.sessionNote')}</p>
        <Button variant="danger" onClick={logout} style={{ marginTop: 16 }}>
          {t('common.signOut')}
        </Button>
      </Card>
    </div>
  )
}
