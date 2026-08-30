import { Link, Outlet, useLocation } from 'react-router-dom'
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
