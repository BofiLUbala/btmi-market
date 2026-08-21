import { Outlet, useLocation, NavLink, useNavigate, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '@/store/auth'
import { shopApi } from '@/api/seller'

const SELLER_NAV = [
  { to: '/seller/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/seller/business', label: 'Business', icon: '🏢' },
  { to: '/seller/shops', label: 'Shops', icon: '🏪' },
  { to: '/seller/employees', label: 'Employees', icon: '👥' },
  { to: '/seller/products', label: 'Products', icon: '📦' },
  { to: '/seller/stock', label: 'Stock', icon: '📋' },
  { to: '/seller/orders', label: 'Orders', icon: '🧾' },
  { to: '/seller/customers', label: 'Customers', icon: '👤' },
  { to: '/seller/cash', label: 'Cash', icon: '💵' },
  { to: '/seller/growth', label: 'Growth', icon: '📈' },
  { to: '/seller/reviews', label: 'Reviews', icon: '⭐' },
  { to: '/seller/profile', label: 'Profile', icon: '⚙️' },
]

const EMPLOYEE_NAV = [
  { to: '/employee/dashboard', label: 'Dashboard', icon: '📊' },
]

export function SellerLayout() {
  const { pathname } = useLocation()
  const { user, activeBusiness, logout, accountType, activeShop, setActiveShop } = useAuth()
  const navigate = useNavigate()
  const [drawer, setDrawer] = useState(false)
  const [shopDrawer, setShopDrawer] = useState(false)
  const [shops, setShops] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    window.scrollTo({ top: 0 })
    document.body.classList.add('has-mobile-nav')
    return () => {
      document.body.classList.remove('has-mobile-nav')
    }
  }, [pathname])

  useEffect(() => {
    if (activeBusiness) {
      loadShops()
    }
  }, [activeBusiness])

  async function loadShops() {
    if (!activeBusiness) return
    try {
      const data = await shopApi.listByBusiness(activeBusiness.id)
      setShops(data.map((s) => ({ id: s.id, name: s.name })))
      if (data.length > 0 && !activeShop) {
        setActiveShop(data[0].id)
      }
    } catch {
      // ignore
    }
  }

  function handleShopChange(shopId: string) {
    setActiveShop(shopId)
    setShopDrawer(false)
  }

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  const isEmployee = accountType === 'EMPLOYEE'
  const navItems = isEmployee ? EMPLOYEE_NAV : SELLER_NAV
  const brandName = isEmployee ? 'BTMI Employee' : 'BTMI Seller'

  return (
    <>
      <header className="seller-header">
        <div className="container seller-header-inner">
          <NavLink to={isEmployee ? '/employee/dashboard' : '/seller/dashboard'} className="seller-brand">
            <span className="brand-mark">B</span>
            <span>{brandName}</span>
          </NavLink>

          <nav className="seller-nav" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === (isEmployee ? '/employee/dashboard' : '/seller/dashboard')}
                className={({ isActive }) => `seller-nav-link ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="seller-header-right">
            {activeBusiness && !isEmployee && (
              <div className="business-selector" style={{ marginRight: 16 }}>
                <span className="business-name small" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeBusiness.name}
                </span>
              </div>
            )}

            {activeShop && shops.length > 1 && !isEmployee && (
              <button className="shop-selector btn btn-secondary" onClick={() => setShopDrawer(true)} style={{ marginRight: 12 }}>
                🏪 {shops.find((s) => s.id === activeShop)?.name || 'Select Shop'}
              </button>
            )}

            <button className="btn btn-ghost" onClick={handleLogout} style={{ marginRight: 8 }}>
              Logout
            </button>

            {user && (
              <Link to={isEmployee ? '/employee/dashboard' : '/seller/profile'} className="seller-user-link">
                <span className="user-avatar">{user.first_name[0]}{user.last_name[0]}</span>
                <span className="user-name">{user.first_name} {user.last_name}</span>
              </Link>
            )}

            <button className="burger" onClick={() => setDrawer(true)} aria-label="Open menu">
              ☰
            </button>
          </div>
        </div>
      </header>

      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
          <div className="drawer seller-drawer" role="dialog" aria-label="Menu">
            <div className="drawer-head">
              <span className="bold">{brandName}</span>
              <button className="btn btn-ghost" style={{ color: '#fff' }} onClick={() => setDrawer(false)}>
                ✕
              </button>
            </div>
            <nav className="drawer-nav" onClick={() => setDrawer(false)}>
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to}>
                  <span className="dnav-icon">{item.icon}</span> {item.label}
                </NavLink>
              ))}
              <button onClick={handleLogout} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'none', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer' }}>
                🚪 Logout
              </button>
            </nav>
          </div>
        </>
      )}

      {shopDrawer && shops.length > 0 && (
        <>
          <div className="drawer-backdrop" onClick={() => setShopDrawer(false)} />
          <div className="drawer shop-drawer" role="dialog" aria-label="Select Shop" style={{ maxWidth: 320 }}>
            <div className="drawer-head">
              <span className="bold">Select Shop</span>
              <button className="btn btn-ghost" style={{ color: '#fff' }} onClick={() => setShopDrawer(false)}>
                ✕
              </button>
            </div>
            <div className="shop-list" style={{ padding: 16 }}>
              {shops.map((shop) => (
                <button
                  key={shop.id}
                  className={`shop-item ${shop.id === activeShop ? 'active' : ''}`}
                  onClick={() => handleShopChange(shop.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    background: shop.id === activeShop ? 'var(--primary-bg)' : 'transparent',
                    color: shop.id === activeShop ? 'var(--primary)' : 'var(--text)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 16,
                    textAlign: 'left',
                    marginBottom: 8,
                  }}
                >
                  <span>🏪 {shop.name}</span>
                  {shop.id === activeShop && <span className="badge badge-primary">Active</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <main className="page fade-in">
        <div className="container">
          <Outlet />
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div>
              <h4>BTMI Market</h4>
              <p className="small">
                Seller platform for managing your business across DRC. Cash on delivery. Earn trust with every verified sale.
              </p>
            </div>
            <div>
              <h4>Seller Tools</h4>
              <p className="small stack" style={{ gap: 4 }}>
                <Link to="/seller/dashboard">Dashboard</Link>
                <Link to="/seller/products">Products</Link>
                <Link to="/seller/orders">Orders</Link>
                <Link to="/seller/growth">Growth</Link>
              </p>
            </div>
            <div>
              <h4>Support</h4>
              <p className="small stack" style={{ gap: 4 }}>
                <Link to="/seller/profile">Account Settings</Link>
                <Link to="/">Marketplace</Link>
              </p>
            </div>
          </div>
          <div className="footer-bottom">
            © {new Date().getFullYear()} BTMI Market. Payments are cash-only (FC).
          </div>
        </div>
      </footer>
    </>
  )
}