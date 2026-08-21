import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Header, MobileNav } from './Header'

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div>
            <h4>BTMI Market</h4>
            <p className="small">
              Buy from trusted shops across the DRC. Cash on delivery. Earn points on every verified purchase.
            </p>
          </div>
          <div>
            <h4>Marketplace</h4>
            <p className="small stack" style={{ gap: 4 }}>
              <a href="/categories">Categories</a>
              <a href="/shops">Shops</a>
              <a href="/search">Search</a>
            </p>
          </div>
          <div>
            <h4>Your account</h4>
            <p className="small stack" style={{ gap: 4 }}>
              <a href="/orders">Orders</a>
              <a href="/points">Points</a>
              <a href="/account">Profile</a>
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          © {new Date().getFullYear()} BTMI Market. Payments are cash-only (FC). Prices shown are set by sellers.
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