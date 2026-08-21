import { Link, NavLink } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '@/store/auth'
import { useCart } from '@/store/cart'
import { loginWithReturnTo } from '@/lib/returnTo'
import { SearchAutocomplete } from '@/components/search/SearchAutocomplete'

const PUBLIC_NAV_LINKS = [
  { to: '/', label: 'Marketplace', icon: '🏪' },
  { to: '/categories', label: 'Categories', icon: '🗂️' },
  { to: '/shops', label: 'Shops', icon: '🏬' },
]

const PROTECTED_NAV_LINKS = [
  { to: '/favorites', label: 'Favorites', icon: '❤️' },
  { to: '/orders', label: 'Orders', icon: '📦' },
  { to: '/points', label: 'Points', icon: '⭐' },
]

export function Header() {
  const { user, loading } = useAuth()
  const { totalQty } = useCart()
  const [drawer, setDrawer] = useState(false)

  function getNavLink(path: string) {
    if (!user) {
      return loginWithReturnTo(path)
    }
    return path
  }

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">B</span>
          <span>BTMI Market</span>
        </Link>

        <SearchAutocomplete variant="header" />

        <nav className="header-nav" aria-label="Primary">
          {PUBLIC_NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) => `header-link ${isActive ? 'active' : ''}`}
            >
              {l.label}
            </NavLink>
          ))}

          {loading ? (
            // Show loading placeholders for protected links while auth restores
            PROTECTED_NAV_LINKS.map((l) => (
              <span key={l.to} className="header-link loading-placeholder" aria-hidden="true">
                {l.label}
              </span>
            ))
          ) : user ? (
            // Logged in - direct links
            <>
              {PROTECTED_NAV_LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) => `header-link ${isActive ? 'active' : ''}`}
                >
                  {l.label}
                </NavLink>
              ))}
            </>
          ) : (
            // Logged out - links with returnTo
            PROTECTED_NAV_LINKS.map((l) => (
              <Link key={l.to} to={getNavLink(l.to)} className="header-link">
                {l.label}
              </Link>
            ))
          )}

          <Link to="/cart" className="header-link">
            🛒 {totalQty > 0 ? `(${totalQty})` : ''}
          </Link>

          {user ? (
            user.account_type === 'SELLER' ? (
              <Link to="/seller/dashboard" className="header-link">
                Seller Hub ({user.first_name})
              </Link>
            ) : user.account_type === 'EMPLOYEE' ? (
              <Link to="/employee/dashboard" className="header-link">
                Workspace ({user.first_name})
              </Link>
            ) : (
              <Link to="/account" className="header-link">
                {user.first_name}
              </Link>
            )
          ) : (
            <Link to="/login" className="header-link">
              Sign in
            </Link>
          )}
        </nav>

        <button
          className="burger"
          onClick={() => setDrawer(true)}
          aria-label="Open menu"
        >
          ☰
        </button>
      </div>

      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
          <div className="drawer" role="dialog" aria-label="Menu">
            <div className="drawer-head">
              <span className="bold">BTMI Market</span>
              <button className="btn btn-ghost" style={{ color: '#fff' }} onClick={() => setDrawer(false)}>
                ✕
              </button>
            </div>
<nav className="drawer-nav" onClick={() => setDrawer(false)}>
              {PUBLIC_NAV_LINKS.map((l) => (
                <Link key={l.to} to={l.to} className="dnav-link">
                  <span className="dnav-icon">{l.icon}</span> {l.label}
                </Link>
              ))}
              {loading ? (
                PROTECTED_NAV_LINKS.map((l) => (
                  <span key={l.to} className="dnav-link loading-placeholder" aria-hidden="true">
                    <span className="dnav-icon">{l.icon}</span> {l.label}
                  </span>
                ))
              ) : user ? (
                <>
                  {PROTECTED_NAV_LINKS.map((l) => (
                    <Link key={l.to} to={l.to} className="dnav-link">
                      <span className="dnav-icon">{l.icon}</span> {l.label}
                    </Link>
                  ))}
                </>
              ) : (
                PROTECTED_NAV_LINKS.map((l) => (
                  <Link key={l.to} to={getNavLink(l.to)} className="dnav-link">
                    <span className="dnav-icon">{l.icon}</span> {l.label}
                  </Link>
                ))
              )}
              <Link to="/cart" className="dnav-link">
                <span className="dnav-icon">🛒</span> Cart{totalQty > 0 ? ` (${totalQty})` : ''}
              </Link>
              {user ? (
                user.account_type === 'SELLER' ? (
                  <Link to="/seller/dashboard" className="dnav-link">
                    <span className="dnav-icon">🏪</span> Seller Hub ({user.first_name})
                  </Link>
                ) : user.account_type === 'EMPLOYEE' ? (
                  <Link to="/employee/dashboard" className="dnav-link">
                    <span className="dnav-icon">💼</span> Workspace ({user.first_name})
                  </Link>
                ) : (
                  <Link to="/account" className="dnav-link">
                    <span className="dnav-icon">👤</span> Account
                  </Link>
                )
              ) : (
                <Link to="/login" className="dnav-link">
                  <span className="dnav-icon">🔑</span> Sign in
                </Link>
              )}
            </nav>
          </div>
        </>
      )}
    </header>
  )
}

export function MobileNav() {
  const { totalQty } = useCart()
  const { user, loading } = useAuth()
  const tabs = [
    { to: '/', label: 'Home', icon: '🏠', end: true },
    { to: '/search', label: 'Search', icon: '🔍', end: false },
  ]
  const accountTab = {
    to: user?.account_type === 'SELLER' ? '/seller/dashboard' : user?.account_type === 'EMPLOYEE' ? '/employee/dashboard' : '/account',
    label: user?.account_type === 'SELLER' ? 'Seller Hub' : user?.account_type === 'EMPLOYEE' ? 'Workspace' : 'Account',
    icon: user?.account_type === 'SELLER' ? '🏪' : user?.account_type === 'EMPLOYEE' ? '💼' : '👤',
    end: false
  }
  const protectedTabs = [
    { to: '/favorites', label: 'Favorites', icon: '❤️', end: false },
    { to: '/orders', label: 'Orders', icon: '📦', end: false },
    accountTab
  ]

  function getMobileLink(path: string) {
    if (!user) return loginWithReturnTo(path)
    return path
  }

  return (
    <nav className="mobile-nav" aria-label="Mobile">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className="mnav-link">
          <span className="mnav-icon">{t.icon}</span>
          {t.label === 'Cart' && totalQty > 0 ? `Cart (${totalQty})` : t.label}
        </NavLink>
      ))}
      {loading ? (
        protectedTabs.map((t) => (
          <span key={t.to} className="mnav-link loading-placeholder" aria-hidden="true">
            <span className="mnav-icon">{t.icon}</span> {t.label}
          </span>
        ))
      ) : user ? (
        protectedTabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="mnav-link">
            <span className="mnav-icon">{t.icon}</span> {t.label}
          </NavLink>
        ))
      ) : (
        protectedTabs.map((t) => (
          <Link key={t.to} to={getMobileLink(t.to)} className="mnav-link">
            <span className="mnav-icon">{t.icon}</span> {t.label}
          </Link>
        ))
      )}
      <Link to="/cart" className="mnav-link">
        <span className="mnav-icon">🛒</span> Cart{totalQty > 0 ? ` (${totalQty})` : ''}
      </Link>
    </nav>
  )
}
