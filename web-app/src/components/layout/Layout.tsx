import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Header, MobileNav } from './Header'
import { useI18n } from '@/store/i18n'

function Footer() {
  const { t } = useI18n()
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div>
            <h4>TBK</h4>
            <p className="small">{t('footer.tagline')}</p>
          </div>
          <div>
            <h4>{t('nav.marketplace')}</h4>
            <p className="small stack" style={{ gap: 4 }}>
              <Link to="/categories">{t('nav.categories')}</Link>
              <Link to="/shops">{t('nav.shops')}</Link>
              <Link to="/search">{t('nav.search')}</Link>
            </p>
          </div>
          <div>
            <h4>{t('footer.yourAccount')}</h4>
            <p className="small stack" style={{ gap: 4 }}>
              <Link to="/account">{t('nav.profile')}</Link>
            </p>
          </div>
          <div>
            <h4>{t('footer.sellWithUs')}</h4>
            <p className="small stack" style={{ gap: 4 }}>
              <Link to="/seller">{t('footer.sellerSpace')}</Link>
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          {t('footer.legal', { year: new Date().getFullYear() })}
        </div>
      </div>
    </footer>
  )
}

export function Layout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const focusedCheckout = pathname.startsWith('/checkout/')
  useEffect(() => {
    window.scrollTo({ top: 0 })
    document.body.classList.toggle('has-mobile-nav', !focusedCheckout)
    document.body.classList.toggle('checkout-focused', focusedCheckout)
    return () => {
      document.body.classList.remove('has-mobile-nav')
      document.body.classList.remove('checkout-focused')
    }
  }, [pathname, focusedCheckout])

  if (focusedCheckout) {
    return (
      <div className="checkout-shell">
        <header className="checkout-shell-header">
          <button type="button" onClick={() => navigate(-1)} aria-label="Retour">←</button>
          <strong>Checkout</strong>
          <span aria-hidden>TBK</span>
        </header>
        <main className="checkout-shell-main"><div className="container"><Outlet /></div></main>
      </div>
    )
  }

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
