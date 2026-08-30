import { Link } from 'react-router-dom'
import { BoxIcon, CustomerIcon, OrdersIcon, StockIcon, StoreIcon, UsersIcon } from '@/components/ui/Icons'
import { useI18n } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

const features: { key: TranslationKey; Icon: typeof StoreIcon }[] = [
  { key: 'seller.entry.manageShops', Icon: StoreIcon },
  { key: 'seller.entry.manageProducts', Icon: BoxIcon },
  { key: 'seller.entry.trackStock', Icon: StockIcon },
  { key: 'seller.entry.processOrders', Icon: OrdersIcon },
  { key: 'seller.entry.manageEmployees', Icon: UsersIcon },
  { key: 'seller.entry.trackCustomers', Icon: CustomerIcon },
]

export default function SellerEntryPage() {
  const { t } = useI18n()

  return (
    <div className="fade-in seller-entry">
      <div className="seller-entry-card card">
        <h1>{t('seller.entry.title')}</h1>

        <p className="seller-entry-tagline">{t('seller.entry.tagline')}</p>

        <ul className="seller-entry-features">
          {features.map(({ key, Icon }) => (
            <li key={key}>
              <Icon />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>

        <div className="seller-entry-actions">
          <Link to="/seller/login" className="btn btn-primary btn-lg btn-block">
            {t('common.signIn')}
          </Link>

          <Link to="/seller/register" className="btn btn-outline btn-lg btn-block">
            {t('seller.entry.createAccount')}
          </Link>
        </div>

        <Link to="/" className="seller-entry-back section-link">
          {t('seller.entry.backToMarketplace')}
        </Link>
      </div>
    </div>
  )
}
