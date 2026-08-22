import { Outlet, useLocation, NavLink, useNavigate, Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/store/auth'
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
  StockIcon,
  StoreIcon,
  UsersIcon,
  ChevronDownIcon,
  CheckIcon,
} from '@/components/ui/Icons'

const SELLER_NAV = [
  { to: '/seller/dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { to: '/seller/business', label: 'Business', Icon: BusinessIcon },
  { to: '/seller/shops', label: 'Shops', Icon: StoreIcon },
  { to: '/seller/employees', label: 'Employees', Icon: UsersIcon },
  { to: '/seller/products', label: 'Products', Icon: BoxIcon },
  { to: '/seller/stock', label: 'Stock', Icon: StockIcon },
  { to: '/seller/orders', label: 'Orders', Icon: OrdersIcon },
  { to: '/seller/customers', label: 'Customers', Icon: CustomerIcon },
  { to: '/seller/cash', label: 'Cash', Icon: CashIcon },
  { to: '/seller/growth', label: 'Growth', Icon: GrowthIcon },
  { to: '/seller/reviews', label: 'Reviews', Icon: ReviewIcon },
]

const EMPLOYEE_NAV = [
  { to: '/employee/dashboard', label: 'Dashboard', Icon: DashboardIcon },
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
  const brandName = isEmployee ? 'BTMI Employee' : 'BTMI Seller'
  const bizList = Array.isArray(sellerBusinesses) ? sellerBusinesses : []
  const shopList = Array.isArray(shops) ? shops : []

  return (
    <div className="seller-workspace-shell">
      {/* ── Left Desktop Sidebar ── */}
      <aside className="seller-sidebar">
        <div className="seller-sidebar-brand">
          <Link to={isEmployee ? '/employee/dashboard' : '/seller/dashboard'} className="seller-brand-link">
            <span className="brand-mark">B</span>
            <div className="brand-copy">
              <span className="brand-title">{brandName}</span>
              <span className="brand-sub">Workspace</span>
            </div>
          </Link>
        </div>

        <nav className="seller-sidebar-nav" aria-label="Seller Navigation">
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
                <span className="seller-sidebar-label">{item.label}</span>
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
                <span className="seller-sidebar-label">Profile</span>
              </NavLink>
            )}

            <button type="button" className="seller-sidebar-link seller-logout-btn" onClick={handleLogout}>
              <span className="seller-sidebar-icon">
                <LogoutIcon />
              </span>
              <span className="seller-sidebar-label">Logout</span>
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
              aria-label="Open navigation menu"
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
                    {activeBusiness ? activeBusiness.name : 'No Business Selected'}
                  </span>
                  {bizList.length > 1 && <ChevronDownIcon />}
                </button>

                {bizDropdown && (
                  <div className="seller-dropdown-menu">
                    <div className="dropdown-header">Select Business</div>
                    {bizList.length === 0 ? (
                      <div className="dropdown-empty">
                        <p className="small muted">No businesses found.</p>
                        <Link to="/seller/onboarding" className="dropdown-action-link" onClick={() => setBizDropdown(false)}>
                          + Create Business
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
                          + Add New Business
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
                    {shopList.find((s) => s.id === activeShop)?.name || 'All Shops'}
                  </span>
                  {shopList.length > 1 && <ChevronDownIcon />}
                </button>

                {shopDropdown && shopList.length > 1 && (
                  <div className="seller-dropdown-menu">
                    <div className="dropdown-header">Select Active Shop</div>
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
              Marketplace
            </Link>

            {user && (
              <Link to={isEmployee ? '/employee/dashboard' : '/seller/profile'} className="seller-user-badge">
                <span className="user-initials">
                  {(user.first_name?.[0] || 'S') + (user.last_name?.[0] || 'B')}
                </span>
                <span className="user-full-name">
                  {user.first_name} {user.last_name}
                </span>
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
          <div className="drawer seller-drawer" role="dialog" aria-label="Seller Menu">
            <div className="drawer-head">
              <span className="bold">{brandName}</span>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ color: '#fff' }}
                onClick={() => setDrawer(false)}
                aria-label="Close menu"
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
                  {item.label}
                </NavLink>
              ))}

              {!isEmployee && (
                <NavLink to="/seller/profile" onClick={() => setDrawer(false)}>
                  <span className="dnav-icon"><SettingsIcon /></span>
                  Profile
                </NavLink>
              )}

              <div style={{ height: 1, background: 'var(--color-border)', margin: '8px 0' }} />

              <NavLink to="/" onClick={() => setDrawer(false)}>
                Marketplace
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
                Logout
              </button>
            </nav>
          </div>
        </>
      )}
    </div>
  )
}
