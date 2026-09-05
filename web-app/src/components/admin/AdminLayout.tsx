import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '@/store/adminAuth'
import { useT } from '@/store/i18n'

export function AdminLayout() {
  const { admin, role, logout, canAccessDashboard, hasRole } = useAdminAuth()
  const navigate = useNavigate()
  const t = useT()

  const handleLogout = async () => {
    await logout()
    navigate('/admin/login')
  }

  const roleColors: Record<string, { bg: string; text: string; border: string }> = {
    SUPER_ADMIN: { bg: '#581c87', text: '#e9d5ff', border: '#7e22ce' },
    DIRECTION_ADMIN: { bg: '#1e3a8a', text: '#bfdbfe', border: '#3b82f6' },
    COMMERCE_ADMIN: { bg: '#064e3b', text: '#a7f3d0', border: '#10b981' },
    FINANCE_SUPPORT_ADMIN: { bg: '#78350f', text: '#fde68a', border: '#f59e0b' },
    TECHNICAL_ADMIN: { bg: '#134e4a', text: '#99f6e4', border: '#14b8a6' },
  }

  const currentRoleStyle = role ? roleColors[role] || { bg: '#334155', text: '#f1f5f9', border: '#64748b' } : { bg: '#334155', text: '#f1f5f9', border: '#64748b' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#090d16', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Main Navigation Header */}
      <header style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '10px 16px', minHeight: 68, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
              🏛️
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.04em', background: 'linear-gradient(90deg, #ffffff 0%, #94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                TBK CONTROL CENTER
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {t('admin.layout.tagline')}
              </div>
            </div>
          </div>

          {/* 4 Dashboard Primary Nav Tabs (Role-guarded: Only allowed tabs render) */}
          <nav style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            {canAccessDashboard('direction') && (
              <NavLink
                to="/admin/direction"
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  backgroundColor: isActive ? '#1e293b' : 'transparent',
                  color: isActive ? '#60a5fa' : '#94a3b8',
                  border: isActive ? '1px solid #3b82f6' : '1px solid transparent'
                })}
              >
                <span>🧭</span> {t('admin.layout.navDirection')}
              </NavLink>
            )}

            {canAccessDashboard('commerce') && (
              <NavLink
                to="/admin/commerce"
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  backgroundColor: isActive ? '#1e293b' : 'transparent',
                  color: isActive ? '#34d399' : '#94a3b8',
                  border: isActive ? '1px solid #10b981' : '1px solid transparent'
                })}
              >
                <span>📦</span> {t('admin.layout.navCommerce')}
              </NavLink>
            )}

            {canAccessDashboard('finance') && (
              <NavLink
                to="/admin/finance"
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  backgroundColor: isActive ? '#1e293b' : 'transparent',
                  color: isActive ? '#fbbf24' : '#94a3b8',
                  border: isActive ? '1px solid #f59e0b' : '1px solid transparent'
                })}
              >
                <span>💰</span> {t('admin.layout.navFinance')}
              </NavLink>
            )}

            {canAccessDashboard('technical') && (
              <NavLink
                to="/admin/technical"
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  backgroundColor: isActive ? '#1e293b' : 'transparent',
                  color: isActive ? '#2dd4bf' : '#94a3b8',
                  border: isActive ? '1px solid #14b8a6' : '1px solid transparent'
                })}
              >
                <span>🛡️</span> {t('admin.layout.navTechnical')}
              </NavLink>
            )}

            {hasRole(['SUPER_ADMIN']) && (
              <NavLink
                to="/admin/admin-users"
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  backgroundColor: isActive ? '#1e293b' : 'transparent',
                  color: isActive ? '#e9d5ff' : '#94a3b8',
                  border: isActive ? '1px solid #a855f7' : '1px solid transparent'
                })}
              >
                <span>🔐</span> {t('admin.layout.navAdminUsers')}
              </NavLink>
            )}

            {hasRole(['SUPER_ADMIN', 'DIRECTION_ADMIN', 'COMMERCE_ADMIN', 'FINANCE_SUPPORT_ADMIN', 'TECHNICAL_ADMIN']) && (
              <NavLink
                to="/admin/platform/feature-flags"
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  backgroundColor: isActive ? '#1e293b' : 'transparent',
                  color: isActive ? '#c084fc' : '#94a3b8',
                  border: isActive ? '1px solid #a855f7' : '1px solid transparent'
                })}
              >
                <span>🚩</span> {t('admin.layout.navFlags')}
              </NavLink>
            )}

            {hasRole(['SUPER_ADMIN', 'DIRECTION_ADMIN', 'COMMERCE_ADMIN', 'FINANCE_SUPPORT_ADMIN', 'TECHNICAL_ADMIN']) && (
              <NavLink
                to="/admin/platform/advanced"
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  backgroundColor: isActive ? '#1e293b' : 'transparent',
                  color: isActive ? '#c084fc' : '#94a3b8',
                  border: isActive ? '1px solid #a855f7' : '1px solid transparent'
                })}
              >
                <span>⚙️</span> {t('admin.layout.navAdvanced')}
              </NavLink>
            )}
          </nav>

          {/* User Profile & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                {admin?.first_name} {admin?.last_name}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  padding: '2px 8px',
                  borderRadius: 6,
                  backgroundColor: currentRoleStyle.bg,
                  color: currentRoleStyle.text,
                  border: `1px solid ${currentRoleStyle.border}`,
                  textTransform: 'uppercase'
                }}>
                  {role?.replace('_', ' ')}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              style={{
                backgroundColor: '#1e293b',
                color: '#cbd5e1',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title={t('admin.layout.signOutTitle')}
            >
              {t('admin.layout.signOut')}
            </button>
          </div>
        </div>
      </header>

      {/* Sub-bar with Live System Indicator */}
      <div style={{ backgroundColor: '#0b1120', borderBottom: '1px solid #1e293b', padding: '8px 16px' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, color: '#94a3b8' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
            <span>{t('admin.layout.sourceOfTruthLabel')} <strong>{t('admin.layout.sourceOfTruthValue')}</strong></span>
            <span style={{ color: '#475569' }}>•</span>
            <span style={{ color: '#64748b' }}>{t('admin.layout.scope')}</span>
          </div>

          <div style={{ color: '#64748b', fontSize: 11 }}>
            {t('admin.layout.footer')}
          </div>
        </div>
      </div>

      {/* Main Outlet View */}
      <main style={{ flex: 1, maxWidth: 1440, width: '100%', margin: '0 auto', padding: '24px' }}>
        <Outlet />
      </main>
    </div>
  )
}
