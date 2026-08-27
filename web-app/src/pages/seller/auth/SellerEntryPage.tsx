import { Link } from 'react-router-dom'
import { BoxIcon, CustomerIcon, OrdersIcon, StockIcon, StoreIcon, UsersIcon } from '@/components/ui/Icons'

const features = [
  { label: 'Gérez vos boutiques', Icon: StoreIcon },
  { label: 'Gérez vos produits', Icon: BoxIcon },
  { label: 'Suivez votre stock', Icon: StockIcon },
  { label: 'Traitez vos commandes', Icon: OrdersIcon },
  { label: 'Gérez vos employés', Icon: UsersIcon },
  { label: 'Suivez vos clients', Icon: CustomerIcon },
]

export default function SellerEntryPage() {
  return (
    <div className="fade-in seller-entry">
      <div className="seller-entry-card card">
        <h1>Développez votre commerce avec TBK</h1>

        <p className="seller-entry-tagline">
          Vendez et gérez votre commerce sur TBK
        </p>

        <ul className="seller-entry-features">
          {features.map(({ label, Icon }) => <li key={label}><Icon /><span>{label}</span></li>)}
        </ul>

        <div className="seller-entry-actions">
          <Link to="/seller/login" className="btn btn-primary btn-lg btn-block">
            Se connecter
          </Link>

          <Link to="/seller/register" className="btn btn-outline btn-lg btn-block">
            Créer un compte vendeur
          </Link>
        </div>

        <Link to="/" className="seller-entry-back section-link">
          ← Retour au Marketplace
        </Link>
      </div>
    </div>
  )
}
