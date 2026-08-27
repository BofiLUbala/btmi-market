import { Link, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Header, MobileNav } from './Header'

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div>
            <h4>TBK</h4>
            <p className="small">
              Buy from trusted shops across the DRC. Cash on delivery. Earn points on every verified purchase.
            </p>
          </div>
          <div>
            <h4>Marketplace</h4>
            <p className="small stack" style={{ gap: 4 }}>
              <Link to="/categories">Categories</Link>
              <Link to="/shops">Shops</Link>
              <Link to="/search">Search</Link>
            </p>
          </div>
          <div>
            <h4>Your account</h4>
            <p className="small stack" style={{ gap: 4 }}>
              <Link to="/account">Profile</Link>
            </p>
          </div>
          <div>
            <h4>Vends tes produits avec nous</h4>
            <p className="small stack" style={{ gap: 4 }}>
              <Link to="/seller">Espace vendeur</Link>
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          © {new Date().getFullYear()} TBK. Payments are cash-only (FC). Prices shown are set by sellers.
        </div>
      </div>
    </footer>
  )
}

export function Layout() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
    document.body.classList.add('has-mobile-nav')
    return () => {
      document.body.classList.remove('has-mobile-nav')
    }
  }, [pathname])

  return (
    <>
      <Header />
      <main className="page fade-in">
        <div className="container">
          <Outlet />
        </div>
      </main>
      <Footer />
      <MobileNav />
    </>
  )
}
