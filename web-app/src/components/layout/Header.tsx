import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useState, type FormEvent } from 'react'
import { useAuth } from '@/store/auth'
import { useCart } from '@/store/cart'

const NAV_LINKS = [
  { to: '/', label: 'Marketplace', icon: '🏪' },
  { to: '/categories', label: 'Categories', icon: '🗂️' },
  { to: '/shops', label: 'Shops', icon: '🏬' },
  { to: '/favorites', label: 'Favorites', icon: '❤️' },
  { to: '/orders', label: 'Orders', icon: '📦' },
  { to: '/points', label: 'Points', icon: '⭐' }
]

export function Header() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { totalQty } = useCart()
  const [drawer, setDrawer] = useState(false)
  const [q, setQ] = useState('')

  function onSearch(e: FormEvent) {
    e.preventDefault()
    navigate(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search')
  }

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">B</span>
          <span>BTMI Market</span>
        </Link>

        <form className="header-search" onSubmit={onSearch} role="search">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, shops…"
            aria-label="Search"
          />
          <button type="submit">Search</button>
        </form>

        <nav className="header-nav" aria-label="Primary">
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) => `header-link ${isActive ? 'active' : ''}`}
            >
              {l.label}
            </NavLink>
          ))}
          <Link to="/cart" className="header-link">
            🛒 {totalQty > 0 ? `(${totalQty})` : ''}
          </Link>
          <Link to="/notifications" className="header-link">
            🔔
          </Link>
          {user ? (
            <Link to="/account" className="header-link">
              {user.first_name}
            </Link>
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
              {NAV_LINKS.map((l) => (
                <Link key={l.to} to={l.to}>
                  <span className="dnav-icon">{l.icon}</span> {l.label}
                </Link>
              ))}
              <Link to="/cart">
                <span className="dnav-icon">🛒</span> Cart{totalQty > 0 ? ` (${totalQty})` : ''}
              </Link>
              <Link to="/notifications">
                <span className="dnav-icon">🔔</span> Notifications
              </Link>
              {user ? (
                <Link to="/account">
                  <span className="dnav-icon">👤</span> Account
                </Link>
              ) : (
                <Link to="/login">
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
  const tabs = [
    { to: '/', label: 'Home', icon: '🏠', end: true },
    { to: '/search', label: 'Search', icon: '🔍', end: false },
    { to: '/favorites', label: 'Favorites', icon: '❤️', end: false },
    { to: '/orders', label: 'Orders', icon: '📦', end: false },
    { to: '/account', label: 'Account', icon: '👤', end: false }
  ]
  return (
    <nav className="mobile-nav" aria-label="Mobile">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end}>
          <span className="mnav-icon">{t.icon}</span>
          {t.label === 'Cart' && totalQty > 0 ? `Cart (${totalQty})` : t.label}
        </NavLink>
      ))}
    </nav>
  )
}