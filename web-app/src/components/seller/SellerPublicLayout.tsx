import { Link, Outlet } from 'react-router-dom'
import { useI18n } from '@/store/i18n'
import { PreferenceToggles } from '@/components/ui/PreferenceToggles'

export function SellerPublicLayout() {
  const { t } = useI18n()
  return (
    <div className="seller-public-shell">
      <header className="seller-public-header">
        <div className="container seller-public-header-inner">
          <Link to="/seller" className="seller-public-brand" aria-label={t('seller.publicBrandAria')}>
            <span className="brand-mark" aria-hidden="true">TBK</span>
            <span>TBK Seller</span>
          </Link>
          <span className="seller-public-actions">
            <PreferenceToggles />
            <Link to="/" className="seller-public-marketplace">{t('nav.marketplace')}</Link>
          </span>
        </div>
      </header>
      <main className="seller-public-main">
        <div className="container"><Outlet /></div>
      </main>
    </div>
  )
}
