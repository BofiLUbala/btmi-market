import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { adminProfileApi } from '@/api/admin'
import { useAdminAuth } from '@/store/adminAuth'
import { useT } from '@/store/i18n'
import { AdminIcon } from './AdminIcon'
import { ADMINISTRATION, matchLocation, sectionsForRole, type NavSection } from './adminNav'
import {
  fetchAdminNotifications,
  fetchAdminUnreadNotificationsCount,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  type NotificationItem
} from '@/api/communication'

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
  const { admin, role, logout, applyAdmin } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const t = useT()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [expanded, setExpanded] = useState<string[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const [notifs, setNotifs] = useState<NotificationItem[]>([])
  const notifRef = useRef<HTMLDivElement>(null)

  const isMobile = useMediaFlag('(max-width: 860px)')
  const isNarrow = useMediaFlag('(max-width: 1100px)')
  // A drawer has room for full labels, so only the in-between widths force the
  // rail; above 1100px it is the operator's stored preference.
  const forcedRail = isNarrow && !isMobile
  const rail = !isMobile && (collapsed || forcedRail)

  // Renaming yourself: a bootstrapped account carries whatever placeholder its
  // environment variables gave it ("Super Admin"), and this block is the only
  // place the operator's identity is shown, so it is also where it is fixed.
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState({ first: '', last: '' })
  const [renameBusy, setRenameBusy] = useState(false)
  const [renameError, setRenameError] = useState('')

  const openRename = () => {
    setNameDraft({ first: admin?.first_name ?? '', last: admin?.last_name ?? '' })
    setRenameError('')
    setRenaming(true)
  }

  const submitRename = async () => {
    const first = nameDraft.first.trim()
    const last = nameDraft.last.trim()
    if (!first || !last) {
      setRenameError(t('admin.layout.renameRequired'))
      return
    }
    setRenameBusy(true)
    setRenameError('')
    try {
      applyAdmin(await adminProfileApi.updateName(first, last))
      setRenaming(false)
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : t('admin.layout.renameFailed'))
    } finally {
      setRenameBusy(false)
    }
  }

  const sections = useMemo(() => sectionsForRole(role), [role])
  const isSuper = role === 'SUPER_ADMIN'
  const active = useMemo(() => matchLocation(location.pathname, role), [location.pathname, role])
  const activeSectionKey = active.section?.key

  const loadNotifications = useCallback(() => {
    fetchAdminUnreadNotificationsCount()
      .then((res) => setNotifCount(res.unread_count))
      .catch(() => null)
    fetchAdminNotifications({ limit: 15 })
      .then((res) => setNotifs(res.items || []))
      .catch(() => null)
  }, [])

  useEffect(() => {
    loadNotifications()
    const timer = setInterval(loadNotifications, 20_000)
    return () => clearInterval(timer)
  }, [loadNotifications])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const handleMarkAllRead = async () => {
    await markAllAdminNotificationsRead().catch(() => null)
    loadNotifications()
  }

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      await markAdminNotificationRead(notif.id).catch(() => null)
      loadNotifications()
    }
    setNotifOpen(false)
    const meta = notif.metadata || {}
    const orderId = (meta.order_id as string) || (notif.reference_type === 'ORDER' ? notif.reference_id : null)
    if (orderId) {
      navigate(`/admin/commerce/orders/${orderId}`)
    } else if (notif.type === 'NEW_REVIEW') {
      navigate('/admin/finance/reviews')
    }
  }

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
          <button
            type="button"
            className="admin-account-identity"
            onClick={openRename}
            data-tip={`${admin?.first_name ?? ''} ${admin?.last_name ?? ''}`.trim()}
            title={t('admin.layout.renameTitle')}
            aria-label={t('admin.layout.renameTitle')}
          >
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
          </button>
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

      {renaming && (
        <div className="admin-rename-backdrop" role="dialog" aria-modal="true" aria-label={t('admin.layout.renameTitle')}>
          <div className="admin-rename-card">
            <h3 className="admin-rename-title">{t('admin.layout.renameTitle')}</h3>
            <p className="admin-rename-note">{t('admin.layout.renameNote')}</p>
            {renameError && <div className="admin-rename-error">{renameError}</div>}
            <label className="admin-rename-label" htmlFor="admin-rename-first">{t('admin.layout.renameFirstName')}</label>
            <input
              id="admin-rename-first"
              className="admin-rename-input"
              value={nameDraft.first}
              onChange={(e) => setNameDraft((d) => ({ ...d, first: e.target.value }))}
              autoFocus
            />
            <label className="admin-rename-label" htmlFor="admin-rename-last">{t('admin.layout.renameLastName')}</label>
            <input
              id="admin-rename-last"
              className="admin-rename-input"
              value={nameDraft.last}
              onChange={(e) => setNameDraft((d) => ({ ...d, last: e.target.value }))}
            />
            <div className="admin-rename-actions">
              <button type="button" className="admin-rename-cancel" onClick={() => setRenaming(false)} disabled={renameBusy}>
                {t('common.cancel')}
              </button>
              <button type="button" className="admin-rename-save" onClick={() => void submitRename()} disabled={renameBusy}>
                {renameBusy ? t('admin.direction.executing') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

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

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: 'auto' }}>
            {/* Operational Notification Bell */}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="Notifications opérationnelles"
                style={{
                  position: 'relative',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px',
                  color: 'inherit'
                }}
              >
                <span>🔔</span>
                {notifCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      background: '#ef4444',
                      color: '#ffffff',
                      borderRadius: '10px',
                      minWidth: '18px',
                      height: '18px',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      boxShadow: '0 0 6px rgba(239, 68, 68, 0.6)'
                    }}
                  >
                    {notifCount > 99 ? '99+' : notifCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '360px',
                    maxWidth: '90vw',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '10px',
                    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45)',
                    zIndex: 1000,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#0f172a'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🔔</span>
                      <span>Notifications Opérationnelles</span>
                      {notifCount > 0 && (
                        <span style={{ fontSize: '11px', backgroundColor: '#ef4444', color: '#fff', padding: '1px 6px', borderRadius: '8px' }}>
                          {notifCount}
                        </span>
                      )}
                    </div>
                    {notifCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#38bdf8',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          textDecoration: 'underline'
                        }}
                      >
                        Tout marquer lu
                      </button>
                    )}
                  </div>

                  <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {notifs.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                        Aucune notification opérationnelle
                      </div>
                    ) : (
                      notifs.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid #334155',
                            backgroundColor: n.is_read ? 'transparent' : 'rgba(56, 189, 248, 0.08)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            transition: 'background-color 0.15s'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: n.is_read ? 500 : 700, fontSize: '12px', color: n.is_read ? '#cbd5e1' : '#f8fafc' }}>
                              {n.title}
                            </span>
                            {!n.is_read && (
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#38bdf8' }} />
                            )}
                          </div>
                          <span style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.4' }}>
                            {n.body}
                          </span>
                          <span style={{ fontSize: '10px', color: '#64748b', alignSelf: 'flex-end', marginTop: '2px' }}>
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="admin-topbar-status">
              <span className="admin-status-dot" aria-hidden="true" />
              <span>{t('admin.layout.sourceOfTruthLabel')} <strong>{t('admin.layout.sourceOfTruthValue')}</strong></span>
            </div>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
