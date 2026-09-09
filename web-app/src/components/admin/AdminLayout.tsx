import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '@/store/adminAuth'
import { useT } from '@/store/i18n'
import type { AdminRole } from '@/api/admin'

type NavItem = { to: string; labelKey: string; end?: boolean }
type NavGroup = { key: string; labelKey: string; icon: string; accent: string; items: NavItem[] }

// Every dashboard group and the pages that belong to it. A role only ever sees
// the groups it owns, so this doubles as the role-to-feature map.
const GROUPS: Record<string, NavGroup> = {
  direction: {
    key: 'direction',
    labelKey: 'admin.layout.navDirection',
    icon: '🧭',
    accent: '#60a5fa',
    items: [{ to: '/admin/direction', labelKey: 'admin.layout.itemOverview', end: true }]
  },
  commerce: {
    key: 'commerce',
    labelKey: 'admin.layout.navCommerce',
    icon: '📦',
    accent: '#34d399',
    items: [
      { to: '/admin/commerce', labelKey: 'admin.layout.itemOverview', end: true },
      { to: '/admin/commerce/products', labelKey: 'admin.layout.itemProducts' },
      { to: '/admin/commerce/categories', labelKey: 'admin.layout.itemCategories' },
      { to: '/admin/commerce/inventory', labelKey: 'admin.layout.itemInventory', end: true },
      { to: '/admin/commerce/inventory/history', labelKey: 'admin.layout.itemStockHistory' },
      { to: '/admin/commerce/orders', labelKey: 'admin.layout.itemOrders' },
      { to: '/admin/commerce/employees', labelKey: 'admin.layout.itemEmployees' },
      { to: '/admin/commerce/marketplace/visibility', labelKey: 'admin.layout.itemVisibility' },
      { to: '/admin/commerce/marketplace/search', labelKey: 'admin.layout.itemSearch' },
      { to: '/admin/commerce/marketplace/ranking', labelKey: 'admin.layout.itemRanking' },
      { to: '/admin/commerce/marketplace/quality', labelKey: 'admin.layout.itemQuality' },
      { to: '/admin/commerce/marketplace/promotions', labelKey: 'admin.layout.itemPromotions' },
      { to: '/admin/commerce/performance/sellers', labelKey: 'admin.layout.itemSellerPerf' },
      { to: '/admin/commerce/performance/shops', labelKey: 'admin.layout.itemShopPerf' },
      { to: '/admin/commerce/performance/categories', labelKey: 'admin.layout.itemCategoryPerf' }
    ]
  },
  finance: {
    key: 'finance',
    labelKey: 'admin.layout.navFinance',
    icon: '💰',
    accent: '#fbbf24',
    items: [{ to: '/admin/finance', labelKey: 'admin.layout.itemOverview', end: true }]
  },
  technical: {
    key: 'technical',
    labelKey: 'admin.layout.navTechnical',
    icon: '🛡️',
    accent: '#2dd4bf',
    items: [{ to: '/admin/technical', labelKey: 'admin.layout.itemOverview', end: true }]
  }
}

// Platform-wide administration, reserved for SUPER_ADMIN.
const SUPER_GROUP: NavGroup = {
  key: 'platform',
  labelKey: 'admin.layout.navPlatform',
  icon: '🔐',
  accent: '#c084fc',
  items: [
    { to: '/admin/admin-users', labelKey: 'admin.layout.navAdminUsers' },
    { to: '/admin/platform/feature-flags', labelKey: 'admin.layout.navFlags' },
    { to: '/admin/platform/advanced', labelKey: 'admin.layout.navAdvanced' }
  ]
}

// The dashboard a role owns. SUPER_ADMIN owns the whole centre instead.
const ROLE_GROUP: Record<string, string> = {
  DIRECTION_ADMIN: 'direction',
  COMMERCE_ADMIN: 'commerce',
  FINANCE_SUPPORT_ADMIN: 'finance',
  TECHNICAL_ADMIN: 'technical'
}

/** Landing route for a role, so nobody is sent to a dashboard they cannot open. */
export function defaultRouteForRole(role: AdminRole | null): string {
  if (!role) return '/admin/login'
  if (role === 'SUPER_ADMIN') return '/admin/direction'
  const group = ROLE_GROUP[role]
  return group ? GROUPS[group].items[0].to : '/admin/login'
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SUPER_ADMIN: { bg: '#581c87', text: '#e9d5ff', border: '#7e22ce' },
  DIRECTION_ADMIN: { bg: '#1e3a8a', text: '#bfdbfe', border: '#3b82f6' },
  COMMERCE_ADMIN: { bg: '#064e3b', text: '#a7f3d0', border: '#10b981' },
  FINANCE_SUPPORT_ADMIN: { bg: '#78350f', text: '#fde68a', border: '#f59e0b' },
  TECHNICAL_ADMIN: { bg: '#134e4a', text: '#99f6e4', border: '#14b8a6' }
}

export function AdminLayout() {
  const { admin, role, logout } = useAdminAuth()
  const navigate = useNavigate()
  const t = useT()

  const isSuper = role === 'SUPER_ADMIN'
  const ownGroup = role ? ROLE_GROUP[role] : undefined

  // SUPER_ADMIN carries the control-centre identity; an operational admin is
  // shown the name of the single dashboard they administer.
  const title = isSuper ? t('admin.layout.brand') : t(GROUPS[ownGroup ?? 'direction'].labelKey)
  const subtitle = isSuper ? t('admin.layout.tagline') : t('admin.layout.taglineSingle')

  // Hidden, not disabled: a role never sees a group it cannot open.
  const groups: NavGroup[] = isSuper
    ? [...Object.values(GROUPS), SUPER_GROUP]
    : ownGroup
      ? [GROUPS[ownGroup]]
      : []

  const roleStyle = (role && ROLE_COLORS[role]) || { bg: '#334155', text: '#f1f5f9', border: '#64748b' }

  const handleLogout = async () => {
    await logout()
    navigate('/admin/login')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#090d16', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <aside style={{
        width: 250,
        flexShrink: 0,
        backgroundColor: '#0f172a',
        borderRight: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto'
      }}>
        {/* Identity */}
        <div style={{ padding: '18px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 11 }}>
          <img
            src="/tbk-admin-logo.png"
            alt="TBK"
            style={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 8, flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#f8fafc', lineHeight: 1.25 }}>
              {title}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 2 }}>
              {subtitle}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {groups.map((group) => (
            <div key={group.key}>
              {/* A single-dashboard admin already has the name in the header. */}
              {isSuper && (
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: '#64748b',
                  padding: '0 8px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <span>{group.icon}</span> {t(group.labelKey)}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    style={({ isActive }) => ({
                      display: 'block',
                      padding: '7px 10px',
                      borderRadius: 7,
                      fontSize: 12.5,
                      fontWeight: isActive ? 700 : 500,
                      textDecoration: 'none',
                      backgroundColor: isActive ? '#1e293b' : 'transparent',
                      color: isActive ? group.accent : '#94a3b8',
                      borderLeft: `2px solid ${isActive ? group.accent : 'transparent'}`
                    })}
                  >
                    {t(item.labelKey)}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Operator */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid #1e293b' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#f8fafc' }}>
            {admin?.first_name} {admin?.last_name}
          </div>
          <span style={{
            display: 'inline-block',
            marginTop: 4,
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: '0.05em',
            padding: '2px 7px',
            borderRadius: 5,
            backgroundColor: roleStyle.bg,
            color: roleStyle.text,
            border: `1px solid ${roleStyle.border}`,
            textTransform: 'uppercase'
          }}>
            {role ? t(`admin.layout.role.${role}`) : ''}
          </span>
          <button
            onClick={handleLogout}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 10,
              backgroundColor: '#1e293b',
              color: '#cbd5e1',
              border: '1px solid #334155',
              borderRadius: 7,
              padding: '7px 10px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title={t('admin.layout.signOutTitle')}
          >
            {t('admin.layout.signOut')}
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ backgroundColor: '#0b1120', borderBottom: '1px solid #1e293b', padding: '7px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 11.5 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, color: '#94a3b8' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
            <span>{t('admin.layout.sourceOfTruthLabel')} <strong>{t('admin.layout.sourceOfTruthValue')}</strong></span>
          </div>
          <div style={{ color: '#64748b', fontSize: 11 }}>{t('admin.layout.footer')}</div>
        </div>

        <main style={{ flex: 1, width: '100%', padding: '22px 20px', minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
