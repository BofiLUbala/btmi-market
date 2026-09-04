import { Outlet, useLocation, NavLink, useNavigate, Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/store/auth'
import { useI18n } from '@/store/i18n'
import { PreferenceToggles } from '@/components/ui/PreferenceToggles'
import type { TranslationKey } from '@/locales/fr'
import { shopApi } from '@/api/seller'
import {
  BoxIcon,
  BusinessIcon,
  CashIcon,
  CloseIcon,
  CustomerIcon,
  DashboardIcon,
  GrowthIcon,
  LogoutIcon,
  MenuIcon,
  OrdersIcon,
  ReviewIcon,
  SettingsIcon,
  ShieldCheckIcon,
  StockIcon,
  StoreIcon,
  UsersIcon,
  ChevronDownIcon,
  CheckIcon,
} from '@/components/ui/Icons'

const SELLER_NAV: { to: string; key: TranslationKey; Icon: typeof DashboardIcon }[] = [
  { to: '/seller/dashboard', key: 'seller.dashboard', Icon: DashboardIcon },
  { to: '/seller/business', key: 'seller.business', Icon: BusinessIcon },
  { to: '/seller/shops', key: 'seller.shops', Icon: StoreIcon },
  { to: '/seller/employees', key: 'seller.employees', Icon: UsersIcon },
  { to: '/seller/products', key: 'seller.products', Icon: BoxIcon },
  { to: '/seller/stock', key: 'seller.stock', Icon: StockIcon },
  { to: '/seller/orders', key: 'seller.orders', Icon: OrdersIcon },
  { to: '/seller/customers', key: 'seller.customers', Icon: CustomerIcon },
  { to: '/seller/cash', key: 'seller.cash', Icon: CashIcon },
  { to: '/seller/growth', key: 'seller.growth', Icon: GrowthIcon },
  { to: '/seller/reviews', key: 'seller.reviews', Icon: ReviewIcon },
]

const EMPLOYEE_NAV: { to: string; key: TranslationKey; Icon: typeof DashboardIcon }[] = [
  { to: '/employee/dashboard', key: 'seller.dashboard', Icon: DashboardIcon },
]

export function SellerLayout() {
  const { pathname } = useLocation()
  const {
    user,
    activeBusiness,
    sellerBusinesses,
    setActiveBusiness,
    logout,
    accountType,
    activeShop,
    setActiveShop,
  } = useAuth()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [drawer, setDrawer] = useState(false)
  const [bizDropdown, setBizDropdown] = useState(false)
  const [shopDropdown, setShopDropdown] = useState(false)
  const [shops, setShops] = useState<Array<{ id: string; name: string }>>([])
  const bizRef = useRef<HTMLDivElement>(null)
  const shopRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.scrollTo({ top: 0 })
    setDrawer(false)
    setBizDropdown(false)
    setShopDropdown(false)
  }, [pathname])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bizRef.current && !bizRef.current.contains(e.target as Node)) {
        setBizDropdown(false)
      }
      if (shopRef.current && !shopRef.current.contains(e.target as Node)) {
        setShopDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (activeBusiness) {
      loadShops()
    } else {
      setShops([])
      setActiveShop(null)
    }
  }, [activeBusiness?.id])

  async function loadShops() {
    if (!activeBusiness) return
    try {
      const data = await shopApi.listByBusiness(activeBusiness.id)
      const list = Array.isArray(data) ? data : []
      setShops(list.map((s) => ({ id: s.id, name: s.name })))
      if (list.length > 0) {
        if (!activeShop || !list.some((s) => s.id === activeShop)) {
          setActiveShop(list[0].id)
        }
      } else {
        setActiveShop(null)
      }
    } catch {
      setShops([])
      setActiveShop(null)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/seller/login')
  }

  const isEmployee = accountType === 'EMPLOYEE'
  const navItems = isEmployee ? EMPLOYEE_NAV : SELLER_NAV
  const brandName = isEmployee ? 'TBK Employee' : 'TBK Seller'
  const bizList = Array.isArray(sellerBusinesses) ? sellerBusinesses : []
  const shopList = Array.isArray(shops) ? shops : []

  return (
    <div className="seller-workspace-shell">
      {/* ── Left Desktop Sidebar ── */}
      <aside className="seller-sidebar">
        <div className="seller-sidebar-brand">
          <Link to={isEmployee ? '/employee/dashboard' : '/seller/dashboard'} className="seller-brand-link">
            <span className="brand-mark">TBK</span>
            <div className="brand-copy">
              <span className="brand-title">{brandName}</span>
              <span className="brand-sub">{t('seller.workspace')}</span>
            </div>
          </Link>
        </div>

        <nav className="seller-sidebar-nav" aria-label={t('seller.navigation')}>
          <div className="seller-nav-group">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === (isEmployee ? '/employee/dashboard' : '/seller/dashboard')}
                className={({ isActive }) => `seller-sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span className="seller-sidebar-icon">
                  <item.Icon />
                </span>
                <span className="seller-sidebar-label">{t(item.key)}</span>
              </NavLink>
            ))}
          </div>

          <div className="seller-sidebar-bottom">
            {!isEmployee && (
              <NavLink
                to="/seller/profile"
                className={({ isActive }) => `seller-sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span className="seller-sidebar-icon">
                  <SettingsIcon />
                </span>
                <span className="seller-sidebar-label">{t('seller.profile')}</span>
              </NavLink>
            )}

            {!isEmployee && (
              <NavLink
                to="/seller/politique"
                className={({ isActive }) => `seller-sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span className="seller-sidebar-icon">
                  <ShieldCheckIcon />
                </span>
                <span className="seller-sidebar-label">{t('seller.policy.navLabel')}</span>
              </NavLink>
            )}

            <button type="button" className="seller-sidebar-link seller-logout-btn" onClick={handleLogout}>
              <span className="seller-sidebar-icon">
                <LogoutIcon />
              </span>
              <span className="seller-sidebar-label">{t('common.signOut')}</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* ── Main App Content Column ── */}
      <div className="seller-main-wrapper">
        {/* Top Header */}
        <header className="seller-top-header">
          <div className="seller-header-left">
            <button
              type="button"
              className="seller-mobile-toggle"
              onClick={() => setDrawer(true)}
              aria-label={t('nav.openMenu')}
            >
              <MenuIcon />
            </button>

            {/* Business Context Switcher */}
            {!isEmployee && (
              <div className="seller-context-item" ref={bizRef}>
                <button
                  type="button"
                  className={`seller-context-btn ${activeBusiness ? 'has-biz' : 'no-biz'}`}
                  onClick={() => setBizDropdown(!bizDropdown)}
                  aria-expanded={bizDropdown}
                >
                  <BusinessIcon />
                  <span className="context-label">
                    {activeBusiness ? activeBusiness.name : t('seller.noBusinessSelected')}
                  </span>
                  {bizList.length > 1 && <ChevronDownIcon />}
                </button>

                {bizDropdown && (
                  <div className="seller-dropdown-menu">
                    <div className="dropdown-header">{t('seller.currentBusiness')}</div>
                    {bizList.length === 0 ? (
                      <div className="dropdown-empty">
                        <p className="small muted">{t('seller.noBusinessesFound')}</p>
                        <Link to="/seller/onboarding" className="dropdown-action-link" onClick={() => setBizDropdown(false)}>
                          {t('seller.createBusiness')}
                        </Link>
                      </div>
                    ) : (
                      <>
                        {bizList.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            className={`dropdown-item ${activeBusiness?.id === b.id ? 'active' : ''}`}
                            onClick={() => {
                              setActiveBusiness(b)
                              setBizDropdown(false)
                            }}
                          >
                            <span>{b.name}</span>
                            {activeBusiness?.id === b.id && <CheckIcon />}
                          </button>
                        ))}
                        <div className="dropdown-divider" />
                        <Link to="/seller/onboarding" className="dropdown-action-item" onClick={() => setBizDropdown(false)}>
                          {t('seller.addNewBusiness')}
                        </Link>
                        <Link to="/seller/business" className="dropdown-action-item" onClick={() => setBizDropdown(false)}>
                          {t('seller.manageBusiness')}
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Shop Selector Dropdown */}
            {!isEmployee && activeBusiness && shopList.length > 0 && (
              <div className="seller-context-item" ref={shopRef}>
                <button
                  type="button"
                  className="seller-context-btn"
                  onClick={() => setShopDropdown(!shopDropdown)}
                  aria-expanded={shopDropdown}
                >
                  <StoreIcon />
                  <span className="context-label">
                    {shopList.find((s) => s.id === activeShop)?.name || t('seller.allShops')}
                  </span>
                  {shopList.length > 1 && <ChevronDownIcon />}
                </button>

                {shopDropdown && shopList.length > 1 && (
                  <div className="seller-dropdown-menu">
                    <div className="dropdown-header">{t('seller.selectActiveShop')}</div>
                    {shopList.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`dropdown-item ${activeShop === s.id ? 'active' : ''}`}
                        onClick={() => {
                          setActiveShop(s.id)
                          setShopDropdown(false)
                        }}
                      >
                        <span>{s.name}</span>
                        {activeShop === s.id && <CheckIcon />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="seller-header-right">
            <Link to="/" className="seller-marketplace-link">
              {t('nav.marketplace')}
            </Link>

            <PreferenceToggles />

            {user && (
              <Link to={isEmployee ? '/employee/dashboard' : '/seller/profile'} className="seller-user-badge">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="user-initials user-avatar-img" />
                ) : (
                  <span className="user-full-name">
                    {user.first_name} {user.last_name}
                  </span>
                )}
              </Link>
            )}
          </div>
        </header>

        {/* ── Main Scrollable Page Area ── */}
        <main className="seller-content-area">
          <div className="seller-content-container">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Mobile Navigation Drawer ── */}
      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
          <div className="drawer seller-drawer" role="dialog" aria-label={t('seller.menu')}>
            <div className="drawer-head">
              <span className="bold">{brandName}</span>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ color: '#fff' }}
                onClick={() => setDrawer(false)}
                aria-label={t('nav.closeMenu')}
              >
                <CloseIcon />
              </button>
            </div>
            <nav className="drawer-nav">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === (isEmployee ? '/employee/dashboard' : '/seller/dashboard')}
                  onClick={() => setDrawer(false)}
                >
                  <span className="dnav-icon"><item.Icon /></span>
                  {t(item.key)}
                </NavLink>
              ))}

              {!isEmployee && (
                <NavLink to="/seller/profile" onClick={() => setDrawer(false)}>
                  <span className="dnav-icon"><SettingsIcon /></span>
                  {t('seller.profile')}
                </NavLink>
              )}

              {!isEmployee && (
                <NavLink to="/seller/politique" onClick={() => setDrawer(false)}>
                  <span className="dnav-icon"><ShieldCheckIcon /></span>
                  {t('seller.policy.navLabel')}
                </NavLink>
              )}

              <div style={{ height: 1, background: 'var(--color-border)', margin: '8px 0' }} />

              <NavLink to="/" onClick={() => setDrawer(false)}>
                {t('nav.marketplace')}
              </NavLink>

              <button
                type="button"
                onClick={() => {
                  setDrawer(false)
                  handleLogout()
                }}
                className="drawer-logout-btn"
              >
                <span className="dnav-icon"><LogoutIcon /></span>
                {t('common.signOut')}
              </button>
            </nav>
          </div>
        </>
      )}
    </div>
  )
}
