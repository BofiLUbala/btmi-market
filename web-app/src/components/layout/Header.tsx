import { Link, NavLink } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '@/store/auth'
import { useCart } from '@/store/cart'
import { useI18n } from '@/store/i18n'
import { loginWithReturnTo } from '@/lib/returnTo'
import { SearchAutocomplete } from '@/components/search/SearchAutocomplete'
import { PreferenceToggles } from '@/components/ui/PreferenceToggles'
import type { User } from '@/api/types'
import type { TranslationKey } from '@/locales/fr'

function HeaderAvatar({ user }: { user: User }) {
  if (!user.avatar_url) return null
  return <img src={user.avatar_url} alt="" className="header-avatar" />
}

const PUBLIC_NAV_LINKS: { to: string; key: TranslationKey; icon: string }[] = [
  { to: '/', key: 'nav.marketplace', icon: '🏪' },
  { to: '/categories', key: 'nav.categories', icon: '🗂️' },
  { to: '/shops', key: 'nav.shops', icon: '🏬' },
]

const PROTECTED_NAV_LINKS: { to: string; key: TranslationKey; icon: string }[] = [
  { to: '/favorites', key: 'nav.favorites', icon: '❤️' },
]

export function Header() {
  const { user, loading } = useAuth()
  const { totalQty } = useCart()
  const { t } = useI18n()
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
        <Link to="/" className="brand" aria-label="TBK — accueil">
          <span className="brand-mark" aria-hidden="true">TBK</span>
        </Link>

        <SearchAutocomplete variant="header" />

        <nav className="header-nav" aria-label={t('nav.primary')}>
          {PUBLIC_NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) => `header-link ${isActive ? 'active' : ''}`}
            >
              {t(l.key)}
            </NavLink>
          ))}

          {loading ? (
            // Show loading placeholders for protected links while auth restores
            PROTECTED_NAV_LINKS.map((l) => (
              <span key={l.to} className="header-link loading-placeholder" aria-hidden="true">
                {t(l.key)}
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
                  {t(l.key)}
                </NavLink>
              ))}
            </>
          ) : (
            // Logged out - links with returnTo
            PROTECTED_NAV_LINKS.map((l) => (
              <Link key={l.to} to={getNavLink(l.to)} className="header-link">
                {t(l.key)}
              </Link>
            ))
          )}

          <Link to="/cart" className="header-link" aria-label={t('nav.cart')}>
            🛒 {totalQty > 0 ? `(${totalQty})` : ''}
          </Link>

          <PreferenceToggles />

          {user ? (
            user.account_type === 'SELLER' ? (
              <Link to="/seller/dashboard" className="header-link header-link-user">
                {user.avatar_url ? <HeaderAvatar user={user} /> : `${t('nav.sellerHub')} (${user.first_name})`}
              </Link>
            ) : user.account_type === 'EMPLOYEE' ? (
              <Link to="/employee/dashboard" className="header-link header-link-user">
                {user.avatar_url ? <HeaderAvatar user={user} /> : `${t('nav.workspace')} (${user.first_name})`}
              </Link>
            ) : (
              <Link to="/account" className="header-link header-link-user">
                {user.avatar_url ? <HeaderAvatar user={user} /> : user.first_name}
              </Link>
            )
          ) : (
            <Link to="/login" className="header-link">
              {t('common.signIn')}
            </Link>
          )}
        </nav>

        <button
          className="burger"
          onClick={() => setDrawer(true)}
          aria-label={t('nav.openMenu')}
        >
          ☰
        </button>
      </div>

      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
          <div className="drawer" role="dialog" aria-label={t('nav.openMenu')}>
            <div className="drawer-head">
              <span className="bold">TBK</span>
              <button
                className="btn btn-ghost"
                style={{ color: 'var(--color-on-primary)' }}
                onClick={() => setDrawer(false)}
                aria-label={t('nav.closeMenu')}
              >
                ✕
              </button>
            </div>
<nav className="drawer-nav" onClick={() => setDrawer(false)}>
              {PUBLIC_NAV_LINKS.map((l) => (
                <Link key={l.to} to={l.to} className="dnav-link">
                  <span className="dnav-icon">{l.icon}</span> {t(l.key)}
                </Link>
              ))}
              {loading ? (
                PROTECTED_NAV_LINKS.map((l) => (
                  <span key={l.to} className="dnav-link loading-placeholder" aria-hidden="true">
                    <span className="dnav-icon">{l.icon}</span> {t(l.key)}
                  </span>
                ))
              ) : user ? (
                <>
                  {PROTECTED_NAV_LINKS.map((l) => (
                    <Link key={l.to} to={l.to} className="dnav-link">
                      <span className="dnav-icon">{l.icon}</span> {t(l.key)}
                    </Link>
                  ))}
                </>
              ) : (
                PROTECTED_NAV_LINKS.map((l) => (
                  <Link key={l.to} to={getNavLink(l.to)} className="dnav-link">
                    <span className="dnav-icon">{l.icon}</span> {t(l.key)}
                  </Link>
                ))
              )}
              <Link to="/cart" className="dnav-link">
                <span className="dnav-icon">🛒</span> {t('nav.cart')}{totalQty > 0 ? ` (${totalQty})` : ''}
              </Link>
              {user ? (
                user.account_type === 'SELLER' ? (
                  <Link to="/seller/dashboard" className="dnav-link">
                    {user.avatar_url ? <HeaderAvatar user={user} /> : `${t('nav.sellerHub')} (${user.first_name})`}
                  </Link>
                ) : user.account_type === 'EMPLOYEE' ? (
                  <Link to="/employee/dashboard" className="dnav-link">
                    {user.avatar_url ? <HeaderAvatar user={user} /> : `${t('nav.workspace')} (${user.first_name})`}
                  </Link>
                ) : (
                  <Link to="/account" className="dnav-link">
                    {user.avatar_url ? <HeaderAvatar user={user} /> : t('nav.account')}
                  </Link>
                )
              ) : (
                <Link to="/login" className="dnav-link">
                  <span className="dnav-icon">🔑</span> {t('common.signIn')}
                </Link>
              )}
              <div className="drawer-prefs">
                <PreferenceToggles />
              </div>
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
  const { t } = useI18n()

  const tabs = [
    { to: '/', label: t('nav.home'), icon: '🏠', end: true },
    { to: '/search', label: t('nav.search'), icon: '🔍', end: false },
  ]
  const accountTab = {
    to: user?.account_type === 'SELLER' ? '/seller/dashboard' : user?.account_type === 'EMPLOYEE' ? '/employee/dashboard' : '/account',
    label: user?.account_type === 'SELLER' ? t('nav.sellerHub') : user?.account_type === 'EMPLOYEE' ? t('nav.workspace') : t('nav.account'),
    icon: user?.account_type === 'SELLER' ? '🏪' : user?.account_type === 'EMPLOYEE' ? '💼' : '👤',
    end: false
  }
  const protectedTabs = [
    { to: '/favorites', label: t('nav.favorites'), icon: '❤️', end: false },
    accountTab
  ]

  function getMobileLink(path: string) {
    if (!user) return loginWithReturnTo(path)
    return path
  }

  return (
    <nav className="mobile-nav" aria-label={t('nav.mobile')}>
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className="mnav-link">
          <span className="mnav-icon">{tab.icon}</span>
          {tab.label}
        </NavLink>
      ))}
      {loading ? (
        protectedTabs.map((tab) => (
          <span key={tab.to} className="mnav-link loading-placeholder" aria-hidden="true">
            <span className="mnav-icon">{tab.icon}</span> {tab.label}
          </span>
        ))
      ) : user ? (
        protectedTabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className="mnav-link">
            <span className="mnav-icon">{tab.icon}</span> {tab.label}
          </NavLink>
        ))
      ) : (
        protectedTabs.map((tab) => (
          <Link key={tab.to} to={getMobileLink(tab.to)} className="mnav-link">
            <span className="mnav-icon">{tab.icon}</span> {tab.label}
          </Link>
        ))
      )}
      <Link to="/cart" className="mnav-link">
        <span className="mnav-icon">🛒</span> {t('nav.cart')}{totalQty > 0 ? ` (${totalQty})` : ''}
      </Link>
    </nav>
  )
}
