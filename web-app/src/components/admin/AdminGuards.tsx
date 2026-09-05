import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAdminAuth } from '@/store/adminAuth'
import type { AdminRole } from '@/api/admin'
import { useT } from '@/store/i18n'

export function RequireAdminAuth() {
  const { isAuthenticated, loading } = useAdminAuth()
  const location = useLocation()
  const t = useT()

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--color-muted, #64748b)', fontSize: 14 }}>{t('admin.guards.authenticating')}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

export function RequireAdminRole({ allowedRoles }: { allowedRoles: AdminRole[] }) {
  const { role, hasRole, loading } = useAdminAuth()
  const t = useT()

  if (loading) {
    return null
  }

  if (!hasRole(allowedRoles)) {
    return (
      <div style={{ padding: '64px 24px', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: '#dc2626' }}>{t('admin.guards.accessDenied')}</h2>
        <p style={{ color: 'var(--color-muted, #64748b)', fontSize: 15, marginBottom: 24, lineHeight: 1.6 }}>
          {t('admin.guards.accessDeniedPrefix')} <strong>{role || t('admin.guards.unknownRole')}</strong> {t('admin.guards.accessDeniedSuffix')}
        </p>
        <a
          href="/admin"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 14
          }}
        >
          {t('admin.guards.returnToControlCenter')}
        </a>
      </div>
    )
  }

  return <Outlet />
}

export function AdminPublicOnly() {
  const { isAuthenticated, loading } = useAdminAuth()

  if (loading) {
    return null
  }

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}
