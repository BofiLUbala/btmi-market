import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '@/store/adminAuth'
import { useT } from '@/store/i18n'
import { AdminIcon } from './AdminIcon'
import { ADMINISTRATION, matchLocation, sectionsForRole, type NavSection } from './adminNav'

export { defaultRouteForRole } from './adminNav'

const COLLAPSE_KEY = 'tbk.admin.sidebarCollapsed'

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SUPER_ADMIN: { bg: '#581c87', text: '#e9d5ff', border: '#7e22ce' },
  DIRECTION_ADMIN: { bg: '#1e3a8a', text: '#bfdbfe', border: '#3b82f6' },
  COMMERCE_ADMIN: { bg: '#064e3b', text: '#a7f3d0', border: '#10b981' },
  FINANCE_SUPPORT_ADMIN: { bg: '#78350f', text: '#fde68a', border: '#f59e0b' },
  TECHNICAL_ADMIN: { bg: '#134e4a', text: '#99f6e4', border: '#14b8a6' }
}

function readCollapsed() {
  try { return window.localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
}

/** Tracks a media query. The rail/drawer decision cannot live in CSS alone:
 *  a section row has to *behave* differently in a rail — its icon navigates
 *  instead of expanding children — so JS needs the same answer the CSS uses. */
function useMediaFlag(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const list = window.matchMedia(query)
    const onChange = () => setMatches(list.matches)
    onChange()
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export function AdminLayout() {
  const { admin, role, logout } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const t = useT()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [expanded, setExpanded] = useState<string[]>([])

  const isMobile = useMediaFlag('(max-width: 860px)')
  const isNarrow = useMediaFlag('(max-width: 1100px)')
  // A drawer has room for full labels, so only the in-between widths force the
  // rail; above 1100px it is the operator's stored preference.
  const forcedRail = isNarrow && !isMobile
  const rail = !isMobile && (collapsed || forcedRail)

  const sections = useMemo(() => sectionsForRole(role), [role])
  const isSuper = role === 'SUPER_ADMIN'
  const active = useMemo(() => matchLocation(location.pathname, role), [location.pathname, role])
  const activeSectionKey = active.section?.key

  // On a phone the sidebar covers the page, so navigating must close it.
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  // The section holding the current route is always open, so the active feature
  // stays visible after a deep link or a browser refresh.
  useEffect(() => {
    if (activeSectionKey) setExpanded((prev) => (prev.includes(activeSectionKey) ? prev : [...prev, activeSectionKey]))
  }, [activeSectionKey])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try { window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch { /* storage blocked */ }
      return next
    })
  }, [])

  // A single-dashboard admin gets their dashboard name as the sidebar title;
  // only SUPER_ADMIN sees the control-centre identity and the switcher below it.
  const brandTitle = isSuper || !sections[0] ? t('admin.layout.brand') : t(sections[0].labelKey)
  const brandSubtitle = isSuper ? t('admin.layout.tagline') : t('admin.layout.taglineSingle')

  const roleStyle = (role && ROLE_COLORS[role]) || { bg: '#334155', text: '#f1f5f9', border: '#64748b' }

  const handleLogout = async () => {
    await logout()
    navigate('/admin/login')
  }

  const crumbs: string[] = []
  if (isSuper) crumbs.push(t('admin.layout.brand'))
  if (active.section) crumbs.push(t(active.section.labelKey))
  if (active.admin) crumbs.push(t(active.admin.labelKey))
  if (active.item) crumbs.push(t(active.item.labelKey))

  const renderItem = (to: string, label: string, end: boolean | undefined, accent: string) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      className="admin-nav-row admin-nav-item"
      data-tip={label}
      style={{ ['--row-accent' as string]: accent }}
    >
      <span className="admin-nav-label">{label}</span>
    </NavLink>
  )

  const renderSection = (section: NavSection) => {
    // One dashboard, no switcher: its name is already the sidebar title, so the
    // features are listed flat rather than nested under a redundant header.
    if (!isSuper) {
      return (
        <div key={section.key} className="admin-nav-children" data-flat="true">
          {section.items.map((item) => renderItem(item.to, t(item.labelKey), item.end, section.accent))}
        </div>
      )
    }

    const isOpen = expanded.includes(section.key)

    return (
      <div key={section.key}>
        <button
          type="button"
          className="admin-nav-row admin-nav-section"
          data-active={activeSectionKey === section.key}
          aria-expanded={rail ? undefined : isOpen}
          aria-label={t(section.labelKey)}
          data-tip={t(section.labelKey)}
          style={{ ['--row-accent' as string]: section.accent }}
          onClick={() => {
            // Collapsed to icons there is nowhere to show children, so the icon
            // becomes a direct link to the dashboard it represents.
            if (rail) { navigate(section.root); return }
            setExpanded((prev) => prev.includes(section.key) ? prev.filter((k) => k !== section.key) : [...prev, section.key])
          }}
        >
          <AdminIcon name={section.icon} />
          <span className="admin-nav-label">{t(section.labelKey)}</span>
          <span className="admin-nav-chevron" data-open={isOpen} aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </span>
        </button>

        {!rail && isOpen && (
          <div className="admin-nav-children">
            {section.items.map((item) => renderItem(item.to, t(item.labelKey), item.end, section.accent))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="admin-shell" data-collapsed={rail} data-mobile={isMobile} data-forced-rail={forcedRail}>
      <div className="admin-sidebar-backdrop" data-open={drawerOpen} onClick={() => setDrawerOpen(false)} />

      <aside className="admin-sidebar" data-open={drawerOpen}>
        <div className="admin-brand">
          <img src="/tbk-admin-logo.png" alt="TBK" className="admin-brand-logo" />
          <div className="admin-brand-text">
            <div className="admin-brand-title">{brandTitle}</div>
            <div className="admin-brand-subtitle">{brandSubtitle}</div>
          </div>
        </div>

        <nav className="admin-nav" aria-label={t('admin.layout.primaryNav')}>
          {sections.length > 0 && (
            <div className="admin-nav-group">
              {isSuper && <div className="admin-nav-heading">{t('admin.layout.groupDashboards')}</div>}
              {sections.map(renderSection)}
            </div>
          )}

          {isSuper && (
            <div className="admin-nav-group">
              <div className="admin-nav-heading">{t('admin.layout.groupAdministration')}</div>
              {ADMINISTRATION.map((entry) => (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  className="admin-nav-row admin-nav-section"
                  data-tip={t(entry.labelKey)}
                  aria-label={t(entry.labelKey)}
                  style={{ ['--row-accent' as string]: '#c084fc' }}
                >
                  <AdminIcon name={entry.icon} />
                  <span className="admin-nav-label">{t(entry.labelKey)}</span>
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        {/* The only place the operator's identity appears, so the role is stated
            once instead of being echoed in the header as well. */}
        <div className="admin-account">
          <div className="admin-nav-heading admin-account-heading">{t('admin.layout.groupAccount')}</div>
          <div className="admin-account-identity" data-tip={`${admin?.first_name ?? ''} ${admin?.last_name ?? ''}`.trim()}>
            <span className="admin-account-avatar" aria-hidden="true">{(admin?.first_name?.[0] ?? 'A').toUpperCase()}</span>
            <span className="admin-account-text">
              <span className="admin-account-name">{admin?.first_name} {admin?.last_name}</span>
              <span
                className="admin-account-role"
                style={{ backgroundColor: roleStyle.bg, color: roleStyle.text, borderColor: roleStyle.border }}
              >
                {role ? t(`admin.layout.role.${role}`) : ''}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="admin-signout"
            data-tip={t('admin.layout.signOut')}
            aria-label={t('admin.layout.signOut')}
            title={t('admin.layout.signOutTitle')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 17l5-5-5-5m5 5H9M12 21H6a2 2 0 01-2-2V5a2 2 0 012-2h6" /></svg>
            <span className="admin-nav-label">{t('admin.layout.signOut')}</span>
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-drawer-button"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label={t('admin.layout.toggleMenu')}
            aria-expanded={drawerOpen}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <button
            type="button"
            className="admin-collapse-button"
            onClick={toggleCollapsed}
            aria-label={t(collapsed ? 'admin.layout.expandSidebar' : 'admin.layout.collapseSidebar')}
            aria-pressed={collapsed}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v14H4zM10 5v14" /></svg>
          </button>

          <nav className="admin-breadcrumb" aria-label={t('admin.layout.breadcrumb')}>
            {crumbs.map((crumb, index) => (
              <span key={`${crumb}-${index}`} className="admin-crumb" data-current={index === crumbs.length - 1}>
                {index > 0 && <span className="admin-crumb-sep" aria-hidden="true">/</span>}
                {crumb}
              </span>
            ))}
          </nav>

          <div className="admin-topbar-status">
            <span className="admin-status-dot" aria-hidden="true" />
            <span>{t('admin.layout.sourceOfTruthLabel')} <strong>{t('admin.layout.sourceOfTruthValue')}</strong></span>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
