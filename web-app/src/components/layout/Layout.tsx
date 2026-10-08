import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Header, MobileNav } from './Header'
import { useI18n } from '@/store/i18n'
import { PlatformBanner } from '@/lib/platformState'

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
  const { t } = useI18n()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const focusedCheckout = pathname.startsWith('/checkout/')
  /**
   * A courier signing in or recovering a password is not shopping: the buyer
   * footer and tab bar (Marketplace, Favourites, Cart) do not belong on their
   * screens. Those screens sit under the shared Layout, so the chrome is
   * dropped here rather than repainted.
   */
  const courierSpace =
    pathname.startsWith('/courier') ||
    pathname.startsWith('/livreur') ||
    new URLSearchParams(search).get('account') === 'courier'
  useEffect(() => {
    window.scrollTo({ top: 0 })
    // No tab bar on courier screens, so no space reserved for one either.
    document.body.classList.toggle('has-mobile-nav', !focusedCheckout && !courierSpace)
    document.body.classList.toggle('checkout-focused', focusedCheckout)
    return () => {
      document.body.classList.remove('has-mobile-nav')
      document.body.classList.remove('checkout-focused')
    }
  }, [pathname, focusedCheckout, courierSpace])

  if (focusedCheckout) {
    return (
      <div className="checkout-shell">
        <header className="checkout-shell-header">
          <button type="button" onClick={() => navigate(-1)} aria-label={t('common.back')}>←</button>
          <strong>{t('checkout.shellTitle')}</strong>
          <span aria-hidden>TBK</span>
        </header>
        <main className="checkout-shell-main"><div className="container"><PlatformBanner audience="BUYERS" /><Outlet /></div></main>
      </div>
    )
  }

  return (
    <>
      <Header />
      <main className="page fade-in">
        <div className="container">
          <PlatformBanner audience="BUYERS" />
          <Outlet />
        </div>
      </main>
      {!courierSpace && <Footer />}
      {!courierSpace && <MobileNav />}
    </>
  )
}
