import { Link, Outlet } from 'react-router-dom'

export function SellerPublicLayout() {
  return (
    <div className="seller-public-shell">
      <header className="seller-public-header">
        <div className="container seller-public-header-inner">
          <Link to="/seller" className="seller-public-brand" aria-label="TBK Seller home">
            <span className="brand-mark" aria-hidden="true">TBK</span>
            <span>TBK Seller</span>
          </Link>
          <Link to="/" className="seller-public-marketplace">Marketplace</Link>
        </div>
      </header>
      <main className="seller-public-main">
        <div className="container"><Outlet /></div>
      </main>
    </div>
  )
}
